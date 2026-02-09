using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Backend.Data;
using Backend.DTOs;
using Backend.Models.Payments;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Backend.Helpers;
using Backend.Models;
using System.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;
using System.ComponentModel.DataAnnotations;

namespace Backend.Controllers.Payments
{
    /// <summary>
    /// Payment gateway controller for processing ZainCash, ZainCashV2, QICard, and Switch payments
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/payments")]
    [EnableRateLimiting("fixed")]
    [Produces("application/json")]
    public class PaymentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly MasterDbContext _masterContext;
        private readonly ILogger<PaymentsController> _logger;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private static readonly ActivitySource ActivitySource = new("OpenRadius.Payments");

        // ZainCashV2 OAuth2 token cache (key: clientId, value: (token, expiresAt))
        private static readonly Dictionary<string, (string token, DateTime expiresAt)> _zainCashV2TokenCache = new();
        private static readonly SemaphoreSlim _zainCashV2TokenLock = new(1, 1);

        public PaymentsController(
            ApplicationDbContext context,
            MasterDbContext masterContext,
            ILogger<PaymentsController> logger,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _masterContext = masterContext ?? throw new ArgumentNullException(nameof(masterContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        }

        /// <summary>
        /// Initiates a payment transaction with the selected gateway
        /// </summary>
        /// <param name="dto">Payment initiation details including gateway, amount, and currency</param>
        /// <returns>Payment URL and transaction ID for tracking</returns>
        /// <response code="200">Payment initiated successfully</response>
        /// <response code="400">Invalid request or missing configuration</response>
        /// <response code="429">Rate limit exceeded</response>
        /// <response code="500">Internal server error</response>
        [HttpPost("initiate")]
        [ProducesResponseType(typeof(PaymentInitiationResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<PaymentInitiationResponse>> InitiatePayment([FromBody] InitiatePaymentDto dto)
        {
            using var activity = ActivitySource.StartActivity("InitiatePayment");
            activity?.SetTag("payment.method_id", dto.PaymentMethodId);
            activity?.SetTag("payment.amount", dto.Amount);

            try
            {
                // Enhanced validation
                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Invalid payment initiation request: {Errors}", 
                        string.Join(", ", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage)));
                    return BadRequest(new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid request data" 
                    });
                }

                var userId = User.GetSystemUserId();
                if (userId == null)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Get payment method
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Id == dto.PaymentMethodId && pm.IsActive);

                if (paymentMethod == null)
                {
                    return NotFound(new { message = "Payment method not found or inactive" });
                }

                // Generate transaction ID
                var transactionId = Guid.NewGuid().ToString();

                // Parse settings to check environment
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true && settings["isProduction"].ToString()?.ToLower() == "true";

                // Create payment log
                var paymentLog = new PaymentLog
                {
                    Gateway = paymentMethod.Type,
                    TransactionId = transactionId,
                    UserId = userId.Value,
                    Amount = dto.Amount,
                    Currency = "IQD",
                    Status = "pending",
                    ServiceType = dto.ServiceType,
                    Environment = isProduction ? "Production" : "Test",
                    RequestData = JsonSerializer.Serialize(dto),
                    CreatedAt = DateTime.UtcNow
                };

                _context.PaymentLogs.Add(paymentLog);
                await _context.SaveChangesAsync();

                // Initialize payment based on gateway
                PaymentInitiationResponse? response = paymentMethod.Type switch
                {
                    "ZainCash" => await InitiateZainCashPayment(paymentMethod, dto.Amount, transactionId, userId.Value),
                    "ZainCashV2" => await InitiateZainCashV2Payment(paymentMethod, dto.Amount, transactionId, userId.Value),
                    "QICard" => await InitiateQICardPayment(paymentMethod, dto.Amount, transactionId, userId.Value),
                    "Switch" => await InitiateSwitchPayment(paymentMethod, dto.Amount, transactionId, userId.Value),
                    _ => new PaymentInitiationResponse
                    {
                        Success = false,
                        ErrorMessage = "Unsupported payment gateway"
                    }
                };

                // Update payment log with response
                paymentLog.ResponseData = JsonSerializer.Serialize(response);
                paymentLog.UpdatedAt = DateTime.UtcNow;

                if (!response.Success)
                {
                    paymentLog.Status = "failed";
                    paymentLog.ErrorMessage = response.ErrorMessage;
                }

                await _context.SaveChangesAsync();

                if (response.Success)
                {
                    _logger.LogInformation("Payment initiated successfully: Gateway={Gateway}, TransactionId={TransactionId}, Amount={Amount}, UserId={UserId}",
                        paymentMethod.Type, transactionId, dto.Amount, userId);
                    activity?.SetTag("payment.status", "success");
                    activity?.SetTag("payment.transaction_id", transactionId);
                }
                else
                {
                    _logger.LogWarning("Payment initiation failed: Gateway={Gateway}, Error={Error}", 
                        paymentMethod.Type, response.ErrorMessage);
                    activity?.SetTag("payment.status", "failed");
                    activity?.SetTag("error.message", response.ErrorMessage);
                }

                return Ok(response);
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database error during payment initiation: UserId={UserId}, PaymentMethodId={PaymentMethodId}", 
                    User.GetSystemUserId(), dto.PaymentMethodId);
                activity?.SetTag("error", true);
                return StatusCode(500, new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "Database error occurred. Please try again."
                });
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "Payment gateway communication error: PaymentMethodId={PaymentMethodId}", dto.PaymentMethodId);
                activity?.SetTag("error", true);
                return StatusCode(503, new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "Payment gateway is currently unavailable. Please try again later."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error initiating payment: UserId={UserId}, PaymentMethodId={PaymentMethodId}", 
                    User.GetSystemUserId(), dto.PaymentMethodId);
                activity?.SetTag("error", true);
                return StatusCode(500, new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "An unexpected error occurred. Please contact support if the issue persists."
                });
            }
        }

        private async Task<PaymentInitiationResponse> InitiateZainCashPayment(
            Models.Management.PaymentMethod paymentMethod,
            decimal amount,
            string transactionId,
            int userId)
        {
            try
            {
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Invalid payment method settings" };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var msisdn = isProduction
                    ? settings.GetValueOrDefault("msisdnProd")?.ToString()
                    : settings.GetValueOrDefault("msisdnTest")?.ToString();

                var merchantId = isProduction
                    ? settings.GetValueOrDefault("merchantProd")?.ToString()
                    : settings.GetValueOrDefault("merchantTest")?.ToString();

                var secret = isProduction
                    ? settings.GetValueOrDefault("secretProd")?.ToString()
                    : settings.GetValueOrDefault("secretTest")?.ToString();

                var lang = isProduction
                    ? settings.GetValueOrDefault("langProd")?.ToString() ?? "ar"
                    : settings.GetValueOrDefault("langTest")?.ToString() ?? "ar";

                if (string.IsNullOrEmpty(msisdn) || string.IsNullOrEmpty(merchantId) || string.IsNullOrEmpty(secret))
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Missing ZainCash configuration" };
                }

                // Determine API URLs based on environment
                var initUrl = isProduction
                    ? "https://api.zaincash.iq/transaction/init"
                    : "https://test.zaincash.iq/transaction/init";

                var payUrl = isProduction
                    ? "https://api.zaincash.iq/transaction/pay?id="
                    : "https://test.zaincash.iq/transaction/pay?id=";

                // Build callback URL
                var callbackUrl = $"{Request.Scheme}://{Request.Host}/api/payments/zaincash/callback";

                // Build JWT payload (matching PHP implementation)
                var jwtPayload = new Dictionary<string, object>
                {
                    ["amount"] = (int)amount,
                    ["serviceType"] = $"wallet_topup_user_{userId}",
                    ["msisdn"] = msisdn,
                    ["orderId"] = transactionId,
                    ["redirectUrl"] = callbackUrl,
                    ["iat"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    ["exp"] = DateTimeOffset.UtcNow.AddHours(4).ToUnixTimeSeconds()
                };

                var jwtToken = GenerateJWT(JsonSerializer.Serialize(jwtPayload), secret);

                // Call ZainCash init API
                var httpClient = _httpClientFactory.CreateClient("ZainCashPayment");
                var formContent = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("token", jwtToken),
                    new KeyValuePair<string, string>("merchantId", merchantId),
                    new KeyValuePair<string, string>("lang", lang)
                });

                _logger.LogInformation("Calling ZainCash init API: {Url}, OrderId={OrderId}", initUrl, transactionId);

                var response = await httpClient.PostAsync(initUrl, formContent);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("ZainCash init response: Status={StatusCode}, Body={Body}", 
                    response.StatusCode, responseBody);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("ZainCash API error: {StatusCode} - {Body}", response.StatusCode, responseBody);
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = $"ZainCash API error: {response.StatusCode}" 
                    };
                }

                // Try to parse the response
                Dictionary<string, object>? zaincashResponse = null;
                try
                {
                    zaincashResponse = JsonSerializer.Deserialize<Dictionary<string, object>>(responseBody);
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogError(jsonEx, "Failed to parse ZainCash response as JSON: {Body}", responseBody);
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid JSON response from ZainCash" 
                    };
                }

                if (zaincashResponse == null)
                {
                    _logger.LogError("ZainCash response deserialized to null");
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid response from ZainCash" 
                    };
                }

                // Log all response keys for debugging
                _logger.LogInformation("ZainCash response keys: {Keys}", string.Join(", ", zaincashResponse.Keys));

                // Check for error response
                if (zaincashResponse.ContainsKey("err"))
                {
                    var error = zaincashResponse["err"]?.ToString();
                    _logger.LogError("ZainCash returned error: {Error}", error);
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = $"ZainCash error: {error}" 
                    };
                }

                if (!zaincashResponse.ContainsKey("id"))
                {
                    _logger.LogError("ZainCash response missing 'id' field. Response: {Response}", responseBody);
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid response from ZainCash: missing transaction id" 
                    };
                }

                var zaincashTransactionId = zaincashResponse["id"].ToString();
                
                if (string.IsNullOrEmpty(zaincashTransactionId))
                {
                    _logger.LogError("ZainCash returned empty transaction id");
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid response from ZainCash: empty transaction id" 
                    };
                }

                var paymentUrl = $"{payUrl}{zaincashTransactionId}";

                // Update payment log with ZainCash transaction ID
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

                if (paymentLog != null)
                {
                    paymentLog.GatewayTransactionId = zaincashTransactionId;
                    paymentLog.ResponseData = responseBody;
                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("ZainCash payment created: OrderId={OrderId}, TransactionId={TransactionId}, PaymentUrl={PaymentUrl}", 
                    transactionId, zaincashTransactionId, paymentUrl);

                return new PaymentInitiationResponse
                {
                    Success = true,
                    PaymentUrl = paymentUrl,
                    TransactionId = transactionId,
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["zaincashTransactionId"] = zaincashTransactionId
                    }
                };
            }
            catch (ArgumentException argEx)
            {
                _logger.LogError(argEx, "Invalid ZainCash configuration: {Message}", argEx.Message);
                return new PaymentInitiationResponse 
                { 
                    Success = false, 
                    ErrorMessage = "Invalid payment configuration. Please contact support." 
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating ZainCash payment: TransactionId={TransactionId}", transactionId);
                return new PaymentInitiationResponse 
                { 
                    Success = false, 
                    ErrorMessage = "Failed to initiate payment. Please try again." 
                };
            }
        }

        /// <summary>
        /// Get or refresh ZainCashV2 OAuth2 access token using client_credentials grant
        /// </summary>
        private async Task<string> GetZainCashV2TokenAsync(string baseUrl, string clientId, string clientSecret, string scope)
        {
            await _zainCashV2TokenLock.WaitAsync();
            try
            {
                // Check cache
                if (_zainCashV2TokenCache.TryGetValue(clientId, out var cached) && cached.expiresAt > DateTime.UtcNow.AddMinutes(1))
                {
                    _logger.LogInformation("[ZainCashV2] Using cached OAuth2 token for client {ClientId}", clientId);
                    return cached.token;
                }

                // Request new token
                var httpClient = _httpClientFactory.CreateClient("ZainCashV2Payment");
                var tokenUrl = $"{baseUrl.TrimEnd('/')}/oauth2/token";

                var formData = new Dictionary<string, string>
                {
                    { "grant_type", "client_credentials" },
                    { "client_id", clientId },
                    { "client_secret", clientSecret },
                    { "scope", scope }
                };

                var content = new FormUrlEncodedContent(formData);

                _logger.LogInformation("[ZainCashV2] Requesting OAuth2 token from {Url}", tokenUrl);

                var response = await httpClient.PostAsync(tokenUrl, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("[ZainCashV2] OAuth2 token request failed: {StatusCode} - {Body}", response.StatusCode, responseBody);
                    throw new HttpRequestException($"ZainCashV2 OAuth2 token request failed: {response.StatusCode}");
                }

                var tokenResponse = JsonSerializer.Deserialize<ZainCashV2TokenResponse>(responseBody);
                if (tokenResponse?.AccessToken == null)
                {
                    throw new InvalidOperationException("ZainCashV2 OAuth2 response did not contain an access_token");
                }

                // Cache with buffer (expire 1 minute early)
                var expiresAt = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn - 60);
                _zainCashV2TokenCache[clientId] = (tokenResponse.AccessToken, expiresAt);

                _logger.LogInformation("[ZainCashV2] OAuth2 token obtained, expires in {ExpiresIn}s", tokenResponse.ExpiresIn);

                return tokenResponse.AccessToken;
            }
            finally
            {
                _zainCashV2TokenLock.Release();
            }
        }

        /// <summary>
        /// Initiate a ZainCash V2 payment using the new OAuth2 + REST API
        /// </summary>
        private async Task<PaymentInitiationResponse> InitiateZainCashV2Payment(
            Models.Management.PaymentMethod paymentMethod,
            decimal amount,
            string transactionId,
            int userId)
        {
            try
            {
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Invalid payment method settings" };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var clientId = isProduction
                    ? settings.GetValueOrDefault("clientIdProd")?.ToString()
                    : settings.GetValueOrDefault("clientIdTest")?.ToString();

                var clientSecret = isProduction
                    ? settings.GetValueOrDefault("clientSecretProd")?.ToString()
                    : settings.GetValueOrDefault("clientSecretTest")?.ToString();

                var serviceType = isProduction
                    ? settings.GetValueOrDefault("serviceTypeProd")?.ToString() ?? "Delivery"
                    : settings.GetValueOrDefault("serviceTypeTest")?.ToString() ?? "Delivery";

                var lang = isProduction
                    ? settings.GetValueOrDefault("langProd")?.ToString() ?? "en"
                    : settings.GetValueOrDefault("langTest")?.ToString() ?? "en";

                var baseUrl = isProduction
                    ? settings.GetValueOrDefault("baseUrlProd")?.ToString() ?? ""
                    : settings.GetValueOrDefault("baseUrlTest")?.ToString() ?? "https://pg-api-uat.zaincash.iq";

                var scope = settings.GetValueOrDefault("scope")?.ToString() ?? "payment:read payment:write";

                if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret) || string.IsNullOrEmpty(baseUrl))
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Missing ZainCash V2 configuration (clientId, clientSecret, or baseUrl)" };
                }

                // Step 1: Get OAuth2 access token
                var accessToken = await GetZainCashV2TokenAsync(baseUrl, clientId, clientSecret, scope);

                // Step 2: Build callback URLs
                var successUrl = settings.GetValueOrDefault("successUrl")?.ToString()
                    ?? $"{Request.Scheme}://{Request.Host}/api/payments/zaincashv2/callback/success";
                var failureUrl = settings.GetValueOrDefault("failureUrl")?.ToString()
                    ?? $"{Request.Scheme}://{Request.Host}/api/payments/zaincashv2/callback/failure";

                // Step 3: Create transaction via /api/v2/payment-gateway/transaction/init
                var externalReferenceId = Guid.NewGuid().ToString();
                var initUrl = $"{baseUrl.TrimEnd('/')}/api/v2/payment-gateway/transaction/init";

                var payload = new
                {
                    language = lang,
                    externalReferenceId = externalReferenceId,
                    orderId = transactionId,
                    serviceType = serviceType,
                    amount = new
                    {
                        value = ((int)amount).ToString(),
                        currency = "IQD"
                    },
                    redirectUrls = new
                    {
                        successUrl = successUrl,
                        failureUrl = failureUrl
                    }
                };

                var httpClient = _httpClientFactory.CreateClient("ZainCashV2Payment");
                httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                var jsonContent = JsonContent.Create(payload);

                _logger.LogInformation("[ZainCashV2] Creating transaction: {Url}, OrderId={OrderId}, Amount={Amount}, ExternalRef={ExternalRef}",
                    initUrl, transactionId, amount, externalReferenceId);

                var response = await httpClient.PostAsync(initUrl, jsonContent);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[ZainCashV2] Init response: Status={StatusCode}, Body={Body}",
                    response.StatusCode, responseBody);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("[ZainCashV2] Transaction init failed: {StatusCode} - {Body}", response.StatusCode, responseBody);
                    return new PaymentInitiationResponse
                    {
                        Success = false,
                        ErrorMessage = $"ZainCash V2 API error: {response.StatusCode} - {responseBody}"
                    };
                }

                var initResponse = JsonSerializer.Deserialize<ZainCashV2InitResponse>(responseBody);
                if (initResponse == null || string.IsNullOrEmpty(initResponse.RedirectUrl))
                {
                    _logger.LogError("[ZainCashV2] Missing redirectUrl in response: {Body}", responseBody);
                    return new PaymentInitiationResponse
                    {
                        Success = false,
                        ErrorMessage = "Invalid response from ZainCash V2: missing redirectUrl"
                    };
                }

                var zaincashV2TransactionId = initResponse.TransactionDetails?.TransactionId;

                // Update payment log
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

                if (paymentLog != null)
                {
                    paymentLog.GatewayTransactionId = zaincashV2TransactionId;
                    paymentLog.ReferenceId = externalReferenceId;
                    paymentLog.ResponseData = responseBody;
                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("[ZainCashV2] Payment created: OrderId={OrderId}, TransactionId={ZcTransactionId}, RedirectUrl={RedirectUrl}",
                    transactionId, zaincashV2TransactionId, initResponse.RedirectUrl);

                return new PaymentInitiationResponse
                {
                    Success = true,
                    PaymentUrl = initResponse.RedirectUrl,
                    TransactionId = transactionId,
                    AdditionalData = new Dictionary<string, object?>
                    {
                        ["zaincashV2TransactionId"] = zaincashV2TransactionId,
                        ["externalReferenceId"] = externalReferenceId,
                        ["expiryTime"] = initResponse.ExpiryTime
                    }
                };
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "[ZainCashV2] HTTP error initiating payment: TransactionId={TransactionId}", transactionId);
                return new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "Failed to communicate with ZainCash V2 gateway. Please try again."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error initiating payment: TransactionId={TransactionId}", transactionId);
                return new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "Failed to initiate ZainCash V2 payment. Please try again."
                };
            }
        }

        private async Task<PaymentInitiationResponse> InitiateQICardPayment(
            Models.Management.PaymentMethod paymentMethod,
            decimal amount,
            string transactionId,
            int userId)
        {
            try
            {
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Invalid payment method settings" };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var username = isProduction
                    ? settings.GetValueOrDefault("usernameProd")?.ToString()
                    : settings.GetValueOrDefault("usernameTest")?.ToString();

                var password = isProduction
                    ? settings.GetValueOrDefault("passwordProd")?.ToString()
                    : settings.GetValueOrDefault("passwordTest")?.ToString();

                var terminalId = isProduction
                    ? settings.GetValueOrDefault("terminalIdProd")?.ToString()
                    : settings.GetValueOrDefault("terminalIdTest")?.ToString();

                var currency = isProduction
                    ? settings.GetValueOrDefault("currencyProd")?.ToString() ?? "IQD"
                    : settings.GetValueOrDefault("currencyTest")?.ToString() ?? "IQD";

                var apiUrl = isProduction
                    ? settings.GetValueOrDefault("urlProd")?.ToString()
                    : settings.GetValueOrDefault("urlTest")?.ToString();

                _logger.LogInformation("QICard Settings - IsProduction={IsProduction}, Username={Username}, TerminalId={TerminalId}, ApiUrl={ApiUrl}", 
                    isProduction, 
                    string.IsNullOrEmpty(username) ? "MISSING" : username, 
                    string.IsNullOrEmpty(terminalId) ? "MISSING" : terminalId,
                    string.IsNullOrEmpty(apiUrl) ? "MISSING" : apiUrl);

                if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) || 
                    string.IsNullOrEmpty(terminalId) || string.IsNullOrEmpty(apiUrl))
                {
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "QICard payment method not properly configured" 
                    };
                }

                // Create request ID
                var requestId = Guid.NewGuid().ToString();

                // Prepare callback URLs
                var callbackUrl = $"{Request.Scheme}://{Request.Host}/api/payments/qicard/callback";
                var notificationUrl = $"{Request.Scheme}://{Request.Host}/api/payments/qicard/notification";

                // Call QICard API to create payment
                var httpClient = _httpClientFactory.CreateClient("QICardPayment");
                
                var paymentEndpoint = $"{apiUrl.TrimEnd('/')}/payment";
                var requestBody = new
                {
                    requestId = requestId,
                    amount = (int)amount,  // QICard expects integer
                    locale = "en_US",
                    currency = currency,
                    finishPaymentUrl = callbackUrl,
                    notificationUrl = notificationUrl
                };

                var request = new HttpRequestMessage(HttpMethod.Post, paymentEndpoint);
                request.Headers.Add("X-Terminal-Id", terminalId);
                
                // Add Basic Authentication
                var authBytes = Encoding.UTF8.GetBytes($"{username}:{password}");
                var authBase64 = Convert.ToBase64String(authBytes);
                request.Headers.Add("Authorization", $"Basic {authBase64}");
                
                request.Content = JsonContent.Create(requestBody);

                _logger.LogInformation("Calling QICard API: {Endpoint}, RequestId={RequestId}, Amount={Amount}, Terminal={Terminal}", 
                    paymentEndpoint, requestId, amount, terminalId);
                _logger.LogInformation("QICard Request Body: {Body}", JsonSerializer.Serialize(requestBody));

                var response = await httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("QICard API response: Status={StatusCode}, Body={Body}", 
                    response.StatusCode, responseBody);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("QICard API error: {StatusCode} - {Body}", response.StatusCode, responseBody);
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = $"QICard API error: {response.StatusCode}" 
                    };
                }

                var qiResponse = JsonSerializer.Deserialize<Dictionary<string, object>>(responseBody);
                if (qiResponse == null)
                {
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Invalid response from QICard" 
                    };
                }

                var formUrl = qiResponse.GetValueOrDefault("formUrl")?.ToString();
                var paymentId = qiResponse.GetValueOrDefault("paymentId")?.ToString();

                if (string.IsNullOrEmpty(formUrl) || string.IsNullOrEmpty(paymentId))
                {
                    return new PaymentInitiationResponse 
                    { 
                        Success = false, 
                        ErrorMessage = "Missing formUrl or paymentId from QICard response" 
                    };
                }

                // Update payment log with QICard payment ID
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

                if (paymentLog != null)
                {
                    paymentLog.GatewayTransactionId = paymentId;
                    paymentLog.RequestData = JsonSerializer.Serialize(requestBody);
                    paymentLog.ResponseData = responseBody;
                    await _context.SaveChangesAsync();
                }

                _logger.LogInformation("QICard payment created: PaymentId={PaymentId}, FormUrl={FormUrl}", 
                    paymentId, formUrl);

                return new PaymentInitiationResponse
                {
                    Success = true,
                    PaymentUrl = formUrl,
                    TransactionId = transactionId,
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["qiCardPaymentId"] = paymentId,
                        ["requestId"] = requestId
                    }
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating QICard payment: TransactionId={TransactionId}", transactionId);
                return new PaymentInitiationResponse 
                { 
                    Success = false, 
                    ErrorMessage = "Failed to initiate QICard payment. Please try again." 
                };
            }
        }

        private async Task<PaymentInitiationResponse> InitiateSwitchPayment(
            Models.Management.PaymentMethod paymentMethod,
            decimal amount,
            string transactionId,
            int userId)
        {
            try
            {
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Invalid payment method settings" };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var entityId = isProduction
                    ? settings.GetValueOrDefault("entityIdProd")?.ToString()
                    : settings.GetValueOrDefault("entityIdTest")?.ToString();

                var entityAuth = isProduction
                    ? settings.GetValueOrDefault("entityAuthProd")?.ToString()
                    : settings.GetValueOrDefault("entityAuthTest")?.ToString();

                var entityUrl = isProduction
                    ? settings.GetValueOrDefault("entityUrlProd")?.ToString()
                    : settings.GetValueOrDefault("entityUrlTest")?.ToString();

                var currency = isProduction
                    ? settings.GetValueOrDefault("currencyProd")?.ToString() ?? "IQD"
                    : settings.GetValueOrDefault("currencyTest")?.ToString() ?? "USD";

                _logger.LogInformation("Switch Settings - IsProduction={IsProduction}, EntityId={EntityId}, EntityUrl={EntityUrl}, Currency={Currency}", 
                    isProduction, entityId, entityUrl, currency);

                if (string.IsNullOrEmpty(entityId) || string.IsNullOrEmpty(entityAuth) || string.IsNullOrEmpty(entityUrl))
                {
                    _logger.LogError("Missing Switch configuration - EntityId={EntityId}, EntityAuth={HasAuth}, EntityUrl={EntityUrl}", 
                        entityId, !string.IsNullOrEmpty(entityAuth), entityUrl);
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Missing Switch configuration" };
                }

                // Call Switch API to create checkout (matches legacy PHP implementation)
                var httpClient = _httpClientFactory.CreateClient("PaymentGateway");
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                
                // Use Bearer token authentication (like legacy: Authorization:Bearer token)
                httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", entityAuth);

                // Build form data (like legacy: entityId + amount + currency + paymentType + integrity)
                var formData = new Dictionary<string, string>
                {
                    { "entityId", entityId },
                    { "amount", amount.ToString("F2") },
                    { "currency", currency },
                    { "paymentType", "DB" },
                    { "integrity", "true" }
                };

                var content = new FormUrlEncodedContent(formData);
                
                _logger.LogInformation("Calling Switch API: Url={Url}, EntityId={EntityId}, Amount={Amount}, Currency={Currency}", 
                    entityUrl, entityId, amount, currency);

                var response = await httpClient.PostAsync(entityUrl, content);
                var responseString = await response.Content.ReadAsStringAsync();
                
                _logger.LogInformation("Switch API response: Status={Status}, Body={Body}", response.StatusCode, responseString);
                var switchResponse = JsonSerializer.Deserialize<SwitchInitResponse>(responseString);

                if (switchResponse?.Id != null)
                {
                    // Store NDC for callback verification
                    var paymentLog = await _context.PaymentLogs.FirstOrDefaultAsync(p => p.TransactionId == transactionId);
                    if (paymentLog != null)
                    {
                        paymentLog.ReferenceId = switchResponse.Ndc;
                        await _context.SaveChangesAsync();
                    }

                    // Get current workspace ID from context
                    var workspaceId = HttpContext.Items["WorkspaceId"]?.ToString() ?? "1";
                    _logger.LogInformation("Creating Switch checkout URL with WorkspaceId={WorkspaceId}", workspaceId);
                    var checkoutUrl = $"{Request.Scheme}://{Request.Host}/api/payments/switch/checkout/{transactionId}?checkoutId={switchResponse.Id}&workspaceId={workspaceId}";

                    return new PaymentInitiationResponse
                    {
                        Success = true,
                        PaymentUrl = checkoutUrl,
                        TransactionId = transactionId,
                        AdditionalData = switchResponse
                    };
                }

                return new PaymentInitiationResponse { Success = false, ErrorMessage = "Failed to create Switch checkout" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating Switch payment");
                return new PaymentInitiationResponse { Success = false, ErrorMessage = ex.Message };
            }
        }

        // GET: api/payments/switch/checkout/{transactionId}
        [AllowAnonymous]
        [HttpGet("switch/checkout/{transactionId}")]
        public async Task<IActionResult> SwitchCheckout(string transactionId, [FromQuery] string checkoutId, [FromQuery] string? workspaceId)
        {
            try
            {
                // Default to workspace 1 if not provided
                workspaceId = workspaceId ?? "1";
                
                _logger.LogInformation("Switch checkout page requested: TransactionId={TransactionId}, CheckoutId={CheckoutId}, WorkspaceId={WorkspaceId}", 
                    transactionId, checkoutId, workspaceId);

                // Create ApplicationDbContext for the specific workspace (anonymous endpoint needs manual setup)
                var baseConnectionString = _configuration.GetConnectionString("DefaultConnection");
                _logger.LogInformation("Base connection string: {BaseConnectionString}", baseConnectionString);
                
                // Replace master database name with workspace database name
                var connectionString = baseConnectionString?.Replace("Database=openradius;", $"Database=openradius_workspace_{workspaceId};");
                
                _logger.LogInformation("Workspace connection string: {ConnectionString}", connectionString);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    _logger.LogError("Failed to build connection string for workspace {WorkspaceId}", workspaceId);
                    return StatusCode(500, "Database configuration error");
                }
                
                var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
                optionsBuilder.UseNpgsql(connectionString);
                
                // Create context without multi-tenant accessor (anonymous endpoint)
                using var workspaceContext = new ApplicationDbContext(optionsBuilder.Options, null);

                // Find payment log in workspace database
                _logger.LogInformation("Searching for payment in workspace database...");
                var paymentLog = await workspaceContext.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

                if (paymentLog == null)
                {
                    _logger.LogWarning("Payment not found for transactionId: {TransactionId}, WorkspaceId: {WorkspaceId}", transactionId, workspaceId);
                    return NotFound($"Payment not found for transaction {transactionId}");
                }

                // Get payment method to determine environment
                var paymentMethod = await workspaceContext.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "Switch" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return BadRequest("Switch payment method not configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var shopperResultUrl = $"{Request.Scheme}://{Request.Host}/api/payments/switch/callback";

                _logger.LogInformation("Rendering Switch checkout page: TransactionId={TransactionId}, CheckoutId={CheckoutId}, Amount={Amount}", 
                    transactionId, checkoutId, paymentLog.Amount);

                // Return HTML page with OPPWA payment widget (like legacy PHP)
                var html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Switch Payment</title>
    <script src=""https://eu-{(isProduction ? "prod" : "test")}.oppwa.com/v1/paymentWidgets.js?checkoutId={checkoutId}""></script>
    <style>
        body {{
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        .payment-container {{
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
        }}
        .payment-header {{
            text-align: center;
            margin-bottom: 2rem;
        }}
        .payment-header h1 {{
            color: #333;
            margin: 0 0 0.5rem 0;
        }}
        .payment-header p {{
            color: #666;
            margin: 0;
        }}
        .wpwl-form {{
            margin-top: 1rem;
        }}
    </style>
</head>
<body>
    <div class=""payment-container"">
        <div class=""payment-header"">
            <h1>Complete Payment</h1>
            <p>Amount: {paymentLog.Amount:F2} {paymentLog.Currency}</p>
        </div>
        <form action=""{shopperResultUrl}"" class=""paymentWidgets"" data-brands=""VISA MASTER AMEX""></form>
    </div>
</body>
</html>";

                return Content(html, "text/html");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error displaying Switch checkout page");
                return StatusCode(500, "Error displaying payment page");
            }
        }

        // GET: api/payments/zaincash/callback
        [AllowAnonymous]
        [HttpGet("zaincash/callback")]
        public async Task<IActionResult> ZainCashCallback([FromQuery] string token)
        {
            try
            {
                // Find payment method to get secret
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCash" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return BadRequest("ZainCash payment method not configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var secret = isProduction
                    ? settings?.GetValueOrDefault("secretProd")?.ToString()
                    : settings?.GetValueOrDefault("secretTest")?.ToString();

                if (string.IsNullOrEmpty(secret))
                {
                    return BadRequest("Missing ZainCash secret configuration");
                }

                // Decode JWT token
                var payload = DecodeJWT(token, secret);
                var result = JsonSerializer.Deserialize<Dictionary<string, object>>(payload);

                if (result == null)
                {
                    return BadRequest("Invalid token payload");
                }

                var orderId = result.GetValueOrDefault("orderid")?.ToString();
                var status = result.GetValueOrDefault("status")?.ToString();
                var zainCashId = result.GetValueOrDefault("id")?.ToString();

                // Update payment log
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == orderId);

                if (paymentLog == null)
                {
                    return NotFound("Payment not found");
                }

                paymentLog.CallbackData = JsonSerializer.Serialize(result);
                paymentLog.ReferenceId = zainCashId;
                paymentLog.UpdatedAt = DateTime.UtcNow;

                if (status == "success")
                {
                    paymentLog.Status = "processing";
                    await _context.SaveChangesAsync();

                    // Process successful payment
                    await ProcessSuccessfulPayment(paymentLog);

                    return Redirect($"/payment/success?transactionId={orderId}");
                }
                else if (status == "failed")
                {
                    paymentLog.Status = "failed";
                    paymentLog.ErrorMessage = result.GetValueOrDefault("msg")?.ToString();
                    await _context.SaveChangesAsync();

                    return Redirect($"/payment/failed?transactionId={orderId}");
                }

                return Redirect($"/payment/cancelled?transactionId={orderId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing ZainCash callback");
                return StatusCode(500, "Error processing payment callback");
            }
        }

        /// <summary>
        /// ZainCash V2 success callback — receives JWT token as query parameter after customer completes payment
        /// </summary>
        [AllowAnonymous]
        [HttpGet("zaincashv2/callback/success")]
        public async Task<IActionResult> ZainCashV2SuccessCallback([FromQuery] string token)
        {
            return await HandleZainCashV2Callback(token, isSuccess: true);
        }

        /// <summary>
        /// ZainCash V2 failure callback — receives JWT token as query parameter after payment failure/cancel
        /// </summary>
        [AllowAnonymous]
        [HttpGet("zaincashv2/callback/failure")]
        public async Task<IActionResult> ZainCashV2FailureCallback([FromQuery] string token)
        {
            return await HandleZainCashV2Callback(token, isSuccess: false);
        }

        /// <summary>
        /// Handle ZainCash V2 redirect callback (both success and failure)
        /// Decodes JWT token using the API key (HS256), extracts transaction details, and updates payment status
        /// </summary>
        private async Task<IActionResult> HandleZainCashV2Callback(string token, bool isSuccess)
        {
            try
            {
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("[ZainCashV2] Callback received without token");
                    return Redirect("/payment/failed?error=missing_token");
                }

                // Find active ZainCashV2 payment method to get API key for JWT verification
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCashV2" && pm.IsActive);

                if (paymentMethod == null)
                {
                    _logger.LogError("[ZainCashV2] No active ZainCashV2 payment method found");
                    return Redirect("/payment/failed?error=not_configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var apiKey = isProduction
                    ? settings?.GetValueOrDefault("apiKeyProd")?.ToString()
                    : settings?.GetValueOrDefault("apiKeyTest")?.ToString();

                // Decode JWT token (HS256 signed with API key)
                Dictionary<string, object>? callbackData;
                if (!string.IsNullOrEmpty(apiKey))
                {
                    var payload = DecodeJWT(token, apiKey);
                    callbackData = JsonSerializer.Deserialize<Dictionary<string, object>>(payload);
                }
                else
                {
                    // If no API key configured, decode without verification (not recommended for production)
                    _logger.LogWarning("[ZainCashV2] No API key configured — decoding JWT without verification");
                    var parts = token.Split('.');
                    if (parts.Length < 2)
                    {
                        return Redirect("/payment/failed?error=invalid_token");
                    }
                    var payloadBase64 = parts[1].Replace('-', '+').Replace('_', '/');
                    switch (payloadBase64.Length % 4)
                    {
                        case 2: payloadBase64 += "=="; break;
                        case 3: payloadBase64 += "="; break;
                    }
                    var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(payloadBase64));
                    callbackData = JsonSerializer.Deserialize<Dictionary<string, object>>(payloadJson);
                }

                if (callbackData == null)
                {
                    return Redirect("/payment/failed?error=invalid_payload");
                }

                _logger.LogInformation("[ZainCashV2] Callback data: {Data}", JsonSerializer.Serialize(callbackData));

                // Extract transaction details from the JWT data
                string? orderId = null;
                string? currentStatus = null;
                string? zcTransactionId = null;

                if (callbackData.TryGetValue("data", out var dataObj))
                {
                    var data = JsonSerializer.Deserialize<Dictionary<string, object>>(dataObj.ToString() ?? "{}");
                    orderId = data?.GetValueOrDefault("orderId")?.ToString();
                    currentStatus = data?.GetValueOrDefault("currentStatus")?.ToString();
                    zcTransactionId = data?.GetValueOrDefault("transactionId")?.ToString();
                }

                // Fallback: try top-level fields
                orderId ??= callbackData.GetValueOrDefault("orderId")?.ToString();
                currentStatus ??= callbackData.GetValueOrDefault("currentStatus")?.ToString();

                if (string.IsNullOrEmpty(orderId))
                {
                    _logger.LogWarning("[ZainCashV2] Could not extract orderId from callback token");
                    return Redirect("/payment/failed?error=missing_order_id");
                }

                // Find and update payment log
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == orderId);

                if (paymentLog == null)
                {
                    _logger.LogWarning("[ZainCashV2] Payment not found for orderId: {OrderId}", orderId);
                    return Redirect($"/payment/failed?transactionId={orderId}&error=not_found");
                }

                paymentLog.CallbackData = JsonSerializer.Serialize(callbackData);
                paymentLog.UpdatedAt = DateTime.UtcNow;

                if (!string.IsNullOrEmpty(zcTransactionId))
                {
                    paymentLog.GatewayTransactionId = zcTransactionId;
                }

                // Use inquiry API as fallback to confirm final status
                var confirmedStatus = currentStatus;
                if (isSuccess && currentStatus == "SUCCESS")
                {
                    confirmedStatus = await VerifyZainCashV2TransactionAsync(paymentMethod, zcTransactionId);
                }

                if (confirmedStatus == "SUCCESS")
                {
                    paymentLog.Status = "processing";
                    await _context.SaveChangesAsync();

                    await ProcessSuccessfulPayment(paymentLog);

                    _logger.LogInformation("[ZainCashV2] Payment completed: TransactionId={TransactionId}", orderId);
                    return Redirect($"/payment/success?transactionId={orderId}");
                }
                else
                {
                    paymentLog.Status = "failed";
                    paymentLog.ErrorMessage = $"ZainCash V2 status: {confirmedStatus}";
                    await _context.SaveChangesAsync();

                    _logger.LogWarning("[ZainCashV2] Payment failed/cancelled: TransactionId={TransactionId}, Status={Status}", orderId, confirmedStatus);
                    return Redirect($"/payment/failed?transactionId={orderId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error processing callback");
                return Redirect("/payment/failed?error=processing_error");
            }
        }

        /// <summary>
        /// Verify a ZainCash V2 transaction status using the Inquiry API
        /// </summary>
        private async Task<string?> VerifyZainCashV2TransactionAsync(
            Models.Management.PaymentMethod paymentMethod,
            string? transactionId)
        {
            if (string.IsNullOrEmpty(transactionId))
                return null;

            try
            {
                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null) return null;

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var clientId = isProduction
                    ? settings.GetValueOrDefault("clientIdProd")?.ToString()
                    : settings.GetValueOrDefault("clientIdTest")?.ToString();

                var clientSecret = isProduction
                    ? settings.GetValueOrDefault("clientSecretProd")?.ToString()
                    : settings.GetValueOrDefault("clientSecretTest")?.ToString();

                var baseUrl = isProduction
                    ? settings.GetValueOrDefault("baseUrlProd")?.ToString() ?? ""
                    : settings.GetValueOrDefault("baseUrlTest")?.ToString() ?? "https://pg-api-uat.zaincash.iq";

                var scope = settings.GetValueOrDefault("scope")?.ToString() ?? "payment:read payment:write";

                if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
                    return null;

                var accessToken = await GetZainCashV2TokenAsync(baseUrl, clientId, clientSecret, scope);

                var inquiryUrl = $"{baseUrl.TrimEnd('/')}/api/v2/payment-gateway/transaction/inquiry/{transactionId}";

                var httpClient = _httpClientFactory.CreateClient("ZainCashV2Payment");
                httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                _logger.LogInformation("[ZainCashV2] Inquiry: {Url}", inquiryUrl);

                var response = await httpClient.GetAsync(inquiryUrl);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[ZainCashV2] Inquiry response: Status={StatusCode}, Body={Body}",
                    response.StatusCode, responseBody);

                if (!response.IsSuccessStatusCode)
                    return null;

                var inquiry = JsonSerializer.Deserialize<ZainCashV2InquiryResponse>(responseBody);
                return inquiry?.Status;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error verifying transaction {TransactionId}", transactionId);
                return null;
            }
        }

        /// <summary>
        /// ZainCash V2 webhook endpoint — receives POST with webhook_token (JWT) for status change notifications
        /// </summary>
        [AllowAnonymous]
        [HttpPost("zaincashv2/webhook")]
        public async Task<IActionResult> ZainCashV2Webhook()
        {
            try
            {
                using var reader = new StreamReader(Request.Body);
                var rawBody = await reader.ReadToEndAsync();

                _logger.LogInformation("[ZainCashV2] Webhook received: {Body}", rawBody);

                // Parse the webhook body to get the JWT token
                var webhookBody = JsonSerializer.Deserialize<Dictionary<string, string>>(rawBody);
                var webhookToken = webhookBody?.GetValueOrDefault("webhook_token");

                if (string.IsNullOrEmpty(webhookToken))
                {
                    _logger.LogWarning("[ZainCashV2] Webhook missing webhook_token");
                    return Ok("Missing webhook_token");
                }

                // Find active ZainCashV2 payment method
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCashV2" && pm.IsActive);

                if (paymentMethod == null)
                {
                    _logger.LogError("[ZainCashV2] No active ZainCashV2 payment method for webhook");
                    return Ok("Not configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var apiKey = isProduction
                    ? settings?.GetValueOrDefault("apiKeyProd")?.ToString()
                    : settings?.GetValueOrDefault("apiKeyTest")?.ToString();

                // Decode JWT (HS256 signed with API key)
                Dictionary<string, object>? webhookData;
                if (!string.IsNullOrEmpty(apiKey))
                {
                    var payload = DecodeJWT(webhookToken, apiKey);
                    webhookData = JsonSerializer.Deserialize<Dictionary<string, object>>(payload);
                }
                else
                {
                    // Decode without verification
                    _logger.LogWarning("[ZainCashV2] No API key — decoding webhook JWT without verification");
                    var parts = webhookToken.Split('.');
                    if (parts.Length < 2)
                    {
                        return Ok("Invalid token");
                    }
                    var payloadBase64 = parts[1].Replace('-', '+').Replace('_', '/');
                    switch (payloadBase64.Length % 4)
                    {
                        case 2: payloadBase64 += "=="; break;
                        case 3: payloadBase64 += "="; break;
                    }
                    var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(payloadBase64));
                    webhookData = JsonSerializer.Deserialize<Dictionary<string, object>>(payloadJson);
                }

                if (webhookData == null)
                {
                    return Ok("Invalid payload");
                }

                _logger.LogInformation("[ZainCashV2] Webhook decoded: {Data}", JsonSerializer.Serialize(webhookData));

                // Extract event details
                var eventType = webhookData.GetValueOrDefault("eventType")?.ToString();
                var eventId = webhookData.GetValueOrDefault("eventId")?.ToString();

                // Idempotency check using eventId
                if (!string.IsNullOrEmpty(eventId))
                {
                    var existingLog = await _context.PaymentLogs
                        .AnyAsync(p => p.Gateway == "ZainCashV2" && p.ReferenceId == eventId && p.Status == "webhook_processed");

                    if (existingLog)
                    {
                        _logger.LogInformation("[ZainCashV2] Duplicate webhook event {EventId} — skipping", eventId);
                        return Ok("Already processed");
                    }
                }

                // Extract transaction data
                string? orderId = null;
                string? currentStatus = null;
                string? zcTransactionId = null;

                if (webhookData.TryGetValue("data", out var dataObj))
                {
                    var data = JsonSerializer.Deserialize<Dictionary<string, object>>(dataObj.ToString() ?? "{}");
                    orderId = data?.GetValueOrDefault("orderId")?.ToString();
                    currentStatus = data?.GetValueOrDefault("currentStatus")?.ToString();
                    zcTransactionId = data?.GetValueOrDefault("transactionId")?.ToString();
                }

                // Log the webhook event
                var webhookLog = new PaymentLog
                {
                    Gateway = "ZainCashV2",
                    TransactionId = $"webhook_{eventId ?? Guid.NewGuid().ToString()}",
                    UserId = 0,
                    Amount = 0,
                    Currency = "IQD",
                    Status = "webhook",
                    RequestData = rawBody,
                    CallbackData = JsonSerializer.Serialize(webhookData),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.PaymentLogs.Add(webhookLog);
                await _context.SaveChangesAsync();

                // Process based on event type
                if (eventType == "STATUS_CHANGED" && !string.IsNullOrEmpty(orderId))
                {
                    var paymentLog = await _context.PaymentLogs
                        .FirstOrDefaultAsync(p => p.TransactionId == orderId &&
                                                 p.Gateway == "ZainCashV2" &&
                                                 (p.Status == "pending" || p.Status == "processing"));

                    if (paymentLog != null)
                    {
                        paymentLog.CallbackData = JsonSerializer.Serialize(webhookData);
                        paymentLog.UpdatedAt = DateTime.UtcNow;

                        if (!string.IsNullOrEmpty(zcTransactionId))
                        {
                            paymentLog.GatewayTransactionId = zcTransactionId;
                        }

                        if (currentStatus == "SUCCESS")
                        {
                            paymentLog.Status = "processing";
                            await _context.SaveChangesAsync();

                            await ProcessSuccessfulPayment(paymentLog);

                            _logger.LogInformation("[ZainCashV2] Webhook: Payment SUCCESS for OrderId={OrderId}", orderId);
                        }
                        else if (currentStatus == "FAILED" || currentStatus == "EXPIRED")
                        {
                            paymentLog.Status = "failed";
                            paymentLog.ErrorMessage = $"ZainCash V2 webhook status: {currentStatus}";
                            await _context.SaveChangesAsync();

                            _logger.LogWarning("[ZainCashV2] Webhook: Payment {Status} for OrderId={OrderId}", currentStatus, orderId);
                        }
                    }
                }
                else if (eventType == "REFUND_COMPLETED" && !string.IsNullOrEmpty(orderId))
                {
                    _logger.LogInformation("[ZainCashV2] Webhook: Refund completed for OrderId={OrderId}", orderId);
                    // TODO: Handle refund processing if needed
                }
                else if (eventType == "REFUND_FAILED" && !string.IsNullOrEmpty(orderId))
                {
                    _logger.LogWarning("[ZainCashV2] Webhook: Refund failed for OrderId={OrderId}", orderId);
                }

                return Ok("Webhook received");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error processing webhook");
                return Ok("Error processing webhook");
            }
        }

        /// <summary>
        /// Inquiry endpoint — check the status of a ZainCash V2 transaction
        /// </summary>
        [HttpGet("zaincashv2/inquiry/{transactionId}")]
        public async Task<IActionResult> ZainCashV2Inquiry(string transactionId)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCashV2" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return BadRequest(new { message = "ZainCash V2 payment method not configured" });
                }

                var status = await VerifyZainCashV2TransactionAsync(paymentMethod, transactionId);

                if (status == null)
                {
                    return NotFound(new { message = "Transaction not found or inquiry failed" });
                }

                return Ok(new { transactionId, status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error during inquiry for {TransactionId}", transactionId);
                return StatusCode(500, new { message = "Error checking transaction status" });
            }
        }

        /// <summary>
        /// Reverse a ZainCash V2 transaction
        /// </summary>
        [HttpPost("zaincashv2/reverse")]
        public async Task<IActionResult> ZainCashV2Reverse([FromBody] ZainCashV2ReverseRequest request)
        {
            try
            {
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCashV2" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return BadRequest(new { message = "ZainCash V2 payment method not configured" });
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return BadRequest(new { message = "Invalid payment method settings" });
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var clientId = isProduction
                    ? settings.GetValueOrDefault("clientIdProd")?.ToString()
                    : settings.GetValueOrDefault("clientIdTest")?.ToString();

                var clientSecret = isProduction
                    ? settings.GetValueOrDefault("clientSecretProd")?.ToString()
                    : settings.GetValueOrDefault("clientSecretTest")?.ToString();

                var baseUrl = isProduction
                    ? settings.GetValueOrDefault("baseUrlProd")?.ToString() ?? ""
                    : settings.GetValueOrDefault("baseUrlTest")?.ToString() ?? "https://pg-api-uat.zaincash.iq";

                var scope = settings.GetValueOrDefault("scope")?.ToString() ?? "payment:read payment:write reverse:write";

                if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
                {
                    return BadRequest(new { message = "Missing ZainCash V2 credentials" });
                }

                var accessToken = await GetZainCashV2TokenAsync(baseUrl, clientId, clientSecret, scope);

                var reverseUrl = $"{baseUrl.TrimEnd('/')}/api/v2/payment-gateway/transaction/reverse";

                var httpClient = _httpClientFactory.CreateClient("ZainCashV2Payment");
                httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                var payload = new
                {
                    transactionId = request.TransactionId,
                    reason = request.Reason
                };

                _logger.LogInformation("[ZainCashV2] Reversing transaction: {TransactionId}, Reason: {Reason}",
                    request.TransactionId, request.Reason);

                var response = await httpClient.PostAsJsonAsync(reverseUrl, payload);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[ZainCashV2] Reverse response: Status={StatusCode}, Body={Body}",
                    response.StatusCode, responseBody);

                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode((int)response.StatusCode, new { message = $"Reverse failed: {responseBody}" });
                }

                var reverseResponse = JsonSerializer.Deserialize<ZainCashV2ReverseResponse>(responseBody);
                return Ok(reverseResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ZainCashV2] Error reversing transaction");
                return StatusCode(500, new { message = "Error reversing transaction" });
            }
        }

        // GET: api/payments/switch/callback
        [AllowAnonymous]
        [HttpGet("switch/callback")]
        public async Task<IActionResult> SwitchCallback([FromQuery] string id, [FromQuery] string resourcePath)
        {
            try
            {
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.ReferenceId == id.Split('/').Last());

                if (paymentLog == null)
                {
                    return NotFound("Payment not found");
                }

                // Get payment status from Switch
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "Switch" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return BadRequest("Switch payment method not configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var entityId = isProduction
                    ? settings?.GetValueOrDefault("entityIdProd")?.ToString()
                    : settings?.GetValueOrDefault("entityIdTest")?.ToString();

                var entityAuth = isProduction
                    ? settings?.GetValueOrDefault("entityAuthProd")?.ToString()
                    : settings?.GetValueOrDefault("entityAuthTest")?.ToString();

                var entityUrl = isProduction
                    ? settings?.GetValueOrDefault("entityUrlProd")?.ToString()
                    : settings?.GetValueOrDefault("entityUrlTest")?.ToString();

                // Query payment status (like legacy PHP)
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {entityAuth}");

                var statusUrl = $"{entityUrl}/{id}/payment?entityId={entityId}";
                var response = await httpClient.GetAsync(statusUrl);
                var responseString = await response.Content.ReadAsStringAsync();
                var statusResult = JsonSerializer.Deserialize<Dictionary<string, object>>(responseString);

                paymentLog.CallbackData = responseString;
                paymentLog.Status = "processing";
                paymentLog.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                if (statusResult != null && statusResult.ContainsKey("result"))
                {
                    var result = JsonSerializer.Deserialize<Dictionary<string, object>>(
                        statusResult["result"].ToString() ?? "{}");
                    
                    var description = result?.GetValueOrDefault("description")?.ToString();

                    // Check if description starts with "Transaction succeeded"
                    if (!string.IsNullOrEmpty(description) && 
                        description.StartsWith("Transaction succeeded", StringComparison.OrdinalIgnoreCase))
                    {
                        paymentLog.Status = "completed";
                        await _context.SaveChangesAsync();

                        await ProcessSuccessfulPayment(paymentLog);

                        return Redirect($"/payment/success?transactionId={paymentLog.TransactionId}");
                    }
                    else
                    {
                        paymentLog.Status = "failed";
                        paymentLog.ErrorMessage = description ?? "Transaction failed";
                        await _context.SaveChangesAsync();

                        return Redirect($"/payment/failed?transactionId={paymentLog.TransactionId}");
                    }
                }

                return BadRequest("Invalid payment status response");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Switch callback");
                return StatusCode(500, "Error processing payment callback");
            }
        }

        // GET: api/payments/qicard/callback
        [AllowAnonymous]
        [HttpGet("qicard/callback")]
        public async Task<IActionResult> QICardCallback()
        {
            try
            {
                _logger.LogInformation("QICard callback received");
                // Simple redirect endpoint - user returns here
                return Redirect("/payment/processing");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing QICard callback");
                return StatusCode(500, "Error processing payment callback");
            }
        }

        // POST: api/payments/qicard/notification
        [AllowAnonymous]
        [HttpPost("qicard/notification")]
        public async Task<IActionResult> QICardNotification()
        {
            try
            {
                // Read raw body
                using var reader = new StreamReader(Request.Body);
                var rawBody = await reader.ReadToEndAsync();

                _logger.LogInformation("QICard notification received: {Body}", rawBody);

                // Get X-Signature header
                if (!Request.Headers.TryGetValue("X-Signature", out var signatureHeader))
                {
                    _logger.LogError("Missing X-Signature header");
                    return BadRequest("Missing signature");
                }

                var signature = signatureHeader.ToString();
                _logger.LogInformation("X-Signature: {Signature}", signature);

                // Get QICard payment method to retrieve public key
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "QICard" && pm.IsActive);

                if (paymentMethod == null)
                {
                    _logger.LogError("QICard payment method not configured");
                    return BadRequest("QICard payment method not configured");
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var publicKey = isProduction
                    ? settings?.GetValueOrDefault("publicKeyProd")?.ToString()
                    : settings?.GetValueOrDefault("publicKeyTest")?.ToString();

                if (string.IsNullOrEmpty(publicKey))
                {
                    _logger.LogError("QICard public key not configured");
                    return StatusCode(500, "Public key not found");
                }

                // Verify RSA signature
                var isValid = VerifyRSASignature(rawBody, signature, publicKey);

                if (!isValid)
                {
                    _logger.LogError("Invalid signature from QICard");
                    // Continue anyway for testing - remove in production
                    // return StatusCode(403, "Invalid signature");
                }
                else
                {
                    _logger.LogInformation("✅ Signature verified successfully");
                }

                // Parse JSON payload
                var data = JsonSerializer.Deserialize<Dictionary<string, object>>(rawBody);

                if (data == null)
                {
                    return BadRequest("Invalid JSON payload");
                }

                var status = data.GetValueOrDefault("status")?.ToString();

                if (status == "SUCCESS")
                {
                    var paymentId = data.GetValueOrDefault("paymentId")?.ToString();
                    
                    if (string.IsNullOrEmpty(paymentId))
                    {
                        _logger.LogError("Missing paymentId in QICard notification");
                        return BadRequest("Missing paymentId");
                    }

                    // Find payment log by GatewayTransactionId (QICard's paymentId)
                    var paymentLog = await _context.PaymentLogs
                        .FirstOrDefaultAsync(p => p.GatewayTransactionId == paymentId && 
                                                 p.Status == "pending" && 
                                                 p.Gateway == "QICard");

                    if (paymentLog == null)
                    {
                        _logger.LogWarning("Payment not found or already processed: PaymentId={PaymentId}", paymentId);
                        return Ok("Payment not found or already processed");
                    }

                    // Update payment log
                    paymentLog.CallbackData = rawBody;
                    paymentLog.Status = "processing";
                    paymentLog.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    // Process successful payment
                    await ProcessSuccessfulPayment(paymentLog);

                    _logger.LogInformation("QICard payment processed successfully: TransactionId={TransactionId}, PaymentId={PaymentId}", 
                        paymentLog.TransactionId, paymentId);
                    return Ok("Success");
                }
                else
                {
                    _logger.LogWarning("QICard payment not successful: {Status}", status);
                    return Ok("Payment not successful");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing QICard notification");
                return StatusCode(500, "Error processing payment notification");
            }
        }

        /// <summary>
        /// Webhook endpoint for encrypted Switch server callbacks
        /// Receives AES-256-GCM encrypted payment notifications
        /// </summary>
        [HttpPost("switch/webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> SwitchWebhook()
        {
            try
            {
                // Log webhook headers and body for debugging
                var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
                using var reader = new StreamReader(Request.Body);
                var rawBody = await reader.ReadToEndAsync();

                // Log the webhook
                var webhookLog = new PaymentLog
                {
                    Gateway = "Switch",
                    TransactionId = $"webhook_{Guid.NewGuid()}",
                    UserId = 0, // System webhook
                    Amount = 0,
                    Currency = "IQD",
                    Status = "webhook",
                    RequestData = JsonSerializer.Serialize(headers),
                    ResponseData = rawBody,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.PaymentLogs.Add(webhookLog);
                await _context.SaveChangesAsync();

                // Extract encryption headers
                var authTag = Request.Headers["x-authentication-tag"].FirstOrDefault();
                var iv = Request.Headers["x-initialization-vector"].FirstOrDefault();

                if (string.IsNullOrEmpty(authTag) || string.IsNullOrEmpty(iv))
                {
                    _logger.LogWarning("Missing encryption headers in Switch webhook");
                    return Ok("Missing encryption headers");
                }

                // Parse encrypted body
                var bodyData = JsonSerializer.Deserialize<Dictionary<string, string>>(rawBody);
                var encryptedBody = bodyData?.GetValueOrDefault("encryptedBody");

                if (string.IsNullOrEmpty(encryptedBody))
                {
                    _logger.LogWarning("Missing encryptedBody in Switch webhook");
                    return Ok("Missing encrypted body");
                }

                // Get decryption key from configuration
                var decryptionKey = _configuration["Switch:DecryptionKey"];
                if (string.IsNullOrEmpty(decryptionKey))
                {
                    _logger.LogError("Switch decryption key not configured");
                    return Ok("Decryption key not configured");
                }

                // Decrypt the payload
                var decryptedData = DecryptSwitchWebhook(encryptedBody, authTag, iv, decryptionKey);
                
                if (!string.IsNullOrEmpty(decryptedData))
                {
                    _logger.LogInformation("Switch webhook decrypted: {Data}", decryptedData);
                    
                    // Update webhook log with decrypted data
                    webhookLog.CallbackData = decryptedData;
                    await _context.SaveChangesAsync();

                    // Process the decrypted payment data
                    var paymentData = JsonSerializer.Deserialize<Dictionary<string, object>>(decryptedData);
                    // TODO: Process payment based on decrypted data
                }

                return Ok("Webhook received");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Switch webhook");
                return Ok("Error processing webhook");
            }
        }

        private string? DecryptSwitchWebhook(string encryptedHex, string authTagHex, string ivHex, string keyHex)
        {
            try
            {
                // Convert hex strings to byte arrays
                var key = Convert.FromHexString(keyHex);
                var iv = Convert.FromHexString(ivHex);
                var authTag = Convert.FromHexString(authTagHex);
                var cipherText = Convert.FromHexString(encryptedHex);

                // Decrypt using AES-256-GCM
                using var aes = new System.Security.Cryptography.AesGcm(key, authTag.Length);
                var decryptedBytes = new byte[cipherText.Length];
                aes.Decrypt(iv, cipherText, authTag, decryptedBytes);

                return Encoding.UTF8.GetString(decryptedBytes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error decrypting Switch webhook");
                return null;
            }
        }

        private bool VerifyRSASignature(string data, string signature, string publicKeyPem)
        {
            try
            {
                // Decode base64 signature
                var signatureBytes = Convert.FromBase64String(signature);
                var dataBytes = Encoding.UTF8.GetBytes(data);

                // Import RSA public key from PEM
                using var rsa = RSA.Create();
                rsa.ImportFromPem(publicKeyPem);

                // Verify signature using SHA256
                return rsa.VerifyData(dataBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying RSA signature");
                return false;
            }
        }

        private async Task ProcessSuccessfulPayment(PaymentLog paymentLog)
        {
            try
            {
                using var transaction = await _context.Database.BeginTransactionAsync();

                // Get the payment method to find its linked wallet
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == paymentLog.Gateway);

                if (paymentMethod?.WalletId == null)
                {
                    _logger.LogWarning(
                        "Payment method {Gateway} has no linked wallet. Payment {TransactionId} cannot be processed.",
                        paymentLog.Gateway, paymentLog.TransactionId);
                    
                    paymentLog.Status = "failed";
                    paymentLog.ErrorMessage = "Payment method has no linked wallet";
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return;
                }

                // Get the payment method's custom wallet
                var customWallet = await _context.CustomWallets
                    .FirstOrDefaultAsync(w => w.Id == paymentMethod.WalletId);

                if (customWallet == null)
                {
                    _logger.LogWarning(
                        "Custom wallet {WalletId} not found for payment method {Gateway}. Payment {TransactionId} cannot be processed.",
                        paymentMethod.WalletId, paymentLog.Gateway, paymentLog.TransactionId);
                    
                    paymentLog.Status = "failed";
                    paymentLog.ErrorMessage = "Custom wallet not found";
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                    return;
                }

                // Create wallet transaction for the payment method's custom wallet
                var walletTransaction = new Transaction
                {
                    UserId = paymentLog.UserId,
                    TransactionType = TransactionType.TopUp,
                    Amount = paymentLog.Amount,
                    Status = TransactionStatus.Completed,
                    Description = $"Payment received via {paymentLog.Gateway} from user {paymentLog.UserId}",
                    PaymentMethod = paymentLog.Gateway,
                    Reference = paymentLog.ReferenceId,
                    WalletType = "custom",
                    CustomWalletId = customWallet.Id,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Transactions.Add(walletTransaction);
                await _context.SaveChangesAsync();

                // Update custom wallet balance
                var balanceBefore = customWallet.CurrentBalance;
                customWallet.CurrentBalance += paymentLog.Amount;
                customWallet.UpdatedAt = DateTime.UtcNow;

                // Link payment log to wallet transaction
                paymentLog.WalletTransactionId = walletTransaction.Id;
                paymentLog.Status = "completed";
                paymentLog.CompletedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Payment processed successfully. Transaction: {TransactionId}, Gateway: {Gateway}, Custom Wallet: {WalletName}, Amount: {Amount}, Balance: {BalanceBefore} -> {BalanceAfter}",
                    paymentLog.TransactionId, paymentLog.Gateway, customWallet.Name, paymentLog.Amount, balanceBefore, customWallet.CurrentBalance);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing successful payment for transaction {TransactionId}", paymentLog.TransactionId);
                throw;
            }
        }

        // GET: api/payments/status/{transactionId}
        [HttpGet("status/{transactionId}")]
        public async Task<ActionResult<PaymentStatusResponse>> GetPaymentStatus(string transactionId)
        {
            try
            {
                var userId = User.GetSystemUserId();
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId && p.UserId == userId);

                if (paymentLog == null)
                {
                    return NotFound(new { message = "Payment not found" });
                }

                return Ok(new PaymentStatusResponse
                {
                    TransactionId = paymentLog.TransactionId,
                    Status = paymentLog.Status,
                    Amount = paymentLog.Amount,
                    Currency = paymentLog.Currency,
                    Gateway = paymentLog.Gateway,
                    CreatedAt = paymentLog.CreatedAt,
                    CompletedAt = paymentLog.CompletedAt,
                    ErrorMessage = paymentLog.ErrorMessage
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting payment status");
                return StatusCode(500, new { message = "Error retrieving payment status" });
            }
        }

        // GET: api/payments/wallet/balance
        [HttpGet("wallet/balance")]
        public async Task<ActionResult<WalletBalanceResponse>> GetWalletBalance()
        {
            try
            {
                var userId = User.GetSystemUserId();
                var wallet = await _context.UserWallets
                    .FirstOrDefaultAsync(w => w.UserId == userId);

                if (wallet == null)
                {
                    return Ok(new WalletBalanceResponse
                    {
                        CurrentBalance = 0,
                        Status = "inactive"
                    });
                }

                return Ok(new WalletBalanceResponse
                {
                    CurrentBalance = wallet.CurrentBalance,
                    Status = wallet.Status,
                    DailySpendingLimit = wallet.DailySpendingLimit,
                    MaxFillLimit = wallet.MaxFillLimit
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting wallet balance");
                return StatusCode(500, new { message = "Error retrieving wallet balance" });
            }
        }

        private string GenerateJWT(string payload, string secret)
        {
            var header = Convert.ToBase64String(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}"))
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');

            var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(payload))
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');

            var signature = ComputeHMACSHA256($"{header}.{payloadBase64}", secret);

            return $"{header}.{payloadBase64}.{signature}";
        }

        private string DecodeJWT(string token, string secret)
        {
            var parts = token.Split('.');
            if (parts.Length != 3)
            {
                throw new ArgumentException("Invalid JWT token");
            }

            var payload = parts[1];
            payload = payload.Replace('-', '+').Replace('_', '/');
            
            switch (payload.Length % 4)
            {
                case 2: payload += "=="; break;
                case 3: payload += "="; break;
            }

            return Encoding.UTF8.GetString(Convert.FromBase64String(payload));
        }

        /// <summary>
        /// Get payment history for all users (admin endpoint)
        /// </summary>
        [HttpGet("history")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public async Task<ActionResult<IEnumerable<PaymentLog>>> GetPaymentHistory(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] string? status = null)
        {
            var query = _context.PaymentLogs.AsQueryable();

            // Filter by status if provided
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(p => p.Status.ToLower() == status.ToLower());
            }

            var totalCount = await query.CountAsync();

            var paymentLogs = await query
                .OrderByDescending(p => p.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Get unique user IDs from payment logs
            var userIds = paymentLogs.Select(p => p.UserId).Distinct().ToList();

            // Fetch users from master database
            var users = await _masterContext.Users
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Username, u.Email })
                .ToListAsync();

            // Create a dictionary for fast lookup
            var userDict = users.ToDictionary(u => u.Id);

            // Join in memory and project to result (Uuid only — never expose internal Id)
            var result = paymentLogs.Select(p => new
            {
                p.Uuid,
                p.TransactionId,
                p.Gateway,
                p.Amount,
                p.Currency,
                p.Status,
                p.ReferenceId,
                p.GatewayTransactionId,
                p.ErrorMessage,
                p.Environment,
                p.CreatedAt,
                p.UpdatedAt,
                UserName = userDict.TryGetValue(p.UserId, out var user) ? user.Username : null,
                UserEmail = userDict.TryGetValue(p.UserId, out var userEmail) ? userEmail.Email : null
            }).ToList();

            Response.Headers.Append("X-Total-Count", totalCount.ToString());
            Response.Headers.Append("X-Page-Number", pageNumber.ToString());
            Response.Headers.Append("X-Page-Size", pageSize.ToString());

            return Ok(result);
        }

        /// <summary>
        /// Unified inquiry endpoint — fetches payment details from stored data and optionally queries the live gateway
        /// </summary>
        /// <param name="uuid">The payment UUID</param>
        /// <returns>Payment details including stored data and live gateway status</returns>
        [HttpGet("{uuid:guid}/inquiry")]
        [ProducesResponseType(typeof(PaymentInquiryResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult<PaymentInquiryResponse>> InquirePayment(Guid uuid)
        {
            using var activity = ActivitySource.StartActivity("InquirePayment");
            activity?.SetTag("payment.uuid", uuid);

            try
            {
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.Uuid == uuid);

                if (paymentLog == null)
                {
                    return NotFound(new { message = "Payment not found" });
                }

                // Parse stored JSONB fields into objects for the response
                object? requestData = null;
                object? responseData = null;
                object? callbackData = null;

                try { if (!string.IsNullOrEmpty(paymentLog.RequestData)) requestData = JsonSerializer.Deserialize<object>(paymentLog.RequestData); } catch { requestData = paymentLog.RequestData; }
                try { if (!string.IsNullOrEmpty(paymentLog.ResponseData)) responseData = JsonSerializer.Deserialize<object>(paymentLog.ResponseData); } catch { responseData = paymentLog.ResponseData; }
                try { if (!string.IsNullOrEmpty(paymentLog.CallbackData)) callbackData = JsonSerializer.Deserialize<object>(paymentLog.CallbackData); } catch { callbackData = paymentLog.CallbackData; }

                var response = new PaymentInquiryResponse
                {
                    Uuid = paymentLog.Uuid,
                    TransactionId = paymentLog.TransactionId,
                    Gateway = paymentLog.Gateway,
                    Amount = paymentLog.Amount,
                    Currency = paymentLog.Currency,
                    Status = paymentLog.Status,
                    ReferenceId = paymentLog.ReferenceId,
                    GatewayTransactionId = paymentLog.GatewayTransactionId,
                    Environment = paymentLog.Environment,
                    ErrorMessage = paymentLog.ErrorMessage,
                    ServiceType = paymentLog.ServiceType,
                    CreatedAt = paymentLog.CreatedAt,
                    UpdatedAt = paymentLog.UpdatedAt,
                    CompletedAt = paymentLog.CompletedAt,
                    RequestData = requestData,
                    ResponseData = responseData,
                    CallbackData = callbackData,
                };

                // Attempt to fetch live status from the gateway
                response.LiveData = paymentLog.Gateway switch
                {
                    "ZainCashV2" => await InquireZainCashV2Async(paymentLog),
                    "QICard" => await InquireQICardAsync(paymentLog),
                    "Switch" => await InquireSwitchAsync(paymentLog),
                    _ => new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = $"Live inquiry not supported for {paymentLog.Gateway}. Showing stored data only.",
                        QueriedAt = DateTime.UtcNow
                    }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inquiring payment {Uuid}", uuid);
                return StatusCode(500, new { message = "Error inquiring payment" });
            }
        }

        /// <summary>
        /// Force-completes a stuck/failed payment that was actually paid.
        /// Creates a full audit trail with justification and proof document upload.
        /// Processes wallet balance credit identical to normal successful payment flow.
        /// </summary>
        /// <param name="uuid">The payment UUID</param>
        /// <param name="justification">Admin's justification text (required, max 2000 chars)</param>
        /// <param name="document">Proof document upload (receipt, screenshot, etc.)</param>
        [HttpPost("{uuid:guid}/force-complete")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> ForceCompletePayment(
            Guid uuid,
            [FromForm][Required][MaxLength(2000)] string justification,
            [FromForm][Required] IFormFile document)
        {
            using var activity = ActivitySource.StartActivity("ForceCompletePayment");
            activity?.SetTag("payment.uuid", uuid);

            try
            {
                var adminUserId = User.GetSystemUserId();
                if (adminUserId == null)
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Validate justification
                if (string.IsNullOrWhiteSpace(justification))
                {
                    return BadRequest(new { message = "Justification is required" });
                }

                if (justification.Length > 2000)
                {
                    return BadRequest(new { message = "Justification must be 2000 characters or less" });
                }

                // Validate document
                if (document == null || document.Length == 0)
                {
                    return BadRequest(new { message = "Proof document is required" });
                }

                // Validate file type (images and PDFs only)
                var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf" };
                if (!allowedTypes.Contains(document.ContentType?.ToLower()))
                {
                    return BadRequest(new { message = "Only image files (JPEG, PNG, GIF, WebP) and PDF documents are allowed" });
                }

                // Max file size: 10MB
                const long maxFileSize = 10 * 1024 * 1024;
                if (document.Length > maxFileSize)
                {
                    return BadRequest(new { message = "File size must be 10MB or less" });
                }

                // Find the payment log
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.Uuid == uuid);

                if (paymentLog == null)
                {
                    return NotFound(new { message = "Payment not found" });
                }

                // Prevent force-completing an already completed payment
                if (paymentLog.Status == "completed")
                {
                    return Conflict(new { message = "Payment is already completed. Force completion is not allowed." });
                }

                // Check if this payment was already force-completed
                var existingForceCompletion = await _context.PaymentForceCompletions
                    .AnyAsync(fc => fc.PaymentLogId == paymentLog.Id);

                if (existingForceCompletion)
                {
                    return Conflict(new { message = "This payment has already been force-completed." });
                }

                // Save the proof document to disk
                var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "PaymentReceipts");
                Directory.CreateDirectory(uploadsDir);

                var fileExtension = Path.GetExtension(document.FileName);
                var safeFileName = $"{uuid}_{DateTime.UtcNow:yyyyMMddHHmmss}{fileExtension}";
                var filePath = Path.Combine(uploadsDir, safeFileName);

                await using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await document.CopyToAsync(stream);
                }

                // Store the previous status for audit
                var previousStatus = paymentLog.Status;

                // Get IP address
                var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

                // Pre-validate: ensure the payment method exists and has a linked wallet
                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == paymentLog.Gateway);

                if (paymentMethod == null)
                {
                    return BadRequest(new { message = $"Payment method '{paymentLog.Gateway}' not found. Please ensure the payment method is configured before force-completing." });
                }

                if (paymentMethod.WalletId == null)
                {
                    return BadRequest(new { message = $"Payment method '{paymentLog.Gateway}' has no linked wallet. Please link a wallet to this payment method in Settings → Payment Methods before force-completing." });
                }

                var targetWallet = await _context.CustomWallets
                    .FirstOrDefaultAsync(w => w.Id == paymentMethod.WalletId);

                if (targetWallet == null)
                {
                    return BadRequest(new { message = $"The wallet linked to payment method '{paymentLog.Gateway}' was not found. Please verify the wallet configuration." });
                }

                _logger.LogWarning(
                    "[ForceComplete] Admin {AdminUserId} force-completing payment {Uuid} (TransactionId={TransactionId}, Gateway={Gateway}, Amount={Amount}, PreviousStatus={PreviousStatus}, TargetWallet={WalletName}). Justification: {Justification}",
                    adminUserId, uuid, paymentLog.TransactionId, paymentLog.Gateway, paymentLog.Amount, previousStatus, targetWallet.Name, justification);

                // Process the payment using the same wallet crediting logic
                await ProcessSuccessfulPayment(paymentLog);

                // Reload to get the updated status and wallet transaction ID
                await _context.Entry(paymentLog).ReloadAsync();

                // Verify the payment was actually processed successfully
                if (paymentLog.Status != "completed")
                {
                    _logger.LogError("[ForceComplete] ProcessSuccessfulPayment did not complete payment {Uuid}. Status={Status}, Error={Error}",
                        uuid, paymentLog.Status, paymentLog.ErrorMessage);
                    return StatusCode(500, new { message = $"Payment processing failed: {paymentLog.ErrorMessage ?? "Unknown error"}. The wallet was not credited." });
                }

                // Create the audit record
                var forceCompletion = new PaymentForceCompletion
                {
                    PaymentLogId = paymentLog.Id,
                    PreviousStatus = previousStatus,
                    Justification = justification,
                    DocumentPath = filePath,
                    DocumentFileName = document.FileName,
                    DocumentContentType = document.ContentType,
                    DocumentFileSize = document.Length,
                    AmountCredited = paymentLog.Amount,
                    Gateway = paymentLog.Gateway,
                    TransactionId = paymentLog.TransactionId,
                    IpAddress = ipAddress,
                    CreatedBy = adminUserId.Value
                };

                _context.PaymentForceCompletions.Add(forceCompletion);
                await _context.SaveChangesAsync();

                _logger.LogWarning(
                    "[ForceComplete] Payment {Uuid} force-completed successfully by admin {AdminUserId}. AuditId={AuditUuid}, Amount={Amount}, PreviousStatus={PreviousStatus}",
                    uuid, adminUserId, forceCompletion.Uuid, paymentLog.Amount, previousStatus);

                return Ok(new
                {
                    message = "Payment force-completed successfully",
                    paymentUuid = paymentLog.Uuid,
                    auditUuid = forceCompletion.Uuid,
                    amountCredited = paymentLog.Amount,
                    previousStatus,
                    newStatus = paymentLog.Status
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ForceComplete] Error force-completing payment {Uuid}", uuid);
                return StatusCode(500, new { message = "Error force-completing payment. Please try again." });
            }
        }

        /// <summary>
        /// Queries ZainCash V2 inquiry API for live transaction status
        /// </summary>
        private async Task<PaymentInquiryLiveData> InquireZainCashV2Async(PaymentLog paymentLog)
        {
            try
            {
                // The gatewayTransactionId for ZainCashV2 is the ZainCash transaction ID
                var gatewayTxId = paymentLog.GatewayTransactionId;
                if (string.IsNullOrEmpty(gatewayTxId))
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "No gateway transaction ID stored — cannot query ZainCash V2",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "ZainCashV2" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "ZainCash V2 payment method not configured or inactive",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInquiryLiveData { Success = false, ErrorMessage = "Invalid payment method settings", QueriedAt = DateTime.UtcNow };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var clientId = isProduction
                    ? settings.GetValueOrDefault("clientIdProd")?.ToString()
                    : settings.GetValueOrDefault("clientIdTest")?.ToString();

                var clientSecret = isProduction
                    ? settings.GetValueOrDefault("clientSecretProd")?.ToString()
                    : settings.GetValueOrDefault("clientSecretTest")?.ToString();

                var baseUrl = isProduction
                    ? settings.GetValueOrDefault("baseUrlProd")?.ToString() ?? ""
                    : settings.GetValueOrDefault("baseUrlTest")?.ToString() ?? "https://pg-api-uat.zaincash.iq";

                var scope = settings.GetValueOrDefault("scope")?.ToString() ?? "payment:read payment:write";

                if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
                {
                    return new PaymentInquiryLiveData { Success = false, ErrorMessage = "Missing ZainCash V2 credentials", QueriedAt = DateTime.UtcNow };
                }

                var accessToken = await GetZainCashV2TokenAsync(baseUrl, clientId, clientSecret, scope);
                var inquiryUrl = $"{baseUrl.TrimEnd('/')}/api/v2/payment-gateway/transaction/inquiry/{gatewayTxId}";

                var httpClient = _httpClientFactory.CreateClient("ZainCashV2Payment");
                httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

                _logger.LogInformation("[Inquiry] ZainCashV2 inquiry: {Url}", inquiryUrl);
                var response = await httpClient.GetAsync(inquiryUrl);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[Inquiry] ZainCashV2 response: Status={StatusCode}", response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = $"Gateway returned {response.StatusCode}",
                        RawResponse = responseBody,
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var inquiry = JsonSerializer.Deserialize<object>(responseBody);
                var inquiryTyped = JsonSerializer.Deserialize<ZainCashV2InquiryResponse>(responseBody);

                return new PaymentInquiryLiveData
                {
                    Success = true,
                    GatewayStatus = inquiryTyped?.Status,
                    RawResponse = inquiry,
                    QueriedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Inquiry] Error querying ZainCash V2 for {TransactionId}", paymentLog.TransactionId);
                return new PaymentInquiryLiveData
                {
                    Success = false,
                    ErrorMessage = $"Error querying gateway: {ex.Message}",
                    QueriedAt = DateTime.UtcNow
                };
            }
        }

        /// <summary>
        /// Queries QICard API for live payment status using GET /api/v1/payment/{paymentId}/status
        /// </summary>
        private async Task<PaymentInquiryLiveData> InquireQICardAsync(PaymentLog paymentLog)
        {
            try
            {
                // The GatewayTransactionId for QICard is the QICard paymentId
                var paymentId = paymentLog.GatewayTransactionId;
                if (string.IsNullOrEmpty(paymentId))
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "No gateway transaction ID (paymentId) stored — cannot query QICard",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "QICard" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "QICard payment method not configured or inactive",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                if (settings == null)
                {
                    return new PaymentInquiryLiveData { Success = false, ErrorMessage = "Invalid payment method settings", QueriedAt = DateTime.UtcNow };
                }

                var isProduction = settings.ContainsKey("isProduction") &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var username = isProduction
                    ? settings.GetValueOrDefault("usernameProd")?.ToString()
                    : settings.GetValueOrDefault("usernameTest")?.ToString();

                var password = isProduction
                    ? settings.GetValueOrDefault("passwordProd")?.ToString()
                    : settings.GetValueOrDefault("passwordTest")?.ToString();

                var terminalId = isProduction
                    ? settings.GetValueOrDefault("terminalIdProd")?.ToString()
                    : settings.GetValueOrDefault("terminalIdTest")?.ToString();

                var apiUrl = isProduction
                    ? settings.GetValueOrDefault("urlProd")?.ToString()
                    : settings.GetValueOrDefault("urlTest")?.ToString();

                if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) ||
                    string.IsNullOrEmpty(terminalId) || string.IsNullOrEmpty(apiUrl))
                {
                    return new PaymentInquiryLiveData { Success = false, ErrorMessage = "Missing QICard credentials", QueriedAt = DateTime.UtcNow };
                }

                // Build status inquiry URL: GET /api/v1/payment/{paymentId}/status
                var statusUrl = $"{apiUrl.TrimEnd('/')}/payment/{paymentId}/status";

                var httpClient = _httpClientFactory.CreateClient("QICardPayment");
                var request = new HttpRequestMessage(HttpMethod.Get, statusUrl);

                // Add X-Terminal-Id header
                request.Headers.Add("X-Terminal-Id", terminalId);

                // Add Basic Authentication
                var authBytes = Encoding.UTF8.GetBytes($"{username}:{password}");
                var authBase64 = Convert.ToBase64String(authBytes);
                request.Headers.Add("Authorization", $"Basic {authBase64}");

                _logger.LogInformation("[Inquiry] QICard status check: {Url}, PaymentId={PaymentId}", statusUrl, paymentId);

                var response = await httpClient.SendAsync(request);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[Inquiry] QICard response: Status={StatusCode}", response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = $"Gateway returned {response.StatusCode}",
                        RawResponse = responseBody,
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var rawObj = JsonSerializer.Deserialize<object>(responseBody);
                var statusResult = JsonSerializer.Deserialize<Dictionary<string, object>>(responseBody);
                var gatewayStatus = statusResult?.GetValueOrDefault("status")?.ToString();

                return new PaymentInquiryLiveData
                {
                    Success = true,
                    GatewayStatus = gatewayStatus,
                    RawResponse = rawObj,
                    QueriedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Inquiry] Error querying QICard for {TransactionId}", paymentLog.TransactionId);
                return new PaymentInquiryLiveData
                {
                    Success = false,
                    ErrorMessage = $"Error querying gateway: {ex.Message}",
                    QueriedAt = DateTime.UtcNow
                };
            }
        }

        /// <summary>
        /// Queries Switch (OPPWA) API for live transaction status
        /// </summary>
        private async Task<PaymentInquiryLiveData> InquireSwitchAsync(PaymentLog paymentLog)
        {
            try
            {
                var referenceId = paymentLog.ReferenceId;
                if (string.IsNullOrEmpty(referenceId))
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "No reference ID stored — cannot query Switch/OPPWA",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Type == "Switch" && pm.IsActive);

                if (paymentMethod == null)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = "Switch payment method not configured or inactive",
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentMethod.Settings);
                var isProduction = settings?.ContainsKey("isProduction") == true &&
                                 settings["isProduction"].ToString()?.ToLower() == "true";

                var entityId = isProduction
                    ? settings?.GetValueOrDefault("entityIdProd")?.ToString()
                    : settings?.GetValueOrDefault("entityIdTest")?.ToString();

                var entityAuth = isProduction
                    ? settings?.GetValueOrDefault("entityAuthProd")?.ToString()
                    : settings?.GetValueOrDefault("entityAuthTest")?.ToString();

                var entityUrl = isProduction
                    ? settings?.GetValueOrDefault("entityUrlProd")?.ToString()
                    : settings?.GetValueOrDefault("entityUrlTest")?.ToString();

                if (string.IsNullOrEmpty(entityAuth) || string.IsNullOrEmpty(entityUrl))
                {
                    return new PaymentInquiryLiveData { Success = false, ErrorMessage = "Missing Switch credentials", QueriedAt = DateTime.UtcNow };
                }

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {entityAuth}");

                var statusUrl = $"{entityUrl}/{referenceId}/payment?entityId={entityId}";
                _logger.LogInformation("[Inquiry] Switch status check: {Url}", statusUrl);

                var response = await httpClient.GetAsync(statusUrl);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[Inquiry] Switch response: Status={StatusCode}", response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    return new PaymentInquiryLiveData
                    {
                        Success = false,
                        ErrorMessage = $"Gateway returned {response.StatusCode}",
                        RawResponse = responseBody,
                        QueriedAt = DateTime.UtcNow
                    };
                }

                var rawObj = JsonSerializer.Deserialize<object>(responseBody);
                var statusResult = JsonSerializer.Deserialize<Dictionary<string, object>>(responseBody);
                string? gatewayStatus = null;

                if (statusResult != null && statusResult.ContainsKey("result"))
                {
                    var result = JsonSerializer.Deserialize<Dictionary<string, object>>(
                        statusResult["result"].ToString() ?? "{}");
                    gatewayStatus = result?.GetValueOrDefault("description")?.ToString();
                }

                return new PaymentInquiryLiveData
                {
                    Success = true,
                    GatewayStatus = gatewayStatus,
                    RawResponse = rawObj,
                    QueriedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Inquiry] Error querying Switch for {TransactionId}", paymentLog.TransactionId);
                return new PaymentInquiryLiveData
                {
                    Success = false,
                    ErrorMessage = $"Error querying gateway: {ex.Message}",
                    QueriedAt = DateTime.UtcNow
                };
            }
        }

        private string ComputeHMACSHA256(string data, string secret)
        {
            var keyBytes = Encoding.UTF8.GetBytes(secret);
            var dataBytes = Encoding.UTF8.GetBytes(data);

            using var hmac = new HMACSHA256(keyBytes);
            var hash = hmac.ComputeHash(dataBytes);

            return Convert.ToBase64String(hash)
                .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}

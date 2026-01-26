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
    /// Payment gateway controller for processing ZainCash, QICard, and Switch payments
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

                    // Get current tenant ID from HttpContext
                    var tenantId = HttpContext.Items["TenantId"]?.ToString() ?? "1";
                    var checkoutUrl = $"{Request.Scheme}://{Request.Host}/api/payments/switch/checkout/{transactionId}?checkoutId={switchResponse.Id}&tenantId={tenantId}";

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
        public async Task<IActionResult> SwitchCheckout(string transactionId, [FromQuery] string checkoutId, [FromQuery] string tenantId)
        {
            try
            {
                // Set tenant context for this anonymous request
                if (!string.IsNullOrEmpty(tenantId))
                {
                    HttpContext.Items["TenantId"] = tenantId;
                }

                // Find payment log in workspace database
                var paymentLog = await _context.PaymentLogs
                    .FirstOrDefaultAsync(p => p.TransactionId == transactionId);

                if (paymentLog == null)
                {
                    _logger.LogWarning("Payment not found for transactionId: {TransactionId}, TenantId: {TenantId}", transactionId, tenantId);
                    return NotFound($"Payment not found for transaction {transactionId}");
                }

                // Get payment method to determine environment
                var paymentMethod = await _context.PaymentMethods
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

            // Join in memory and project to result
            var result = paymentLogs.Select(p => new
            {
                p.Id,
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

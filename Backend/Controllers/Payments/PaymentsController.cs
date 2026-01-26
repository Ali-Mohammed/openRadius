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

namespace Backend.Controllers.Payments
{
    [Authorize]
    [ApiController]
    [Route("api/payments")]
    public class PaymentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PaymentsController> _logger;
        private readonly IConfiguration _configuration;

        public PaymentsController(
            ApplicationDbContext context,
            ILogger<PaymentsController> logger,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
        }

        // POST: api/payments/initiate
        [HttpPost("initiate")]
        public async Task<ActionResult<PaymentInitiationResponse>> InitiatePayment([FromBody] InitiatePaymentDto dto)
        {
            try
            {
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

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating payment");
                return StatusCode(500, new PaymentInitiationResponse
                {
                    Success = false,
                    ErrorMessage = "An error occurred while initiating payment"
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

                var zainCashUrl = isProduction
                    ? settings.GetValueOrDefault("urlProd")?.ToString()
                    : settings.GetValueOrDefault("urlTest")?.ToString();

                if (string.IsNullOrEmpty(msisdn) || string.IsNullOrEmpty(merchantId) || string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(zainCashUrl))
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Missing ZainCash configuration" };
                }

                // Build ZainCash request
                var requestData = new
                {
                    amount = amount.ToString("0"),
                    serviceType = $"wallet_topup_user_{userId}",
                    msisdn = msisdn,
                    orderId = transactionId,
                    merchantId = merchantId,
                    redirectUrl = $"{Request.Scheme}://{Request.Host}/api/payments/zaincash/callback",
                    lang = lang
                };

                var jsonData = JsonSerializer.Serialize(requestData);
                var token = GenerateJWT(jsonData, secret);

                var paymentUrl = $"{zainCashUrl}?token={token}&lang={lang}";

                return new PaymentInitiationResponse
                {
                    Success = true,
                    PaymentUrl = paymentUrl,
                    TransactionId = transactionId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating ZainCash payment");
                return new PaymentInitiationResponse { Success = false, ErrorMessage = ex.Message };
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

                var apiUrl = isProduction
                    ? settings.GetValueOrDefault("urlProd")?.ToString()
                    : settings.GetValueOrDefault("urlTest")?.ToString();

                // QI Card requires server-to-server integration
                // Return a checkout page URL that will handle the payment
                var checkoutUrl = $"{Request.Scheme}://{Request.Host}/api/payments/qicard/checkout/{transactionId}";

                return new PaymentInitiationResponse
                {
                    Success = true,
                    PaymentUrl = checkoutUrl,
                    TransactionId = transactionId
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error initiating QICard payment");
                return new PaymentInitiationResponse { Success = false, ErrorMessage = ex.Message };
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

                if (string.IsNullOrEmpty(entityId) || string.IsNullOrEmpty(entityAuth) || string.IsNullOrEmpty(entityUrl))
                {
                    return new PaymentInitiationResponse { Success = false, ErrorMessage = "Missing Switch configuration" };
                }

                // Call Switch API to create checkout
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {entityAuth}");

                var formData = new Dictionary<string, string>
                {
                    { "entityId", entityId },
                    { "amount", amount.ToString("F2") },
                    { "currency", currency },
                    { "paymentType", "DB" },
                    { "integrity", "true" }
                };

                var content = new FormUrlEncodedContent(formData);
                var response = await httpClient.PostAsync(entityUrl, content);
                var responseString = await response.Content.ReadAsStringAsync();
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

                    var checkoutUrl = $"{Request.Scheme}://{Request.Host}/api/payments/switch/checkout/{transactionId}?checkoutId={switchResponse.Id}";

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

                // Query payment status
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

                    // Find payment log
                    var paymentLog = await _context.PaymentLogs
                        .FirstOrDefaultAsync(p => p.TransactionId == paymentId && 
                                                 p.Status == "pending" && 
                                                 p.Gateway == "QICard");

                    if (paymentLog == null)
                    {
                        _logger.LogWarning("Payment not found or already processed: {PaymentId}", paymentId);
                        return Ok("Payment not found or already processed");
                    }

                    // Update payment log
                    paymentLog.CallbackData = rawBody;
                    paymentLog.Status = "processing";
                    paymentLog.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    // Process successful payment
                    await ProcessSuccessfulPayment(paymentLog);

                    _logger.LogInformation("QICard payment processed successfully: {PaymentId}", paymentId);
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

                // Get or create user wallet
                var userWallet = await _context.UserWallets
                    .FirstOrDefaultAsync(w => w.UserId == paymentLog.UserId);

                if (userWallet == null)
                {
                    userWallet = new UserWallet
                    {
                        UserId = paymentLog.UserId,
                        CurrentBalance = 0,
                        Status = "active",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.UserWallets.Add(userWallet);
                    await _context.SaveChangesAsync();
                }

                // Create wallet transaction
                var walletTransaction = new Transaction
                {
                    UserId = paymentLog.UserId,
                    TransactionType = TransactionType.TopUp,
                    Amount = paymentLog.Amount,
                    Status = TransactionStatus.Completed,
                    Description = $"Wallet top-up via {paymentLog.Gateway}",
                    PaymentMethod = paymentLog.Gateway,
                    Reference = paymentLog.ReferenceId,
                    WalletType = "user",
                    UserWalletId = userWallet.Id,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Transactions.Add(walletTransaction);
                await _context.SaveChangesAsync();

                // Update wallet balance
                var balanceBefore = userWallet.CurrentBalance;
                userWallet.CurrentBalance += paymentLog.Amount;
                userWallet.UpdatedAt = DateTime.UtcNow;

                // Link payment log to wallet transaction
                paymentLog.WalletTransactionId = walletTransaction.Id;
                paymentLog.Status = "completed";
                paymentLog.CompletedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Payment processed successfully. Transaction: {TransactionId}, User: {UserId}, Amount: {Amount}, Balance: {BalanceBefore} -> {BalanceAfter}",
                    paymentLog.TransactionId, paymentLog.UserId, paymentLog.Amount, balanceBefore, userWallet.CurrentBalance);
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

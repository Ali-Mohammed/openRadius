# QICard Payment Integration Guide

## Overview

Complete implementation of QICard payment gateway integration matching the legacy PHP system.

## Implementation Flow

### 1. **Payment Initiation**

**Endpoint**: `POST /api/payments/initiate`

```json
{
  "paymentMethodId": 2,
  "amount": 50000,
  "serviceType": "TopUpAgentPortal"
}
```

**Process**:
1. Validates payment method is active
2. Creates payment log in database (status: `pending`)
3. Calls QICard API to create payment:
   - **Endpoint**: `{QI_URL}/payment`
   - **Method**: POST
   - **Headers**:
     - `X-Terminal-Id`: Terminal ID from settings
     - `Authorization`: Basic auth (username:password base64 encoded)
   - **Body**:
     ```json
     {
       "requestId": "uuid",
       "amount": 50000,
       "locale": "en_US",
       "currency": "IQD",
       "finishPaymentUrl": "https://yourapp.com/api/payments/qicard/callback",
       "notificationUrl": "https://yourapp.com/api/payments/qicard/notification"
     }
     ```

4. QICard responds with:
   ```json
   {
     "requestId": "original-uuid",
     "paymentId": "qicard-payment-id",
     "formUrl": "https://qicard.com/payment-form-url"
   }
   ```

5. Stores `paymentId` in `PaymentLog.GatewayTransactionId`
6. Returns `formUrl` to frontend to redirect user

### 2. **User Payment Flow**

1. Frontend redirects user to QICard's `formUrl`
2. User enters card details and completes payment on QICard's site
3. QICard redirects user back to `finishPaymentUrl` (callback endpoint)
4. QICard sends server-to-server notification to `notificationUrl`

### 3. **Callback Endpoint** (User Return)

**Endpoint**: `GET /api/payments/qicard/callback`

- Simple redirect endpoint
- User lands here after payment (success or failure)
- Redirects to: `/payment/processing`
- Frontend polls for status or waits for notification

### 4. **Notification Endpoint** (Server-to-Server)

**Endpoint**: `POST /api/payments/qicard/notification`

**Security**:
- QICard sends RSA-SHA256 signature in `X-Signature` header
- Verifies signature using public key from payment method settings
- Signature validates the request body integrity

**Process**:
1. Receives notification from QICard
2. Extracts `X-Signature` header
3. Verifies RSA signature using QICard public key
4. Parses JSON body:
   ```json
   {
     "status": "SUCCESS",
     "paymentId": "qicard-payment-id",
     "amount": 50000,
     "currency": "IQD",
     ...other fields
   }
   ```
5. Finds payment log by `GatewayTransactionId` (matches QICard's `paymentId`)
6. Updates payment log:
   - Status: `pending` → `processing`
   - Stores callback data
7. Calls `ProcessSuccessfulPayment()` to:
   - Update wallet balance
   - Mark payment as `completed`
   - Create wallet transaction record

## Database Schema

### PaymentLog Table

```sql
CREATE TABLE payment_logs (
    id SERIAL PRIMARY KEY,
    gateway VARCHAR(50) NOT NULL,           -- 'QICard'
    transaction_id VARCHAR(100) NOT NULL,   -- Our internal transaction ID
    gateway_transaction_id VARCHAR(100),    -- QICard's paymentId
    user_id INT NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'IQD',
    status VARCHAR(20) DEFAULT 'pending',   -- pending, processing, completed, failed
    request_data JSONB,                     -- Initial request to QICard
    response_data JSONB,                    -- QICard's response
    callback_data JSONB,                    -- Notification data from QICard
    error_message VARCHAR(500),
    service_type VARCHAR(100),              -- 'TopUpAgentPortal'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

## Payment Method Configuration

### Required Settings

Store in `PaymentMethod.Settings` (JSON):

```json
{
  "isProduction": false,
  
  // Production credentials
  "usernameProd": "prod_username",
  "passwordProd": "prod_password",
  "terminalIdProd": "prod_terminal_id",
  "currencyProd": "IQD",
  "urlProd": "https://api.qicard.iq/prod",
  "publicKeyProd": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  
  // Test credentials
  "usernameTest": "test_username",
  "passwordTest": "test_password",
  "terminalIdTest": "test_terminal_id",
  "currencyTest": "IQD",
  "urlTest": "https://api.qicard.iq/test",
  "publicKeyTest": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
}
```

## Code Components

### 1. InitiateQICardPayment()
- Location: `Controllers/Payments/PaymentsController.cs`
- Calls QICard API to create payment
- Stores QICard's `paymentId` in `GatewayTransactionId`
- Returns `formUrl` for user redirect

### 2. QICardCallback()
- Location: `Controllers/Payments/PaymentsController.cs`
- Handles user return from QICard
- Redirects to processing page

### 3. QICardNotification()
- Location: `Controllers/Payments/PaymentsController.cs`
- Receives server-to-server notification
- Verifies RSA signature
- Updates payment status
- Processes successful payment

### 4. VerifyRSASignature()
- Verifies `X-Signature` header
- Uses QICard's RSA public key
- SHA256 hashing algorithm

### 5. ProcessSuccessfulPayment()
- Updates user wallet balance
- Creates wallet transaction
- Marks payment as completed
- Handles idempotency

## Testing

### 1. Configure Payment Method

```bash
POST /api/payment-methods
{
  "type": "QICard",
  "name": "QI Card Payment",
  "isActive": true,
  "settings": {
    "isProduction": false,
    "usernameTest": "your-test-username",
    "passwordTest": "your-test-password",
    "terminalIdTest": "your-terminal-id",
    "currencyTest": "IQD",
    "urlTest": "https://test-api.qicard.iq",
    "publicKeyTest": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

### 2. Initiate Payment

```bash
POST /api/payments/initiate
Authorization: Bearer {token}
{
  "paymentMethodId": 2,
  "amount": 50000,
  "serviceType": "TopUpAgentPortal"
}
```

Response:
```json
{
  "success": true,
  "paymentUrl": "https://qicard.iq/payment/form/abc123",
  "transactionId": "uuid-from-our-system",
  "additionalData": {
    "qiCardPaymentId": "qicard-payment-id",
    "requestId": "request-uuid"
  }
}
```

### 3. User Completes Payment

1. Redirect user to `paymentUrl`
2. User enters card details on QICard's site
3. QICard redirects to `/api/payments/qicard/callback`
4. QICard sends notification to `/api/payments/qicard/notification`

### 4. Check Payment Status

```bash
GET /api/payments/status/{transactionId}
```

## Security Features

### 1. **RSA Signature Verification**
- QICard signs notification body with private key
- We verify with their public key
- Prevents unauthorized notifications
- SHA256 hashing algorithm

### 2. **HTTPS Only**
- All QICard API calls use HTTPS
- Callbacks and notifications require HTTPS

### 3. **Authentication**
- Basic Auth for API calls (username:password)
- Terminal ID header for additional security

### 4. **Rate Limiting**
- Payment initiation: 10 requests/minute
- Protects against abuse

## Differences from PHP Implementation

| Feature | PHP (Legacy) | C# (.NET) |
|---------|-------------|-----------|
| HTTP Client | Laravel HTTP facade | IHttpClientFactory + Polly |
| Database | Eloquent ORM | Entity Framework Core |
| Signature Verification | `openssl_verify()` | `RSACryptoServiceProvider` |
| Logging | Laravel Log | Serilog + Seq UI |
| Configuration | .env file | appsettings.json + PaymentMethod table |
| Error Handling | Try-catch | Try-catch + Polly resilience |
| Transaction ID | UUID | GUID |
| Wallet Update | DB::transaction | EF transaction |

## Monitoring

### Serilog Logs

View in Seq UI: http://localhost:5341

**Queries**:
```
# All QICard payments
Gateway = 'QICard'

# Failed QICard payments
Gateway = 'QICard' and Status = 'failed'

# QICard notifications
SourceContext like '%QICard%' and @Level = 'Information'

# Signature verification failures
@Message like '%Invalid signature%' and Gateway = 'QICard'
```

### Payment Log Queries

```sql
-- Recent QICard payments
SELECT * FROM payment_logs 
WHERE gateway = 'QICard' 
ORDER BY created_at DESC 
LIMIT 20;

-- Pending QICard payments (might be stuck)
SELECT * FROM payment_logs 
WHERE gateway = 'QICard' 
AND status = 'pending' 
AND created_at < NOW() - INTERVAL '1 hour';

-- Success rate
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM payment_logs 
WHERE gateway = 'QICard'
GROUP BY status;
```

## Troubleshooting

### Payment Stuck in Pending

**Symptoms**: Payment log shows `pending` after 5+ minutes

**Causes**:
1. QICard notification didn't arrive
2. Signature verification failed
3. Network issue

**Solution**:
1. Check Serilog for notification errors
2. Verify public key is correct
3. Check QICard's notification logs
4. Manually call QICard status API

### Invalid Signature Error

**Symptoms**: Logs show "Invalid signature from QICard"

**Causes**:
1. Wrong public key
2. QICard changed their key
3. Body modification during transit

**Solution**:
1. Verify public key matches QICard's documentation
2. Check if body encoding is correct (UTF-8)
3. Contact QICard support

### QICard API Error

**Symptoms**: `InitiateQICardPayment` returns error

**Causes**:
1. Wrong credentials
2. Terminal ID not configured
3. QICard API down

**Solution**:
1. Verify username, password, terminal ID
2. Check `isProduction` flag matches credentials
3. Test with QICard's test environment first

## Next Steps

1. **Test with QICard Test Environment**
   - Get test credentials from QICard
   - Configure payment method with test settings
   - Perform end-to-end test payment

2. **Add Refund Support**
   - Implement QICard refund API
   - Add refund endpoint
   - Update payment log for refunds

3. **Add Payment Status Check**
   - Implement QICard status check API
   - Add cron job to check stuck payments
   - Auto-update payment logs

4. **Production Deployment**
   - Switch to production credentials
   - Update callback URLs to production domain
   - Enable signature verification (remove bypass)
   - Set up monitoring alerts

## API Reference

### QICard Payment API

**Create Payment**:
```http
POST {QI_URL}/payment
X-Terminal-Id: your-terminal-id
Authorization: Basic {base64(username:password)}
Content-Type: application/json

{
  "requestId": "uuid",
  "amount": 50000,
  "locale": "en_US",
  "currency": "IQD",
  "finishPaymentUrl": "callback-url",
  "notificationUrl": "notification-url"
}
```

**Get Payment Status**:
```http
GET {QI_URL}/payment/{paymentId}/status
X-Terminal-Id: your-terminal-id
Authorization: Basic {base64(username:password)}
Accept: application/json
```

**Refund Payment**:
```http
POST {QI_URL}/payment/{paymentId}/refund
X-Terminal-Id: your-terminal-id
Authorization: Basic {base64(username:password)}
Content-Type: application/json

{
  "requestId": "uuid",
  "amount": 50000,
  "message": "Refund reason"
}
```

## Support

- **QICard Documentation**: Contact QICard for API docs
- **Technical Support**: Your development team
- **Serilog Logs**: http://localhost:5341
- **Database**: Check `payment_logs` table

---

**Last Updated**: January 26, 2026  
**Status**: ✅ Fully Implemented  
**Tested**: ⚠️ Awaiting QICard test credentials

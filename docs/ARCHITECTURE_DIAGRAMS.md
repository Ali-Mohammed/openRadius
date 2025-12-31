# OpenRadius OIDC Architecture Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OpenRadius Application                          │
│                                                                           │
│  ┌─────────────────┐         ┌─────────────────┐      ┌──────────────┐ │
│  │                 │         │                 │      │              │ │
│  │   Frontend      │         │    Keycloak     │      │   Backend    │ │
│  │   React 19      │◄───────►│  OIDC Provider  │      │   .NET 10    │ │
│  │   TypeScript    │  OIDC   │   Keycloak      │      │   API        │ │
│  │                 │  Flow   │                 │      │              │ │
│  │ localhost:5173  │         │ localhost:8080  │      │localhost:5000│ │
│  │                 │         │                 │      │              │ │
│  └────────┬────────┘         └─────────────────┘      └───────┬──────┘ │
│           │                                                    │        │
│           │              JWT Bearer Token                      │        │
│           └────────────────────────────────────────────────────┘        │
│                                                                           │
└───────────────────────────────────────┬───────────────────────────────────┘
                                        │
                                        │
                              ┌─────────▼──────────┐
                              │                    │
                              │    PostgreSQL      │
                              │    Database        │
                              │                    │
                              │  - Users           │
                              │  - OidcSettings    │
                              │  - Instants        │
                              │                    │
                              │  localhost:5432    │
                              │                    │
                              └────────────────────┘
```

## OIDC Authorization Code Flow with PKCE

```
┌─────────┐                 ┌──────────┐                  ┌──────────┐
│ Browser │                 │ Frontend │                  │ Keycloak │
└────┬────┘                 └─────┬────┘                  └─────┬────┘
     │                            │                             │
     │  1. Click Login            │                             │
     ├───────────────────────────►│                             │
     │                            │                             │
     │                            │ 2. Generate PKCE            │
     │                            │    Code Verifier            │
     │                            │    Code Challenge           │
     │                            │                             │
     │                            │ 3. Redirect to              │
     │                            │    Authorization Endpoint   │
     │                            │    + Code Challenge         │
     │                            ├────────────────────────────►│
     │                            │                             │
     │                     4. Show Login Form                   │
     │◄──────────────────────────────────────────────────────────┤
     │                            │                             │
     │  5. Enter Credentials      │                             │
     ├───────────────────────────────────────────────────────────►
     │                            │                             │
     │                            │      6. Validate            │
     │                            │         Credentials         │
     │                            │                             │
     │  7. Redirect with          │                             │
     │     Authorization Code     │                             │
     │◄──────────────────────────────────────────────────────────┤
     │                            │                             │
     │  8. Send Code              │                             │
     ├───────────────────────────►│                             │
     │                            │                             │
     │                            │ 9. Exchange Code for Token  │
     │                            │    + Code Verifier          │
     │                            ├────────────────────────────►│
     │                            │                             │
     │                            │     10. Validate PKCE       │
     │                            │         Verifier            │
     │                            │                             │
     │                            │ 11. Return Tokens           │
     │                            │     - Access Token          │
     │                            │     - ID Token              │
     │                            │     - Refresh Token         │
     │                            │◄────────────────────────────┤
     │                            │                             │
     │  12. User Authenticated    │                             │
     │◄───────────────────────────┤                             │
     │                            │                             │
```

## API Request Flow with JWT

```
┌─────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│ Browser │         │ Frontend │         │ Backend  │         │ Keycloak │
└────┬────┘         └─────┬────┘         └─────┬────┘         └─────┬────┘
     │                    │                    │                    │
     │ 1. Request Data    │                    │                    │
     ├───────────────────►│                    │                    │
     │                    │                    │                    │
     │                    │ 2. API Request     │                    │
     │                    │    Authorization:  │                    │
     │                    │    Bearer {token}  │                    │
     │                    ├───────────────────►│                    │
     │                    │                    │                    │
     │                    │                    │ 3. Validate Token  │
     │                    │                    │    - Get JWKS      │
     │                    │                    ├───────────────────►│
     │                    │                    │                    │
     │                    │                    │ 4. Return Public   │
     │                    │                    │    Keys            │
     │                    │                    │◄───────────────────┤
     │                    │                    │                    │
     │                    │                    │ 5. Verify:         │
     │                    │                    │    - Signature     │
     │                    │                    │    - Issuer        │
     │                    │                    │    - Expiration    │
     │                    │                    │    - Audience      │
     │                    │                    │                    │
     │                    │ 6. Return Data     │                    │
     │                    │◄───────────────────┤                    │
     │                    │                    │                    │
     │ 7. Display Data    │                    │                    │
     │◄───────────────────┤                    │                    │
     │                    │                    │                    │
```

## Token Refresh Flow

```
┌──────────┐                                              ┌──────────┐
│ Frontend │                                              │ Keycloak │
└─────┬────┘                                              └─────┬────┘
      │                                                         │
      │  Every 60 seconds:                                     │
      │  Check if token expires in < 70 seconds                │
      │                                                         │
      │  1. Update Token Request                               │
      │     + Refresh Token                                    │
      ├────────────────────────────────────────────────────────►│
      │                                                         │
      │                                2. Validate Refresh Token│
      │                                                         │
      │  3. New Tokens                                         │
      │     - Access Token (fresh)                             │
      │     - ID Token (fresh)                                 │
      │     - Refresh Token (rotated)                          │
      │◄────────────────────────────────────────────────────────┤
      │                                                         │
      │  4. Continue with new tokens                           │
      │                                                         │
      │                                                         │
      │  If refresh fails:                                     │
      │  ├── Log error                                         │
      │  ├── Clear tokens                                      │
      │  └── Redirect to login                                 │
      │                                                         │
```

## Admin Panel Configuration Flow

```
┌──────────┐         ┌─────────────┐         ┌──────────┐
│  Admin   │         │   Backend   │         │ Database │
│  Panel   │         │     API     │         │          │
└────┬─────┘         └──────┬──────┘         └─────┬────┘
     │                      │                      │
     │ 1. View OIDC         │                      │
     │    Settings          │                      │
     ├─────────────────────►│                      │
     │                      │                      │
     │                      │ 2. Query Active      │
     │                      │    Settings          │
     │                      ├─────────────────────►│
     │                      │                      │
     │                      │ 3. Return Config     │
     │                      │◄─────────────────────┤
     │                      │                      │
     │ 4. Display Settings  │                      │
     │◄─────────────────────┤                      │
     │                      │                      │
     │ 5. Update Settings   │                      │
     │    (new config)      │                      │
     ├─────────────────────►│                      │
     │                      │                      │
     │                      │ 6. Validate & Save   │
     │                      ├─────────────────────►│
     │                      │                      │
     │                      │ 7. Confirm           │
     │                      │◄─────────────────────┤
     │                      │                      │
     │ 8. Success Response  │                      │
     │◄─────────────────────┤                      │
     │                      │                      │
     │ 9. Test Connection   │                      │
     ├─────────────────────►│                      │
     │                      │                      │
     │                      │ 10. GET metadata     │
     │                      │     endpoint         │
     │                      ├──────────────┐       │
     │                      │              │       │
     │                      │ 11. Result   │       │
     │                      │◄─────────────┘       │
     │                      │                      │
     │ 12. Connection OK/   │                      │
     │     Failed           │                      │
     │◄─────────────────────┤                      │
     │                      │                      │
```

## Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Components                      │
│                                                               │
│  ┌────────────────┐    ┌─────────────────┐                  │
│  │  App.tsx       │───►│ KeycloakContext │                  │
│  │  Main Router   │    │ OIDC Auth State │                  │
│  └────────┬───────┘    └────────┬────────┘                  │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌────────────────┐    ┌─────────────────┐                  │
│  │ ProtectedRoute │    │ keycloak.ts     │                  │
│  │ Auth Guard     │    │ OIDC Client     │                  │
│  └────────┬───────┘    └────────┬────────┘                  │
│           │                     │                            │
│           ▼                     │                            │
│  ┌────────────────────────────┐ │                            │
│  │      Page Components       │ │                            │
│  │                            │ │                            │
│  │  - Dashboard               │ │                            │
│  │  - Settings                │ │                            │
│  │  - OidcSettings ◄──────────┘                             │
│  │  - ProfileSettings          │                            │
│  └────────────────────────────┘                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Backend Components                        │
│                                                               │
│  ┌────────────────┐                                          │
│  │  Program.cs    │                                          │
│  │  - OIDC Setup  │                                          │
│  │  - JWT Config  │                                          │
│  └────────┬───────┘                                          │
│           │                                                   │
│           ▼                                                   │
│  ┌────────────────────────────────────┐                      │
│  │         Controllers                │                      │
│  │                                    │                      │
│  │  ┌──────────────────────────────┐ │                      │
│  │  │ OidcSettingsController       │ │                      │
│  │  │ [Authorize]                  │ │                      │
│  │  │ - GET /active                │ │                      │
│  │  │ - POST /create               │ │                      │
│  │  │ - PUT /update                │ │                      │
│  │  │ - POST /test                 │ │                      │
│  │  └────────────┬─────────────────┘ │                      │
│  │               │                   │                      │
│  │  ┌────────────▼─────────────────┐ │                      │
│  │  │ UsersController              │ │                      │
│  │  │ [Authorize]                  │ │                      │
│  │  └──────────────────────────────┘ │                      │
│  └────────────────┬───────────────────┘                      │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────┐                      │
│  │  ApplicationDbContext              │                      │
│  │  - Users                           │                      │
│  │  - OidcSettings                    │                      │
│  │  - Instants                        │                      │
│  └────────────────────────────────────┘                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Security Layers                         │
│                                                               │
│  Layer 1: Transport Security                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ HTTPS (Production)                                  │    │
│  │ TLS 1.2+                                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Layer 2: Authentication                                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ OIDC Authorization Code Flow                        │    │
│  │ PKCE (S256)                                         │    │
│  │ JWT Bearer Tokens                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Layer 3: Token Validation                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Signature Verification (RS256)                      │    │
│  │ Issuer Validation                                   │    │
│  │ Expiration Check                                    │    │
│  │ Audience Validation (optional)                      │    │
│  │ Clock Skew Tolerance                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Layer 4: Authorization                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [Authorize] Attributes                              │    │
│  │ Role-Based Access Control (future)                  │    │
│  │ Claims-Based Authorization (future)                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Layer 5: Session Management                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Automatic Token Refresh                             │    │
│  │ Secure Token Storage (memory)                       │    │
│  │ Logout on Refresh Failure                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Login
    ↓
Frontend initiates OIDC flow with PKCE
    ↓
Keycloak authenticates user
    ↓
Returns authorization code
    ↓
Frontend exchanges code for tokens
    ↓
Tokens stored in memory
    ↓
User accesses protected page
    ↓
Frontend makes API request with Bearer token
    ↓
Backend validates token with Keycloak public keys
    ↓
Token is valid → Process request
    ↓
Query PostgreSQL database
    ↓
Return data to frontend
    ↓
Frontend displays data to user

Token Refresh (every 60 seconds)
    ↓
Check if token expires soon
    ↓
Request new token from Keycloak
    ↓
Update stored tokens
    ↓
Continue normal operation
```

## Deployment Architecture (Production)

```
┌───────────────────────────────────────────────────────────────┐
│                         Internet                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                ┌───────────▼────────────┐
                │   Load Balancer        │
                │   SSL/TLS Termination  │
                └───────────┬────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│   Frontend     │  │   Keycloak     │  │   Backend   │
│   (Static)     │  │   (OIDC)       │  │   API       │
│   - CDN        │  │   - Clustered  │  │   - Scaled  │
│   - HTTPS      │  │   - HTTPS      │  │   - HTTPS   │
└────────────────┘  └────────────────┘  └──────┬──────┘
                                               │
                                        ┌──────▼──────┐
                                        │ PostgreSQL  │
                                        │ - Primary   │
                                        │ - Replica   │
                                        └─────────────┘
```

All diagrams represent the current implementation of OpenRadius with OIDC authentication.

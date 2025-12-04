# Garmin Routing Structure - Final Map

## ✅ Complete Routing Map (Next.js App Router)

This document shows the final, production-ready Garmin OAuth and webhook routing structure for both `gofastapp-mvp` and `trainingmvp` applications.

---

## 📍 Route Structure

```
app/
 └─ api/
     ├─ auth/
     │   └─ garmin/
     │       ├─ authorize/
     │       │   └─ route.ts    ✅ GET  /api/auth/garmin/authorize
     │       └─ callback/
     │           └─ route.ts    ✅ GET  /api/auth/garmin/callback
     └─ garmin/
         └─ webhook/
             └─ route.ts        ✅ POST /api/garmin/webhook
```

---

## 🔗 Final Routing Map (Garmin)

### OAuth Flow Routes

| HTTP Method | Route | Handler | Purpose |
|------------|-------|---------|---------|
| **GET** | `/api/auth/garmin/authorize` | `app/api/auth/garmin/authorize/route.ts` | Starts OAuth handshake with Garmin (PKCE flow) |
| **GET** | `/api/auth/garmin/callback` | `app/api/auth/garmin/callback/route.ts` | Handles OAuth callback, exchanges code for tokens, saves to DB |

### Webhook Routes

| HTTP Method | Route | Handler | Purpose |
|------------|-------|---------|---------|
| **POST** | `/api/garmin/webhook` | `app/api/garmin/webhook/route.ts` | Endpoint for Garmin's activity file uploads / notifications |

---

## 🔐 Environment Variables Required

```bash
# Garmin OAuth 2.0 Credentials
GARMIN_CLIENT_ID=""
GARMIN_CLIENT_SECRET=""

# OAuth Callback URL (must match Garmin Developer Portal)
GARMIN_REDIRECT_URI="https://gofast.gofastcrushgoals.com/api/auth/garmin/callback"

# Webhook URL (must match Garmin Developer Portal)
GARMIN_WEBHOOK_URI="https://gofast.gofastcrushgoals.com/api/garmin/webhook"

# Optional: Token secrets
GARMIN_USER_ACCESS_TOKEN_SECRET=""
GARMIN_USER_REFRESH_TOKEN_SECRET=""
```

---

## 📋 Route Details

### 1. GET `/api/auth/garmin/authorize`

**Purpose**: Initiates OAuth 2.0 PKCE flow with Garmin

**Flow**:
1. Authenticates user via Firebase token
2. Generates PKCE code verifier and challenge
3. Stores code verifier in HTTP-only cookie
4. Builds Garmin authorization URL
5. Redirects user to Garmin Connect

**Authentication**: Required (Firebase Bearer token)

**Response**: HTTP 302 Redirect to Garmin

---

### 2. GET `/api/auth/garmin/callback`

**Purpose**: Handles OAuth callback from Garmin

**Flow**:
1. Receives authorization code and state from Garmin
2. Retrieves code verifier from cookie
3. Exchanges code + verifier for access/refresh tokens
4. Fetches Garmin user info to get user ID
5. Saves tokens and user ID to database
6. Cleans up cookies
7. Redirects to success page

**Query Parameters**:
- `code` (required): Authorization code from Garmin
- `state` (required): State parameter for CSRF protection
- `error` (optional): OAuth error from Garmin

**Response**: HTTP 302 Redirect to app success page

---

### 3. POST `/api/garmin/webhook`

**Purpose**: Receives activity data and notifications from Garmin

**Flow**:
1. Immediately responds with 200 OK (required for webhook compliance)
2. Processes webhook data asynchronously
3. Handles different event types:
   - Activity summaries (`activities` array)
   - Activity details (`activityDetails` array)
   - Generic events (`eventType` field)

**Webhook Event Types**:
- `activities` - New activity summaries
- `activityDetails` - Detailed activity data
- `permissions_changed` - User permissions updated
- `user_deregistered` - User disconnected Garmin
- `connection_status` - Connection status changed
- `data_available` - New data available for sync

**Response**: HTTP 200 OK (immediate acknowledgment)

---

## 🗑️ Deleted Legacy Routes

The following legacy routes have been removed:

- ❌ `app/api/garmin/auth-url/route.ts` → Replaced by `/api/auth/garmin/authorize`
- ❌ `app/api/garmin/callback/route.ts` → Replaced by `/api/auth/garmin/callback`
- ❌ `app/api/garmin/activity/route.ts` → Consolidated into `/api/garmin/webhook`

---

## 📦 Supporting Files

### Utility Files

- `lib/garmin-pkce.ts` - PKCE code generation and token exchange utilities
- `lib/domain-garmin.ts` - Database operations for Garmin integration

### Key Functions

**PKCE Utilities** (`lib/garmin-pkce.ts`):
- `generatePKCE()` - Generates code verifier, challenge, and state
- `buildGarminAuthUrl()` - Builds authorization URL with PKCE parameters
- `exchangeCodeForTokens()` - Exchanges authorization code for tokens
- `fetchGarminUserInfo()` - Fetches Garmin user ID

**Domain Functions** (`lib/domain-garmin.ts`):
- `updateGarminConnection()` - Saves tokens and connection status
- `disconnectGarmin()` - Disconnects Garmin integration
- `getGarminConnection()` - Gets connection status
- `getAthleteByGarminUserId()` - Finds athlete by Garmin user ID
- `fetchAndSaveGarminUserInfo()` - Fetches and saves Garmin user info

---

## ✅ Verification Checklist

### Garmin Developer Portal Configuration

- [ ] **OAuth Redirect URI**: `https://gofast.gofastcrushgoals.com/api/auth/garmin/callback`
- [ ] **Webhook URL**: `https://gofast.gofastcrushgoals.com/api/garmin/webhook`
- [ ] **Client ID**: Set in `GARMIN_CLIENT_ID` environment variable
- [ ] **Client Secret**: Set in `GARMIN_CLIENT_SECRET` environment variable

### Database Schema

- [ ] `Athlete` model has all Garmin fields:
  - `garmin_user_id` (String?, unique)
  - `garmin_access_token` (String?)
  - `garmin_refresh_token` (String?)
  - `garmin_expires_in` (Int?)
  - `garmin_scope` (String?)
  - `garmin_connected_at` (DateTime?)
  - `garmin_last_sync_at` (DateTime?)
  - `garmin_is_connected` (Boolean)
  - `garmin_user_profile` (Json?)

### Testing

- [ ] OAuth flow completes successfully
- [ ] Tokens are saved to database
- [ ] Garmin user ID is fetched and saved
- [ ] Webhook receives and processes activities
- [ ] Activities are saved to `AthleteActivity` table

---

## 🚀 Deployment Notes

### Vercel Configuration

1. Set all environment variables in Vercel dashboard
2. Ensure `GARMIN_REDIRECT_URI` matches production domain
3. Ensure `GARMIN_WEBHOOK_URI` matches production domain
4. Register webhook URL in Garmin Developer Portal after deployment

### Production URLs

- **OAuth Callback**: `https://gofast.gofastcrushgoals.com/api/auth/garmin/callback`
- **Webhook**: `https://gofast.gofastcrushgoals.com/api/garmin/webhook`

---

## 📝 Summary

✅ **All routes are correctly structured for Next.js App Router**
✅ **PKCE OAuth 2.0 flow implemented**
✅ **Webhook endpoint responds immediately and processes asynchronously**
✅ **Database models match the flow**
✅ **Legacy routes removed**
✅ **Both `gofastapp-mvp` and `trainingmvp` updated**

The Garmin integration is now production-ready for Vercel deployment! 🎉


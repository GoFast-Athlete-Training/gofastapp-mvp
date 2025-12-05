# Garmin Integration – Legacy Architecture (GoFast Backend)

## Overview

This document details the complete Garmin OAuth 2.0 PKCE integration architecture from the legacy GoFast Backend (`gofastbackendv2-fall2025`). This backend was built with Express.js and Prisma, and served as the production Garmin integration before the Next.js rewrite.

**Key Technologies:**
- Express.js REST API
- Prisma ORM (PostgreSQL)
- Redis (for PKCE code verifier storage)
- OAuth 2.0 PKCE flow
- Multiple webhook endpoints for different event types

---

## OAuth Flow

### Step-by-Step Flow

1. **Frontend initiates OAuth**
   - Frontend calls: `GET /api/garmin/auth-url?athleteId=xxx`
   - Backend generates PKCE parameters (code_verifier, code_challenge, state)
   - Backend stores `code_verifier` in Redis (keyed by `athleteId`)
   - Backend returns authorization URL with `state=athleteId`

2. **User authorizes on Garmin**
   - User redirected to: `https://connect.garmin.com/oauthConfirm?...`
   - Garmin redirects to: `https://gofastbackendv2-fall2025.onrender.com/api/garmin/callback?code=XXX&state=athleteId`

3. **Backend handles callback**
   - Retrieves `code_verifier` from Redis using `state` (which is `athleteId`)
   - Exchanges `code` for access/refresh tokens
   - Fetches Garmin user ID from `/oauth-service/oauth/user-info`
   - Saves tokens + `garmin_user_id` to database
   - Redirects to frontend success page

### Example URLs

**Authorization URL:**
```
https://connect.garmin.com/oauthConfirm?
  client_id=856b6502-0fed-48fb-9e60-643c299fb3b7
  &response_type=code
  &code_challenge=qZr-UQ361IRQtCU2WLbZFXoDB9zFSOAlp97fgUnX0tA
  &code_challenge_method=S256
  &state=cmh9pl5in0000rj1wkijpxl2t
  &scope=CONNECT_READ CONNECT_WRITE PARTNER_READ PARTNER_WRITE
  &redirect_uri=https://gofastbackendv2-fall2025.onrender.com/api/garmin/callback
```

**Callback URL:**
```
https://gofastbackendv2-fall2025.onrender.com/api/garmin/callback?
  code=acb2b209f26246c094bab152507ffec4
  &state=cmh9pl5in0000rj1wkijpxl2t
```

### Where athleteId was inserted

- **State parameter**: `athleteId` was used directly as the `state` value in the OAuth flow
- **Redis key**: `code_verifier` was stored in Redis with key = `athleteId`
- **Callback validation**: `state` from callback was validated against `athleteId` (they should match)

### How GarminUserId was stored

1. **After token exchange**: Backend calls `https://connectapi.garmin.com/oauth-service/oauth/user-info` with access token
2. **Response contains**: `{ userId: "9b1c3de4-5a2b-47c9-8c03-8423f7b4c126" }` (Partner API UUID)
3. **Database save**: `garmin_user_id` field updated in `Athlete` table
4. **Fallback**: If user-info fails, tries `https://apis.garmin.com/wellness-api/rest/user/id`

---

## Authorization URL Format

### Exact Working Pattern

```javascript
// From: services/garminUtils.js - buildAuthUrl()
const params = new URLSearchParams({
  client_id: GARMIN_CONFIG.CLIENT_ID,
  response_type: 'code',
  code_challenge: codeChallenge,  // SHA-256 hash of code_verifier
  code_challenge_method: 'S256',
  state: state,  // athleteId used as state
  scope: 'CONNECT_READ CONNECT_WRITE PARTNER_READ PARTNER_WRITE',
  redirect_uri: `${GARMIN_CONFIG.BACKEND_URL}/api/garmin/callback`
});

return `${GARMIN_CONFIG.AUTHORIZE_URL}?${params.toString()}`;
```

**Key Details:**
- **AUTHORIZE_URL**: `https://connect.garmin.com/oauthConfirm`
- **redirect_uri**: Backend callback URL (not frontend)
- **state**: Used `athleteId` directly (not a random token)
- **Scopes**: Requested all four scopes (CONNECT_READ, CONNECT_WRITE, PARTNER_READ, PARTNER_WRITE)

---

## Callback Handler

### How tokens were exchanged

**File**: `routes/Garmin/garminCodeCatchRoute.js`

```javascript
// Step 1: Get code_verifier from Redis (keyed by athleteId from state)
const codeVerifier = await getCodeVerifier(athleteId);

// Step 2: Exchange code for tokens
const tokenResult = await exchangeCodeForTokens(code, codeVerifier);

// Step 3: Token exchange POST to Garmin
POST https://diauth.garmin.com/di-oauth2-service/oauth/token
Body:
  grant_type: 'authorization_code'
  client_id: GARMIN_CLIENT_ID
  client_secret: GARMIN_CLIENT_SECRET
  code: code
  code_verifier: codeVerifier
  redirect_uri: 'https://gofastbackendv2-fall2025.onrender.com/api/garmin/callback'
```

### How athlete was identified

1. **State = athleteId**: The `state` parameter from callback was the `athleteId`
2. **Redis lookup**: Used `athleteId` to retrieve `code_verifier` from Redis
3. **Validation**: Validated that `state === athleteId` (simple check)

### How Garmin userId was mapped

**File**: `routes/Garmin/garminTokenSaveRoute.js`

```javascript
// Step 1: Save tokens first
await prisma.athlete.update({
  where: { id: athleteId },
  data: {
    garmin_access_token: tokens.access_token,
    garmin_refresh_token: tokens.refresh_token,
    // ... other token fields
  }
});

// Step 2: Fetch user info from Garmin
const userInfoResult = await fetchGarminUserInfo(tokens.access_token);
// Calls: GET https://connectapi.garmin.com/oauth-service/oauth/user-info

// Step 3: Save garmin_user_id
if (userInfoResult.success) {
  const garminUserId = userInfoResult.userData.userId;
  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      garmin_user_id: garminUserId,  // Partner API UUID
      garmin_user_profile: userInfoResult.userData
    }
  });
}
```

**Critical Endpoint:**
- `https://connectapi.garmin.com/oauth-service/oauth/user-info` - Returns Partner API UUID
- Alternative: `https://apis.garmin.com/wellness-api/rest/user/id` - Also returns userId

---

## Token Storage Model

### Database Fields (Athlete Table)

| Field | Type | Description |
|-------|------|-------------|
| `garmin_user_id` | String? | Partner API UUID (from user-info endpoint) |
| `garmin_access_token` | String? | OAuth access token (JWT) |
| `garmin_refresh_token` | String? | OAuth refresh token (JWT) |
| `garmin_expires_in` | Int? | Token expiration in seconds (typically 3600) |
| `garmin_scope` | String? | Space-separated scopes: "CONNECT_READ CONNECT_WRITE PARTNER_READ PARTNER_WRITE" |
| `garmin_connected_at` | DateTime? | Timestamp when connection was established |
| `garmin_last_sync_at` | DateTime? | Last time data was synced |
| `garmin_is_connected` | Boolean | Connection status flag |
| `garmin_permissions` | Json? | Permission details object |
| `garmin_user_profile` | Json? | Full user profile data from Garmin |
| `garmin_user_sleep` | Json? | Sleep preferences |
| `garmin_user_preferences` | Json? | User preferences (measurement system, etc.) |
| `garmin_disconnected_at` | DateTime? | When user disconnected |

### Permission Object Structure

```json
{
  "read": true,
  "write": true,
  "scope": "CONNECT_READ CONNECT_WRITE PARTNER_READ PARTNER_WRITE",
  "grantedAt": "2024-01-01T00:00:00Z",
  "lastChecked": "2024-01-01T00:00:00Z",
  "current": ["CONNECT_READ", "CONNECT_WRITE"]  // From permissions webhook
}
```

---

## Webhook Flow

### Endpoint Structure

**Base Path**: `/api/garmin`

| Endpoint | Method | Purpose | Webhook Type |
|----------|--------|---------|--------------|
| `/api/garmin/activity` | POST | Activity summary webhook | ✅ |
| `/api/garmin/activities` | POST | Manually updated activities | ✅ |
| `/api/garmin/activity-details` | POST | Activity detail/telemetry data | ✅ |
| `/api/garmin/permissions` | PUT/POST | Permission changes | ✅ |
| `/api/garmin/deregistration` | PUT/POST | User deregistration | ✅ |

### Example Payloads

**Activity Summary Webhook:**
```json
{
  "activities": [
    {
      "userId": "9b1c3de4-5a2b-47c9-8c03-8423f7b4c126",
      "activityId": "1234567890",
      "activityName": "Morning Run",
      "activityType": { "typeKey": "running" },
      "startTimeLocal": "2024-01-01T06:00:00Z",
      "distanceInMeters": 5000,
      "durationInSeconds": 1800,
      "averageSpeed": 2.78,
      "calories": 350,
      "averageHeartRate": 150,
      "maxHeartRate": 175,
      "elevationGain": 50,
      "deviceMetaData": {
        "deviceName": "Forerunner 945"
      }
    }
  ]
}
```

**Permission Change Webhook:**
```json
{
  "userPermissionsChange": [
    {
      "userId": "9b1c3de4-5a2b-47c9-8c03-8423f7b4c126"
    }
  ]
}
```

**Deregistration Webhook:**
```json
{
  "userId": "9b1c3de4-5a2b-47c9-8c03-8423f7b4c126"
}
```

### How activities were saved

**File**: `routes/Garmin/garminActivityRoute.js`

1. **Extract userId**: From `activity.userId` or `payload.userId` (root level)
2. **Find athlete**: `findAthleteByGarminUserId(userId)` service
3. **Map fields**: `GarminFieldMapper.mapActivitySummary(activity, athleteId)`
4. **Validate**: `GarminFieldMapper.validateActivity(mappedActivity)`
5. **Upsert**: `prisma.athleteActivity.upsert()` using `sourceActivityId` as unique key

**Key Mapping Logic:**
- `sourceActivityId` = `activityId` from Garmin (string)
- `athleteId` = Our internal athlete ID
- Device name extracted from multiple possible fields: `deviceMetaData.deviceName`, `deviceName`, `device.deviceName`, etc.

### Webhook Validation

**No explicit signature validation** - Legacy backend relied on:
1. **HTTPS only**: All webhooks over HTTPS
2. **User ID matching**: Webhooks only processed if `garmin_user_id` matched
3. **Immediate 200 response**: Always returned 200 OK immediately, processed asynchronously

---

## Differences From New Next.js Flow

### Side-by-Side Comparison

| Aspect | Legacy Backend | New Next.js App |
|--------|---------------|-----------------|
| **State Management** | `athleteId` used as `state` | Random `state` token, `athleteId` in cookie |
| **Code Verifier Storage** | Redis (keyed by `athleteId`) | HTTP-only cookie |
| **Callback URL** | Backend URL: `/api/garmin/callback` | Backend URL: `/api/auth/garmin/callback` |
| **Redirect After OAuth** | Redirects to frontend: `/garmin/success?athleteId=xxx` | Returns HTML with `postMessage` for popup |
| **User ID Fetch** | Calls `/oauth-service/oauth/user-info` | Calls `/wellness-api/rest/user/id` |
| **Webhook Endpoints** | Multiple endpoints (`/activity`, `/permissions`, etc.) | Single unified `/api/garmin/webhook` |
| **Webhook Processing** | Synchronous processing | Async processing (returns 200 immediately) |
| **Token Refresh** | Not implemented | `lib/garmin-refresh-token.ts` with automatic refresh |

### Key Architectural Differences

1. **State Parameter**:
   - **Legacy**: Used `athleteId` directly as `state` (simpler but less secure)
   - **New**: Random `state` token, stores `athleteId` in HTTP-only cookie

2. **Code Verifier Storage**:
   - **Legacy**: Redis (external dependency, keyed by `athleteId`)
   - **New**: HTTP-only cookie (no external dependency, tied to session)

3. **Webhook Architecture**:
   - **Legacy**: Multiple specific endpoints for each event type
   - **New**: Single unified webhook endpoint with event type routing

4. **User Identification in Webhooks**:
   - **Legacy**: `findAthleteByGarminUserId(userId)` service with retry logic
   - **New**: Direct Prisma query with `garmin_user_id` field

---

## Required Migration Steps

### What the Current App Must Copy from Legacy

#### 1. User ID Fetching Logic

**Legacy Pattern:**
```javascript
// Try primary endpoint first
const userInfoResult = await fetchGarminUserInfo(accessToken);
// GET https://connectapi.garmin.com/oauth-service/oauth/user-info

// Fallback to alternative endpoint
if (!userInfoResult.success) {
  const profileData = await fetchGarminProfile(accessToken);
  // GET https://apis.garmin.com/wellness-api/rest/user/id
}
```

**Action**: Ensure both endpoints are tried in `lib/garmin-oauth.ts` or `lib/domain-garmin.ts`

#### 2. Webhook User ID Extraction

**Legacy Pattern:**
```javascript
// Check multiple field name variations
const userId = garminActivity.userId || 
               garminActivity.user_id || 
               garminActivity.userIdString || 
               garminActivity.garminUserId || 
               payload.userId;  // Also check root level
```

**Action**: Implement same field name variations in `lib/garmin-events/handleActivitySummary.ts`

#### 3. Device Name Extraction

**Legacy Pattern:**
```javascript
const extractedDeviceName = 
  garminActivity.deviceMetaData?.deviceName || 
  garminActivity.deviceMetaData?.deviceModel ||
  garminActivity.deviceName || 
  garminActivity.deviceModel ||
  garminActivity.device?.name ||
  garminActivity.device?.deviceName ||
  garminActivity.device?.deviceModel ||
  garminActivity.deviceMetaData?.name ||
  null;
```

**Action**: Copy this logic to activity mapping functions

#### 4. Activity Field Normalization

**Legacy Pattern:**
```javascript
const normalizedActivity = {
  ...garminActivity,
  activityName: garminActivity.activityName || 
                garminActivity.activity_name || 
                garminActivity.name || 
                garminActivity.displayName || 
                garminActivity.title || 
                null,
  activityType: typeof garminActivity.activityType === 'string' 
    ? { typeKey: garminActivity.activityType }
    : garminActivity.activityType,
  startTimeLocal: garminActivity.startTimeLocal || 
    (garminActivity.startTimeInSeconds 
      ? new Date(garminActivity.startTimeInSeconds * 1000).toISOString()
      : null),
  // ... more field mappings
};
```

**Action**: Implement same normalization in `lib/garmin-events/handleActivitySummary.ts`

#### 5. Permission Change Handling

**Legacy Pattern:**
```javascript
// Fetch current permissions from Garmin API
const resp = await fetch(
  "https://apis.garmin.com/wellness-api/rest/user/permissions",
  {
    headers: {
      Authorization: `Bearer ${athlete.garmin_access_token}`,
      "Content-Type": "application/json"
    }
  }
);
const currentPerms = resp.ok ? await resp.json() : [];

// Store in database
await prisma.athlete.updateMany({
  where: { garmin_user_id: userId },
  data: {
    garmin_permissions: {
      current: currentPerms,
      updatedAt: new Date().toISOString()
    }
  }
});
```

**Action**: Implement in `lib/garmin-events/handlePermissionChange.ts`

#### 6. Deregistration Handling

**Legacy Pattern:**
```javascript
// Clear ALL Garmin data
await prisma.athlete.updateMany({
  where: { garmin_user_id: userId },
  data: {
    garmin_user_id: null,  // Critical: prevents webhook matching
    garmin_access_token: null,
    garmin_refresh_token: null,
    // ... all other Garmin fields null
    garmin_is_connected: false,
    garmin_disconnected_at: new Date()
  }
});
```

**Action**: Ensure `lib/garmin-events/handleDeregistration.ts` clears `garmin_user_id` (not just tokens)

#### 7. Retry Logic for Webhook Timing

**Legacy Pattern:**
```javascript
let athlete = await findAthleteByGarminUserId(userId);

// Retry if not found (webhook might fire before DB commit)
if (!athlete) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  athlete = await findAthleteByGarminUserId(userId);
}
```

**Action**: Add retry logic to webhook handlers that look up athletes

---

## Critical Implementation Notes

### 1. Garmin User ID is Critical

- **Without `garmin_user_id`**: Webhooks cannot match activities to athletes
- **Must be saved during OAuth**: Fetch from user-info endpoint immediately after token exchange
- **Must be cleared on disconnect**: Setting to `null` prevents orphaned webhooks

### 2. Webhook Response Timing

- **Always return 200 OK immediately**: Garmin requires response within 30 seconds
- **Process asynchronously**: Do not await database operations before responding
- **Log everything**: Webhook debugging requires extensive logging

### 3. Field Name Variations

- **Garmin sends inconsistent field names**: Always check multiple variations
- **userId location**: Can be at root level or inside activity object
- **Device name**: Can be in `deviceMetaData`, `device`, or root level

### 4. State Parameter Security

- **Legacy used athleteId directly**: Less secure but simpler
- **New uses random state**: More secure, requires cookie storage
- **Both work**: Choose based on security requirements

---

## Environment Variables (Legacy)

```bash
# Garmin OAuth 2.0
GARMIN_CLIENT_ID=856b6502-0fed-48fb-9e60-643c299fb3b7
GARMIN_CLIENT_SECRET=your_secret_here

# URLs
FRONTEND_URL=https://athlete.gofastcrushgoals.com
BACKEND_URL=https://gofastbackendv2-fall2025.onrender.com

# Redis (for code verifier storage)
REDIS_URL=redis://localhost:6379
```

---

## File Structure (Legacy)

```
gofastbackendv2-fall2025/
├── routes/
│   └── Garmin/
│       ├── garminUrlGenRoute.js          # GET /api/garmin/auth-url
│       ├── garminCodeCatchRoute.js        # GET /api/garmin/callback
│       ├── garminTokenSaveRoute.js        # Internal token save service
│       ├── garminActivityRoute.js         # POST /api/garmin/activity
│       ├── garminActivityDetailsRoute.js  # POST /api/garmin/activity-details
│       ├── garminPermissionsRoute.js      # PUT /api/garmin/permissions
│       └── garminDeregistrationRoute.js  # PUT /api/garmin/deregistration
├── services/
│   ├── garminUtils.js                     # PKCE, token exchange, user info
│   ├── GarminIntegrationService.js        # High-level integration service
│   ├── GarminFieldMapper.js               # Activity field mapping
│   └── garminFindAthleteService.js        # Find athlete by garmin_user_id
├── config/
│   ├── garminUserIdConfig.js              # User ID fetch endpoints
│   └── garminTokenConfig.js               # Token configuration
└── utils/
    └── redis.js                            # Redis code verifier storage
```

---

## Summary

The legacy backend used a **simpler but less secure** approach:
- `athleteId` as `state` parameter
- Redis for code verifier storage
- Multiple webhook endpoints
- Extensive field name variation handling

The new Next.js app should:
- ✅ Keep the secure `state` + cookie approach
- ✅ Copy the field name variation logic
- ✅ Implement both user-info endpoints
- ✅ Add retry logic for webhook timing
- ✅ Ensure `garmin_user_id` is always saved and cleared properly


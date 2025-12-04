# Garmin Integration Testing Guide

This guide covers how to test all aspects of the Garmin integration in GoFastNextApp.

---

## Prerequisites

1. **Production Garmin Credentials** configured in environment variables
2. **Garmin Developer Portal** configured with:
   - OAuth Redirect URI: `https://gofast.gofastcrushgoals.com/api/auth/garmin/callback`
   - Webhook URL: `https://gofast.gofastcrushgoals.com/api/garmin/webhook`
3. **Database** with Prisma schema synced
4. **Firebase Authentication** working

---

## 1. Testing OAuth Flow

### Step 1: Initiate OAuth

**Endpoint**: `GET /api/auth/garmin/authorize`

**Request**:
```bash
curl -X GET "https://gofast.gofastcrushgoals.com/api/auth/garmin/authorize" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected Behavior**:
- Returns HTTP 302 redirect to Garmin Connect authorization page
- Sets HTTP-only cookies: `garmin_code_verifier` and `garmin_athlete_id`

**Verification**:
- Check browser redirects to Garmin Connect
- User can authorize the application
- After authorization, Garmin redirects back to callback URL

---

### Step 2: OAuth Callback

**Endpoint**: `GET /api/auth/garmin/callback?code=XXX&state=YYY`

**Expected Behavior**:
- Exchanges authorization code for access/refresh tokens
- Fetches Garmin user ID
- Saves tokens to database
- Redirects to `/settings/integrations?connected=garmin`

**Database Verification**:
```sql
SELECT 
  id,
  garmin_user_id,
  garmin_is_connected,
  garmin_connected_at,
  garmin_access_token IS NOT NULL as has_token
FROM athletes
WHERE id = 'YOUR_ATHLETE_ID';
```

**Expected Results**:
- `garmin_user_id` is set (not null)
- `garmin_is_connected` is `true`
- `garmin_connected_at` is recent timestamp
- `garmin_access_token` is present

---

## 2. Testing Webhook Flow

### Enable Debug Mode

Set in environment:
```bash
GARMIN_DEBUG="true"
```

This will log full webhook payloads to console.

---

### Test Activity Summary Webhook

**Endpoint**: `POST /api/garmin/webhook`

**Sample Payload**:
```json
{
  "activities": [
    {
      "activityId": "123456789",
      "userId": "garmin-user-uuid",
      "activityType": "running",
      "activityName": "Morning Run",
      "startTime": "2024-01-15T06:00:00Z",
      "duration": 3600,
      "distance": 5000,
      "calories": 300,
      "averageSpeed": 5.0,
      "averageHeartRate": 150,
      "maxHeartRate": 170,
      "elevationGain": 50,
      "steps": 6000
    }
  ],
  "userId": "garmin-user-uuid"
}
```

**Expected Behavior**:
- Returns HTTP 200 OK immediately (<3 seconds)
- Processes activity asynchronously
- Creates `AthleteActivity` record in database

**Verification**:
```sql
SELECT * FROM athlete_activities 
WHERE source_activity_id = '123456789';
```

---

### Test Activity Detail Webhook

**Sample Payload**:
```json
{
  "activityDetails": [
    {
      "activityId": "123456789",
      "userId": "garmin-user-uuid",
      "detailedMetrics": {
        "heartRateZones": [...],
        "paceZones": [...],
        "splits": [...]
      }
    }
  ],
  "userId": "garmin-user-uuid"
}
```

**Expected Behavior**:
- Updates existing activity with detail data
- Sets `hydratedAt` timestamp

**Verification**:
```sql
SELECT 
  source_activity_id,
  detail_data IS NOT NULL as has_details,
  hydrated_at
FROM athlete_activities
WHERE source_activity_id = '123456789';
```

---

### Test Activity File Webhook

**Sample Payload**:
```json
{
  "activityFiles": [
    {
      "activityId": "123456789",
      "userId": "garmin-user-uuid",
      "fileType": "tcx",
      "fileUrl": "https://garmin.com/files/123456789.tcx"
    }
  ],
  "userId": "garmin-user-uuid"
}
```

**Expected Behavior**:
- Processes file attachment
- Marks file as processed to prevent duplicates

---

### Test Permission Change Webhook

**Sample Payload**:
```json
{
  "eventType": "USER_PERMISSION_CHANGED",
  "userId": "garmin-user-uuid",
  "permissions": {
    "activities": true,
    "health": true
  },
  "scopes": ["CONNECT_READ", "CONNECT_WRITE"]
}
```

**Expected Behavior**:
- Updates `garmin_permissions` JSON field
- Updates `garmin_scope` field

**Verification**:
```sql
SELECT 
  garmin_permissions,
  garmin_scope
FROM athletes
WHERE garmin_user_id = 'garmin-user-uuid';
```

---

### Test Deregistration Webhook

**Sample Payload**:
```json
{
  "eventType": "USER_DEREGISTER",
  "userId": "garmin-user-uuid",
  "reason": "User disconnected"
}
```

**Expected Behavior**:
- Sets `garmin_is_connected` to `false`
- Sets `garmin_disconnected_at` timestamp
- Clears access/refresh tokens

**Verification**:
```sql
SELECT 
  garmin_is_connected,
  garmin_disconnected_at,
  garmin_access_token IS NULL as token_cleared
FROM athletes
WHERE garmin_user_id = 'garmin-user-uuid';
```

---

## 3. Testing Activity Ingestion

### Manual Sync Endpoint

**Endpoint**: `POST /api/garmin/sync`

**Request**:
```bash
curl -X POST "https://gofast.gofastcrushgoals.com/api/garmin/sync" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "summary": {
    "fetched": 10,
    "saved": 5,
    "skipped": 5,
    "errors": 0
  },
  "message": "Synced 5 new activities"
}
```

**Behavior**:
- Fetches activities from last 7 days
- Skips duplicates
- Updates `garmin_last_sync_at` timestamp

---

## 4. Testing Token Refresh

### Simulate Token Expiration

1. Manually set `garmin_connected_at` to an old date:
```sql
UPDATE athletes
SET garmin_connected_at = NOW() - INTERVAL '2 hours'
WHERE id = 'YOUR_ATHLETE_ID';
```

2. Call sync endpoint or any endpoint that uses tokens

**Expected Behavior**:
- Automatically refreshes token
- Updates `garmin_access_token` and `garmin_connected_at`
- Request succeeds

**Verification**:
```sql
SELECT 
  garmin_access_token,
  garmin_connected_at
FROM athletes
WHERE id = 'YOUR_ATHLETE_ID';
```

---

## 5. Testing Deduplication

### Test Duplicate Prevention

1. Send the same activity webhook twice:
```bash
# First request
curl -X POST "https://gofast.gofastcrushgoals.com/api/garmin/webhook" \
  -H "Content-Type: application/json" \
  -d '{"activities": [{"activityId": "123", ...}]}'

# Second request (same activity)
curl -X POST "https://gofast.gofastcrushgoals.com/api/garmin/webhook" \
  -H "Content-Type: application/json" \
  -d '{"activities": [{"activityId": "123", ...}]}'
```

**Expected Behavior**:
- First request creates activity
- Second request skips (logs "already exists")
- Only one record in database

**Verification**:
```sql
SELECT COUNT(*) FROM athlete_activities 
WHERE source_activity_id = '123';
-- Should return 1
```

---

## 6. Testing Error Handling

### Test Invalid Webhook Payload

**Request**:
```bash
curl -X POST "https://gofast.gofastcrushgoals.com/api/garmin/webhook" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}'
```

**Expected Behavior**:
- Returns HTTP 200 OK (webhook compliance)
- Logs warning about unknown event type
- Does not crash

---

### Test Missing User ID

**Request**:
```bash
curl -X POST "https://gofast.gofastcrushgoals.com/api/garmin/webhook" \
  -H "Content-Type: application/json" \
  -d '{"activities": [{"activityId": "123"}]}'
```

**Expected Behavior**:
- Returns HTTP 200 OK
- Logs warning "No userId found"
- Skips processing

---

## 7. Integration Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens saved to database
- [ ] Garmin user ID fetched and saved
- [ ] Webhook receives and processes activities
- [ ] Activities saved to database
- [ ] Activity details update existing activities
- [ ] Duplicate activities are skipped
- [ ] Permission changes update database
- [ ] Deregistration disconnects user
- [ ] Token refresh works automatically
- [ ] Manual sync endpoint works
- [ ] Error handling doesn't crash webhook

---

## 8. Production Verification

### Garmin Developer Portal Checklist

- [ ] OAuth Redirect URI matches: `https://gofast.gofastcrushgoals.com/api/auth/garmin/callback`
- [ ] Webhook URL matches: `https://gofast.gofastcrushgoals.com/api/garmin/webhook`
- [ ] Production Client ID and Secret configured
- [ ] Webhook is active and receiving events

### Environment Variables Checklist

- [ ] `GARMIN_CLIENT_ID` set to production value
- [ ] `GARMIN_CLIENT_SECRET` set to production value
- [ ] `GARMIN_REDIRECT_URI` matches production domain
- [ ] `GARMIN_WEBHOOK_URI` matches production domain
- [ ] `GARMIN_DEBUG` set to `false` in production

---

## Troubleshooting

### OAuth Flow Fails

**Symptoms**: Redirect fails or callback returns error

**Check**:
1. `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` are correct
2. Redirect URI matches Garmin Developer Portal exactly
3. Cookies are enabled (for code verifier storage)

---

### Webhook Not Receiving Events

**Symptoms**: No activities appearing in database

**Check**:
1. Webhook URL is registered in Garmin Developer Portal
2. Webhook is active (not paused)
3. Check logs for incoming requests
4. Verify `GARMIN_DEBUG` is enabled to see payloads

---

### Token Refresh Fails

**Symptoms**: API calls fail with 401 Unauthorized

**Check**:
1. Refresh token is still valid
2. `GARMIN_CLIENT_ID` and `GARMIN_CLIENT_SECRET` are correct
3. Token refresh endpoint is accessible
4. Check logs for refresh errors

---

## Support

For issues or questions:
1. Check application logs (especially with `GARMIN_DEBUG=true`)
2. Verify Garmin Developer Portal configuration
3. Check database for token and activity records
4. Review webhook payloads in debug mode


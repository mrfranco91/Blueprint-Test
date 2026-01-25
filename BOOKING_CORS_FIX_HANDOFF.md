# Booking CORS/405 Error Fix - Handoff

**Date:** January 25, 2026  
**Issue:** CORS preflight failure when booking appointments - browser was making direct calls to Square API resulting in 405 Method Not Allowed on OPTIONS preflight requests

## Problem Summary

User was seeing a 405 error in network dev tools:
- Request URL: `https://connect.squareup.com/v2/locations`
- Request Method: OPTIONS (preflight)
- Status Code: 405 Method Not Allowed

**Root Cause:** The client-side code in `services/squareIntegration.ts` was making direct calls to Square API from the browser, which triggers CORS preflight checks. Square API doesn't allow cross-origin preflight requests.

## Solution Applied

Routed all Square API calls through the existing server-side proxy (`/api/square/proxy.ts`) instead of making direct calls from the browser.

### Changes Made

**File:** `services/squareIntegration.ts`

1. Removed token caching logic (`cachedToken`, `tokenFetchPromise`, `getSquareAccessToken()`)
2. Updated `squareApiFetch()` function to:
   - Route calls to `/api/square/proxy?path=<SQUARE_PATH>` instead of directly to `connect.squareup.com`
   - Pass Supabase JWT in Authorization header (proxy handles token resolution)
   - Removed hardcoded baseUrl (proxy handles sandbox vs production)

**Before:**
```js
const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
        'Authorization': `Bearer ${token}`,
        // ...
    },
});
```

**After:**
```js
const response = await fetch(`/api/square/proxy?path=${encodeURIComponent(path)}`, {
    method,
    headers: {
        'Authorization': `Bearer ${session.access_token}`,
        // ...
    },
});
```

## How It Works Now

1. Browser calls `/api/square/proxy?path=/v2/bookings` (local server endpoint)
2. Proxy extracts Supabase JWT from Authorization header
3. Proxy looks up merchant_settings.square_access_token from DB using Supabase admin client
4. Proxy makes the actual Square API call server-to-server (no CORS)
5. Response returns to browser

## How to Test

1. **In a test environment with OAuth access:**
   - Complete the OAuth flow with Square
   - Navigate to booking flow and try creating an appointment
   - Open browser dev tools → Network tab
   - Look for requests to `/api/square/proxy` (should succeed)
   - Look for requests to `connect.squareup.com` (should NOT appear)

2. **Quick test without full OAuth:**
   - On the credentials screen, paste a valid Square access token in "Enter your Square access token" field
   - This will sync team/clients and allow you to test the API calls
   - Then try the booking flow

## If the Fix Doesn't Work

### Check these things:

1. **Verify `/api/square/proxy.ts` exists and is correct**
   - File should still exist at `api/square/proxy.ts`
   - It should extract token from Authorization header and merchant_settings table
   - Should pass token to Square API calls as `Authorization: Bearer ${token}`

2. **Check for new error messages**
   - Errors will now appear on `/api/square/proxy` requests instead of Square requests
   - Common issues:
     - `401 Missing authorization token` - JWT not being passed correctly
     - `401 Square access token not found` - merchant_settings record missing square_access_token
     - Other 401s - invalid JWT or merchant_settings lookup failed

3. **Verify Supabase session is available**
   - User must be logged into Supabase after OAuth flow
   - Session token must have valid JWT

4. **Check environment variables**
   - `VITE_SUPABASE_URL` - must be set
   - `SUPABASE_SERVICE_ROLE_KEY` - must be set (on server-side only)
   - `VITE_SQUARE_ENV` - controls sandbox vs production (optional, defaults to 'production')

### If Still Failing

1. Check the exact error in the `/api/square/proxy` response
2. Verify merchant_settings table has the correct user and square_access_token
3. Verify Supabase JWT is being sent in Authorization header
4. Look at server logs for proxy endpoint errors
5. If token resolution is failing, the issue is likely in:
   - `api/square/proxy.ts` - token lookup logic
   - `api/square/get-token.ts` - shows how token is retrieved for comparison

## Files Modified

- `services/squareIntegration.ts` - Updated `squareApiFetch()` to use proxy

## Files Already in Place (No Changes)

- `api/square/proxy.ts` - Server-side proxy endpoint (existing, working correctly)
- `api/square/get-token.ts` - Token retrieval endpoint (existing)
- `api/square/oauth/token.ts` - OAuth token exchange (existing)

## Notes

- This change eliminates CORS as a problem entirely by moving Square API calls to server-side
- The proxy endpoint was already built and in use for other endpoints like team sync
- All Square API endpoints (locations, bookings, availability, customers, etc.) now use the proxy
- Supabase is the auth mechanism - user must be logged in via OAuth flow before making Square API calls

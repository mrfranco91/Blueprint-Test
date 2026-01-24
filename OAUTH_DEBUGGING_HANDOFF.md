# OAuth Integration Issue - Debugging Handoff (Session 2)

## Current Status
OAuth flow is partially working but hitting errors during the sync phase. The PR from Session 1 failed deployment due to an **invalid route pattern in vercel.json**. This has been fixed.

## Root Issues Identified

### 1. ✅ FIXED: Invalid vercel.json Route Pattern (Session 2)
**Issue:** Previous PR used `/(?!api)(.*)` which is incorrect Vercel syntax for negative lookahead
**Root Cause:** Negative lookaheads must be wrapped in a group per Vercel documentation
**Fix Applied:**
```json
{
  "rewrites": [
    {
      "source": "/((?!api).*)",
      "destination": "/index.html"
    }
  ]
}
```
- This allows `/api/*` routes to bypass the rewrite and reach serverless functions
- Fixes the 401 errors on `/api/square/oauth/token` endpoint

### 2. ✅ FIXED: SquareCallback Resilience (Session 2)
**Issue:** OAuth callback was blocking on sync function calls, causing timeout errors
**Fix Applied:** Made sync calls non-blocking (background promises)
```typescript
// Sync calls now run in background, don't block OAuth completion
Promise.all([
  fetch(`${edgeFunctionBase}/sync-team-members`, ...),
  fetch(`${edgeFunctionBase}/sync-clients`, ...),
]).catch(err => console.warn('Sync functions error:', err));

window.location.replace('/admin'); // Redirect immediately
```
- OAuth completes even if sync functions are slow or fail
- Gives the app time to display and boot up

### 3. ⚠️ NEEDS VERIFICATION: Supabase Edge Functions (Session 2)
**Status:** Attempted to deploy cleaner versions but hit Supabase internal errors
- Current versions (v16 sync-team-members, v15 sync-clients) are marked ACTIVE
- Logs show many 503 errors on OPTIONS requests in recent attempts
- May need to be redeployed or replaced with simpler implementations
- Network test showed: `Status Code 503 Service Unavailable` on CORS preflight

### 4. Still Present: OAuth Token Exchange Error
**Current Error:** "Failed to exchange Square OAuth token"
**What We Know:**
- OAuth code is being sent correctly to `/api/square/oauth/token`
- The endpoint exists and should be accessible now (with vercel.json fix)
- Error appears to be coming from token exchange with Square API
- Check `/api/square/oauth/token` logs on Vercel to see what's failing

## Changes Made This Session

### vercel.json
```diff
- "source": "/(?!api)(.*)"
+ "source": "/((?!api).*)"
```

### components/SquareCallback.tsx
- Made sync function calls non-blocking (Promise.all with .catch())
- Redirects to `/admin` immediately after auth succeeds
- Data syncs in background; UI doesn't wait for it

## Files to Check if Fixes Don't Work

1. **Vercel Deployment Logs**
   - Check build logs for errors
   - Verify `/api/square/oauth/token` endpoint is deployed

2. **Supabase Edge Function Logs**
   - Check `sync-team-members` logs (service: edge-function)
   - Check `sync-clients` logs
   - Look for 503 errors and deployment issues
   - May need to redeploy with simpler implementation

3. **Environment Variables on Vercel**
   - `VITE_SQUARE_APPLICATION_ID` (or `VITE_SQUARE_CLIENT_ID`)
   - `SQUARE_APPLICATION_SECRET` (server-side, not exposed)
   - `VITE_SQUARE_REDIRECT_URI` must match Square OAuth app settings
   - `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SQUARE_ENV` (should be 'production' unless sandbox)

4. **Square OAuth Configuration**
   - Verify redirect URI is set correctly in Square dashboard
   - Verify Application ID is correct
   - Verify Application Secret is correct and matches `SQUARE_APPLICATION_SECRET`

## Testing Steps for Next Chat

1. **Deploy the fixes** - Push/merge the changes from this session
2. **Monitor Vercel build** - Check that build succeeds
3. **Test OAuth flow:**
   - Click "Login with Square" on production
   - Complete Square authorization
   - Watch for "Failed to exchange Square OAuth token" error
   - If that still appears, check `/api/square/oauth/token` logs

4. **Check browser console:**
   - Look for detailed error messages
   - Check Network tab to see response from `/api/square/oauth/token`
   - Should return `{ merchant_id, business_name, access_token }`

5. **If token exchange fails:**
   - Verify all Square credentials are correct
   - Check Square API is returning proper response
   - Look at server logs in `/api/square/oauth/token` endpoint

## Key Locations

**OAuth Endpoints:**
- `/api/square/oauth/start` - Initiates OAuth flow with state cookie
- `/api/square/oauth/token` - Exchanges code for access token (THIS IS FAILING)

**Frontend Components:**
- `components/SquareCallback.tsx` - Handles OAuth callback (line 60-75 is token exchange)
- `components/LoginScreen.tsx` - Shows "Login with Square" button

**Supabase Edge Functions:**
- `sync-team-members` (v16) - Should fetch and sync team data
- `sync-clients` (v15) - Should fetch and sync client data

**Context:**
- `contexts/SettingsContext.tsx` - Has fallback queries and logging
- `contexts/AuthContext.tsx` - Manages auth state

## Next Actions if Fixes Don't Work

1. **Check Vercel Logs:**
   - Go to Vercel dashboard > Blueprint > Deployments
   - Look at latest build logs
   - Check Function Logs for `/api/square/oauth/token`

2. **Verify Square Configuration:**
   - Application ID correct?
   - Secret correct and matches env var?
   - Redirect URI matches what's in Square settings?

3. **Check Token Exchange:**
   - In browser Network tab, inspect `/api/square/oauth/token` response
   - What status code? (should be 200)
   - What error message? (check response body)

4. **Consider Alternative Approach:**
   - If token endpoint keeps failing, may need to debug Square API response
   - Could bypass sync functions temporarily and just complete OAuth
   - Then manually trigger sync when needed

## Environment Variables Needed

These MUST be set in Vercel for OAuth to work:
- `VITE_SQUARE_APPLICATION_ID` - Your Square app's client ID
- `SQUARE_APPLICATION_SECRET` - Your Square app's secret (server-side only!)
- `VITE_SQUARE_REDIRECT_URI` - Must be `https://blueprint-test-mu.vercel.app/square/callback`
- `VITE_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `VITE_SUPABASE_ANON_KEY` - Supabase public key

## Current Error
When testing on production: **"Failed to exchange Square OAuth token"**
- This error comes from SquareCallback.tsx line 77
- Means the response from `/api/square/oauth/token` was not ok (not 200 status)
- Need to check actual response from that endpoint to see what's wrong

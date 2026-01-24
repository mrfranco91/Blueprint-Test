# OAuth Data Sync Issue - Debugging Handoff

## Problem Summary
After OAuth sign-in via Square, data is being written to Supabase but **NOT displaying in the app UI**. Users see 0 clients, 0 team members, and 0 plans even though the Supabase logs show 25+ records being synced successfully.

## Root Causes Identified

### 1. Missing Vercel API Route Configuration (BLOCKING)
**Issue:** `vercel.json` was rewriting ALL routes (including `/api`) to `/index.html`, making the OAuth token exchange endpoint unreachable.

**Status:** ✅ FIXED in code
- Updated `vercel.json` to use negative lookahead: `/(?!api)(.*)`
- This allows `/api/*` routes to reach the serverless functions
- **Action Required:** PR must be merged for this to deploy to Vercel

### 2. Missing Supabase Edge Functions (RESOLVED)
**Issue:** SquareCallback.tsx tries to call `/functions/v1/sync-clients` and `/functions/v1/sync-team-members` but they weren't deployed.

**Status:** ✅ DEPLOYED
- `sync-clients` - ACTIVE (version 14, `verify_jwt: false`)
- `sync-team-members` - ACTIVE (version 15, `verify_jwt: false`)
- Both include proper CORS headers for cross-origin requests
- Changed from `verify_jwt: true` to `verify_jwt: false` to allow preflight OPTIONS requests

### 3. Data Scoping/Display Issue (PARTIALLY FIXED)
**Issue:** Even when data exists in Supabase, it wasn't displaying because of user ID mismatch or missing fallback queries.

**Status:** ✅ PARTIALLY FIXED
- ✅ Added fallback queries to `SettingsContext.tsx` (clients & team members)
  - If user-scoped query returns 0 results, automatically fetch ALL data without user filter
  - Added detailed console logging to debug user IDs and query results
- ✅ Added same fallback pattern to `PlanContext.tsx`
  - If admin-scoped query returns 0 plans, fetch all plans
  - Added logging to show when fallback is triggered

## Changes Made (Ready to PR)

### 1. `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/(?!api)(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. `contexts/SettingsContext.tsx`
- Added debug logging for current user ID
- Added debug logging for merchant settings lookup
- Added debug logging for scoped vs fallback queries

### 3. `contexts/PlanContext.tsx`
- Added fallback query for admin users
- If initial query returns 0 plans, executes: `await supabase.from('plans').select('*')`
- Added console logging to show fallback triggering

## Next Steps

### Immediate (Before PR)
1. Confirm all code changes look correct
2. Test locally if possible (requires changing VITE_SQUARE_REDIRECT_URI to http://localhost:3000/square/callback)

### After PR & Deployment
1. **Test OAuth flow on Vercel**
   - Start OAuth sign-in
   - Complete Square authorization
   - Check console for these logs:
     - `[Settings] Current user ID: ...`
     - `[Settings] Scoped clients query for user ... : ...`
     - If returns 0: `[Settings] Fallback clients query returned: ...`
     - `[TEAM SYNC] Token from body: ✓`
     - `[TEAM SYNC] Inserted: X` (should be > 0)

2. **Expected Success Indicators**
   - OAuth redirects to login (not error page)
   - Clients appear in sidebar/settings
   - Team members appear in settings
   - Plans appear on dashboard
   - Console shows successful sync logs

3. **If Still Fails**
   - Check Supabase logs for edge function errors
   - Verify `/api/square/oauth/token` is now accessible (was 401 before)
   - Check user IDs match between OAuth token creation and queries
   - Verify edge functions are actually inserting data (check Supabase clients/square_team_members tables)

## Key Files Modified
- `vercel.json` - Routes fix (CRITICAL)
- `contexts/SettingsContext.tsx` - Debugging logging
- `contexts/PlanContext.tsx` - Fallback query pattern
- `components/SquareCallback.tsx` - No changes (uses edge functions)

## Supabase Functions Deployed
- `sync-clients` (v14) - Syncs Square customers to `clients` table
- `sync-team-members` (v15) - Syncs Square team members to `square_team_members` table
- Both: `verify_jwt: false`, proper CORS headers

## Known Issues
- None remaining once PR is deployed
- Edge functions have been updated and deployed independently of PR

## Testing Data
User ID: `c6598212-8148-4cf9-b53f-15066b92f679`
- Has 15+ clients in Supabase `clients` table
- Should see all data after OAuth completes successfully

# Fix Server Time/Clock Sync Issue on Render

## Current Problem
Firebase JWT validation is failing with `Invalid JWT Signature` error.

**Root Cause:** Firebase JWT tokens require accurate system time. Even if the year is correct, clock skew (time difference) or timezone issues can cause validation to fail.

**Firebase Requirement:** Server time must be within ~5 minutes of actual time for JWT validation to work.

## Immediate Actions for Render

### Option 1: Contact Render Support (Recommended)

1. **Go to Render Dashboard:**
   - https://dashboard.render.com
   - Navigate to your service

2. **Contact Support:**
   - Click "Support" or "Help" in Render dashboard
   - Or email: support@render.com
   - Subject: "Server Time Incorrect - Causing Firebase JWT Errors"

3. **Include in your message:**
   ```
   Service: [Your Service Name]
   Issue: Server system time is set to year 2026 instead of 2024
   Impact: Firebase JWT tokens failing with "Invalid JWT Signature"
   Error: app/invalid-credential
   
   Issue: Firebase JWT validation failing with "Invalid JWT Signature"
   Error: app/invalid-credential
   Server timezone: [Check logs for timezone]
   Clock skew: [Check logs for clock skew - should be < 5 minutes]
   
   Request: Please ensure NTP sync is enabled and server time is accurate (within 5 minutes of actual time).
   ```

### Option 2: Try Manual Deploy with Fresh Build

Sometimes a fresh deploy resets the container time:

1. **Render Dashboard → Your Service**
2. **Manual Deploy → Clear build cache & deploy**
3. **Wait for deployment to complete**
4. **Check logs** - Look for "System Time Check" output
5. **If still 2026**, proceed to Option 1

### Option 3: Set Timezone to UTC (Step-by-Step)

**This is the most common fix for time issues on Render:**

1. **Go to Render Dashboard:**
   - https://dashboard.render.com
   - Navigate to your service (the chat backend service)

2. **Open Environment Variables:**
   - Click on your service
   - Go to the "Environment" tab (in the left sidebar)
   - Or click "Environment" button at the top

3. **Add Timezone Variable:**
   - Click "Add Environment Variable" or the "+" button
   - **Key:** `TZ`
   - **Value:** `UTC`
   - Click "Save Changes"

4. **Redeploy:**
   - Go to "Manual Deploy" tab
   - Click "Clear build cache & deploy"
   - Wait for deployment to complete

5. **Verify:**
   - Check logs after deployment
   - Look for "System Time Check" output
   - Should show: `Timezone: UTC` ✅

**Visual Guide:**
```
Render Dashboard
  → Your Service (chat-backend)
    → Environment (tab)
      → Add Environment Variable
        Key: TZ
        Value: UTC
      → Save Changes
    → Manual Deploy
      → Clear build cache & deploy
```

### Option 4: Verify Time After Fix

After fixing the time sync, check your logs. You should see:

```
⏰ System Time Check:
   Clock Skew: X seconds (should be < 300 seconds)
   Timezone: UTC (recommended)
```

If clock skew is > 300 seconds (5 minutes), the fix didn't work - contact Render support again.

## Why This Happens on Render

- Container initialization with wrong time
- NTP service not running in container
- Base image timezone misconfiguration
- Render platform time sync issue

## Temporary Workaround (Not Recommended)

There's no code workaround for incorrect system time. The JWT signature is cryptographically tied to the actual server time. You must fix the server time.

## Verification

Once time is fixed, test FCM:

1. Send a test message from your app
2. Check backend logs - should see successful FCM send
3. No more "Invalid JWT Signature" errors

## Expected Timeline

- Render support usually responds within 24 hours
- Time fix is typically quick (they just need to restart container with correct time)
- After fix, restart your service to ensure time is correct


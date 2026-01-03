# How to Set Timezone to UTC on Render

## Quick Steps

### Step 1: Go to Your Service
1. Open https://dashboard.render.com
2. Click on your **chat backend service**

### Step 2: Open Environment Variables
1. Click on **"Environment"** tab (left sidebar)
   - Or click the **"Environment"** button at the top of the page

### Step 3: Add TZ Variable
1. Click **"Add Environment Variable"** or the **"+"** button
2. Enter:
   - **Key:** `TZ`
   - **Value:** `UTC`
3. Click **"Save Changes"**

### Step 4: Redeploy
1. Go to **"Manual Deploy"** tab
2. Click **"Clear build cache & deploy"**
3. Wait for deployment to complete (usually 2-5 minutes)

### Step 5: Verify
1. Go to **"Logs"** tab
2. Look for Firebase initialization logs
3. Should see:
   ```
   ⏰ System Time Check:
      Timezone: UTC ✅
   ```

## Screenshot Guide

```
┌─────────────────────────────────────┐
│  Render Dashboard                   │
│                                     │
│  [Services] [Environment] [Logs]   │
│                                     │
│  Environment Variables:             │
│  ┌─────────────────────────────┐   │
│  │ Key: TZ                      │   │
│  │ Value: UTC                   │   │
│  │ [Save Changes]               │   │
│  └─────────────────────────────┘   │
│                                     │
│  [+ Add Environment Variable]       │
└─────────────────────────────────────┘
```

## Alternative: Using Render CLI

If you have Render CLI installed:

```bash
# Set timezone
render env:set TZ=UTC --service your-service-name

# Redeploy
render deploy
```

## Why This Works

- `TZ=UTC` tells the server to use UTC timezone
- This ensures consistent time across all operations
- Firebase JWT requires accurate UTC time
- After setting, the server will use UTC for all time operations

## Troubleshooting

### If TZ variable doesn't appear to work:

1. **Check the variable is saved:**
   - Go back to Environment tab
   - Verify `TZ=UTC` is listed

2. **Force a full redeploy:**
   - Manual Deploy → Clear build cache & deploy
   - This ensures the environment variable is loaded

3. **Check logs:**
   - After deploy, check if timezone shows as UTC
   - If still wrong, contact Render support

### If timezone is still wrong after setting TZ=UTC:

1. **Contact Render Support:**
   - Go to Render Dashboard → Support
   - Explain: "Set TZ=UTC but server timezone still incorrect"
   - They can check NTP sync on their end

## Verification

After setting `TZ=UTC` and redeploying, your logs should show:

```
⏰ System Time Check:
   Current UTC: 2026-01-03T13:11:03.388Z
   Timezone: UTC ✅
   Clock Skew: 0 seconds ✅
```

If you see `Timezone: UTC` with ✅, you're good to go!

## Next Steps

Once timezone is set to UTC:
1. Test Firebase FCM notifications
2. If still getting JWT errors, the issue is likely the service account key (not time)
3. See `FIREBASE_KEY_REGENERATION.md` for key regeneration steps


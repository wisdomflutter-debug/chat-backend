# Fix Server Time Issue for Firebase JWT

## Problem
Your server time is set to **2026** (future date), which causes Firebase JWT validation to fail with "Invalid JWT" error.

Firebase Admin SDK creates JWT tokens using the server's system time. If the clock is wrong, the tokens will be invalid.

## Solution

### For Render (Cloud Hosting)

Render servers should automatically sync time via NTP, but if there's an issue:

1. **Check Render Dashboard:**
   - Go to your service dashboard
   - Check if there are any timezone/time-related settings
   - Ensure the server is using UTC timezone

2. **Restart the Service:**
   - Sometimes a restart fixes time sync issues
   - Go to Render Dashboard → Your Service → Manual Deploy → Clear build cache & deploy

3. **Contact Render Support:**
   - If time is still wrong, contact Render support
   - They can check NTP sync on their end

### For Local Development

#### macOS:
```bash
# Option 1: Use System Preferences
# System Preferences → Date & Time → Set automatically

# Option 2: Use command line
sudo sntp -sS time.apple.com

# Verify time is correct
date
```

#### Linux:
```bash
# Enable NTP sync
sudo timedatectl set-ntp true

# Check time status
timedatectl status

# If needed, manually sync
sudo ntpdate -s time.nist.gov
```

#### Windows:
1. Settings → Time & Language → Date & Time
2. Turn on "Set time automatically"
3. Click "Sync now"

### Verify Time is Fixed

After fixing the time, restart your backend server and check the logs. You should see:

```
⏰ System Time Check:
   Current UTC: 2024-XX-XX... (correct year)
   Year: 2024
```

If you still see year 2026, the time fix didn't work.

## Why This Happens

- Server clock drift (common on VMs/containers)
- Timezone misconfiguration
- NTP service not running
- Manual time setting that was incorrect

## Prevention

- Always use automatic time sync (NTP)
- Don't manually set server time
- Monitor server time in production
- Use time sync services in cloud environments


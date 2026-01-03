# Debug Firebase Service Account Key Issue

## Current Situation
- ✅ Server time is **correct** (UTC matches actual time)
- ✅ Clock skew is **0 seconds**
- ✅ Timezone is **UTC**
- ❌ Still getting "Invalid JWT Signature" error

**Conclusion:** The issue is **NOT time** - it's the **service account key**.

## How to Verify Key Issues

### Check 1: Is the Key File on Render?

1. **Check if file exists on Render:**
   - Look at your deployment logs
   - Should see: `Service account file: /app/firebase-service-account.json`
   - If file not found, that's the issue

2. **Verify file path:**
   - Check `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable
   - Should point to correct file location

### Check 2: Is the Key Revoked?

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/iam-admin/serviceaccounts?project=wisdom-7c115

2. **Find service account:**
   - `firebase-adminsdk-fbsvc@wisdom-7c115.iam.gserviceaccount.com`

3. **Click on it → "Keys" tab**

4. **Check:**
   - Is there a key listed?
   - Is it marked as "Active"?
   - If no key or "Revoked" → Generate new key

### Check 3: Is the Key from Correct Project?

Check your logs for:
```
Project ID: wisdom-7c115 ✅ (should match)
Client Email: firebase-adminsdk-xxxxx@wisdom-7c115.iam.gserviceaccount.com ✅
```

If Project ID is different → Wrong key!

### Check 4: Is the Key Corrupted?

Check your logs for:
```
Private Key Length: 1704 chars ✅ (should be ~1700+)
Key starts with: -----BEGIN PRIVATE KEY----- ✅
```

**Common corruption issues:**
- Missing newlines in private key
- Key truncated (too short)
- Extra spaces or characters
- Key copied incorrectly

### Check 5: Is the Key File Different on Render vs Local?

**This is common!** The key on Render might be:
- Old/outdated version
- Different from what you have locally
- Not uploaded correctly

**Solution:**
1. Download fresh key from Firebase Console
2. Upload to your repo
3. Commit and push
4. Redeploy on Render

## Step-by-Step Fix

### Step 1: Generate New Key

1. **Firebase Console:**
   - https://console.firebase.google.com/project/wisdom-7c115/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Download JSON file

### Step 2: Verify Key Locally

```bash
# Check the downloaded file
cat wisdom-7c115-firebase-adminsdk-xxxxx.json | jq .

# Should see:
# - project_id: "wisdom-7c115"
# - client_email: "firebase-adminsdk-xxxxx@wisdom-7c115.iam.gserviceaccount.com"
# - private_key: "-----BEGIN PRIVATE KEY-----\n..."
```

### Step 3: Update on Render

**Option A: Upload to Repo (Recommended)**
```bash
# Copy to your repo
cp ~/Downloads/wisdom-7c115-firebase-adminsdk-xxxxx.json chat-backend/firebase-service-account.json

# Commit and push
git add chat-backend/firebase-service-account.json
git commit -m "Update Firebase service account key"
git push
```

**Option B: Set as Environment Variable**
1. Convert to base64:
   ```bash
   cat firebase-service-account.json | base64
   ```
2. Render Dashboard → Environment
3. Add: `FIREBASE_SERVICE_ACCOUNT_JSON` = (base64 string)
4. Update code to read from env var if needed

### Step 4: Redeploy

1. Render Dashboard → Manual Deploy
2. Clear build cache & deploy
3. Wait for completion

### Step 5: Verify

Check logs for:
```
✅ Firebase Admin SDK initialized successfully
```

Then test FCM - should work now!

## Why Keys Get Invalid

1. **Key was manually deleted** in Google Cloud Console
2. **Key expired** (rare but possible)
3. **Security policy change** revoked the key
4. **Key was rotated** by another admin
5. **Key file corrupted** during upload/copy

## Prevention

- Don't delete keys from Google Cloud Console
- Keep backup of working keys (securely)
- Use separate keys for dev/staging/prod
- Monitor Firebase Console for key status

## Still Not Working?

If you've:
- ✅ Generated new key
- ✅ Uploaded to Render
- ✅ Redeployed
- ✅ Verified time is correct

And it still fails, check:
1. **File permissions** on Render
2. **Environment variable** path is correct
3. **Key format** (newlines, encoding)
4. **Contact Render support** if file isn't being read


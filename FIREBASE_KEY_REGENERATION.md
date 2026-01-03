# Regenerate Firebase Service Account Key

## Current Issue
Firebase JWT validation is failing with "Invalid JWT Signature" error.

**Diagnosis:**
- ✅ Server time is correct (clock skew: 0s, timezone: UTC)
- ✅ Year is correct (2026)
- ❌ Service account key is likely **revoked** or **corrupted**

## Solution: Generate New Service Account Key

### Step 1: Generate New Key from Firebase Console

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/project/wisdom-7c115/settings/serviceaccounts/adminsdk

2. **Generate New Key:**
   - Click "Generate new private key" button
   - Confirm the dialog
   - A JSON file will download automatically

3. **Verify the Downloaded File:**
   - File name: `wisdom-7c115-firebase-adminsdk-xxxxx.json`
   - Should contain:
     - `project_id`: "wisdom-7c115"
     - `client_email`: "firebase-adminsdk-xxxxx@wisdom-7c115.iam.gserviceaccount.com"
     - `private_key`: Should start with "-----BEGIN PRIVATE KEY-----"
     - `private_key` length: ~1700+ characters

### Step 2: Replace the Key File

**For Render (Production):**

1. **Upload to Render:**
   - Go to Render Dashboard → Your Service → Environment
   - Add/Update: `FIREBASE_SERVICE_ACCOUNT_PATH` = `/app/firebase-service-account.json`
   - Or upload the file to your repo and set the path

2. **Or Use Environment Variables:**
   - Convert the JSON to base64: `cat key.json | base64`
   - Add to Render: `FIREBASE_SERVICE_ACCOUNT_JSON` (base64 encoded)
   - Update code to read from env var if needed

**For Local Development:**

1. **Replace the file:**
   ```bash
   # Backup old key (just in case)
   mv chat-backend/firebase-service-account.json chat-backend/firebase-service-account.json.backup
   
   # Copy new key
   cp ~/Downloads/wisdom-7c115-firebase-adminsdk-xxxxx.json chat-backend/firebase-service-account.json
   ```

2. **Verify file:**
   ```bash
   # Check file exists
   ls -la chat-backend/firebase-service-account.json
   
   # Check it's valid JSON
   cat chat-backend/firebase-service-account.json | jq .
   ```

### Step 3: Restart Backend Server

**Render:**
- Go to Dashboard → Manual Deploy → Clear cache & deploy

**Local:**
```bash
# Stop server (Ctrl+C)
# Restart
npm start
# or
node server.js
```

### Step 4: Verify It Works

Check backend logs for:
```
✅ Firebase Admin SDK initialized successfully
```

Then test FCM - should see:
```
✅ FCM notification sent successfully
```

## Step 5: Clean Up Old Key (Optional but Recommended)

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/iam-admin/serviceaccounts?project=wisdom-7c115

2. **Find the service account:**
   - `firebase-adminsdk-fbsvc@wisdom-7c115.iam.gserviceaccount.com`

3. **Click on it → "Keys" tab**

4. **Delete the old key** (the one that was failing)

## Troubleshooting

### If still getting errors:

1. **Check file permissions:**
   ```bash
   chmod 600 chat-backend/firebase-service-account.json
   ```

2. **Verify JSON format:**
   - No extra spaces or characters
   - Proper newlines in private_key
   - All quotes are escaped properly

3. **Check file path:**
   - Render: Should be `/app/firebase-service-account.json` or path set in env var
   - Local: Should be `chat-backend/firebase-service-account.json`

4. **Verify project ID matches:**
   - Service account must be from project: `wisdom-7c115`

## Why Keys Get Revoked

- Key was manually deleted in Google Cloud Console
- Key expired (rare, but possible)
- Security policy change
- Service account was disabled/re-enabled
- Key was rotated by another admin

## Prevention

- Don't delete keys from Google Cloud Console unless necessary
- Keep a backup of working keys (securely stored)
- Use separate keys for dev/staging/prod if needed
- Monitor Firebase Console for key status


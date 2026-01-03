# Firebase Admin SDK Setup for FCM Notifications

## ⚠️ IMPORTANT: Project Matching

**The backend service account MUST match the Firebase project used by your Flutter app!**

Check your Flutter app's Firebase project:
- **Android**: Check `android/app/google-services.json` → `project_id`
- **iOS**: Check `ios/Runner/GoogleService-Info.plist` → `PROJECT_ID`

**Current Status:**
- Android project: `wisdom-7c115` (from google-services.json)
- iOS project: `test-101b0` (from GoogleService-Info.plist)
- ⚠️ **These don't match!** You need to use the same project for both.

## Problem
If you see this error:
```
Firebase Admin SDK not initialized. Skipping notification.
📱 FCM notification sent to XXX: ❌ Failed
```

Or:
```
Error fetching access token: invalid_grant (Invalid JWT: Token must be a short-lived token (60 minutes) and in a reasonable timeframe. Check your iat and exp values in the JWT claim.)
```

**This error usually means:**
1. **Server time is out of sync** (most common) - Your system clock is wrong
2. **Service account key was revoked** - The key was deleted in Google Cloud Console
3. **Wrong project** - Service account is from a different Firebase project

**Quick Fix for Time Sync (macOS):**

**Method 1: System Preferences (Recommended - No Terminal Required)**
1. Click **Apple menu** (🍎 top left) → **System Preferences** (or **System Settings** on newer macOS)
2. Click **Date & Time**
3. Click the **lock icon** 🔒 at bottom left
4. Enter your Mac password
5. Check the box: **"Set date and time automatically"**
6. Select time server: **`time.apple.com`** (or any server from the dropdown)
7. Close System Preferences
8. **Restart your backend server**

**Method 2: Command Line (Quick)**
```bash
# Sync time with Apple's time server
sudo sntp -sS time.apple.com

# Verify time is synced
date

# Then restart your backend server
```

**After syncing, verify:**
- Run `date` - should show current correct time
- Restart backend server
- Try sending a message - notifications should work

---

## Alternative: Run Backend in Docker (Time Always Synced)

If you can't sync your Mac's system time, you can run the backend in Docker where time is automatically synced:

```bash
# Build and run with Docker
cd chat-backend
docker-compose up -d

# Or manually:
docker build -t chat-backend .
docker run -p 3000:3000 \
  -v $(pwd)/firebase-service-account.json:/app/firebase-service-account.json:ro \
  chat-backend
```

**Note:** Docker containers use the host's time, so if your Mac time is wrong, Docker will also be wrong. You still need to sync your Mac's time.

---

## Workaround: Continue Without Notifications

**The app will continue working even if notifications fail:**
- ✅ Messages send/receive via Socket.io
- ✅ Chat list updates in real-time
- ✅ Read receipts work
- ❌ Only push notifications won't work

Notifications already fail gracefully - your app won't crash. You can continue development and fix time sync later.

**If time sync doesn't work, check if key was revoked:**
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=wisdom-7c115
2. Find: `firebase-adminsdk-fbsvc@wisdom-7c115.iam.gserviceaccount.com`
3. Click on it → **Keys** tab
4. Check if your key exists and is **Active**
5. If missing/revoked: Generate new key (see Step 2 below)

## Solution: Add Firebase Service Account

### Step 1: Determine Which Firebase Project to Use

**You need to decide which project to use:**
- Option A: Use `wisdom-7c115` (Android) - Update iOS config to match
- Option B: Use `test-101b0` (iOS) - Update Android config to match

**Recommendation:** Use the project that has FCM enabled and is actively used.

### Step 2: Get Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select the **SAME project** that your Flutter app uses:
   - If using Android project: Select `wisdom-7c115`
   - If using iOS project: Select `test-101b0`
3. Click the **⚙️ Settings** icon (top left) → **Project settings**
4. Go to the **Service accounts** tab
5. Click **Generate new private key**
6. Click **Generate key** in the dialog
7. A JSON file will be downloaded (e.g., `your-project-firebase-adminsdk-xxxxx.json`)

### Step 3: Add Service Account to Backend

1. Rename the downloaded file to `firebase-service-account.json`
2. Place it in the `chat-backend/` directory:
   ```
   chat-backend/
   ├── firebase-service-account.json  ← Add here
   ├── server.js
   ├── package.json
   └── ...
   ```

3. **Verify the project ID matches:**
   - Open `firebase-service-account.json`
   - Check the `project_id` field
   - It should match your Flutter app's Firebase project

### Step 4: Alternative - Use Environment Variable

If you prefer to use an environment variable:

1. Add to `chat-backend/.env`:
   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/your/firebase-service-account.json
   ```

2. Or use absolute path in the variable

### Step 5: Fix Project Mismatch (If Needed)

**If Android and iOS use different projects, you need to:**

1. **Choose one project** (recommended: use the one with FCM enabled)
2. **Update the other platform's config:**
   - If keeping Android project (`wisdom-7c115`): Update iOS `GoogleService-Info.plist`
   - If keeping iOS project (`test-101b0`): Update Android `google-services.json`
3. **Generate service account from the chosen project**
4. **Re-register FCM tokens** (users need to login again to register new tokens)

### Step 6: Restart Backend Server

After adding the file, restart your backend server:

```bash
cd chat-backend
npm start
```

You should see:
```
✅ Firebase Admin SDK initialized with service account
   Service account: /path/to/firebase-service-account.json
```

## Verify It's Working

1. Send a message from one user to another (offline user)
2. Check backend logs - you should see:
   ```
   📱 FCM notification sent to XXX: ✅ Success
   ```

## Security Notes

⚠️ **Important**: 
- Never commit `firebase-service-account.json` to Git
- Add it to `.gitignore`:
  ```
  chat-backend/firebase-service-account.json
  ```
- Keep the file secure - it has admin access to your Firebase project

## Troubleshooting

### Error: "Firebase service account file not found"
- Check the file exists in `chat-backend/` directory
- Verify the filename is exactly `firebase-service-account.json`
- Check file permissions

### Error: "Invalid service account"
- Make sure you downloaded the correct service account key
- Verify the JSON file is not corrupted
- Try generating a new key from Firebase Console

### Still not working?
1. Check backend logs for detailed error messages
2. Verify Firebase project has FCM enabled
3. Make sure the service account has proper permissions

r
# 🚀 Deploy to Render - Quick Steps

## 1. Go to Render
https://render.com

## 2. Sign Up/Login
- Use your GitHub account

## 3. Create Web Service
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository (if not already)
- Select the repo with `chat-backend` folder

## 4. Configure Service
- **Name**: `hr-chat-backend` (or any name)
- **Root Directory**: `chat-backend` ⚠️ **CRITICAL!**
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: `Free`

## 5. Add Environment Variables
Click **"Environment"** tab, add these:

```
NODE_ENV=production
```

```
PORT=10000
```

```
MONGODB_URI=your_mongodb_connection_string_here
```
(Paste your MongoDB Atlas connection string)

```
CORS_ORIGIN=*
```

```
SEND_NOTIFICATIONS_TO_ONLINE_USERS=true
```

## 6. Deploy
- Click **"Create Web Service"**
- Wait 5-10 minutes for first deployment
- Watch the logs to see progress

## 7. Get Your URL
Once deployed, you'll see:
`https://hr-chat-backend.onrender.com` (or your service name)

## 8. Test
Open in browser:
```
https://your-service-name.onrender.com/health
```

Should return:
```json
{"success":true,"message":"Chat API is running",...}
```

## 9. Update Flutter App
Edit `lib/constants/strings_constant.dart`:

```dart
static const String chatBaseUrl = 'https://your-service-name.onrender.com/api/chat';
static const String chatSocketUrl = 'wss://your-service-name.onrender.com';
```

⚠️ **Use `wss://` not `ws://`**

---

## ✅ Done!

Your backend is now live! 🎉



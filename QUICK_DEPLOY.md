# 🚀 Quick Deploy to Render (5 Minutes)

## Step 1: Set Up MongoDB Atlas (2 minutes)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up (free)
3. Create a free cluster (M0 - Free tier)
4. Wait for cluster to be created (~3 minutes)
5. Click "Connect" → "Connect your application"
6. Copy the connection string
7. Replace `<password>` with a password you'll create
8. Click "Database Access" → "Add New Database User"
   - Username: `chatadmin`
   - Password: Click "Autogenerate Secure Password" and save it
9. Click "Network Access" → "Add IP Address" → "Allow Access from Anywhere" (0.0.0.0/0)
10. Update connection string with your password:
    ```
    mongodb+srv://chatadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority
    ```

## Step 2: Deploy to Render (3 minutes)

1. **Push to GitHub** (if not already):
   ```bash
   cd chat-backend
   git add .
   git commit -m "Ready for deployment"
   git push
   ```

2. **Go to Render**: https://render.com
   - Sign up with GitHub (free)

3. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repo

4. **Configure**:
   - **Name**: `hr-chat-backend` (or any name)
   - **Root Directory**: `chat-backend` ⚠️ **IMPORTANT!**
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add Environment Variables**:
   Click "Environment" and add:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://chatadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority
   CORS_ORIGIN=*
   SEND_NOTIFICATIONS_TO_ONLINE_USERS=true
   ```

6. **Deploy**:
   - Click "Create Web Service"
   - Wait 5-10 minutes for first deployment
   - Your URL will be: `https://hr-chat-backend.onrender.com` (or your service name)

## Step 3: Update Flutter App (1 minute)

Edit `lib/constants/strings_constant.dart`:

```dart
// Replace these lines:
static const String chatBaseUrl = 'https://hr-chat-backend.onrender.com/api/chat';
static const String chatSocketUrl = 'wss://hr-chat-backend.onrender.com';
```

**Important**: Use `wss://` (secure WebSocket) not `ws://`

## Step 4: Test

1. **Test API**:
   ```bash
   curl https://hr-chat-backend.onrender.com/health
   ```
   Should return: `{"success":true,"message":"Chat API is running",...}`

2. **Test in Flutter App**:
   - Rebuild app
   - Login
   - Try sending a message

## ✅ Done!

Your backend is now live at:
- **API**: `https://hr-chat-backend.onrender.com/api/chat`
- **Socket**: `wss://hr-chat-backend.onrender.com`

---

## ⚠️ Important Notes

### Render Free Tier Limitations:
- **Sleeps after 15 minutes** of inactivity
- **First request after sleep** takes ~30 seconds (cold start)
- **750 hours/month** free (enough for testing)

### Keep Service Awake (Optional):
Use https://cron-job.org to ping your service every 10 minutes:
- URL: `https://hr-chat-backend.onrender.com/health`
- Schedule: Every 10 minutes

### MongoDB Atlas Free Tier:
- **512MB storage** (enough for testing)
- **Shared cluster** (may have performance limits)

---

## 🆘 Troubleshooting

**Service won't start?**
- Check logs in Render dashboard
- Verify MongoDB connection string is correct
- Ensure all environment variables are set

**Socket.io not connecting?**
- Use `wss://` not `ws://` in Flutter app
- Check CORS_ORIGIN is set to `*` (for testing)

**MongoDB connection error?**
- Verify Network Access allows all IPs (0.0.0.0/0)
- Check username/password in connection string
- Ensure cluster is fully created

---

## 📱 Next Steps

1. Test all features
2. Monitor logs in Render dashboard
3. Set up cron job to keep service awake (optional)
4. Consider upgrading to paid tier for production


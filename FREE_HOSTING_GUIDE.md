# Free Hosting Guide for Chat Backend

## 🎯 Best Free Hosting Options

### Option 1: Render (Recommended - Easiest) ⭐
- **Free Tier**: 750 hours/month (enough for testing)
- **Auto-deploy from GitHub**
- **Free SSL certificate**
- **WebSocket support**
- **Easy MongoDB Atlas integration**

### Option 2: Railway
- **Free Tier**: $5 credit/month
- **Auto-deploy from GitHub**
- **Simple setup**

### Option 3: Fly.io
- **Free Tier**: 3 shared VMs
- **Good for Socket.io**
- **More complex setup**

---

## 🚀 Quick Start: Render (Recommended)

### Step 1: Prepare Your Code

1. **Create `.env.example` file** (already created below)
2. **Ensure `package.json` has start script** ✅ (already has `"start": "node server.js"`)

### Step 2: Set Up MongoDB Atlas (Free)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a free cluster (M0 - Free tier)
4. Create database user:
   - Database Access → Add New Database User
   - Username: `chatadmin` (or your choice)
   - Password: Generate secure password
5. Network Access:
   - Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (0.0.0.0/0) for testing
6. Get Connection String:
   - Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://chatadmin:yourpassword@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority`

### Step 3: Deploy to Render

1. **Push code to GitHub** (if not already):
   ```bash
   cd chat-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Go to Render Dashboard**:
   - Visit: https://render.com
   - Sign up/login with GitHub

3. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository with `chat-backend` folder

4. **Configure Service**:
   - **Name**: `hr-chat-backend` (or your choice)
   - **Root Directory**: `chat-backend` (important!)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Set Environment Variables**:
   Click "Environment" tab and add:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://chatadmin:yourpassword@cluster0.xxxxx.mongodb.net/chatdb?retryWrites=true&w=majority
   CORS_ORIGIN=*
   SEND_NOTIFICATIONS_TO_ONLINE_USERS=true
   ```
   
   **For Firebase (Optional - if you want notifications)**:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```
   Then upload `firebase-service-account.json` file in Render dashboard

6. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Your service will be available at: `https://your-service-name.onrender.com`

### Step 4: Update Flutter App

Update `lib/constants/strings_constant.dart`:

```dart
// Replace with your Render URL
static const String chatBaseUrl = 'https://your-service-name.onrender.com/api/chat';
static const String chatSocketUrl = 'wss://your-service-name.onrender.com';
```

**Important**: Use `wss://` (secure WebSocket) for Render, not `ws://`

---

## 🚂 Alternative: Railway

### Step 1: Sign Up
- Go to https://railway.app
- Sign up with GitHub

### Step 2: Create Project
- Click "New Project"
- Select "Deploy from GitHub repo"
- Select your repository

### Step 3: Configure
- **Root Directory**: `chat-backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 4: Add Environment Variables
- Go to Variables tab
- Add all variables from `.env.example`

### Step 5: Get URL
- Railway will provide a URL like: `https://your-app.up.railway.app`
- Update Flutter app with this URL

---

## 🪰 Alternative: Fly.io

### Step 1: Install Fly CLI
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Login
```bash
fly auth login
```

### Step 3: Initialize
```bash
cd chat-backend
fly launch
```

### Step 4: Deploy
```bash
fly deploy
```

---

## 📋 Required Environment Variables

Create these in your hosting platform:

```env
# Server
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatdb?retryWrites=true&w=majority

# CORS (for Flutter app)
CORS_ORIGIN=*

# Firebase (Optional - for notifications)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
SEND_NOTIFICATIONS_TO_ONLINE_USERS=true
```

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to MongoDB"
- **Solution**: Check MongoDB Atlas Network Access allows your Render IP
- Add `0.0.0.0/0` to allow all IPs (for testing)

### Issue: "Socket.io not working"
- **Solution**: Ensure you're using `wss://` (secure WebSocket) not `ws://`
- Check CORS settings in Render

### Issue: "Service sleeps after inactivity"
- **Render Free Tier**: Services sleep after 15 minutes of inactivity
- **Solution**: 
  - First request after sleep takes ~30 seconds (cold start)
  - Consider upgrading to paid tier for always-on
  - Or use a ping service to keep it awake

### Issue: "Port already in use"
- **Solution**: Render sets PORT automatically, don't hardcode it
- Use `process.env.PORT || 3000` in code ✅ (already done)

---

## 🎯 Quick Deploy Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created
- [ ] Network access configured (0.0.0.0/0)
- [ ] Connection string copied
- [ ] Code pushed to GitHub
- [ ] Render/Railway account created
- [ ] Web service created
- [ ] Environment variables set
- [ ] Service deployed
- [ ] Flutter app URLs updated
- [ ] Test connection

---

## 📱 Update Flutter App After Deployment

1. **Update `lib/constants/strings_constant.dart`**:
   ```dart
   static const String chatBaseUrl = 'https://your-service.onrender.com/api/chat';
   static const String chatSocketUrl = 'wss://your-service.onrender.com';
   ```

2. **Rebuild app**:
   ```bash
   flutter clean
   flutter pub get
   flutter run
   ```

---

## 💡 Pro Tips

1. **Keep Service Awake** (Render Free Tier):
   - Use a service like https://cron-job.org
   - Ping your service every 10 minutes: `GET https://your-service.onrender.com/health`

2. **MongoDB Atlas Free Tier**:
   - 512MB storage (enough for testing)
   - Shared cluster (may have performance limits)

3. **Firebase Service Account**:
   - Upload `firebase-service-account.json` to Render
   - Or use environment variables (more secure)

4. **Monitoring**:
   - Render provides logs in dashboard
   - Check logs if service doesn't work

---

## 🎉 You're Done!

Your backend should now be accessible at:
- **API**: `https://your-service.onrender.com/api/chat`
- **Socket.io**: `wss://your-service.onrender.com`
- **Health Check**: `https://your-service.onrender.com/health`

Test it:
```bash
curl https://your-service.onrender.com/health
```

Should return:
```json
{
  "success": true,
  "message": "Chat API is running",
  "timestamp": "..."
}
```


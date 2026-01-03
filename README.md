# HR ↔ Line Worker Chat System - Backend

Node.js backend for real-time chat between HR and Line Workers.

## 🚀 Quick Deploy (Free Hosting)

**Want to deploy for free?** See:
- **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** - 5-minute deployment guide ⭐ (Recommended)
- **[FREE_HOSTING_GUIDE.md](./FREE_HOSTING_GUIDE.md)** - Complete hosting options
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step checklist

**Recommended**: Render (easiest, free tier available)

## Features

- ✅ Real-time messaging with Socket.io
- ✅ REST API for chat operations
- ✅ MongoDB for data persistence
- ✅ FCM push notifications
- ✅ Typing indicators
- ✅ Online/offline status
- ✅ Read receipts
- ✅ Message history with pagination

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Firebase project with FCM enabled (optional, for notifications)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
CORS_ORIGIN=http://localhost:3000,https://app.thewisdom.ai
```

4. (Optional) For FCM notifications:
   - Download Firebase service account JSON from Firebase Console
   - Place it in the root directory as `firebase-service-account.json`
   - Or update `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`

## Running the Server

### Development (with auto-reload):
```bash
npm run dev
```

### Production:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/chat/auth/sync-user` - Sync user from HR system
- `POST /api/chat/auth/register-fcm` - Register FCM token

### Users
- `GET /api/chat/users/line-workers?resortId=1` - Get all line workers
- `GET /api/chat/users/:empId` - Get user by empId
- `GET /api/chat/users/online/list` - Get online users

### Chat Rooms
- `GET /api/chat/rooms?empId=APV-60&role=hr` - Get user's chat rooms
- `GET /api/chat/rooms/:roomId` - Get chat room details
- `POST /api/chat/rooms` - Create new chat room
- `PUT /api/chat/rooms/:roomId/read` - Mark room as read

### Messages
- `GET /api/chat/rooms/:roomId/messages?page=1&limit=50` - Get messages
- `POST /api/chat` - Send message (REST fallback)
- `PUT /api/chat/:messageId/read` - Mark message as read

## Socket.io Events

### Client → Server
- `join-room` - Join a chat room
- `leave-room` - Leave a chat room
- `send-message` - Send a message
- `typing-start` - User started typing
- `typing-stop` - User stopped typing
- `mark-read` - Mark message(s) as read
- `user-online` - Notify user is online

### Server → Client
- `new-message` - New message received
- `typing` - Typing indicator
- `message-read` - Message read confirmation
- `user-status` - User online/offline status
- `error` - Error occurred

## Authentication

All REST API endpoints require Bearer token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

Socket.io connections require token in handshake:
```javascript
socket.connect({
  auth: {
    token: 'your_jwt_token'
  }
});
```

## Database Schema

### Users Collection
- Stores user information synced from HR system
- Tracks online status and FCM tokens

### ChatRooms Collection
- One-on-one chat rooms between HR and Line Workers
- Tracks last message and unread counts

### Messages Collection
- All chat messages
- Tracks read receipts and delivery status

## File Upload

File upload functionality is planned but not yet implemented. For now, you can:
1. Upload files to your existing file storage service
2. Get the file URL
3. Send the URL in the message with `type: 'image'` or `type: 'file'`

## Environment Variables

See `.env.example` for all available environment variables.

## Development

The server uses:
- **Express** for REST API
- **Socket.io** for real-time communication
- **Mongoose** for MongoDB
- **Firebase Admin SDK** for FCM notifications

## License

ISC



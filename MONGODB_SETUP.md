# MongoDB Setup Complete ✅

## Connection Details

- **Database Name**: `hr_chat`
- **Cluster**: `chat.ixyfzgw.mongodb.net`
- **Username**: `wisdom`
- **Connection String**: Configured in `.env`

## Connection String Format

```
mongodb+srv://wisdom:chat@chat.ixyfzgw.mongodb.net/hr_chat?retryWrites=true&w=majority
```

## Collections Created Automatically

When you first run the server, MongoDB will automatically create these collections:

1. **users** - User information synced from HR system
2. **chatrooms** - Chat rooms between HR and Line Workers
3. **messages** - All chat messages

## Indexes

The models include indexes for optimal performance:
- `users`: empId (unique), resortId, role, rankType
- `chatrooms`: hrEmpId, lineWorkerEmpId, compound index on (hrEmpId, lineWorkerEmpId)
- `messages`: roomId, senderId, createdAt, compound index on (roomId, createdAt)

## Testing Connection

Once you start the server, you should see:
```
MongoDB Connected: chat-shard-00-00.ixyfzgw.mongodb.net
```

If you see connection errors:
1. Check your internet connection
2. Verify MongoDB Atlas allows connections from your IP (check Network Access in Atlas)
3. Verify username/password are correct

## Network Access

Make sure MongoDB Atlas allows connections from:
- Your development machine IP (for local testing)
- Your server IP (for production)
- Or use `0.0.0.0/0` to allow all IPs (less secure, but easier for development)

## Next Steps

1. ✅ MongoDB connection configured
2. ⏳ Install dependencies: `npm install`
3. ⏳ Start server: `npm run dev`
4. ⏳ Test connection by syncing a user



const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  loginId: {
    type: String,
    index: true,
    sparse: true // Allows multiple null values
  },
  userId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return this.empId;
    }
  },
  name: {
    type: String,
    required: true
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  email: {
    type: String
  },
  role: {
    type: String,
    required: true,
    enum: ['hr', 'line_worker', 'employee'],
    index: true
  },
  rankType: {
    type: String,
    index: true
  },
  profilePicture: {
    type: String
  },
  department: {
    type: String
  },
  position: {
    type: String
  },
  resortId: {
    type: Number,
    index: true
  },
  fcmToken: {
    type: String
  },
  fcmTokens: {
    type: [String],
    default: []
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String
  }
}, {
  timestamps: true
});

// Add FCM token (supports multiple devices)
userSchema.methods.addFCMToken = function(token) {
  if (!this.fcmTokens.includes(token)) {
    this.fcmTokens.push(token);
  }
  // Also set single fcmToken for backward compatibility
  this.fcmToken = token;
  return this.save();
};

// Remove FCM token
userSchema.methods.removeFCMToken = function(token) {
  this.fcmTokens = this.fcmTokens.filter(t => t !== token);
  if (this.fcmToken === token) {
    this.fcmToken = this.fcmTokens[0] || null;
  }
  return this.save();
};

// Update online status
userSchema.methods.setOnline = function(socketId) {
  this.isOnline = true;
  this.socketId = socketId;
  this.lastSeen = new Date();
  return this.save();
};

userSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.socketId = null;
  this.lastSeen = new Date();
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;


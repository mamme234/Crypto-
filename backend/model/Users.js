const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  referralLink: String,
  coins: { type: Number, default: 0 },
  usdt: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  referrals: { type: Number, default: 0 },
  withdrawUnlocked: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', userSchema);

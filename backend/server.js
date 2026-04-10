require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// ✅ FIXED (lowercase to match file: models/user.js)
const User = require('./models/user');

const SECRET = process.env.JWT_SECRET;

/* ---------------- ROOT ---------------- */
app.get('/', (req, res) => {
  res.send("Crypto backend is running 🚀");
});

/* ---------------- DB ---------------- */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB error:", err));

/* ---------------- AUTH ---------------- */
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = await User.findById(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const createToken = (id) =>
  jwt.sign({ id }, SECRET, { expiresIn: '7d' });

/* ---------------- REGISTER ---------------- */
app.post('/api/register', async (req, res) => {
  const { email, password, referral } = req.body;

  if (!email || !password) {
    return res.json({ success: false, message: "Missing fields" });
  }

  const exist = await User.findOne({ email });
  if (exist) {
    return res.json({ success: false, message: "Email exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const referralLink = email.split('@')[0] + "_ref";

  const user = await User.create({
    email,
    password: hash,
    referralLink
  });

  // referral system
  if (referral) {
    const refUser = await User.findOne({ referralLink: referral });
    if (refUser) {
      refUser.referrals += 1;
      await refUser.save();
    }
  }

  const token = createToken(user._id);
  res.json({ success: true, token });
});

/* ---------------- LOGIN ---------------- */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.json({ success: false, message: "Wrong password" });
  }

  const token = createToken(user._id);
  res.json({ success: true, token });
});

/* ---------------- USER DATA ---------------- */
app.get('/api/user', auth, async (req, res) => {
  const u = req.user;

  res.json({
    coins: u.coins,
    usdt: u.usdt,
    level: u.level,
    referrals: u.referrals,
    referralLink: u.referralLink,
    withdrawUnlocked: u.withdrawUnlocked
  });
});

/* ---------------- ADD COINS ---------------- */
app.post('/api/user/coins', auth, async (req, res) => {
  const { coins } = req.body;

  req.user.coins += Number(coins || 0);
  req.user.usdt = req.user.coins / 1000;

  await req.user.save();

  res.json({
    coins: req.user.coins,
    usdt: req.user.usdt,
    level: req.user.level
  });
});

/* ---------------- TASK ---------------- */
app.post('/api/user/task', auth, async (req, res) => {
  const { task } = req.body;

  let reward = 0;

  if (task === "Telegram") reward = 500;
  if (task === "TikTok") reward = 1000;
  if (task === "YouTube") reward = 500;

  req.user.coins += reward;

  await req.user.save();

  res.json({
    coins: req.user.coins,
    referrals: req.user.referrals
  });
});

/* ---------------- WITHDRAW ---------------- */
app.post('/api/user/withdraw', auth, async (req, res) => {
  const u = req.user;

  if ((u.coins >= 20000 && u.referrals >= 10) || u.withdrawUnlocked) {

    u.coins = 0;
    u.usdt = 0;
    u.withdrawUnlocked = false;

    await u.save();

    return res.json({
      success: true,
      message: "Withdraw successful!"
    });
  }

  res.json({
    success: false,
    message: "Need 20,000 coins + 10 referrals OR deposit $5"
  });
});

/* ---------------- DEPOSIT UNLOCK ---------------- */
app.post('/api/user/depositUnlock', auth, async (req, res) => {
  req.user.withdrawUnlocked = true;
  await req.user.save();

  res.json({
    success: true,
    message: "Deposit successful!"
  });
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

/* ================= FRONTEND ================= */

app.use(
  express.static(
    path.join(__dirname, "../frontend")
  )
);

/* ================= START BOT ================= */

spawn("node", [path.join(__dirname, "bot.js")], {
  cwd: __dirname,
  stdio: "inherit"
});

/* ================= MONGODB ================= */

if (!MONGO_URL) {
  console.log("❌ MONGO_URL is missing in environment");
}

mongoose.connect(MONGO_URL)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Error:", err));

/* ================= USER MODEL ================= */

const User = mongoose.model("User", new mongoose.Schema({

  userId: { type: String, unique: true },

  balance: { type: Number, default: 0 },

  refs: { type: Number, default: 0 },

  adsWatched: { type: Number, default: 0 },

  lastAd: { type: Number, default: 0 }

}));

/* ================= WITHDRAW MODEL ================= */

const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({

  userId: String,
  amount: Number,
  status: { type: String, default: "pending" },
  date: { type: Date, default: Date.now }

}));

/* ================= SAFE USER LOADER ================= */

async function getUser(userId) {

  let user = await User.findOne({ userId });

  if (!user) {

    user = await User.create({
      userId,
      balance: 0,
      refs: 0,
      adsWatched: 0,
      lastAd: 0
    });

  }

  return user;
}

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req, res) => {

  const user = await getUser(req.params.id);

  res.json(user);

});

/* ================= ADS ================= */

app.post("/ads", async (req, res) => {

  const user = await getUser(req.body.userId);

  const now = Date.now();

  if (now - user.lastAd < 10000) {

    return res.json({
      success: false,
      message: "Cooldown"
    });

  }

  user.balance += 0.03;
  user.adsWatched += 1;
  user.lastAd = now;

  await user.save();

  res.json({
    success: true,
    balance: user.balance,
    adsWatched: user.adsWatched
  });

});

/* ================= REF ================= */

app.post("/ref", async (req, res) => {

  const { userId, refId } = req.body;

  if (!refId || userId === refId) {

    return res.json({ success: false });

  }

  const user = await getUser(userId);
  const ref = await getUser(refId);

  if (user.refUsed) {

    return res.json({ success: false });

  }

  user.refUsed = true;

  ref.balance += 0.1;
  ref.refs += 1;

  await user.save();
  await ref.save();

  res.json({ success: true });

});

/* ================= WITHDRAW ================= */

const MIN_WITHDRAW = 5;
const MIN_REFS = 10;
const MIN_ADS = 500;

app.post("/withdraw", async (req, res) => {

  const { userId, amount } = req.body;

  const user = await getUser(userId);

  if (amount < MIN_WITHDRAW) {

    return res.json({
      success: false,
      message: "Min withdraw is 5"
    });

  }

  if (user.balance < amount) {

    return res.json({
      success: false,
      message: "Insufficient balance"
    });

  }

  if (user.refs < MIN_REFS) {

    return res.json({
      success: false,
      message: "Need 10 refs"
    });

  }

  if (user.adsWatched < MIN_ADS) {

    return res.json({
      success: false,
      message: "Watch 500 ads"
    });

  }

  user.balance -= amount;

  await user.save();

  await Withdraw.create({
    userId,
    amount,
    status: "pending"
  });

  res.json({
    success: true,
    message: "Withdraw submitted"
  });

});

/* ================= START SERVER ================= */

app.listen(PORT, () => {

  console.log("🚀 Server running on " + PORT);

});

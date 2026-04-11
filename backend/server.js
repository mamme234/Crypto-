const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

/* ======================
   🔥 DEBUG ENV (IMPORTANT)
====================== */
console.log("MONGO_URI:", process.env.MONGO_URI ? "Loaded ✅" : "Missing ❌");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Loaded ✅" : "Missing ❌");

/* ======================
   🔥 MONGODB CONNECT
====================== */
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => {
  console.log("❌ MongoDB Error:", err.message);
  process.exit(1); // stop app if DB fails
});

/* ======================
   🔐 AUTH MIDDLEWARE
====================== */
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "No token" });
  }

  const token = header.split(" ")[1];

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ======================
   👤 REGISTER
====================== */
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist) {
      return res.json({ success: false, message: "User exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   🔐 LOGIN
====================== */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.json({ success: false, message: "Wrong password" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   👤 GET USER
====================== */
app.get("/api/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   🪙 TAP
====================== */
app.post("/api/user/tap", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.coins += 50;
    user.usdt = user.coins / 1000;

    await user.save();
    res.json(user);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   🎁 DAILY
====================== */
app.post("/api/user/daily", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.coins += 1000;
    user.usdt = user.coins / 1000;

    await user.save();
    res.json(user);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   📱 TASKS
====================== */
app.post("/api/user/task", auth, async (req, res) => {
  try {
    const { task } = req.body;
    const user = await User.findById(req.user.id);

    if (task === "Telegram") user.coins += 500;
    if (task === "TikTok") user.coins += 1000;
    if (task === "YouTube") user.coins += 500;

    user.usdt = user.coins / 1000;

    await user.save();
    res.json(user);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   💸 WITHDRAW
====================== */
app.post("/api/user/withdraw", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.coins < 20000 || user.referrals < 10) {
      return res.json({ message: "Need 20000 coins + 10 referrals" });
    }

    if (!user.withdrawUnlocked) {
      return res.json({ message: "Locked. Deposit $5 to unlock" });
    }

    user.coins = 0;
    await user.save();

    res.json({ message: "Withdraw successful" });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   🔓 UNLOCK
====================== */
app.post("/api/user/depositUnlock", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.withdrawUnlocked = true;
    await user.save();

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ======================
   🚀 START SERVER
====================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});

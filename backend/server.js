const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ======================
// 1. MONGO DB CONNECT
// ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.log("MongoDB Error ❌", err));

// ======================
// 2. USER MODEL
// ======================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  coins: { type: Number, default: 0 },
  usdt: { type: Number, default: 0 },
});

const User = mongoose.model("User", userSchema);

// ======================
// 3. REGISTER
// ======================
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
    });

    await user.save();

    res.json({ message: "User created ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 4. LOGIN
// ======================
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found ❌" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Wrong password ❌" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 5. GET USER PROFILE
// ======================
app.get("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization;

    if (!token) return res.status(401).json({ message: "No token ❌" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 6. TAP / COIN INCREASE (YOUR APP CORE)
// ======================
app.post("/tap", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);

    user.coins += 1;
    user.usdt = user.coins / 1000; // example conversion

    await user.save();

    res.json({
      coins: user.coins,
      usdt: user.usdt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// 7. START SERVER
// ======================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

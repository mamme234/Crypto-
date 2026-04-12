const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ======================
// MongoDB
// ======================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected ✅"))
  .catch(err => console.log("MongoDB Error ❌", err));

// ======================
// Model
// ======================
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  coins: { type: Number, default: 0 },
  usdt: { type: Number, default: 0 }
});

const User = mongoose.model("User", userSchema);

// ======================
// Register
// ======================
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const user = new User({ username, password: hash });
    await user.save();

    res.json({ message: "Registered ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Login
// ======================
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// Tap
// ======================
app.post("/tap", async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.json({ message: "User not found" });

    user.coins += 1;
    user.usdt = user.coins / 1000;

    await user.save();

    res.json({
      coins: user.coins,
      usdt: user.usdt
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running 🚀"));

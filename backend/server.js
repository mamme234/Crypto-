require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

const app = express();
app.use(express.json());

/* ================= CONFIG ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
  .then(() => console.log("DB Connected"))
  .catch(err => console.log("Mongo Error:", err));

const UserSchema = new mongoose.Schema({
  userId: String,
  usdt: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  level: { type: String, default: "Bronze" },
  lastBonus: Number
});

const User = mongoose.model("User", UserSchema);

async function getUser(userId) {
  let user = await User.findOne({ userId });
  if (!user) user = await User.create({ userId });
  return user;
}

/* ================= TELEGRAM BOT ================= */
bot.onText(/\/start/, async (msg) => {
  const user = await getUser(msg.from.id);

  bot.sendMessage(msg.chat.id,
`👋 Welcome!

💰 USDT: $${user.usdt}
🪙 Coins: ${user.coins}
📊 Level: ${user.level}

🌐 Open App:
https://YOUR_DOMAIN.com`);
});

bot.onText(/\/ref/, async (msg) => {
  await getUser(msg.from.id);

  bot.sendMessage(msg.chat.id,
`🔗 Referral Link:
https://t.me/YOUR_BOT?start=${msg.from.id}`);
});

/* ================= API ================= */
app.get("/profile/:id", async (req, res) => {
  const user = await getUser(req.params.id);
  res.json(user);
});

app.post("/ads", async (req, res) => {
  const user = await getUser(req.body.userId);

  user.usdt += 0.03;
  user.coins += 1;

  await user.save();

  res.json({ ok: true });
});

app.post("/bonus", async (req, res) => {
  const user = await getUser(req.body.userId);

  const now = Date.now();

  if (user.lastBonus && now - user.lastBonus < 86400000) {
    return res.json({ message: "❌ Already claimed today" });
  }

  user.usdt += 0.05;
  user.lastBonus = now;

  await user.save();

  res.json({ message: "🎁 +0.05$ added" });
});

app.post("/withdraw", async (req, res) => {
  const { userId, wallet, amount } = req.body;

  const user = await getUser(userId);

  if (!wallet) return res.json({ message: "❌ Enter wallet" });
  if (!amount || amount <= 0) return res.json({ message: "❌ Invalid amount" });
  if (user.usdt < amount) return res.json({ message: "❌ Not enough balance" });

  user.usdt -= amount;
  await user.save();

  bot.sendMessage(
    ADMIN_ID,
`💸 WITHDRAW REQUEST

User: ${userId}
Wallet: ${wallet}
Amount: $${amount}`
  );

  res.json({ message: "✅ Sent to admin" });
});

/* ================= FRONTEND (FIXED SAFE METHOD) ================= */

// ALWAYS go ONE LEVEL UP from backend
const frontendPath = path.resolve(__dirname, "../frontend");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

/* ================= CONFIG ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

/* ================= APP ================= */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= FRONTEND ================= */
const FRONTEND_PATH = path.join(__dirname, "../Frontend");

app.use(express.static(FRONTEND_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* ================= USER MODEL ================= */
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  usdt: { type: Number, default: 0 },
  refBy: String,
  referrals: { type: Number, default: 0 }
}));

/* ================= HELPERS ================= */
async function getUser(userId) {
  let user = await User.findOne({ userId });
  if (!user) user = await User.create({ userId });
  return user;
}

/* ================= TELEGRAM BOT ================= */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================= START ================= */
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const ref = match?.[1];

  let user = await getUser(userId);

  if (ref && ref !== userId) {
    const refUser = await User.findOne({ userId: ref });

    if (refUser && !user.refBy) {
      user.refBy = ref;
      await user.save();

      refUser.referrals += 1;
      refUser.usdt += 0.1;
      await refUser.save();
    }
  }

  bot.sendMessage(msg.chat.id,
`👋 Welcome to StudyBuddy!

💰 Earn USDT by watching ads
📊 Use /balance
🔗 Use /ref`);
});

/* ================= REF (FIXED) ================= */
bot.onText(/\/ref/, async (msg) => {
  const botUsername = process.env.BOT_USERNAME;

  const link = `https://t.me/${botUsername}?start=${msg.from.id}`;

  bot.sendMessage(msg.chat.id,
`🔗 Your Referral Link:
${link}`);
});

/* ================= BALANCE ================= */
bot.onText(/\/balance/, async (msg) => {
  const user = await getUser(msg.from.id.toString());

  bot.sendMessage(msg.chat.id,
`💰 Balance:
USDT: ${user.usdt.toFixed(4)}
👥 Referrals: ${user.referrals}`);
});

/* ================= ADS CLICK ================= */
app.post("/ads-click", async (req, res) => {
  try {
    const { userId, reward } = req.body;

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const user = await getUser(userId);

    user.usdt += Number(reward) || 0.03;

    await user.save();

    res.json({
      success: true,
      usdt: user.usdt
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= PROFILE ================= */
app.get("/profile/:userId", async (req, res) => {
  const user = await getUser(req.params.userId);

  res.json({
    usdt: user.usdt
  });
});

/* ================= WITHDRAW ================= */
app.post("/withdraw", async (req, res) => {
  const { userId, wallet, amount } = req.body;

  const user = await getUser(userId);

  if (user.usdt < amount) {
    return res.json({ message: "❌ Not enough USDT" });
  }

  user.usdt -= amount;
  await user.save();

  res.json({ message: "✅ Withdraw request sent (manual approval)" });
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

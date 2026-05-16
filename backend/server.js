require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");

/* ================= CONFIG ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

/* ================= PATH FIX (YOUR STRUCTURE) ================= */
const FRONTEND_PATH = path.join(__dirname, "../Frontend");

/* ================= APP ================= */
const app = express();
app.use(cors());
app.use(express.json());

/* ================= FRONTEND FIX ================= */

// Serve frontend static files
app.use(express.static(FRONTEND_PATH));

// Main route
app.get("/", (req, res) => {
  const indexPath = path.join(FRONTEND_PATH, "index.html");

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("❌ Frontend index.html not found");
  }
});

/* ================= DB ================= */
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ DB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

/* ================= USER MODEL ================= */
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  coins: { type: Number, default: 0 },
  usdt: { type: Number, default: 0 },
  refBy: String,
  referrals: { type: Number, default: 0 }
}));

/* ================= TELEGRAM BOT ================= */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const CHANNEL_ID = process.env.CHANNEL_ID;
const GROUP_ID = process.env.GROUP_ID;
const BOT_USERNAME = process.env.BOT_USERNAME;

/* ================= HELPERS ================= */
async function getUser(userId) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId });
  }
  return user;
}

/* ================= START COMMAND ================= */
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const ref = match?.[1];

  let user = await getUser(userId);

  if (ref && ref !== userId) {
    const refUser = await User.findOne({ userId: ref });

    if (refUser && !user.refBy) {
      user.refBy = ref;
      await user.save();

      refUser.referrals += 1;
      refUser.coins += 10;
      await refUser.save();
    }
  }

  bot.sendMessage(chatId,
`👋 Welcome!

🔥 Earn coins by watching ads
💰 Use /ref to get referral link
📊 Use /balance to check balance`);
});

/* ================= REF ================= */
bot.onText(/\/ref/, async (msg) => {
  const userId = msg.from.id.toString();

  const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;

  bot.sendMessage(msg.chat.id,
`🔗 Your referral link:
${link}`);
});

/* ================= BALANCE ================= */
bot.onText(/\/balance/, async (msg) => {
  const user = await getUser(msg.from.id.toString());

  bot.sendMessage(msg.chat.id,
`💰 Balance:
Coins: ${user.coins}
USDT: ${user.usdt}
Referrals: ${user.referrals}`);
});

/* ================= MOTIVATE POST ================= */
bot.onText(/\/motivate\/post (.+)/, async (msg, match) => {
  const text = match[1];

  const post =
`🔥 BIG UPDATE RELEASED!

${text}

📢 The owner changed the system`;

  if (CHANNEL_ID) bot.sendMessage(CHANNEL_ID, post);
  if (GROUP_ID) bot.sendMessage(GROUP_ID, post);

  bot.sendMessage(msg.chat.id, "✅ Posted!");
});

/* ================= VIDEO POST ================= */
bot.onText(/\/postvideo (.+)/, async (msg, match) => {
  const videoId = match[1];

  if (CHANNEL_ID) {
    bot.sendVideo(CHANNEL_ID, videoId, {
      caption: "🎥 New Update Video"
    });
  }

  bot.sendMessage(msg.chat.id, "✅ Video posted!");
});

/* ================= ADS REWARD API ================= */
app.post("/ads-click", async (req, res) => {
  const { userId, reward } = req.body;

  const user = await getUser(userId);
  user.coins += reward || 1;
  await user.save();

  res.json({ success: true, coins: user.coins });
});

/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

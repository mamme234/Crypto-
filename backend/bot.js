const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

// ===== CONFIG =====
const TOKEN = process.env.BOT_TOKEN;
const MONGO = process.env.MONGO_URI;
const APP_URL = "https://myapp1-khaki.vercel.app";

// ===== CONNECT DB =====
mongoose.connect(MONGO)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// ===== USER MODEL =====
const User = mongoose.model("User", new mongoose.Schema({
  tgId: String,
  name: String,
  coins: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  referredBy: String
}));

// ===== BOT =====
const bot = new TelegramBot(TOKEN, { polling: true });

// ===== START WITH REFERRAL =====
bot.onText(/\/start (.+)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const tgId = msg.from.id.toString();
  const name = msg.from.first_name;

  const refData = match[1]; // example: 12345_name
  const refId = refData.split("_")[0];

  let user = await User.findOne({ tgId });

  // CREATE USER
  if (!user) {

    user = new User({
      tgId,
      name,
      referredBy: refId !== tgId ? refId : null
    });

    await user.save();

    // GIVE REFERRAL REWARD
    if (refId && refId !== tgId) {

      const refUser = await User.findOne({ tgId: refId });

      if (refUser) {
        refUser.coins += 100; // ✅ 100 coins
        refUser.referrals += 1;
        await refUser.save();

        bot.sendMessage(refId, "🎉 You got 100 coins from referral!");
      }
    }
  }

  // OPEN APP BUTTON
  bot.sendMessage(chatId, "🚀 Tap below to open app", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔥 Open App",
            web_app: { url: APP_URL }
          }
        ]
      ]
    }
  });

});

// ===== NORMAL START =====
bot.onText(/\/start$/, async (msg) => {

  const chatId = msg.chat.id;
  const tgId = msg.from.id.toString();
  const name = msg.from.first_name;

  let user = await User.findOne({ tgId });

  if (!user) {
    user = new User({ tgId, name });
    await user.save();
  }

  bot.sendMessage(chatId, "🚀 Tap below to open app", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔥 Open App",
            web_app: { url: APP_URL }
          }
        ]
      ]
    }
  });

});

// ===== ERROR LOG =====
bot.on("polling_error", (err) => console.log(err));

console.log("🤖 Bot is running...");

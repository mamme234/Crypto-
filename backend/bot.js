const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// USER MODEL
const User = mongoose.model("User", new mongoose.Schema({
  tgId: String,
  name: String,
  coins: { type: Number, default: 0 },
  referredBy: String,
  referrals: { type: Number, default: 0 }
}));

// START COMMAND WITH REFERRAL
bot.onText(/\/start (.+)/, async (msg, match) => {

  const chatId = msg.chat.id;
  const tgId = msg.from.id.toString();
  const name = msg.from.first_name;

  const refData = match[1]; // example: 12345_Ali
  const refId = refData.split("_")[0];

  let user = await User.findOne({ tgId });

  // 🟢 CREATE NEW USER
  if (!user) {
    user = new User({
      tgId,
      name,
      referredBy: refId !== tgId ? refId : null
    });

    await user.save();

    // 🎁 GIVE REFERRAL REWARD
    if (refId && refId !== tgId) {

      const refUser = await User.findOne({ tgId: refId });

      if (refUser) {
        refUser.coins += 100; // ✅ 100 coins reward
        refUser.referrals += 1;
        await refUser.save();

        // notify inviter
        bot.sendMessage(refId, "🎉 You got 100 coins from referral!");
      }
    }
  }

  // 🚀 OPEN MINI APP BUTTON
  bot.sendMessage(chatId, "🚀 Tap below to open app", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🔥 Open App",
            web_app: {
              url: "https://myapp1-khaki.vercel.app"
            }
          }
        ]
      ]
    }
  });

});

// NORMAL START (NO REF)
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
            web_app: {
              url: "https://myapp1-khaki.vercel.app"
            }
          }
        ]
      ]
    }
  });

});

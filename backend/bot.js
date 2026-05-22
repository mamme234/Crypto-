require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// ================= CONFIG =================

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

const ADMIN_ID = Number(process.env.ADMIN_ID) || 7154361039;

const BOT_USERNAME = "Studybuddy_2025Bot";

const WEB_APP_URL =
"https://myapp1-khaki.vercel.app/";

const CHANNEL = "@gangs234";

const ADS_SECRET =
process.env.SECRET_KEY || "alpha_secret";

// ================= INIT =================

const bot = new TelegramBot(
  BOT_TOKEN,
  {
    polling: true
  }
);

const app = express();

app.use(cors());
app.use(express.json());

// ================= DATABASE =================

mongoose.connect(MONGO_URI)
.then(() => {

  console.log("✅ MongoDB Connected");

})
.catch((err) => {

  console.log(err);

});

// ================= USER MODEL =================

const User = mongoose.model("User", {

  userId: {
    type: String,
    unique: true
  },

  username: {
    type: String,
    default: ""
  },

  firstName: {
    type: String,
    default: ""
  },

  balance: {
    type: Number,
    default: 0
  },

  refs: {
    type: Number,
    default: 0
  },

  referredBy: {
    type: String,
    default: null
  },

  walletType: {
    type: String,
    default: ""
  },

  walletAddress: {
    type: String,
    default: ""
  },

  adsWatched: {
    type: Number,
    default: 0
  },

  lastAdTime: {
    type: Number,
    default: 0
  },

  pendingWithdrawal: {
    type: Number,
    default: 0
  }

});

// ================= WITHDRAW MODEL =================

const Withdrawal = mongoose.model("Withdrawal", {

  userId: String,

  amount: Number,

  method: String,

  address: String,

  status: {
    type: String,
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

// ================= SERVER =================

app.get("/", (req, res) => {

  res.send("🚀 Alpha Pro Running");

});

// ================= PROFILE API =================

app.get(
"/profile/:userId/:username/:firstName",

async (req, res) => {

  try {

    const {
      userId,
      username,
      firstName
    } = req.params;

    let user =
    await User.findOne({
      userId
    });

    if (!user) {

      user =
      await User.create({

        userId,
        username,
        firstName

      });

    } else {

      user.username = username;
      user.firstName = firstName;

      await user.save();

    }

    res.json({

      success: true,

      balance: user.balance,

      refs: user.refs,

      adsWatched: user.adsWatched,

      username: user.username,

      firstName: user.firstName

    });

  } catch (err) {

    console.log(err);

    res.json({
      success: false
    });

  }

});

// ================= ADS API =================

app.post("/ads", async (req, res) => {

  try {

    if (
      req.headers.authorization !== ADS_SECRET
    ) {

      return res.json({
        success: false,
        message: "Unauthorized"
      });

    }

    const { userId } = req.body;

    const user =
    await User.findOne({
      userId
    });

    if (!user) {

      return res.json({
        success: false
      });

    }

    const now = Date.now();

    // 30 sec cooldown

    if (
      now - user.lastAdTime < 30000
    ) {

      return res.json({
        success: false,
        message: "Cooldown active"
      });

    }

    // REWARD

    user.balance += 0.03;

    user.adsWatched += 1;

    user.lastAdTime = now;

    await user.save();

    res.json({

      success: true,

      balance: user.balance,

      adsWatched: user.adsWatched

    });

  } catch (err) {

    console.log(err);

    res.json({
      success: false
    });

  }

});

// ================= FORCE JOIN =================

async function checkJoin(userId) {

  try {

    const member =
    await bot.getChatMember(
      CHANNEL,
      userId
    );

    return (

      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"

    );

  } catch (e) {

    console.log(e.message);

    return false;

  }

}

// ================= REF LINK =================

function getRefLink(userId) {

  return `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;

}

// ================= START =================

bot.onText(
/\/start(?: (.+))?/,

async (msg, match) => {

  try {

    const id = String(msg.chat.id);

    const username =
    msg.from.username
    ? "@"+msg.from.username
    : "@user"+id;

    const firstName =
    msg.from.first_name || "User";

    const param =
    match?.[1];

    // FORCE JOIN

    const joined =
    await checkJoin(id);

    if (!joined) {

      return bot.sendMessage(

        id,

        "📢 Join channel first",

        {
          reply_markup: {
            inline_keyboard: [

              [
                {
                  text: "📢 Join Channel",
                  url: "https://t.me/gangs234"
                }
              ],

              [
                {
                  text: "✅ Check Join",
                  callback_data: "check_join"
                }
              ]

            ]
          }
        }

      );

    }

    // USER

    let user =
    await User.findOne({
      userId: id
    });

    if (!user) {

      user =
      await User.create({

        userId: id,
        username,
        firstName

      });

    } else {

      user.username = username;
      user.firstName = firstName;

      await user.save();

    }

    // ================= REF SYSTEM =================

    if (
      param &&
      param.startsWith("ref_")
    ) {

      const refId =
      param.replace("ref_", "");

      if (
        refId !== id &&
        !user.referredBy
      ) {

        const refUser =
        await User.findOne({
          userId: refId
        });

        if (refUser) {

          user.referredBy =
          refId;

          refUser.refs += 1;

          refUser.balance += 1;

          await user.save();
          await refUser.save();

          bot.sendMessage(

            refId,

`🎉 New Referral Joined

💰 +1 USDT Added`

          );

        }

      }

    }

    // ================= MAIN UI =================

    bot.sendMessage(

      id,

`🔥 *WELCOME TO ALPHA PRO*

👤 ${firstName}
🆔 ${username}

💰 Balance:
${user.balance.toFixed(2)} USDT

👥 Referrals:
${user.refs}

Choose option below 👇`,

{
parse_mode:"Markdown",

reply_markup:{
inline_keyboard:[

[
{
text:"🚀 Open App",
web_app:{
url:WEB_APP_URL
}
}
],

[
{
text:"💰 Balance",
callback_data:"balance"
},

{
text:"👥 Referrals",
callback_data:"refs"
}
],

[
{
text:"💸 Withdraw",
callback_data:"withdraw"
}
],

[
{
text:"📢 Join Channel",
url:"https://t.me/gangs234"
}
]

]
}
}

    );

  } catch (e) {

    console.log(e);

  }

});

// ================= CALLBACKS =================

bot.on(
"callback_query",

async (query) => {

  try {

    const id =
    String(query.message.chat.id);

    const user =
    await User.findOne({
      userId:id
    });

    if (!user) return;

    // CHECK JOIN

    if (
      query.data === "check_join"
    ) {

      const joined =
      await checkJoin(id);

      if (!joined) {

        return bot.answerCallbackQuery(
          query.id,
          {
            text:"❌ Join first",
            show_alert:true
          }
        );

      }

      bot.answerCallbackQuery(
        query.id,
        {
          text:"✅ Joined"
        }
      );

      return bot.sendMessage(
        id,
        "Send /start"
      );

    }

    // BALANCE

    if (
      query.data === "balance"
    ) {

      return bot.sendMessage(

        id,

`💰 *YOUR BALANCE*

${user.balance.toFixed(2)} USDT`,

{
parse_mode:"Markdown"
}

      );

    }

    // REFS

    if (
      query.data === "refs"
    ) {

      const link =
      getRefLink(id);

      return bot.sendMessage(

        id,

`👥 *REFERRALS*

👥 Total:
${user.refs}

🔗 Your Link:

${link}`,

{
parse_mode:"Markdown"
}

      );

    }

    // WITHDRAW

    if (
      query.data === "withdraw"
    ) {

      if (user.balance < 5) {

        return bot.sendMessage(

          id,

          "❌ Minimum withdraw is 5 USDT"

        );

      }

      return bot.sendMessage(

        id,

        "Choose withdraw method",

        {
          reply_markup:{
            inline_keyboard:[

              [
                {
                  text:"💛 Binance",
                  callback_data:"binance"
                }
              ],

              [
                {
                  text:"💎 TON",
                  callback_data:"ton"
                }
              ]

            ]
          }
        }

      );

    }

    // BINANCE

    if (
      query.data === "binance"
    ) {

      user.walletType = "Binance";

      await user.save();

      return bot.sendMessage(

        id,

        "Send your Binance wallet address"

      );

    }

    // TON

    if (
      query.data === "ton"
    ) {

      user.walletType = "TON";

      await user.save();

      return bot.sendMessage(

        id,

        "Send your TON wallet address"

      );

    }

    bot.answerCallbackQuery(
      query.id
    );

  } catch (e) {

    console.log(e);

  }

});

// ================= WALLET RECEIVER =================

bot.on(
"message",

async (msg) => {

  try {

    if (!msg.text) return;

    if (
      msg.text.startsWith("/")
    ) return;

    const id =
    String(msg.chat.id);

    const user =
    await User.findOne({
      userId:id
    });

    if (
      !user ||
      !user.walletType
    ) return;

    // CREATE WITHDRAW

    const withdraw =
    await Withdrawal.create({

      userId:id,

      amount:user.balance,

      method:user.walletType,

      address:msg.text

    });

    // SAVE ADDRESS

    user.walletAddress =
    msg.text;

    user.pendingWithdrawal =
    user.balance;

    user.balance = 0;

    await user.save();

    // SEND TO ADMIN

    bot.sendMessage(

      ADMIN_ID,

`💸 *NEW WITHDRAW REQUEST*

👤 ${user.firstName}
🆔 ${user.username}

💰 Amount:
${withdraw.amount} USDT

🏦 Method:
${withdraw.method}

📬 Address:
${withdraw.address}

🆔 Withdraw ID:
${withdraw._id}

Approve:
\`/approve ${withdraw._id}\`

Reject:
\`/reject ${withdraw._id}\``,

{
parse_mode:"Markdown"
}

    );

    // RESET

    user.walletType = "";

    await user.save();

    bot.sendMessage(

      id,

      "✅ Withdraw request sent"

    );

  } catch (e) {

    console.log(e);

  }

});

// ================= APPROVE =================

bot.onText(
/\/approve (.+)/,

async (msg, match) => {

  try {

    if (
      msg.chat.id !== ADMIN_ID
    ) return;

    const withdrawId =
    match[1];

    const withdraw =
    await Withdrawal.findById(
      withdrawId
    );

    if (!withdraw) {

      return bot.sendMessage(
        ADMIN_ID,
        "❌ Withdrawal not found"
      );

    }

    withdraw.status = "approved";

    await withdraw.save();

    const user =
    await User.findOne({
      userId:withdraw.userId
    });

    if (user) {

      user.pendingWithdrawal = 0;

      await user.save();

    }

    bot.sendMessage(

      withdraw.userId,

      "✅ Your withdrawal approved"

    );

    bot.sendMessage(

      ADMIN_ID,

      "✅ Withdrawal approved"

    );

  } catch (e) {

    console.log(e);

  }

});

// ================= REJECT =================

bot.onText(
/\/reject (.+)/,

async (msg, match) => {

  try {

    if (
      msg.chat.id !== ADMIN_ID
    ) return;

    const withdrawId =
    match[1];

    const withdraw =
    await Withdrawal.findById(
      withdrawId
    );

    if (!withdraw) {

      return bot.sendMessage(
        ADMIN_ID,
        "❌ Withdrawal not found"
      );

    }

    withdraw.status = "rejected";

    await withdraw.save();

    const user =
    await User.findOne({
      userId:withdraw.userId
    });

    if (user) {

      user.balance += withdraw.amount;

      user.pendingWithdrawal = 0;

      await user.save();

    }

    bot.sendMessage(

      withdraw.userId,

      "❌ Withdrawal rejected & refunded"

    );

    bot.sendMessage(

      ADMIN_ID,

      "❌ Withdrawal rejected"

    );

  } catch (e) {

    console.log(e);

  }

});

// ================= ADMIN STATS =================

bot.onText(
/\/stats/,

async (msg) => {

  try {

    if (
      msg.chat.id !== ADMIN_ID
    ) return;

    const users =
    await User.countDocuments();

    const withdrawals =
    await Withdrawal.countDocuments();

    const pending =
    await Withdrawal.countDocuments({
      status:"pending"
    });

    const approved =
    await Withdrawal.countDocuments({
      status:"approved"
    });

    bot.sendMessage(

      ADMIN_ID,

`📊 BOT STATS

👥 Users:
${users}

💸 Withdrawals:
${withdrawals}

⌛ Pending:
${pending}

✅ Approved:
${approved}`

    );

  } catch (e) {

    console.log(e);

  }

});

// ================= COMMANDS =================

bot.onText(
/\/balance/,

async (msg) => {

  const id =
  String(msg.chat.id);

  const user =
  await User.findOne({
    userId:id
  });

  if (!user) return;

  bot.sendMessage(

    id,

`💰 Balance:
${user.balance.toFixed(2)} USDT`

  );

});

bot.onText(
/\/ref/,

async (msg) => {

  const id =
  String(msg.chat.id);

  const user =
  await User.findOne({
    userId:id
  });

  if (!user) return;

  const link =
  getRefLink(id);

  bot.sendMessage(

    id,

`👥 Referrals:
${user.refs}

🔗 Link:

${link}`

  );

});

// ================= START SERVER =================

app.listen(PORT, () => {

  console.log(
    `🚀 Running on ${PORT}`
  );

});

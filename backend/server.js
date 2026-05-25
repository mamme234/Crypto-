require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID || "7154361039";
const SECRET_KEY = process.env.SECRET_KEY || "alpha_secret";

const CHANNEL_ID = "@gangs234";
const GROUP_ID = "@gangs234";

const BOT_USERNAME = "Studybuddy_2025Bot";

const WEB_APP_URL =
"https://myapp1-khaki.vercel.app/";

/* ================= BOT ================= */

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

/* ================= DATABASE ================= */

mongoose.connect(MONGO_URL)
.then(()=>{
  console.log("✅ MongoDB Connected");
})
.catch((err)=>{
  console.log(err);
});

/* ================= MODELS ================= */

const User = mongoose.model("User", new mongoose.Schema({

  userId:{
    type:String,
    unique:true
  },

  username:{
    type:String,
    default:""
  },

  firstName:{
    type:String,
    default:""
  },

  balance:{
    type:Number,
    default:0
  },

  refs:{
    type:Number,
    default:0
  },

  adsWatched:{
    type:Number,
    default:0
  },

  referredBy:{
    type:String,
    default:null
  },

  lastAdTime:{
    type:Number,
    default:0
  },

  walletType:{
    type:String,
    default:""
  },

  walletAddress:{
    type:String,
    default:""
  },

  pendingWithdrawal:{
    type:Number,
    default:0
  }

}));

const Withdrawal = mongoose.model("Withdrawal", new mongoose.Schema({

  userId:String,
  amount:Number,
  method:String,
  address:String,

  status:{
    type:String,
    default:"pending"
  },

  createdAt:{
    type:Date,
    default:Date.now
  }

}));

/* ================= SETTINGS ================= */

const MIN_WITHDRAW = 5;
const MIN_REFS = 10;
const MIN_ADS = 500;
const REF_REWARD = 0.1;
const AD_REWARD = 0.03;

/* ================= SAFE USER ================= */

async function getUser(userId, username="", firstName="User"){

  let user = await User.findOne({
    userId
  });

  if(!user){

    user = await User.create({
      userId,
      username,
      firstName
    });

  }

  return user;

}

/* ================= FORCE JOIN ================= */

async function checkJoin(userId){

  try{

    const member = await bot.getChatMember(
      CHANNEL_ID,
      userId
    );

    return (
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"
    );

  }catch(err){

    return false;

  }

}

/* ================= DAILY POST ================= */

async function sendDailyPost(){

  try{

    const totalUsers = await User.countDocuments();
    const totalWithdraws = await Withdrawal.countDocuments();

    const text =
`🔥 DAILY ACTIVITY REPORT 🔥

👥 Total Users: ${totalUsers}

💸 Total Withdrawals: ${totalWithdraws}

📺 Watch Ads & Earn Daily

🚀 Open Mini App:
${WEB_APP_URL}`;

    await bot.sendMessage(CHANNEL_ID, text);

    await bot.sendMessage(GROUP_ID, text);

    console.log("✅ Daily activity sent");

  }catch(err){

    console.log(err);

  }

}

/* SEND EVERY 24 HOURS */

setInterval(()=>{
  sendDailyPost();
}, 24 * 60 * 60 * 1000);

/* SEND ON START */

sendDailyPost();

/* ================= SERVER ================= */

app.get("/", (req,res)=>{

  res.send("🚀 Meta Pro Earn Running");

});

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req,res)=>{

  const user = await getUser(req.params.id);

  res.json(user);

});

/* ================= ADS ================= */

app.post("/ads", async (req,res)=>{

  try{

    if(req.headers.authorization !== SECRET_KEY){

      return res.json({
        success:false,
        message:"Unauthorized"
      });

    }

    const { userId } = req.body;

    const user = await getUser(userId);

    const now = Date.now();

    if(now - user.lastAdTime < 30000){

      return res.json({
        success:false,
        message:"Wait 30 sec"
      });

    }

    user.balance += AD_REWARD;
    user.adsWatched += 1;
    user.lastAdTime = now;

    await user.save();

    res.json({
      success:true,
      balance:user.balance,
      adsWatched:user.adsWatched
    });

  }catch(err){

    console.log(err);

    res.json({
      success:false
    });

  }

});

/* ================= START ================= */

bot.onText(/\/start(?: (.+))?/, async (msg, match)=>{

  try{

    const id = String(msg.chat.id);

    const username =
    msg.from.username
    ? "@" + msg.from.username
    : "@user" + id;

    const firstName =
    msg.from.first_name || "User";

    const joined = await checkJoin(id);

    if(!joined){

      return bot.sendMessage(
        id,
        "📢 Join our channel first",
        {
          reply_markup:{
            inline_keyboard:[
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

    }

    let user = await getUser(
      id,
      username,
      firstName
    );

    const param = match?.[1];

    if(param && param.startsWith("ref_")){

      const refId = param.replace("ref_", "");

      if(refId !== id && !user.referredBy){

        const refUser = await User.findOne({
          userId:refId
        });

        if(refUser){

          user.referredBy = refId;

          refUser.refs += 1;
          refUser.balance += REF_REWARD;

          await user.save();
          await refUser.save();

          bot.sendMessage(
            refId,
            `🎉 New referral joined\n\n💰 +${REF_REWARD} USDT`
          );

        }

      }

    }

    bot.sendMessage(
      id,
`🔥 WELCOME TO META PRO EARN

👤 ${firstName}
💰 Balance: ${user.balance.toFixed(2)} USDT
👥 Referrals: ${user.refs}
📺 Ads: ${user.adsWatched}

Earn by watching ads daily 🚀`,
      {
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
                text:"👥 Referrals",
                callback_data:"refs"
              },
              {
                text:"💰 Balance",
                callback_data:"balance"
              }
            ],
            [
              {
                text:"💸 Withdraw",
                callback_data:"withdraw"
              }
            ]
          ]
        }
      }
    );

  }catch(err){

    console.log(err);

  }

});

/* ================= CALLBACKS ================= */

bot.on("callback_query", async (query)=>{

  try{

    const id = String(query.message.chat.id);

    const user = await User.findOne({
      userId:id
    });

    if(!user) return;

    if(query.data === "balance"){

      return bot.sendMessage(
        id,
`💰 Balance: ${user.balance.toFixed(2)} USDT`
      );

    }

    if(query.data === "refs"){

      return bot.sendMessage(
        id,
`👥 Referrals: ${user.refs}

🔗 Referral Link:
https://t.me/${BOT_USERNAME}?start=ref_${id}`
      );

    }

    if(query.data === "withdraw"){

      if(user.balance < MIN_WITHDRAW){

        return bot.sendMessage(
          id,
          "❌ Minimum withdraw is 5 USDT"
        );

      }

      if(user.refs < MIN_REFS){

        return bot.sendMessage(
          id,
          "❌ Need 10 referrals"
        );

      }

      if(user.adsWatched < MIN_ADS){

        return bot.sendMessage(
          id,
          `❌ Watch 500 ads first\n\n📺 ${user.adsWatched}/500`
        );

      }

      user.pendingWithdrawal = user.balance;

      await user.save();

      return bot.sendMessage(
        id,
        "✅ Send your wallet address"
      );

    }

  }catch(err){

    console.log(err);

  }

});

/* ================= WALLET ================= */

bot.on("message", async (msg)=>{

  try{

    if(!msg.text) return;

    if(msg.text.startsWith("/")) return;

    const id = String(msg.chat.id);

    const user = await User.findOne({
      userId:id
    });

    if(!user) return;

    if(user.pendingWithdrawal <= 0) return;

    const withdraw = await Withdrawal.create({

      userId:id,
      amount:user.pendingWithdrawal,
      method:"USDT",
      address:msg.text

    });

    const amount = user.pendingWithdrawal;

    user.walletAddress = msg.text;
    user.balance -= amount;
    user.pendingWithdrawal = 0;

    await user.save();

    bot.sendMessage(
      ADMIN_ID,
`💸 NEW WITHDRAW

👤 ${user.firstName}
💰 ${amount} USDT
📬 ${msg.text}

Approve:
/approve ${withdraw._id}

Reject:
/reject ${withdraw._id}`
    );

    bot.sendMessage(
      id,
      "✅ Withdraw request sent"
    );

  }catch(err){

    console.log(err);

  }

});

/* ================= APPROVE ================= */

bot.onText(/\/approve (.+)/, async (msg, match)=>{

  if(String(msg.chat.id) !== String(ADMIN_ID)) return;

  const withdraw = await Withdrawal.findById(match[1]);

  if(!withdraw){

    return bot.sendMessage(
      ADMIN_ID,
      "❌ Withdraw not found"
    );

  }

  withdraw.status = "approved";

  await withdraw.save();

  bot.sendMessage(
    withdraw.userId,
    "✅ Withdrawal approved"
  );

  bot.sendMessage(
    ADMIN_ID,
    "✅ Approved"
  );

});

/* ================= REJECT ================= */

bot.onText(/\/reject (.+)/, async (msg, match)=>{

  if(String(msg.chat.id) !== String(ADMIN_ID)) return;

  const withdraw = await Withdrawal.findById(match[1]);

  if(!withdraw){

    return bot.sendMessage(
      ADMIN_ID,
      "❌ Withdraw not found"
    );

  }

  withdraw.status = "rejected";

  await withdraw.save();

  const user = await User.findOne({
    userId:withdraw.userId
  });

  if(user){

    user.balance += withdraw.amount;

    await user.save();

  }

  bot.sendMessage(
    withdraw.userId,
    "❌ Withdrawal rejected & refunded"
  );

  bot.sendMessage(
    ADMIN_ID,
    "❌ Rejected"
  );

});

/* ================= STATS ================= */

bot.onText(/\/stats/, async (msg)=>{

  if(String(msg.chat.id) !== String(ADMIN_ID)) return;

  const users = await User.countDocuments();
  const withdrawals = await Withdrawal.countDocuments();

  bot.sendMessage(
    ADMIN_ID,
`📊 BOT STATS

👥 Users: ${users}
💸 Withdrawals: ${withdrawals}`
  );

});

/* ================= START SERVER ================= */

app.listen(PORT, ()=>{

  console.log(`🚀 Running on ${PORT}`);

});

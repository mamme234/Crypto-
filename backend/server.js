require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URL = process.env.MONGO_URL;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const SECRET_KEY = process.env.SECRET_KEY;
const BOT_USERNAME = process.env.BOT_USERNAME;

const WEB_APP_URL = "https://myapp1-khaki.vercel.app/";

const CHATS = [
  "@gangs234",
  "-1003984859530",
  "-1001965046046"
];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

app.use(cors());
app.use(express.json());

/* ================= DB ================= */

mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("DB ERROR:", err));

/* ================= USER MODEL ================= */

const User = mongoose.model("User", new mongoose.Schema({

  userId: { type: String, unique: true },

  balance: { type: Number, default: 0 },

  refs: { type: Number, default: 0 },

  adsWatched: { type: Number, default: 0 },

  lastAd: { type: Number, default: 0 },

  referredBy: { type: String, default: null },

  wallet: { type: String, default: "" }

}));

/* ================= WITHDRAW ================= */

const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({

  userId: String,
  amount: Number,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }

}));

/* ================= SAFE USER ================= */

async function getUser(userId){

  let user = await User.findOne({ userId });

  if(!user){
    user = await User.create({ userId });
  }

  return user;

}

/* ================= REF LINK ================= */

function getRefLink(userId){

  return `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;

}

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req,res)=>{

  const user = await getUser(req.params.id);

  res.json(user);

});

/* ================= ADS ================= */

app.post("/ads", async (req,res)=>{

  if(req.headers.authorization !== SECRET_KEY){
    return res.json({ success:false, message:"Unauthorized" });
  }

  const user = await getUser(req.body.userId);

  const now = Date.now();

  if(now - user.lastAd < 30000){
    return res.json({ success:false, message:"Cooldown" });
  }

  user.adsWatched += 1;
  user.lastAd = now;

  user.balance += 0.03;

  await user.save();

  res.json({
    success:true,
    balance:user.balance,
    adsWatched:user.adsWatched
  });

});

/* ================= WITHDRAW ================= */

app.post("/withdraw", async (req,res)=>{

  const { userId, amount } = req.body;

  const user = await getUser(userId);

  if(amount < 5){
    return res.json({ success:false, message:"Min 5 USDT" });
  }

  if(user.refs < 10){
    return res.json({ success:false, message:"Need 10 refs" });
  }

  if(user.adsWatched < 500){
    return res.json({ success:false, message:"Need 500 ads" });
  }

  if(user.balance < amount){
    return res.json({ success:false, message:"Low balance" });
  }

  user.balance -= amount;
  await user.save();

  const w = await Withdraw.create({
    userId,
    amount
  });

  bot.sendMessage(ADMIN_ID,"💸 WITHDRAW REQUEST",{
    reply_markup:{
      inline_keyboard:[
        [
          { text:"✅ Approve", callback_data:`ap_${w._id}` },
          { text:"❌ Reject", callback_data:`re_${w._id}` }
        ]
      ]
    }
  });

  res.json({ success:true });

});

/* ================= POST SYSTEM ================= */

async function sendGroupPost(){

  const text = "🚀 START EARNING NOW";

  const keyboard = {
    reply_markup:{
      inline_keyboard:[
        [
          { text:"🚀 Start App", web_app:{ url:WEB_APP_URL } }
        ]
      ]
    }
  };

  for(const chat of CHATS){

    try{
      await bot.sendMessage(chat, text, keyboard);
      console.log("POSTED TO:", chat);
    }catch(err){
      console.log("POST FAILED:", chat, err.message);
    }

  }

}

/* ================= START ================= */

bot.onText(/\/start(?: (.+))?/, async (msg, match)=>{

  const id = String(msg.chat.id);
  const param = match?.[1];

  const user = await getUser(id);

  /* REF SYSTEM FIX */
  if(param && param.startsWith("ref_")){

    const refId = param.replace("ref_","");

    if(refId !== id){

      const refUser = await getUser(refId);

      if(!user.referredBy){

        user.referredBy = refId;

        refUser.refs += 1;
        refUser.balance += 0.1;

        await user.save();
        await refUser.save();

      }

    }

  }

  bot.sendMessage(id,"🔥 META PRO EARN",{
    reply_markup:{
      inline_keyboard:[
        [
          { text:"🚀 Open App", web_app:{ url:WEB_APP_URL } }
        ],
        [
          { text:"💰 Balance", callback_data:"bal" },
          { text:"👥 Ref", callback_data:"ref" }
        ],
        [
          { text:"🔗 My Link", callback_data:"link" }
        ]
      ]
    }
  });

  sendGroupPost();

});

/* ================= CALLBACKS ================= */

bot.on("callback_query", async (q)=>{

  const id = String(q.message.chat.id);
  const user = await getUser(id);

  if(q.data === "bal"){
    return bot.answerCallbackQuery(q.id,{
      text:`Balance: ${user.balance.toFixed(2)}`,
      show_alert:true
    });
  }

  if(q.data === "ref"){
    return bot.answerCallbackQuery(q.id,{
      text:`Refs: ${user.refs}`,
      show_alert:true
    });
  }

  if(q.data === "link"){
    return bot.sendMessage(id, getRefLink(id));
  }

});

/* ================= TEST POST ================= */

bot.onText(/\/posttest/, async ()=>{
  await sendGroupPost();
});

/* ================= SERVER ================= */

app.listen(process.env.PORT || 3000, ()=>{
  console.log("🚀 FULL FIXED SERVER RUNNING");
});

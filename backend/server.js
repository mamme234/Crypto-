require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URL = process.env.MONGO_URL;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const SECRET_KEY = process.env.SECRET_KEY;

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
.catch(err=>console.log(err));

/* ================= USER ================= */

const User = mongoose.model("User", new mongoose.Schema({

  userId: { type: String, unique: true },

  balance: { type: Number, default: 0 },

  refs: { type: Number, default: 0 },

  adsWatched: { type: Number, default: 0 },

  level: { type: Number, default: 1 },

  lastAd: { type: Number, default: 0 },

  isBlocked: { type: Boolean, default: false }

}));

/* ================= WITHDRAW ================= */

const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({

  userId: String,
  amount: Number,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }

}));

/* ================= GET USER ================= */

async function getUser(userId){

  let user = await User.findOne({ userId });

  if(!user){
    user = await User.create({ userId });
  }

  return user;

}

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req,res)=>{

  const user = await getUser(req.params.id);

  res.json({
    balance: user.balance,
    refs: user.refs,
    adsWatched: user.adsWatched,
    level: user.level
  });

});

/* ================= ADS SYSTEM ================= */

app.post("/ads", async (req,res)=>{

  if(req.headers.authorization !== SECRET_KEY){
    return res.json({ success:false });
  }

  const user = await getUser(req.body.userId);

  if(user.isBlocked){
    return res.json({ success:false, message:"Blocked" });
  }

  const now = Date.now();

  if(now - user.lastAd < 30000){
    user.isBlocked = true;
    await user.save();
    return res.json({ success:false, message:"Spam detected" });
  }

  user.adsWatched += 1;
  user.lastAd = now;

  user.balance += 0.03 * (1 + user.level * 0.1);

  if(user.adsWatched % 100 === 0){
    user.level += 1;
  }

  await user.save();

  res.json({
    success:true,
    balance:user.balance,
    adsWatched:user.adsWatched,
    level:user.level
  });

});

/* ================= WITHDRAW RULES ================= */

app.post("/withdraw", async (req,res)=>{

  const { userId, amount } = req.body;

  const user = await getUser(userId);

  if(user.balance < amount){
    return res.json({ success:false, message:"Low balance" });
  }

  if(amount < 5){
    return res.json({ success:false, message:"Min 5 USDT" });
  }

  if(user.refs < 10){
    return res.json({ success:false, message:"Need 10 refs" });
  }

  if(user.adsWatched < 500){
    return res.json({ success:false, message:"Need 500 ads" });
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

/* ================= START BOT ================= */

bot.onText(/\/start/, async (msg)=>{

  const id = String(msg.chat.id);
  const user = await getUser(id);

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
          { text:"💸 Withdraw", callback_data:"wd" }
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

  if(q.data === "wd"){

    if(user.balance < 5 || user.refs < 10 || user.adsWatched < 500){
      return bot.answerCallbackQuery(q.id,{
        text:"❌ Not eligible",
        show_alert:true
      });
    }

    return bot.sendMessage(id,"Send wallet address");

  }

  if(q.data.startsWith("ap_") || q.data.startsWith("re_")){

    if(q.from.id !== ADMIN_ID) return;

    const wId = q.data.split("_")[1];
    const w = await Withdraw.findById(wId);

    if(!w) return;

    if(q.data.startsWith("ap_")){
      w.status = "approved";
      bot.sendMessage(w.userId,"✅ Approved");
    } else {
      w.status = "rejected";
      bot.sendMessage(w.userId,"❌ Rejected");
    }

    await w.save();

  }

});

/* ================= MULTI POST SYSTEM ================= */

async function sendGroupPost(){

  const text = "🚀 START EARNING NOW";

  const keyboard = {
    reply_markup:{
      inline_keyboard:[
        [
          {
            text:"🚀 Start App",
            web_app:{ url:WEB_APP_URL }
          }
        ]
      ]
    }
  };

  for(const chat of CHATS){

    try{
      await bot.sendMessage(chat, text, keyboard);
    }catch(e){
      console.log("Post failed:", chat, e.message);
    }

  }

}

/* ================= SERVER ================= */

app.listen(process.env.PORT || 3000, ()=>{
  console.log("🚀 V4 FINAL RUNNING");
});

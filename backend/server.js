require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(cors());
app.use(express.json());

// ================= CONFIG =================

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = "7154361039";
const CHANNEL = "@gangs234";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ================= DB =================

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

// ================= USER =================

const User = mongoose.model("User",{

userId:String,
username:String,
firstName:String,

usdt:{ type:Number, default:0 },
adsWatched:{ type:Number, default:0 },
refs:{ type:Number, default:0 },

walletType:String,
walletAddress:String,

lastDaily:{ type:Number, default:0 }

});

// ================= ADS =================

app.post("/ads", async(req,res)=>{

const { userId } = req.body;

let user = await User.findOne({ userId });
if(!user) return res.json({ success:false });

user.usdt += 0.03;
user.adsWatched += 1;

await user.save();

res.json({
success:true,
usdt:user.usdt,
adsWatched:user.adsWatched,
reward:0.03
});

});

// ================= PROFILE =================

app.get("/profile/:id/:username", async(req,res)=>{

const { id, username } = req.params;

let user = await User.findOne({ userId:id });

if(!user){

user = await User.create({
userId:id,
username
});

}

res.json({
success:true,
user
});

});

// ================= DAILY =================

app.post("/daily", async(req,res)=>{

const { userId } = req.body;

let user = await User.findOne({ userId });
if(!user) return res.json({ success:false });

const now = Date.now();

if(now - user.lastDaily < 86400000){

return res.json({
success:false,
message:"Already claimed"
});

}

user.usdt += 0.2;
user.lastDaily = now;

await user.save();

res.json({
success:true,
usdt:user.usdt
});

});

// ================= SPIN =================

app.post("/spin", async(req,res)=>{

const { userId } = req.body;

let user = await User.findOne({ userId });
if(!user) return res.json({ success:false });

const reward = (Math.random()*0.1).toFixed(3);

user.usdt += Number(reward);

await user.save();

res.json({
success:true,
usdt:user.usdt,
reward
});

});

// ================= WITHDRAW =================

app.post("/withdraw", async(req,res)=>{

const { userId, wallet, amount } = req.body;

let user = await User.findOne({ userId });
if(!user) return res.json({ success:false });

if(amount < 5){

return res.json({
success:false,
message:"Min 5 USDT"
});

}

if(user.usdt < amount){

return res.json({
success:false,
message:"Not enough balance"
});

}

user.usdt -= amount;
user.walletAddress = wallet;

await user.save();

// SEND TO ADMIN BOT

bot.sendMessage(ADMIN_ID,

`💸 WITHDRAW REQUEST

👤 ${user.username}
🆔 ${user.userId}

💰 Amount: ${amount}
🏦 Wallet: ${wallet}`);

res.json({
success:true,
message:"Withdraw sent to admin"
});

});

// ================= TOP USERS =================

app.get("/top", async(req,res)=>{

const users = await User.find()
.sort({ usdt:-1 })
.limit(10);

res.json(users);

});

// ================= BOT START =================

bot.onText(/\/start/, async(msg)=>{

const id = msg.chat.id;

let user = await User.findOne({ userId:id });

if(!user){

user = await User.create({
userId:id,
username:msg.from.username || "@user"+id,
firstName:msg.from.first_name
});

}

bot.sendMessage(id,

`🔥 META PRO EARN

💰 Balance: ${user.usdt.toFixed(2)} USDT
👥 Referrals: ${user.refs}

Start earning now!`,{

reply_markup:{
inline_keyboard:[
[
{ text:"🚀 Open App", web_app:{ url:"https://myapp1-khaki.vercel.app/" } }
],
[
{ text:"💸 Withdraw", callback_data:"withdraw" }
]
]
}
});

});

// ================= WITHDRAW BUTTON =================

bot.on("callback_query", async(q)=>{

const id = q.message.chat.id;

if(q.data === "withdraw"){

bot.sendMessage(id,

"Send format:\n\nBINANCE or TON\nADDRESS AMOUNT");

}

});

app.get("/",(req,res)=>{
res.send("Running");
});

app.listen(process.env.PORT || 3000,()=>{
console.log("Server running");
});

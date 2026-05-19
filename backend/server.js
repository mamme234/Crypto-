require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// ================= CONFIG =================

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

const ADMIN_ID = "7154361039";
const BOT_USERNAME = "Studybuddy_2025Bot";
const WEB_APP_URL = "https://myapp1-khaki.vercel.app/";
const CHANNEL = "@gangs234";

// ================= INIT =================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const app = express();

app.use(cors());
app.use(express.json());

// ================= DB =================

mongoose.connect(MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

// ================= USER MODEL =================

const User = mongoose.model("User", {

userId: { type: String, unique: true },

username: String,
firstName: String,

balance: { type: Number, default: 0 },
refs: { type: Number, default: 0 },

referredBy: String,

adsWatched: { type: Number, default: 0 },

walletType: { type: String, default: "" },
walletAddress: { type: String, default: "" }

});

// ================= CHECK JOIN =================

async function checkJoin(userId){

try{

const m = await bot.getChatMember(CHANNEL, userId);

return ["member","administrator","creator"].includes(m.status);

}catch{
return false;
}

}

// ================= REF LINK =================

function getRefLink(username){
return `https://t.me/${BOT_USERNAME}?start=ref_${username.replace("@","")}`;
}

// ================= PROFILE API =================

app.get("/profile/:userId/:username/:firstName", async(req,res)=>{

try{

let { userId, username, firstName } = req.params;

let user = await User.findOne({ userId });

if(!user){

user = await User.create({
userId,
username,
firstName
});

}else{

user.username = username;
user.firstName = firstName;
await user.save();

}

res.json({
success:true,
balance:user.balance,
refs:user.refs,
adsWatched:user.adsWatched,
username:user.username,
firstName:user.firstName
});

}catch(err){
res.json({ success:false });
}

});

// ================= ADS API =================

app.post("/ads", async(req,res)=>{

try{

const { userId } = req.body;

let user = await User.findOne({ userId });

if(!user){
return res.json({ success:false });
}

user.balance += 0.03;
user.adsWatched += 1;

await user.save();

res.json({
success:true,
balance:user.balance,
adsWatched:user.adsWatched
});

}catch(err){
res.json({ success:false });
}

});

// ================= START =================

bot.onText(/\/start(?: (.+))?/, async(msg,match)=>{

const id = String(msg.chat.id);

const username = msg.from.username
? "@"+msg.from.username
: "@user"+id;

const firstName = msg.from.first_name || "User";

const param = match?.[1];

// CHECK JOIN

const joined = await checkJoin(id);

if(!joined){

return bot.sendMessage(id,"📢 Join channel first",{
reply_markup:{
inline_keyboard:[
[
{ text:"📢 Join Channel", url:"https://t.me/gangs234" }
],
[
{ text:"✅ Check Join", callback_data:"check_join" }
]
]
}
});

}

// USER

let user = await User.findOne({ userId:id });

if(!user){

user = await User.create({
userId:id,
username,
firstName
});

}else{

user.username = username;
user.firstName = firstName;
await user.save();

}

// REFERRAL

if(param && param.startsWith("ref_")){

const refUsername = "@"+param.replace("ref_","");

if(refUsername !== username && !user.referredBy){

const refUser = await User.findOne({ username:refUsername });

if(refUser){

user.referredBy = refUsername;
refUser.refs += 1;
refUser.balance += 1;

await user.save();
await refUser.save();

bot.sendMessage(refUser.userId,"🎉 Referral +1 USDT");

}

}

}

// MAIN MENU

bot.sendMessage(id,

`🔥 *META PRO*

👤 ${firstName}
🆔 ${username}

💰 Balance: ${user.balance.toFixed(2)} USDT
👥 Referrals: ${user.refs}`,

{
parse_mode:"Markdown",
reply_markup:{
inline_keyboard:[
[
{ text:"🚀 Open App", web_app:{ url:WEB_APP_URL } }
],
[
{ text:"💰 Balance", callback_data:"balance" },
{ text:"👥 Ref", callback_data:"refs" }
],
[
{ text:"💸 Withdraw", callback_data:"withdraw" }
]
]
}
});

});

// ================= CALLBACKS =================

bot.on("callback_query", async(query)=>{

const id = String(query.message.chat.id);

const user = await User.findOne({ userId:id });

if(!user) return;

// BALANCE

if(query.data === "balance"){
return bot.sendMessage(id,
`💰 Balance: ${user.balance.toFixed(2)} USDT`);
}

// REFS

if(query.data === "refs"){
return bot.sendMessage(id,
`👥 Referrals: ${user.refs}

🔗 ${getRefLink(user.username)}`);
}

// WITHDRAW MENU

if(query.data === "withdraw"){

if(user.balance < 5){
return bot.sendMessage(id,"❌ Min withdraw 5 USDT");
}

return bot.sendMessage(id,
"Choose method",
{
reply_markup:{
inline_keyboard:[
[
{ text:"Binance", callback_data:"binance" }
],
[
{ text:"TON", callback_data:"ton" }
]
]
}
});

}

// BINANCE

if(query.data === "binance"){

user.walletType = "Binance";
await user.save();

return bot.sendMessage(id,"Send Binance address");

}

// TON

if(query.data === "ton"){

user.walletType = "TON";
await user.save();

return bot.sendMessage(id,"Send TON address");

}

bot.answerCallbackQuery(query.id);

});

// ================= WALLET MESSAGE =================

bot.on("message", async(msg)=>{

if(!msg.text) return;
if(msg.text.startsWith("/")) return;

const id = String(msg.chat.id);

const user = await User.findOne({ userId:id });

if(!user || !user.walletType) return;

user.walletAddress = msg.text;

await user.save();

// SEND TO ADMIN

bot.sendMessage(ADMIN_ID,

`💸 WITHDRAW REQUEST

👤 ${user.firstName}
🆔 ${user.username}

💰 Balance: ${user.balance.toFixed(2)}
🏦 Method: ${user.walletType}
📬 Address: ${user.walletAddress}`);

// RESET METHOD ONLY

user.walletType = "";
await user.save();

bot.sendMessage(id,"✅ Request sent");

});

// ================= SERVER =================

app.get("/",(req,res)=>{
res.send("Bot Running");
});

app.listen(PORT,()=>{
console.log("🚀 Server running on " + PORT);
});

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

const MONGO_URI = process.env.MONGO_URI;

const PORT = process.env.PORT || 3000;

const ADMIN_ID = "7154361039";

const WEB_APP_URL =
"https://myapp1-khaki.vercel.app/";

const BOT_USERNAME =
"Studybuddy_2025Bot";

// ================= BOT =================

const bot = new TelegramBot(
BOT_TOKEN,
{
polling:true
}
);

// ================= DATABASE =================

mongoose.connect(MONGO_URI)
.then(()=>{

console.log("MongoDB Connected");

})
.catch(err=>{

console.log(err);

});

// ================= USER MODEL =================

const User = mongoose.model("User",{

userId:String,

username:String,

firstName:String,

usdt:{
type:Number,
default:0
},

adsWatched:{
type:Number,
default:0
},

refs:{
type:Number,
default:0
},

referredBy:{
type:String,
default:null
},

lastDaily:{
type:Number,
default:0
}

});

// ================= HOME =================

app.get("/",(req,res)=>{

res.send("Meta Pro Earn Running");

});

// ================= PROFILE =================

app.get(
"/profile/:id/:username",
async(req,res)=>{

try{

const {
id,
username
} = req.params;

let user =
await User.findOne({
userId:id
});

if(!user){

user =
await User.create({

userId:id,

username,

firstName:"User"

});

}

res.json({

success:true,

user

});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

// ================= ADS =================

app.post(
"/ads",
async(req,res)=>{

try{

const {
userId
} = req.body;

if(!userId){

return res.json({
success:false
});

}

let user =
await User.findOne({
userId
});

if(!user){

return res.json({
success:false
});

}

// REWARD

const reward = 0.03;

user.usdt += reward;

user.adsWatched += 1;

await user.save();

res.json({

success:true,

usdt:user.usdt,

adsWatched:user.adsWatched,

reward

});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

// ================= DAILY =================

app.post(
"/daily",
async(req,res)=>{

try{

const {
userId
} = req.body;

let user =
await User.findOne({
userId
});

if(!user){

return res.json({
success:false
});

}

const now =
Date.now();

if(
now - user.lastDaily
< 86400000
){

return res.json({

success:false,

message:
"Already claimed today"

});

}

user.usdt += 0.2;

user.lastDaily = now;

await user.save();

res.json({

success:true,

usdt:user.usdt

});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

// ================= SPIN =================

app.post(
"/spin",
async(req,res)=>{

try{

const {
userId
} = req.body;

let user =
await User.findOne({
userId
});

if(!user){

return res.json({
success:false
});

}

const reward =
Number(
(Math.random()*0.1)
.toFixed(3)
);

user.usdt += reward;

await user.save();

res.json({

success:true,

reward,

usdt:user.usdt

});

}catch(err){

console.log(err);

res.json({
success:false
});

}

});

// ================= TOP USERS =================

app.get(
"/top",
async(req,res)=>{

try{

const users =
await User.find()
.sort({
usdt:-1
})
.limit(10);

res.json(users);

}catch(err){

console.log(err);

res.json([]);

}

});

// ================= WITHDRAW =================

app.post(
"/withdraw",
async(req,res)=>{

try{

const {
userId,
wallet,
amount
} = req.body;

if(
!userId ||
!wallet ||
!amount
){

return res.json({

success:false,

message:
"Missing data"

});

}

let user =
await User.findOne({
userId
});

if(!user){

return res.json({

success:false,

message:
"User not found"

});

}

// MINIMUM

if(
Number(amount) < 5
){

return res.json({

success:false,

message:
"Minimum withdraw is 5 USDT"

});

}

// BALANCE CHECK

if(
user.usdt < Number(amount)
){

return res.json({

success:false,

message:
"Not enough balance"

});

}

// REMOVE BALANCE

user.usdt -= Number(amount);

await user.save();

// SEND TO ADMIN

await bot.sendMessage(

ADMIN_ID,

`💸 NEW WITHDRAW REQUEST

👤 User:
${user.firstName || "User"}

🆔 ID:
${user.userId}

📛 Username:
${user.username || "No Username"}

💰 Amount:
${Number(amount).toFixed(2)} USDT

🏦 Wallet:
${wallet}

📊 Remaining Balance:
${user.usdt.toFixed(2)} USDT`

);

// USER RESPONSE

res.json({

success:true,

message:
"Withdraw request sent"

});

}catch(err){

console.log(err);

res.json({

success:false,

message:
"Server error"

});

}

});

// ================= REFERRAL =================

function getRefLink(username){

return
`https://t.me/${BOT_USERNAME}?start=ref_${username}`;

}

// ================= START BOT =================

bot.onText(
/\/start(?: (.+))?/,
async(msg,match)=>{

try{

const id =
String(msg.chat.id);

const username =
msg.from.username
? "@"+msg.from.username
: "@user"+id;

const firstName =
msg.from.first_name
|| "User";

const param =
match?.[1];

let user =
await User.findOne({
userId:id
});

if(!user){

user =
await User.create({

userId:id,

username,

firstName

});

}

// REF SYSTEM

if(
param &&
param.startsWith("ref_")
){

const refUsername =
"@" +
param.replace("ref_","");

if(
refUsername !== username &&
!user.referredBy
){

const refUser =
await User.findOne({
username:refUsername
});

if(refUser){

user.referredBy =
refUsername;

refUser.refs += 1;

refUser.usdt += 1;

await user.save();

await refUser.save();

bot.sendMessage(

refUser.userId,

"🎉 New referral joined! +1 USDT"

);

}

}

}

bot.sendMessage(

id,

`🔥 META PRO EARN

👋 Welcome ${firstName}

💰 Balance:
${user.usdt.toFixed(2)} USDT

👥 Referrals:
${user.refs}

Start earning now 🚀`,

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
text:"👥 Referral Link",
url:getRefLink(
username.replace("@","")
)
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

// ================= ERRORS =================

process.on(
"uncaughtException",
(err)=>{

console.log(err);

});

process.on(
"unhandledRejection",
(err)=>{

console.log(err);

});

// ================= SERVER =================

app.listen(PORT,()=>{

console.log(
"Server running on " + PORT
);

});

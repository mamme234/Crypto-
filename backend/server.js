const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// DB
mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// MODEL
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
photo:String,

coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},

referredBy:String,
unlocked:{type:Boolean,default:false},
lastWithdraw:{type:Number,default:0},

withdrawRequests:{type:Array,default:[]}
}));

// AUTH
function auth(req,res,next){
const token=req.headers.authorization;
if(!token) return res.json({message:"No token"});

try{
const data=jwt.verify(token.split(" ")[1],JWT_SECRET);
req.userId=data.id;
next();
}catch{
res.json({message:"Invalid token"});
}
}

// =====================
// TELEGRAM LOGIN + REFERRAL
// =====================
app.post("/api/tg-login", async (req,res)=>{

const {id,name,photo,ref} = req.body;

let user = await User.findOne({telegramId:id});

if(!user){

user = await User.create({
telegramId:id,
name:name || "user_"+id,
photo:photo || "",
referredBy:ref || null
});

// referral reward
if(ref){
const refUser = await User.findOne({telegramId:ref});
if(refUser){
refUser.referrals += 1;
refUser.coins += 1000;
await refUser.save();
}
}

}else{
user.name = name;
user.photo = photo;
await user.save();
}

const token = jwt.sign({id:user._id}, JWT_SECRET);

res.json({token});
});

// =====================
// USER
// =====================
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);

res.json({
telegramId:u.telegramId,
name:u.name,
photo:u.photo,
coins:u.coins,
usdt:u.usdt,
referrals:u.referrals,
unlocked:u.unlocked
});
});

// =====================
// TAP
// =====================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 50;
await u.save();
res.json({coins:u.coins});
});

// =====================
// CONVERT COINS → USDT
// =====================
app.post("/api/convert", auth, async (req,res)=>{
const u = await User.findById(req.userId);

if(u.coins < 1000){
return res.json({message:"Need 1000 coins"});
}

u.coins -= 1000;
u.usdt += 1;

await u.save();

res.json({message:"Converted"});
});

// =====================
// UNLOCK ($5 simulation)
// =====================
app.post("/api/unlock", auth, async (req,res)=>{
const u = await User.findById(req.userId);

u.unlocked = true;
await u.save();

res.json({message:"Unlocked for daily withdraw"});
});

// =====================
// WITHDRAW
// =====================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address} = req.body;
const u = await User.findById(req.userId);

if(u.usdt < amount){
return res.json({message:"Not enough USDT"});
}

// RULES
if(!u.unlocked && u.referrals < 10){
return res.json({message:"Need 10 referrals or unlock"});
}

// DAILY LIMIT IF UNLOCKED
const now = Date.now();
if(u.unlocked){
if(now - u.lastWithdraw < 86400000){
return res.json({message:"Wait 24h"});
}
u.lastWithdraw = now;
}

u.usdt -= amount;

u.withdrawRequests.push({
amount,
address,
status:"pending",
date:now
});

await u.save();

res.json({message:"Withdraw requested"});
});

// =====================
// LEADERBOARD
// =====================
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find().sort({coins:-1}).limit(10);
res.json(users);
});

app.listen(3000,()=>console.log("Server running"));

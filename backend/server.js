const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const TON_WALLET = "UQAYjMccjJ8Xn1z9hodUImMjJCB2qmWGjlMup9-sVZtEQFWH";

mongoose.connect(MONGO_URL);

// ================= MODEL =================
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
photo:String,

usdt:{type:Number,default:0},
referrals:{type:Number,default:0},

refUsers:{type:Array,default:[]},

unlocked:{type:Boolean,default:false}
}));

// ================= AUTH =================
function auth(req,res,next){
const t=req.headers.authorization;
if(!t) return res.json({message:"No token"});

try{
req.userId=jwt.verify(t.split(" ")[1],JWT_SECRET).id;
next();
}catch{
res.json({message:"Invalid token"});
}
}

// ================= LOGIN =================
app.post("/api/tg-login", async (req,res)=>{
const {id,name,photo,ref} = req.body;

let u = await User.findOne({telegramId:id});

// NEW USER
if(!u){
u = await User.create({
telegramId:id,
name,
photo
});

// REFERRAL (100 USDT? NO → 0.1 USDT)
if(ref && ref != id){
const r = await User.findOne({telegramId:ref});

if(r){
const exists = r.refUsers.find(x=>x.id==id);

if(!exists){
r.referrals += 1;
r.usdt += 0.1;

r.refUsers.push({
id,
name,
photo
});

await r.save();
}
}
}
}

const token = jwt.sign({id:u._id},JWT_SECRET);
res.json({token});
});

// ================= USER =================
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);

res.json({
name:u.name,
photo:u.photo,
usdt:Number(u.usdt || 0),
referrals:u.referrals
});
});

// ================= TAP (NEW SYSTEM) =================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);

u.usdt += 0.001; // 💥 NEW: each tap = 0.001 USDT

await u.save();

res.json({usdt:u.usdt});
});

// ================= DAILY TASK =================
app.post("/api/task", auth, async (req,res)=>{
const {type}=req.body;
const u = await User.findById(req.userId);

if(!u.tasks) u.tasks={};

if(u.tasks[type]){
return res.json({message:"Already done"});
}

let reward=0;
if(type==="telegram") reward=0.05;
if(type==="tiktok") reward=0.07;
if(type==="youtube") reward=0.1;

u.usdt += reward;
u.tasks[type]=true;

await u.save();

res.json({message:"Task done"});
});

// ================= WALLET =================
app.get("/api/wallet",(req,res)=>{
res.json({ton:TON_WALLET});
});

// ================= WITHDRAW =================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address}=req.body;
const u = await User.findById(req.userId);

if(amount < 20){
return res.json({message:"Minimum withdraw 20 USDT"});
}

if(u.usdt < amount){
return res.json({message:"Not enough USDT"});
}

if(u.referrals < 10 && !u.unlocked){
return res.json({message:"Need 10 referrals or 5 USDT unlock"});
}

u.usdt -= amount;

await u.save();

res.json({message:"Withdraw sent"});
});

// ================= UNLOCK =================
app.post("/api/unlock", auth, async (req,res)=>{
const u = await User.findById(req.userId);

if(u.usdt < 5){
return res.json({message:"Need 5 USDT"});
}

u.usdt -= 5;
u.unlocked = true;

await u.save();

res.json({message:"Unlocked"});
});

app.listen(3000);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;

mongoose.connect(MONGO_URL);

// ================= MODEL =================
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
photo:String,

coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},

refUsers:{type:Array,default:[]},

tasks:{type:Object,default:{}},

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

// REFERRAL FIX (100 coins)
if(ref && ref != id){
const r = await User.findOne({telegramId:ref});

if(r){
const exists = r.refUsers.find(x=>x.id==id);

if(!exists){
r.referrals += 1;
r.coins += 100;

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
name:u.name || "user",
photo:u.photo || "",
coins:u.coins || 0,
usdt:Number(u.usdt || 0),   // FIXED
referrals:u.referrals || 0
});
});

// ================= TAP =================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 1;
await u.save();
res.json({coins:u.coins});
});

// ================= CONVERT =================
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

// ================= TASKS =================
app.post("/api/task", auth, async (req,res)=>{
const {type}=req.body;
const u = await User.findById(req.userId);

if(u.tasks[type]){
return res.json({message:"Already done"});
}

let reward=0;
if(type==="telegram") reward=500;
if(type==="tiktok") reward=700;
if(type==="youtube") reward=1000;

u.coins += reward;
u.tasks[type]=true;

await u.save();

res.json({message:"Task done"});
});

// ================= WITHDRAW =================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address}=req.body;
const u = await User.findById(req.userId);

if(amount < 20){
return res.json({message:"Minimum 20 USDT"});
}

if(u.usdt < amount){
return res.json({message:"Not enough USDT"});
}

if(u.referrals < 10 && !u.unlocked){
return res.json({message:"Need 10 referrals or unlock"});
}

u.usdt -= amount;

await u.save();

res.json({message:"Withdraw request sent"});
});

// ================= LEADERBOARD =================
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find().sort({coins:-1}).limit(10);
res.json(users);
});

app.listen(3000,()=>console.log("Server running"));

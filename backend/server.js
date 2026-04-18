const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL);

const JWT_SECRET = process.env.JWT_SECRET;

const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
photo:String,

coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},

tasks:{type:Object,default:{}},
refUsers:{type:Array,default:[]},

unlocked:{type:Boolean,default:false}
}));

function auth(req,res,next){
const t=req.headers.authorization;
if(!t) return res.json({message:"no token"});
try{
req.userId=jwt.verify(t.split(" ")[1],JWT_SECRET).id;
next();
}catch{
res.json({message:"invalid"});
}
}

// LOGIN + REF
app.post("/api/tg-login", async (req,res)=>{
const {id,name,photo,ref,username} = req.body;

let u = await User.findOne({telegramId:id});

if(!u){
u = await User.create({telegramId:id,name,photo});
}

if(ref && ref != id){
const r = await User.findOne({telegramId:ref});
if(r){
const exists = r.refUsers.some(x=>x.id==id);
if(!exists){
r.referrals += 1;
r.coins += 100;
r.refUsers.push({id,name,photo});
await r.save();
}
}
}

const token = jwt.sign({id:u._id},JWT_SECRET);
res.json({token});
});

// USER
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);

res.json({
coins:u.coins,
usdt:u.usdt,
referrals:u.referrals
});
});

// TAP
app.post("/api/tap", auth, async (req,res)=>{
let multi = Math.max(1,Math.min(req.body.multi || 1,4));

const u = await User.findById(req.userId);

u.coins += multi;

u.usdt = Math.floor(u.coins/1000);
u.coins = u.coins%1000;

await u.save();

res.json(u);
});

// TASK
app.post("/api/task", auth, async (req,res)=>{
const {type} = req.body;
const u = await User.findById(req.userId);

if(!u.tasks) u.tasks={};

if(u.tasks[type]) return res.json({message:"done"});

let reward = 0;
if(type=="telegram") reward=500;
if(type=="tiktok") reward=700;
if(type=="youtube") reward=1000;

u.coins += reward;
u.tasks[type]=true;

u.usdt=Math.floor(u.coins/1000);
u.coins=u.coins%1000;

await u.save();

res.json({message:"ok"});
});

// WITHDRAW
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address}=req.body;
const u = await User.findById(req.userId);

if(amount<20) return res.json({message:"min 20"});
if(u.usdt<amount) return res.json({message:"no balance"});

u.usdt -= amount;
await u.save();

res.json({message:"withdraw sent"});
});

app.listen(3000);

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

// ================= USER MODEL =================
const User = mongoose.model("User", new mongoose.Schema({
telegramId: String,
name: String,
photo: String,

coins: { type: Number, default: 0 },
usdt: { type: Number, default: 0 },
referrals: { type: Number, default: 0 },

refUsers: { type: Array, default: [] }
}));

// ================= AUTH =================
function auth(req,res,next){
const token = req.headers.authorization;
if(!token) return res.json({message:"no token"});

try{
req.userId = jwt.verify(token.split(" ")[1], JWT_SECRET).id;
next();
}catch{
res.json({message:"invalid token"});
}
}

// ================= LOGIN =================
app.post("/api/tg-login", async (req,res)=>{
const {id,name,photo} = req.body;

let u = await User.findOne({telegramId:id});

if(!u){
u = await User.create({telegramId:id,name,photo});
}

const token = jwt.sign({id:u._id}, JWT_SECRET);
res.json({token});
});

// ================= GET USER =================
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);

res.json({
coins: u.coins,
usdt: u.usdt,
referrals: u.referrals
});
});

// ================= TAP SYSTEM =================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);

let multi = Math.min(Math.max(req.body.multi || 1,1),4);

u.coins += multi;

// convert
u.usdt = Math.floor(u.coins / 1000);

await u.save();

res.json({
coins: u.coins,
usdt: u.usdt
});
});

// ================= REFERRAL =================
app.post("/api/ref", auth, async (req,res)=>{
const {refId} = req.body;

const user = await User.findById(req.userId);
const refUser = await User.findOne({telegramId:refId});

if(refUser && refUser._id != user._id){
refUser.referrals += 1;
refUser.coins += 100;

await refUser.save();
}

res.json({ok:true});
});

// ================= WITHDRAW =================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount} = req.body;

const u = await User.findById(req.userId);

if(amount < 20) return res.json({message:"Min 20 USDT"});
if(u.usdt < amount) return res.json({message:"Not enough USDT"});

u.usdt -= amount;
await u.save();

res.json({message:"Withdraw sent"});
});

app.listen(3000,()=>console.log("Server running"));

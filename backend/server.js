const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* 👇 FRONTEND FIX */
app.use(express.static("frontend"));

/* DB CONNECT */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected"));

/* USER MODEL */
const User = mongoose.model("User", new mongoose.Schema({
userId: String,
balance: { type: Number, default: 0 },
refs: { type: Number, default: 0 },
adsWatched: { type: Number, default: 0 },
refUsed: { type: Boolean, default: false },
lastAd: { type: Number, default: 0 }
}));

/* WITHDRAW MODEL */
const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({
userId: String,
amount: Number,
status: { type: String, default: "pending" },
date: { type: Date, default: Date.now }
}));

/* GET USER */
async function getUser(userId){
let u = await User.findOne({ userId });
if(!u) u = await User.create({ userId });
return u;
}

/* PROFILE */
app.get("/profile/:id", async (req,res)=>{
const u = await getUser(req.params.id);
res.json(u);
});

/* ADS REWARD */
app.post("/ads", async (req,res)=>{
const u = await getUser(req.body.userId);

const now = Date.now();

/* anti spam */
if(now - u.lastAd < 10000){
return res.json({ success:false, message:"Cooldown" });
}

u.lastAd = now;
u.balance += 0.03;
u.adsWatched++;

await u.save();

res.json({
success:true,
balance:u.balance,
adsWatched:u.adsWatched
});
});

/* REFERRAL */
app.post("/ref", async (req,res)=>{
const { userId, refId } = req.body;

if(!refId || userId === refId){
return res.json({ success:false });
}

const u = await getUser(userId);
const r = await getUser(refId);

if(u.refUsed){
return res.json({ success:false });
}

u.refUsed = true;
r.balance += 0.1;
r.refs++;

await u.save();
await r.save();

res.json({ success:true });
});

/* WITHDRAW */
app.post("/withdraw", async (req,res)=>{
const { userId, amount } = req.body;

const u = await getUser(userId);

if(u.balance < amount){
return res.json({ success:false, message:"Not enough balance" });
}

u.balance -= amount;
await u.save();

await Withdraw.create({
userId,
amount,
status:"pending"
});

res.json({ success:true });
});

/* ADMIN WITHDRAW LIST */
app.get("/withdraws/:adminId", async (req,res)=>{
if(req.params.adminId !== process.env.ADMIN_ID){
return res.json({ error:"no access" });
}

const list = await Withdraw.find({ status:"pending" });
res.json(list);
});

/* APPROVE WITHDRAW */
app.post("/approve", async (req,res)=>{
const { adminId, withdrawId } = req.body;

if(adminId !== process.env.ADMIN_ID){
return res.json({ success:false });
}

const w = await Withdraw.findById(withdrawId);
if(!w) return res.json({ success:false });

w.status = "approved";
await w.save();

res.json({ success:true });
});

app.listen(3000, ()=>{
console.log("Server running on port 3000");
});

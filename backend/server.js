const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* FRONTEND (IMPORTANT) */
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;

/* START BOT INSIDE SAME RENDER SERVICE */
spawn("node", ["bot.js"], {
cwd: __dirname,
stdio: "inherit"
});

/* CONNECT MONGO */
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

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
let user = await User.findOne({ userId });
if(!user) user = await User.create({ userId });
return user;
}

/* PROFILE */
app.get("/profile/:id", async (req,res)=>{
const user = await getUser(req.params.id);
res.json(user);
});

/* ADS REWARD */
app.post("/ads", async (req,res)=>{
const user = await getUser(req.body.userId);

const now = Date.now();
if(now - user.lastAd < 10000){
return res.json({ success:false, message:"Cooldown" });
}

user.lastAd = now;
user.balance += 0.03;
user.adsWatched++;

await user.save();

res.json({
success:true,
balance:user.balance,
adsWatched:user.adsWatched
});
});

/* REFERRAL */
app.post("/ref", async (req,res)=>{
const { userId, refId } = req.body;

if(!refId || userId === refId){
return res.json({ success:false });
}

const user = await getUser(userId);
const ref = await getUser(refId);

if(user.refUsed){
return res.json({ success:false });
}

user.refUsed = true;
ref.balance += 0.1;
ref.refs++;

await user.save();
await ref.save();

res.json({ success:true });
});

/* WITHDRAW */
app.post("/withdraw", async (req,res)=>{
const { userId, amount } = req.body;

const user = await getUser(userId);

if(user.balance < amount){
return res.json({ success:false, message:"Not enough balance" });
}

user.balance -= amount;
await user.save();

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

/* START SERVER */
app.listen(PORT, ()=>{
console.log("Server running on port " + PORT);
});

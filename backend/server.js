const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* FRONTEND */
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;

/* START BOT */
spawn("node", ["bot.js"], {
cwd: __dirname,
stdio: "inherit"
});

/* DB */
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

/* WITHDRAW */
const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({
userId: String,
amount: Number,
status: { type: String, default: "pending" },
date: { type: Date, default: Date.now }
}));

/* SAFE USER */
async function getUser(userId){
let user = await User.findOne({ userId });

if(!user){
user = await User.create({
userId,
balance: 0,
refs: 0,
adsWatched: 0,
refUsed: false,
lastAd: 0
});
}

return user;
}

/* PROFILE */
app.get("/profile/:id", async (req,res)=>{
const user = await getUser(req.params.id);
res.json(user);
});

/* ADS */
app.post("/ads", async (req,res)=>{
const user = await getUser(req.body.userId);

const now = Date.now();
if(now - user.lastAd < 10000){
return res.json({ success:false });
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

/* REF */
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
return res.json({ success:false });
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

app.listen(PORT, ()=>{
console.log("Server running on port " + PORT);
});

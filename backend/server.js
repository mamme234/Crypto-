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

/* ================= USER ================= */
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
username:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
refs:{type:Number,default:0},
tasks:{type:Object,default:{}},
ban:{type:Boolean,default:false},
lastTap:{type:Number,default:0}
}));

/* ================= WITHDRAW ================= */
const Withdraw = mongoose.model("Withdraw",{
userId:String,
amount:Number,
address:String,
status:{type:String,default:"pending"}
});

/* ================= LOGIN ================= */
app.post("/api/login", async (req,res)=>{
let {id,name,ref} = req.body;

let u = await User.findOne({telegramId:id});

if(!u){
u = await User.create({
telegramId:id,
name,
username:ref
});
}

const token = jwt.sign({id:u._id},JWT_SECRET);
res.json({token});
});

/* ================= USER ================= */
app.get("/api/user", async (req,res)=>{
const token = req.headers.authorization?.split(" ")[1];
const data = jwt.verify(token,JWT_SECRET);

const u = await User.findById(data.id);

res.json({
coins:u.coins,
usdt:u.usdt,
refs:u.refs,
level:Math.floor(u.coins/5000)
});
});

/* ================= TAP SYSTEM ================= */
app.post("/api/tap", async (req,res)=>{
const token = req.headers.authorization?.split(" ")[1];
const data = jwt.verify(token,JWT_SECRET);

const u = await User.findById(data.id);

if(u.ban) return res.json({message:"Banned"});

let now = Date.now();
if(now - u.lastTap < 300) return res.json({message:"Too fast"});

u.lastTap = now;

let multi = Math.min(req.body.multi || 1,4);

u.coins += multi;
u.usdt = Math.floor(u.coins / 1000);

await u.save();

res.json({
coins:u.coins,
usdt:u.usdt,
level:Math.floor(u.coins/5000)
});
});

/* ================= TASKS ================= */
app.post("/api/task", async (req,res)=>{
const token = req.headers.authorization?.split(" ")[1];
const data = jwt.verify(token,JWT_SECRET);

const u = await User.findById(data.id);

if(!u.tasks) u.tasks = {};

const {type} = req.body;

if(u.tasks[type]){
return res.json({message:"Already done"});
}

let reward = 0;

if(type==="telegram") reward=500;
if(type==="tiktok") reward=700;
if(type==="youtube") reward=1000;

u.coins += reward;
u.tasks[type]=true;
u.usdt = Math.floor(u.coins / 1000);

await u.save();

res.json({message:`+${reward} coins`});
});

/* ================= WITHDRAW ================= */
app.post("/api/withdraw", async (req,res)=>{
const token = req.headers.authorization?.split(" ")[1];
const data = jwt.verify(token,JWT_SECRET);

const u = await User.findById(data.id);

if(u.usdt < req.body.amount){
return res.json({message:"Not enough USDT"});
}

await Withdraw.create({
userId:u._id,
amount:req.body.amount,
address:req.body.address
});

res.json({message:"Pending approval"});
});

/* ================= ADMIN ================= */
const ADMIN = {user:"admin",pass:"123456"};

/* login */
app.post("/api/admin/login",(req,res)=>{
if(req.body.user===ADMIN.user && req.body.pass===ADMIN.pass){
return res.json({ok:true});
}
res.json({ok:false});
});

/* users */
app.get("/api/admin/users", async (req,res)=>{
const u = await User.find();
res.json(u);
});

/* withdraws */
app.get("/api/admin/withdraws", async (req,res)=>{
const w = await Withdraw.find({status:"pending"});
res.json(w);
});

/* approve */
app.post("/api/admin/approve", async (req,res)=>{
const w = await Withdraw.findById(req.body.id);
const u = await User.findById(w.userId);

if(u.usdt >= w.amount){
u.usdt -= w.amount;
await u.save();

w.status="approved";
await w.save();
}

res.json({ok:true});
});

/* reject */
app.post("/api/admin/reject", async (req,res)=>{
await Withdraw.findByIdAndUpdate(req.body.id,{status:"rejected"});
res.json({ok:true});
});

/* ban */
app.post("/api/admin/ban", async (req,res)=>{
await User.findByIdAndUpdate(req.body.id,{ban:true});
res.json({ok:true});
});

app.listen(3000,()=>console.log("Server running"));

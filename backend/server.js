const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Mongo connected"));

/* ================= USER ================= */
const User = mongoose.model("User", {
  email:String,
  password:String,

  coins:{type:Number,default:0},
  usdt:{type:Number,default:0},

  referrals:{type:Number,default:0},
  referredBy:String,

  withdrawUnlocked:{type:Boolean,default:false},
  depositPaid:{type:Boolean,default:false},

  walletAddress:String,

  withdrawRequests:[
    {
      amount:Number,
      address:String,
      status:{type:String,default:"pending"},
      date:{type:Date,default:Date.now}
    }
  ],

  lastTap:{type:Number,default:0}
});

/* ================= TASK ================= */
const Task = mongoose.model("Task", {
  title:String,
  reward:Number,
  link:String
});

/* ================= AUTH ================= */
function auth(req,res,next){
  try{
    const token=req.headers.authorization.split(" ")[1];
    const data=jwt.verify(token,process.env.JWT_SECRET);
    req.userId=data.id;
    next();
  }catch{
    res.status(401).json({message:"Unauthorized"});
  }
}

/* ================= REGISTER ================= */
app.post("/api/register", async (req,res)=>{
  const {email,password,ref}=req.body;

  const exist=await User.findOne({email});
  if(exist) return res.status(400).json({message:"User exists"});

  const hash=await bcrypt.hash(password,10);

  const user=await User.create({
    email,
    password:hash,
    referredBy:ref||null
  });

  if(ref){
    await User.updateOne({_id:ref},{$inc:{referrals:1,coins:500}});
  }

  const token=jwt.sign({id:user._id},process.env.JWT_SECRET);
  res.json({token});
});

/* ================= LOGIN ================= */
app.post("/api/login", async (req,res)=>{
  const {email,password}=req.body;

  const user=await User.findOne({email});
  if(!user) return res.status(400).json({message:"Not found"});

  const ok=await bcrypt.compare(password,user.password);
  if(!ok) return res.status(400).json({message:"Wrong password"});

  const token=jwt.sign({id:user._id},process.env.JWT_SECRET);
  res.json({token});
});

/* ================= USER ================= */
app.get("/api/user", auth, async (req,res)=>{
  const user=await User.findById(req.userId);
  res.json(user);
});

/* ================= TAP ================= */
app.post("/api/user/tap", auth, async (req,res)=>{
  const user=await User.findById(req.userId);

  const now=Date.now();
  if(now-user.lastTap<700){
    return res.status(429).json({message:"Too fast"});
  }

  user.lastTap=now;
  user.coins+=50;

  await user.save();
  res.json(user);
});

/* ================= DAILY ================= */
app.post("/api/user/daily", auth, async (req,res)=>{
  const user=await User.findById(req.userId);
  user.coins+=1000;
  await user.save();
  res.json(user);
});

/* ================= TASK ================= */
app.get("/api/tasks", async (req,res)=>{
  const tasks=await Task.find();
  res.json(tasks);
});

app.post("/api/user/task", auth, async (req,res)=>{
  const user=await User.findById(req.userId);
  const task=await Task.findById(req.body.taskId);

  user.coins+=task.reward;
  await user.save();

  res.json(user);
});

/* ================= CONVERT ================= */
app.post("/api/user/convert", auth, async (req,res)=>{
  const user=await User.findById(req.userId);

  if(user.coins<1000){
    return res.status(400).json({message:"Not enough coins"});
  }

  user.coins-=1000;
  user.usdt+=1;

  await user.save();
  res.json(user);
});

/* ================= DEPOSIT ================= */
app.post("/api/user/deposit", auth, async (req,res)=>{
  const user=await User.findById(req.userId);

  user.depositPaid=true;
  user.withdrawUnlocked=true;

  await user.save();

  res.json({message:"Wait admin confirm"});
});

/* ================= WITHDRAW ================= */
app.post("/api/user/withdraw", auth, async (req,res)=>{
  const user=await User.findById(req.userId);

  const {amount,address}=req.body;

  if(user.usdt<amount){
    return res.status(400).json({message:"Not enough USDT"});
  }

  if(user.referrals<10 && !user.withdrawUnlocked){
    return res.status(400).json({
      message:"Need 10 referrals OR deposit $5"
    });
  }

  user.usdt-=amount;

  user.withdrawRequests.push({
    amount,
    address
  });

  await user.save();

  res.json({message:"Request sent"});
});

/* ================= ADMIN ================= */

app.post("/api/admin/login",(req,res)=>{
  const {email,password}=req.body;

  if(
    email===process.env.ADMIN_EMAIL &&
    password===process.env.ADMIN_PASS
  ){
    return res.json({success:true});
  }

  res.status(401).json({message:"Unauthorized"});
});

function adminAuth(req,res,next){
  if(req.headers.key===process.env.ADMIN_PASS){
    next();
  }else{
    res.status(403).json({message:"Forbidden"});
  }
}

app.get("/api/admin/withdraws", adminAuth, async (req,res)=>{
  const users=await User.find();
  res.json(users);
});

app.post("/api/admin/mark-paid", adminAuth, async (req,res)=>{
  const {userId,index}=req.body;

  const user=await User.findById(userId);
  user.withdrawRequests[index].status="paid";

  await user.save();

  res.json({message:"Paid"});
});

app.post("/api/admin/confirm-deposit", adminAuth, async (req,res)=>{
  const {userId}=req.body;

  const user=await User.findById(userId);
  user.withdrawUnlocked=true;

  await user.save();

  res.json({message:"Deposit confirmed"});
});

app.listen(3000,()=>console.log("Server running"));

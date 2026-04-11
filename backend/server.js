const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const User = require("./models/User");
const auth = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

// REGISTER
app.post("/api/register", async (req,res)=>{
  const {email,password} = req.body;
  const hash = await bcrypt.hash(password,10);

  const user = await User.create({email,password:hash});

  const token = jwt.sign({id:user._id},process.env.JWT_SECRET);
  res.json({success:true,token});
});

// LOGIN
app.post("/api/login", async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});

  if(!user) return res.json({success:false,message:"User not found"});

  const ok = await bcrypt.compare(password,user.password);
  if(!ok) return res.json({success:false,message:"Wrong password"});

  const token = jwt.sign({id:user._id},process.env.JWT_SECRET);
  res.json({success:true,token});
});

// GET USER
app.get("/api/user",auth,async(req,res)=>{
  const user = await User.findById(req.user.id);
  res.json(user);
});

// TAP
app.post("/api/user/tap",auth,async(req,res)=>{
  const user = await User.findById(req.user.id);
  user.coins += 50;
  user.usdt = user.coins / 1000;
  await user.save();
  res.json(user);
});

// DAILY
app.post("/api/user/daily",auth,async(req,res)=>{
  const user = await User.findById(req.user.id);
  user.coins += 1000;
  user.usdt = user.coins / 1000;
  await user.save();
  res.json(user);
});

// TASK
app.post("/api/user/task",auth,async(req,res)=>{
  const {task} = req.body;
  const user = await User.findById(req.user.id);

  if(task === "Telegram") user.coins += 500;
  if(task === "TikTok") user.coins += 1000;
  if(task === "YouTube") user.coins += 500;

  user.usdt = user.coins / 1000;
  await user.save();

  res.json(user);
});

// WITHDRAW
app.post("/api/user/withdraw",auth,async(req,res)=>{
  const user = await User.findById(req.user.id);

  if(user.coins < 20000 || user.referrals < 10){
    return res.json({message:"Not eligible"});
  }

  if(!user.withdrawUnlocked){
    return res.json({message:"Locked. Deposit $5"});
  }

  user.coins = 0;
  await user.save();

  res.json({message:"Withdraw successful"});
});

// UNLOCK
app.post("/api/user/depositUnlock",auth,async(req,res)=>{
  const user = await User.findById(req.user.id);
  user.withdrawUnlocked = true;
  await user.save();
  res.json({success:true});
});

app.listen(3000,()=>console.log("Server running"));

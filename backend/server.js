const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// MONGO
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Mongo connected"))
.catch(err=>console.log(err));

// USER MODEL
const User = mongoose.model("User", {
  email: String,
  password: String,
  coins: { type: Number, default: 0 },
  usdt: { type: Number, default: 0 },
  referrals: { type: Number, default: 0 },
  withdrawUnlocked: { type: Boolean, default: false }
});

// REGISTER
app.post("/api/register", async (req,res)=>{
  try{
    const {email, password} = req.body;

    const exist = await User.findOne({email});
    if(exist) return res.status(400).json({message:"User exists"});

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hash
    });

    const token = jwt.sign({id:user._id}, process.env.JWT_SECRET);

    res.json({token});

  }catch(e){
    res.status(500).json({message:e.message});
  }
});

// LOGIN
app.post("/api/login", async (req,res)=>{
  try{
    const {email, password} = req.body;

    const user = await User.findOne({email});
    if(!user) return res.status(400).json({message:"Not found"});

    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(400).json({message:"Wrong password"});

    const token = jwt.sign({id:user._id}, process.env.JWT_SECRET);

    res.json({token});

  }catch(e){
    res.status(500).json({message:e.message});
  }
});

// AUTH MIDDLEWARE
function auth(req,res,next){
  try{
    const token = req.headers.authorization.split(" ")[1];
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = data.id;
    next();
  }catch{
    res.status(401).json({message:"Invalid token"});
  }
}

// GET USER
app.get("/api/user", auth, async (req,res)=>{
  const user = await User.findById(req.userId);
  res.json(user);
});

// TAP
app.post("/api/user/tap", auth, async (req,res)=>{
  const user = await User.findById(req.userId);
  user.coins += 50;
  await user.save();
  res.json(user);
});

// DAILY
app.post("/api/user/daily", auth, async (req,res)=>{
  const user = await User.findById(req.userId);
  user.coins += 1000;
  await user.save();
  res.json(user);
});

// TASK
app.post("/api/user/task", auth, async (req,res)=>{
  const user = await User.findById(req.userId);

  if(req.body.task === "Telegram") user.coins += 500;
  if(req.body.task === "TikTok") user.coins += 1000;
  if(req.body.task === "YouTube") user.coins += 500;

  await user.save();
  res.json(user);
});

// WITHDRAW
app.post("/api/user/withdraw", auth, async (req,res)=>{
  const user = await User.findById(req.userId);

  if(user.coins >= 20000 && user.referrals >= 10){
    return res.json({message:"Withdraw success"});
  }

  res.status(400).json({message:"Not eligible"});
});

// UNLOCK
app.post("/api/user/depositUnlock", auth, async (req,res)=>{
  const user = await User.findById(req.userId);

  user.withdrawUnlocked = true;
  await user.save();

  res.json({message:"Unlocked"});
});

app.listen(PORT, ()=>{
  console.log("Server running on", PORT);
});

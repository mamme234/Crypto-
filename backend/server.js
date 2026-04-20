const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== MongoDB =====
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected ✅"))
.catch(err=>console.log(err));

// ===== Model =====
const User = mongoose.model("User",{
  userId:Number,
  coins:{type:Number,default:0},
  usdt:{type:Number,default:0},
  referredBy:Number,
  tasks:{type:Array,default:[]}
});

// ===== GET USER + REF =====
app.get("/user/:id/:ref?", async (req,res)=>{

  let {id,ref} = req.params;

  let user = await User.findOne({userId:id});

  if(!user){
    user = await User.create({
      userId:id,
      referredBy:ref || null
    });

    // give referral reward
    if(ref){
      let refUser = await User.findOne({userId:ref});
      if(refUser){
        refUser.coins += 100;
        refUser.usdt = refUser.coins/1000;
        await refUser.save();
      }
    }
  }

  res.json(user);
});

// ===== TAP =====
app.post("/tap", async (req,res)=>{
  let {userId,fingers} = req.body;

  let user = await User.findOne({userId});
  fingers = Math.min(fingers,4);

  user.coins += fingers;
  user.usdt = user.coins/1000;

  await user.save();
  res.json(user);
});

// ===== TASK =====
app.post("/task", async (req,res)=>{
  let {userId,type} = req.body;

  let user = await User.findOne({userId});

  if(user.tasks.includes(type)){
    return res.json({message:"Already completed",coins:user.coins,usdt:user.usdt});
  }

  let reward =
    type==="telegram"?500:
    type==="youtube"?1250:
    type==="tiktok"?1000:0;

  user.coins += reward;
  user.usdt = user.coins/1000;
  user.tasks.push(type);

  await user.save();

  res.json({message:"Task completed",coins:user.coins,usdt:user.usdt});
});

// ===== ADS =====
app.post("/ads", async (req,res)=>{
  let {userId} = req.body;

  let user = await User.findOne({userId});

  user.coins += 300;
  user.usdt = user.coins/1000;

  await user.save();
  res.json(user);
});

// ===== WITHDRAW =====
app.post("/withdraw", async (req,res)=>{
  let {userId,wallet,amount} = req.body;

  let user = await User.findOne({userId});

  if(amount < 20){
    return res.json({message:"Minimum 20 USDT"});
  }

  if(amount > user.usdt){
    return res.json({message:"Not enough balance"});
  }

  user.usdt -= amount;
  user.coins = user.usdt * 1000;

  await user.save();

  console.log("Withdraw:",wallet,amount);

  res.json({message:"Withdraw request sent"});
});

// ===== SERVER =====
app.listen(PORT,()=>{
  console.log("Server running on port",PORT);
});

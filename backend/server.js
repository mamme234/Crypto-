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
.then(async ()=>{

  console.log("MongoDB Connected ✅");

  // RUN ONCE ONLY (optional conversion)
  // await User.updateMany({}, {
  //   $set: {
  //     coins: { $floor: { $divide: ["$coins", 2] } }
  //   }
  // });

})
.catch(err=>console.log(err));

// ===== MODEL =====
const User = mongoose.model("User",{
  userId:Number,
  coins:{type:Number,default:0},
  usdt:{type:Number,default:0},
  referredBy:Number,
  lastAd:{type:Number,default:0}
});

// ===== USER =====
app.get("/user/:id/:ref?", async (req,res)=>{

  let {id,ref} = req.params;

  let user = await User.findOne({userId:id});

  if(!user){
    user = await User.create({
      userId:id,
      referredBy:ref || null
    });

    // referral bonus
    if(ref){
      let refUser = await User.findOne({userId:ref});
      if(refUser){
        refUser.coins += 100;
        refUser.usdt = refUser.coins / 1000;
        await refUser.save();
      }
    }
  }

  res.json(user);
});

// ===== ADS REWARD =====
app.post("/ads", async (req,res)=>{

  let {userId} = req.body;

  let user = await User.findOne({userId});

  if(!user) return res.json({message:"User not found"});

  const now = Date.now();

  if(user.lastAd && now - user.lastAd < 30000){
    return res.json({message:"Wait 30 seconds"});
  }

  user.coins += 50;
  user.usdt = user.coins / 1000;
  user.lastAd = now;

  await user.save();

  res.json({
    message:"Ad rewarded",
    coins:user.coins,
    usdt:user.usdt
  });
});

// ===== WITHDRAW =====
app.post("/withdraw", async (req,res)=>{

  let {userId,wallet,amount} = req.body;

  let user = await User.findOne({userId});

  if(!user) return res.json({message:"User not found"});

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

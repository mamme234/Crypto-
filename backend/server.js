const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ================= MIDDLEWARE =================

app.use(cors());
app.use(express.json());

// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));

// ================= MODEL =================

const UserSchema = new mongoose.Schema({

  userId:{
    type:String,
    unique:true
  },

  username:{
    type:String,
    default:"Telegram User"
  },

  usdt:{
    type:Number,
    default:0
  },

  adsWatched:{
    type:Number,
    default:0
  },

  lastAdTime:{
    type:Number,
    default:0
  }

});

const User = mongoose.model("User", UserSchema);

// ================= HOME =================

app.get("/", (req,res)=>{
  res.send("Meta Pro Earn Backend Running ✅");
});

// ================= PROFILE =================

app.get("/profile/:userId/:username", async(req,res)=>{

  try{

    const { userId, username } = req.params;

    let user = await User.findOne({ userId });

    // CREATE USER
    if(!user){

      user = await User.create({
        userId,
        username
      });

    }else{

      // UPDATE USERNAME
      user.username = username;
      await user.save();

    }

    res.json({
      success:true,
      userId:user.userId,
      username:user.username,
      usdt:user.usdt,
      adsWatched:user.adsWatched
    });

  }catch(err){

    console.log(err);

    res.json({
      success:false,
      message:"Profile error"
    });

  }

});

// ================= WATCH ADS =================

app.post("/ads", async(req,res)=>{

  try{

    const { userId } = req.body;

    if(!userId){

      return res.json({
        success:false,
        message:"User ID missing"
      });

    }

    let user = await User.findOne({ userId });

    if(!user){

      return res.json({
        success:false,
        message:"User not found"
      });

    }

    // ================= COOLDOWN =================

    const now = Date.now();

    const cooldown = 10000; // 10 seconds

    if(now - user.lastAdTime < cooldown){

      return res.json({
        success:false,
        message:"Wait before watching next ad"
      });

    }

    // ================= REWARD =================

    user.usdt += 0.03;

    user.adsWatched += 1;

    user.lastAdTime = now;

    await user.save();

    res.json({
      success:true,
      usdt:user.usdt,
      adsWatched:user.adsWatched
    });

  }catch(err){

    console.log(err);

    res.json({
      success:false,
      message:"Ads reward failed"
    });

  }

});

// ================= LEADERBOARD =================

app.get("/top", async(req,res)=>{

  try{

    const users = await User.find()
    .sort({ usdt:-1 })
    .limit(20);

    res.json(users);

  }catch(err){

    console.log(err);

    res.json([]);
  }

});

// ================= START =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running on port " + PORT);
});

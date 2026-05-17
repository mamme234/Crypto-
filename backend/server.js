const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// ================= DATABASE =================

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("MongoDB Connected ✅"))
.catch(err=>console.log(err));

// ================= MODEL =================

const User = mongoose.model("User",{

  userId:String,

  username:{
    type:String,
    default:"Telegram User"
  },

  usdt:{
    type:Number,
    default:0
  }

});

// ================= FRONTEND =================

app.use(express.static("frontend"));

// ================= PROFILE =================

app.get("/profile/:id/:name", async (req,res)=>{

  try{

    let user = await User.findOne({
      userId:req.params.id
    });

    if(!user){

      user = await User.create({

        userId:req.params.id,

        username:req.params.name,

        usdt:0

      });

    }else{

      user.username = req.params.name;

      await user.save();
    }

    res.json(user);

  }catch(err){

    console.log(err);

    res.json({
      usdt:0
    });
  }

});

// ================= ADS REWARD =================

app.post("/ads", async (req,res)=>{

  try{

    let { userId } = req.body;

    if(!userId){

      return res.json({
        success:false,
        message:"No userId"
      });

    }

    let user = await User.findOne({ userId });

    if(!user){

      user = await User.create({
        userId,
        usdt:0
      });

    }

    // reward
    user.usdt =
      Number(user.usdt || 0) + 0.03;

    await user.save();

    res.json({

      success:true,

      usdt:user.usdt

    });

  }catch(err){

    console.log(err);

    res.json({

      success:false,

      message:"Server error"

    });

  }

});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{

  console.log("Server running on",PORT);

});

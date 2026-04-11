const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  coins:{type:Number,default:0},
  usdt:{type:Number,default:0},
  referrals:{type:Number,default:0},
  withdrawUnlocked:{type:Boolean,default:false}
});

module.exports = mongoose.model("User",userSchema);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Collab Server Connected"));

// ================= MODELS =================
const User = mongoose.model("User",{
  userId:String,
  username:String,
  adsWatched:{type:Number,default:0}
});

const Ledger = mongoose.model("Ledger",{
  userId:String,
  type:String,
  amount:Number,
  createdAt:{type:Date,default:Date.now}
});

const Withdraw = mongoose.model("Withdraw",{
  userId:String,
  wallet:String,
  amount:Number,
  status:{type:String,default:"pending"}
});

// ================= BALANCE =================
async function getBalance(userId){
  const tx = await Ledger.find({userId});
  return tx.reduce((s,t)=>s+t.amount,0);
}

// ================= PROFILE =================
app.get("/profile/:id", async (req,res)=>{
  let user = await User.findOne({userId:req.params.id});
  if(!user) user = await User.create({userId:req.params.id});

  res.json({
    success:true,
    user,
    balance:await getBalance(req.params.id)
  });
});

// ================= ADS =================
app.post("/ads", async (req,res)=>{
  const {userId} = req.body;

  const reward = 0.03;

  await Ledger.create({
    userId,
    type:"ads",
    amount:reward
  });

  await User.updateOne(
    {userId},
    {$inc:{adsWatched:1}}
  );

  res.json({
    success:true,
    reward,
    balance:await getBalance(userId)
  });
});

// ================= WITHDRAW =================
app.post("/withdraw", async (req,res)=>{
  const {userId,wallet,amount} = req.body;

  const balance = await getBalance(userId);

  if(balance < amount){
    return res.json({success:false,message:"Low balance"});
  }

  await Withdraw.create({userId,wallet,amount});

  res.json({success:true,message:"Sent to admin"});
});

// ================= ADMIN =================
const ADMIN_KEY = process.env.ADMIN_KEY;

// middleware
function admin(req,res,next){
  if(req.headers.key !== ADMIN_KEY){
    return res.json({success:false,message:"No access"});
  }
  next();
}

// ================= GET WITHDRAW REQUESTS =================
app.get("/admin/withdraws", admin, async (req,res)=>{
  const list = await Withdraw.find().sort({_id:-1});
  res.json(list);
});

// ================= APPROVE =================
app.post("/admin/approve", admin, async (req,res)=>{
  const w = await Withdraw.findById(req.body.id);
  if(!w) return res.json({success:false});

  await Ledger.create({
    userId:w.userId,
    type:"withdraw",
    amount:-w.amount
  });

  w.status="approved";
  await w.save();

  res.json({success:true});
});

// ================= REJECT =================
app.post("/admin/reject", admin, async (req,res)=>{
  await Withdraw.findByIdAndUpdate(req.body.id,{status:"rejected"});
  res.json({success:true});
});

// ================= TOP =================
app.get("/top", async (req,res)=>{
  const users = await Ledger.aggregate([
    {$group:{_id:"$userId",balance:{$sum:"$amount"}}},
    {$sort:{balance:-1}},
    {$limit:10}
  ]);

  res.json(users);
});

app.listen(3000,()=>console.log("Collab API Running"));

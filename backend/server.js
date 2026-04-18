const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL);

const JWT_SECRET = process.env.JWT_SECRET;

// ================= USER =================
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
refs:{type:Number,default:0},
lastTap:{type:Number,default:0}
}));

// ================= WITHDRAW =================
const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({
userId:String,
amount:Number,
address:String,
status:{type:String,default:"pending"}, // pending | processing | paid | failed
txId:String,
createdAt:{type:Date,default:Date.now}
}));

// ================= AUTH =================
function auth(req,res,next){
const t=req.headers.authorization;
if(!t) return res.json({error:"no token"});
try{
req.userId=jwt.verify(t.split(" ")[1],JWT_SECRET).id;
next();
}catch{
res.json({error:"invalid"});
}
}

// ================= USER =================
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);
res.json(u);
});

// ================= TAP =================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);

let now = Date.now();
if(now - u.lastTap < 200) return res.json(u);

u.lastTap = now;

let tap = Math.min(Math.max(req.body.multi || 1,1),4);

u.coins += tap;
u.usdt = Math.floor(u.coins / 1000);

await u.save();

res.json(u);
});

// ================= WITHDRAW REQUEST =================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address} = req.body;
const u = await User.findById(req.userId);

if(amount < 20) return res.json({error:"min 20 USDT"});
if(u.usdt < amount) return res.json({error:"not enough"});

// lock funds (important)
u.usdt -= amount;
await u.save();

const w = await Withdraw.create({
userId:u._id,
amount,
address,
status:"pending"
});

res.json({success:true,withdraw:w});
});

// ================= ADMIN PAYOUT (BINANCE PAY READY) =================
app.post("/api/admin/pay", async (req,res)=>{
const {id} = req.body;

const w = await Withdraw.findById(id);
if(!w) return res.json({error:"not found"});

try{

// PLACEHOLDER FOR REAL API (Binance Pay / NowPayments)
const response = await axios.post("https://api.paymentprovider.com/send",{
address:w.address,
amount:w.amount
});

// if success
w.status="paid";
w.txId=response.data.txId || "manual";
await w.save();

res.json({success:true});

}catch(e){

w.status="failed";
await w.save();

res.json({error:"payment failed"});
}
});

// ================= ADMIN LIST =================
app.get("/api/admin/withdraws", async (req,res)=>{
const list = await Withdraw.find().sort({createdAt:-1});
res.json(list);
});

// ================= STATS =================
app.get("/api/admin/stats", async (req,res)=>{
const users = await User.countDocuments();
const withdraws = await Withdraw.countDocuments();

res.json({users,withdraws});
});

app.listen(3000,()=>console.log("v10 PAYOUT READY"));

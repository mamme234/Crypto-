const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// DB CONNECT
mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// USER MODEL
const User = mongoose.model("User", new mongoose.Schema({
email:String,
password:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},

withdrawRequests:{
  type:Array,
  default:[]
},

depositVerified:{
  type:Boolean,
  default:false
}
}));

// AUTH
function auth(req,res,next){
const token=req.headers.authorization;
if(!token) return res.json({message:"No token"});

try{
const data=jwt.verify(token.split(" ")[1],JWT_SECRET);
req.userId=data.id;
next();
}catch{
res.json({message:"Invalid token"});
}
}

// REGISTER
app.post("/api/register", async (req,res)=>{
const {email,password}=req.body;

const hash=await bcrypt.hash(password,10);

const user=await User.create({
email,
password:hash
});

const token=jwt.sign({id:user._id},JWT_SECRET);
res.json({token});
});

// LOGIN
app.post("/api/login", async (req,res)=>{
const {email,password}=req.body;

const user=await User.findOne({email});
if(!user) return res.json({message:"User not found"});

const ok=await bcrypt.compare(password,user.password);
if(!ok) return res.json({message:"Wrong password"});

const token=jwt.sign({id:user._id},JWT_SECRET);
res.json({token});
});

// USER INFO
app.get("/api/user", auth, async (req,res)=>{
const user=await User.findById(req.userId);

res.json({
email:user.email,
coins:user.coins,
usdt:user.usdt,
referrals:user.referrals,
depositVerified:user.depositVerified
});
});

// TAP
app.post("/api/tap", auth, async (req,res)=>{
const user=await User.findById(req.userId);

user.coins += 50;

await user.save();

res.json({coins:user.coins});
});

// TASK
app.post("/api/task", auth, async (req,res)=>{
const user=await User.findById(req.userId);

user.coins += 500;

await user.save();

res.json({coins:user.coins});
});


// ================================
// 💸 WITHDRAW SYSTEM (REQUEST ONLY)
// ================================
app.post("/api/withdraw", auth, async (req,res)=>{

const {amount, address} = req.body;

const user = await User.findById(req.userId);

const amt = Number(amount);

if(!amt || amt <= 0){
return res.json({message:"Invalid amount"});
}

if(user.usdt < amt){
return res.json({message:"Not enough USDT"});
}

// 🔴 STORE REQUEST (NO DEDUCTION YET)
user.withdrawRequests.push({
amount:amt,
address,
status:"pending",
date:Date.now()
});

await user.save();

res.json({message:"Withdraw sent to admin"});
});


// ================================
// 🧑‍💼 ADMIN: GET WITHDRAW REQUESTS
// ================================
app.get("/api/admin/withdraws", async (req,res)=>{

const users = await User.find();

let all = [];

users.forEach(u=>{
u.withdrawRequests.forEach((w,i)=>{
if(w.status === "pending"){
all.push({
userId:u._id,
email:u.email,
index:i,
...w
});
}
});
});

res.json(all);
});


// ================================
// 🧑‍💼 ADMIN: APPROVE WITHDRAW
// ================================
app.post("/api/admin/approve", async (req,res)=>{

const {userId, index} = req.body;

const user = await User.findById(userId);

const w = user.withdrawRequests[index];

if(!w || w.status !== "pending"){
return res.json({message:"Already processed"});
}

// 💰 NOW DEDUCT BALANCE
user.usdt -= w.amount;

// mark paid
user.withdrawRequests[index].status = "paid";

await user.save();

res.json({message:"Withdraw approved & paid"});
});


// LEADERBOARD
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find().sort({coins:-1}).limit(10);
res.json(users);
});

app.listen(3000, ()=>console.log("Server running"));

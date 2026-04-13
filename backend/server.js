const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const MONGO_URL = process.env.MONGO_URL;

// ================= DB =================
mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("MongoDB Error:", err.message));

// ================= USER =================
const User = mongoose.model("User", new mongoose.Schema({
email:String,
password:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},
withdrawRequests:{type:Array,default:[]},
depositVerified:{type:Boolean,default:false}
}));

// ================= AUTH =================
function auth(req,res,next){
const token=req.headers.authorization;
if(!token) return res.status(401).json({message:"No token"});

try{
const data=jwt.verify(token.split(" ")[1],JWT_SECRET);
req.userId=data.id;
next();
}catch{
res.status(401).json({message:"Invalid token"});
}
}

// ================= USER =================
app.get("/api/user", auth, async (req,res)=>{
const user=await User.findById(req.userId);
res.json(user);
});

// ================= 🔥 FIXED TAP =================
app.post("/api/tap", auth, async (req,res)=>{
try{

const user=await User.findById(req.userId);
if(!user) return res.status(404).json({message:"User not found"});

user.coins = (user.coins || 0) + 50;

await user.save();
res.json(user);

}catch(err){
console.log("TAP ERROR:",err);
res.status(500).json({message:"Tap failed"});
}
});

// ================= 🔥 FIXED TASK =================
app.post("/api/task", auth, async (req,res)=>{
try{

const user=await User.findById(req.userId);
if(!user) return res.status(404).json({message:"User not found"});

user.coins = (user.coins || 0) + 500;

await user.save();
res.json(user);

}catch(err){
console.log(err);
res.status(500).json({message:"Task failed"});
}
});

// ================= 🔥 FIXED WITHDRAW =================
app.post("/api/withdraw", auth, async (req,res)=>{
try{

const user=await User.findById(req.userId);
if(!user) return res.status(404).json({message:"User not found"});

user.withdrawRequests.push({
amount:req.body.amount,
address:req.body.address,
status:"pending"
});

await user.save();

res.json({message:"Withdraw requested"});

}catch(err){
console.log(err);
res.status(500).json({message:"Withdraw failed"});
}
});

// ================= OTHER ROUTES =================
app.post("/api/register", async (req,res)=>{
const {email,password,ref}=req.body;

const hash=await bcrypt.hash(password,10);
const user=await User.create({email,password:hash});

if(ref){
const r=await User.findById(ref);
if(r){
r.referrals++;
r.coins+=500;
await r.save();
}
}

const token=jwt.sign({id:user._id},JWT_SECRET);
res.json({token});
});

app.post("/api/login", async (req,res)=>{
const {email,password}=req.body;

const user=await User.findOne({email});
if(!user) return res.status(400).json({message:"No user"});

const ok=await bcrypt.compare(password,user.password);
if(!ok) return res.status(400).json({message:"Wrong password"});

const token=jwt.sign({id:user._id},JWT_SECRET);
res.json({token});
});

// ================= TASK LIST =================
app.get("/api/tasks",(req,res)=>{
res.json([
  { _id:"tg", title:"Join Telegram", reward:500 },
  { _id:"tt", title:"Follow TikTok", reward:800 },
  { _id:"yt", title:"Subscribe YouTube", reward:1000 }
]);
});

// ================= LEADERBOARD =================
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find()
.sort({coins:-1})
.limit(10);

res.json(users);
});

// ================= HEALTH =================
app.get("/",(req,res)=>{
res.send("Crypto backend running ✅");
});

// ================= START =================
app.listen(3000,()=>console.log("Server running"));

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;

// DB
mongoose.connect(MONGO_URL)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

// USER MODEL
const User = mongoose.model("User", new mongoose.Schema({
telegramId:String,
name:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},
withdrawRequests:{type:Array,default:[]},
depositVerified:{type:Boolean,default:false}
}));

// AUTH MIDDLEWARE
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

// =========================
// TELEGRAM LOGIN
// =========================
app.get("/api/auth/telegram", async (req,res)=>{

const data = req.query;

const checkString = Object.keys(data)
.filter(k => k !== "hash")
.sort()
.map(k => `${k}=${data[k]}`)
.join("\n");

const secret = crypto.createHash("sha256")
.update(BOT_TOKEN)
.digest();

const hash = crypto.createHmac("sha256", secret)
.update(checkString)
.digest("hex");

if(hash !== data.hash){
return res.send("Invalid Telegram login");
}

// find or create user
let user = await User.findOne({telegramId:data.id});

if(!user){
user = await User.create({
telegramId:data.id,
name:data.username || data.first_name
});
}

const token = jwt.sign({id:user._id},JWT_SECRET);

// send back to frontend
res.redirect(`https://YOUR-FRONTEND.com?token=${token}`);
});

// GET USER
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);
res.json(u);
});

// TAP
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 50;
await u.save();
res.json({coins:u.coins});
});

// TASK
app.post("/api/task", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 500;
await u.save();
res.json({coins:u.coins});
});

// WITHDRAW REQUEST
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address} = req.body;
const u = await User.findById(req.userId);

if(u.usdt < amount){
return res.json({message:"Not enough balance"});
}

u.withdrawRequests.push({
amount,
address,
status:"pending",
date:Date.now()
});

await u.save();

res.json({message:"Withdraw request sent"});
});

// LEADERBOARD
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find().sort({coins:-1}).limit(10);
res.json(users);
});

// ADMIN VIEW WITHDRAW
app.get("/api/admin/withdraws", async (req,res)=>{
const users = await User.find();

let all=[];

users.forEach(u=>{
u.withdrawRequests.forEach((w,i)=>{
if(w.status==="pending"){
all.push({
userId:u._id,
name:u.name,
index:i,
...w
});
}
});
});

res.json(all);
});

// ADMIN APPROVE
app.post("/api/admin/approve", async (req,res)=>{
const {userId,index} = req.body;

const u = await User.findById(userId);

const w = u.withdrawRequests[index];

if(!w || w.status!=="pending"){
return res.json({message:"Already processed"});
}

u.usdt -= w.amount;
u.withdrawRequests[index].status="paid";

await u.save();

res.json({message:"Paid successfully"});
});

app.listen(3000,()=>console.log("Server running"));

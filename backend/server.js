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
photo:String,
coins:{type:Number,default:0},
usdt:{type:Number,default:0},
referrals:{type:Number,default:0},
refUsed:{type:Boolean,default:false},
withdrawRequests:{type:Array,default:[]}
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

// =====================
// TELEGRAM LOGIN
// =====================
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
return res.send("Invalid login");
}

const tgId = data.id;
const username = data.username || null;
const firstName = data.first_name || "User";
const photo = data.photo_url || "";

// safe name
const name = username ? `@${username}` : firstName;

// find or create user
let user = await User.findOne({telegramId:tgId});

if(!user){
user = await User.create({
telegramId:tgId,
name,
photo
});
} else {
user.name = name;
user.photo = photo;
await user.save();
}

const token = jwt.sign({id:user._id},JWT_SECRET);

res.redirect(`https://YOUR-FRONTEND.com?token=${token}`);
});

// =====================
// USER INFO
// =====================
app.get("/api/user", auth, async (req,res)=>{
const u = await User.findById(req.userId);

res.json({
telegramId:u.telegramId,
name:u.name,
photo:u.photo,
coins:u.coins,
usdt:u.usdt,
referrals:u.referrals
});
});

// =====================
// TAP SYSTEM
// =====================
app.post("/api/tap", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 50;
await u.save();
res.json({coins:u.coins});
});

// =====================
// TASK SYSTEM
// =====================
app.post("/api/task", auth, async (req,res)=>{
const u = await User.findById(req.userId);
u.coins += 500;
await u.save();
res.json({coins:u.coins});
});

// =====================
// WITHDRAW REQUEST
// =====================
app.post("/api/withdraw", auth, async (req,res)=>{
const {amount,address} = req.body;

const u = await User.findById(req.userId);

if(u.usdt < amount){
return res.json({message:"Not enough USDT"});
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

// =====================
// LEADERBOARD
// =====================
app.get("/api/leaderboard", async (req,res)=>{
const users = await User.find().sort({coins:-1}).limit(10);
res.json(users);
});

// =====================
// ADMIN WITHDRAW LIST
// =====================
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

// =====================
// ADMIN APPROVE WITHDRAW
// =====================
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

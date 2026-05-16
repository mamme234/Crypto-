const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

// ================= MODEL =================
const User = mongoose.model("User",{
  userId:String,
  usdt:{type:Number,default:0},
  coins:{type:Number,default:0},
  totalAds:{type:Number,default:0},
  level:{type:String,default:"Bronze"},
  lastAd:{type:Number,default:0},
  lastBonus:{type:Number,default:0}
});

const Withdraw = mongoose.model("Withdraw",{
  userId:String,
  wallet:String,
  amount:Number,
  status:{type:String,default:"pending"},
  date:{type:Number,default:Date.now()}
});

const ADMIN_ID = process.env.ADMIN_ID;

// ================= FRONTEND =================
app.get("/", (req,res)=>{
res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Earn USDT App</title>

<style>
body{margin:0;font-family:Arial;background:#0f172a;color:white;text-align:center}
.card{background:#1e293b;margin:15px;padding:15px;border-radius:12px}
button{width:90%;padding:12px;margin:6px;border:none;border-radius:10px;font-size:16px}
.ad{background:#22c55e;color:white}
.bonus{background:#3b82f6;color:white}
.withdraw{background:#f59e0b;color:white}
</style>

</head>

<body>

<h2>💰 Earn USDT App</h2>

<div class="card">
<p>🆔 ID: <span id="uid"></span></p>
<p>💰 USDT: $<span id="usdt">0</span></p>
<p>🪙 Coins: <span id="coins">0</span></p>
<p>🏆 Level: <span id="level">Bronze</span></p>
</div>

<button class="ad" onclick="watchAd()">▶ Watch Ad +0.03$</button>
<button class="bonus" onclick="bonus()">🎁 Daily Bonus +0.01$</button>

<div class="card">
<h3>💸 Withdraw</h3>
<input id="wallet" placeholder="Wallet" style="width:90%;padding:10px"><br><br>
<input id="amount" placeholder="Amount" style="width:90%;padding:10px"><br><br>
<button class="withdraw" onclick="withdraw()">Withdraw</button>
</div>

<script>

const userId =
(window.Telegram && Telegram.WebApp)
? Telegram.WebApp.initDataUnsafe.user.id
: "test";

document.getElementById("uid").innerText = userId;

// PROFILE
async function load(){
  let res = await fetch("/profile/"+userId);
  let d = await res.json();

  document.getElementById("usdt").innerText = d.usdt.toFixed(2);
  document.getElementById("coins").innerText = d.coins;
  document.getElementById("level").innerText = d.level;
}

load();

// ADS
async function watchAd(){

  let res = await fetch("/ads",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId})
  });

  let d = await res.json();

  if(d.success) load();
  else alert(d.message);
}

// BONUS
async function bonus(){

  let res = await fetch("/bonus",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({userId})
  });

  let d = await res.json();
  alert(d.message);
  load();
}

// WITHDRAW
async function withdraw(){

  let wallet = document.getElementById("wallet").value;
  let amount = document.getElementById("amount").value;

  let res = await fetch("/withdraw",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      userId,
      wallet,
      amount:Number(amount)
    })
  });

  let d = await res.json();
  alert(d.message);
}

</script>

</body>
</html>
`);
});

// ================= PROFILE =================
app.get("/profile/:id", async (req,res)=>{
  let user = await User.findOne({userId:req.params.id});
  if(!user) user = await User.create({userId:req.params.id});
  res.json(user);
});

// ================= ADS =================
app.post("/ads", async (req,res)=>{

  let {userId} = req.body;
  let user = await User.findOne({userId});

  if(!user) return res.json({message:"User not found"});

  const now = Date.now();

  if(user.lastAd && now - user.lastAd < 30000){
    return res.json({message:"Wait 30 seconds"});
  }

  user.usdt += 0.03;
  user.coins = user.usdt * 1000;

  user.totalAds += 1;
  user.lastAd = now;

  if(user.totalAds > 200) user.level = "Gold";
  else if(user.totalAds > 100) user.level = "Silver";

  await user.save();

  res.json({success:true,user});
});

// ================= BONUS =================
app.post("/bonus", async (req,res)=>{

  let {userId} = req.body;
  let user = await User.findOne({userId});

  const today = new Date().toDateString();

  if(user.lastBonus === today){
    return res.json({message:"Already claimed"});
  }

  user.usdt += 0.01;
  user.coins = user.usdt * 1000;
  user.lastBonus = today;

  await user.save();

  res.json({message:"Bonus added"});
});

// ================= WITHDRAW =================
app.post("/withdraw", async (req,res)=>{

  let {userId,wallet,amount} = req.body;

  let user = await User.findOne({userId});
  if(!user) return res.json({message:"User not found"});

  if(amount < 5){
    return res.json({message:"Minimum $5"});
  }

  if(amount > user.usdt){
    return res.json({message:"Not enough balance"});
  }

  await Withdraw.create({
    userId,
    wallet,
    amount
  });

  res.json({message:"Withdraw submitted"});
});

// ================= ADMIN USERS =================
app.get("/admin/users/:id", async (req,res)=>{

  if(req.params.id !== ADMIN_ID){
    return res.send("Not allowed");
  }

  let users = await User.find().sort({usdt:-1});
  res.json(users);
});

// ================= ADMIN WITHDRAW =================
app.get("/admin/withdraws/:id", async (req,res)=>{

  if(req.params.id !== ADMIN_ID){
    return res.send("Not allowed");
  }

  let data = await Withdraw.find().sort({date:-1});
  res.json(data);
});

// ================= SERVER =================
app.listen(3000, ()=>console.log("Server running"));

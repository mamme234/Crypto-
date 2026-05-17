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

// ================= MODELS =================
const User = mongoose.model("User",{
  userId:String,
  username:{type:String,default:"Telegram User"},
  usdt:{type:Number,default:0},
  coins:{type:Number,default:0},
  totalAds:{type:Number,default:0},
  level:{type:String,default:"Bronze"},
  lastAd:{type:Number,default:0},
  lastBonus:{type:String,default:""}
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

<title>Earn USDT Pro</title>

<script src='//libtl.com/sdk.js'
data-zone='10892289'
data-sdk='show_10892289'></script>

<style>

body{
margin:0;
font-family:Arial;
background:#0f172a;
color:white;
text-align:center;
}

.topbar{
background:#111827;
padding:15px;
display:flex;
align-items:center;
gap:12px;
}

.avatar{
width:45px;
height:45px;
border-radius:50%;
background:#334155;
display:flex;
align-items:center;
justify-content:center;
font-size:20px;
font-weight:bold;
}

.userinfo{
text-align:left;
}

.card{
background:#1e293b;
margin:15px;
padding:15px;
border-radius:14px;
}

.balance{
font-size:28px;
font-weight:bold;
color:#22c55e;
}

button{
width:90%;
padding:14px;
margin:8px;
border:none;
border-radius:12px;
font-size:17px;
font-weight:bold;
}

.ad{
background:#22c55e;
color:white;
}

.bonus{
background:#3b82f6;
color:white;
}

.withdraw{
background:#f59e0b;
color:white;
}

input{
width:90%;
padding:12px;
border:none;
border-radius:10px;
margin-top:10px;
font-size:16px;
}

</style>

</head>

<body>

<!-- TOP PROFILE -->
<div class="topbar">

<div class="avatar" id="avatar">
U
</div>

<div class="userinfo">

<div id="tgname">
Telegram User
</div>

<small>
ID: <span id="uid"></span>
</small>

</div>

</div>

<!-- BALANCE -->
<div class="card">

<h2>💰 Balance</h2>

<div class="balance">
$<span id="usdt">0.00</span>
</div>

<p>
🪙 Coins:
<span id="coins">0</span>
</p>

<p>
🏆 Level:
<span id="level">Bronze</span>
</p>

</div>

<!-- ADS -->
<button class="ad" onclick="watchAd()">
▶ Watch Ad +0.03$
</button>

<!-- BONUS -->
<button class="bonus" onclick="bonus()">
🎁 Daily Bonus +0.01$
</button>

<!-- WITHDRAW -->
<div class="card">

<h3>💸 Withdraw</h3>

<input id="wallet" placeholder="USDT Wallet">

<input id="amount" placeholder="Amount">

<button class="withdraw" onclick="withdrawNow()">
Withdraw
</button>

</div>

<script>

// ================= TELEGRAM USER =================

let userId = "guest";
let tgName = "Telegram User";
let avatar = "U";

if(window.Telegram && Telegram.WebApp){

  const tgUser = Telegram.WebApp.initDataUnsafe.user;

  if(tgUser){

    userId = tgUser.id;

    tgName =
      tgUser.username
      ? "@"+tgUser.username
      : tgUser.first_name || "Telegram User";

    avatar = tgName.charAt(1).toUpperCase();
  }
}

document.getElementById("uid").innerText = userId;
document.getElementById("tgname").innerText = tgName;
document.getElementById("avatar").innerText = avatar;

// ================= LOAD PROFILE =================

async function load(){

  let res = await fetch("/profile/"+userId+"/"+encodeURIComponent(tgName));

  let d = await res.json();

  document.getElementById("usdt").innerText =
    Number(d.usdt || 0).toFixed(2);

  document.getElementById("coins").innerText =
    d.coins || 0;

  document.getElementById("level").innerText =
    d.level || "Bronze";
}

load();

// ================= WATCH AD =================

async function watchAd(){

  show_10892289().then(async ()=>{

    let res = await fetch("/ads",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({userId})
    });

    let d = await res.json();

    if(d.success){

      alert("🎉 +0.03 USDT Added!");

      load();

    }else{
      alert(d.message);
    }

  }).catch(()=>{
    alert("Ad not completed");
  });

}

// ================= BONUS =================

async function bonus(){

  let res = await fetch("/bonus",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({userId})
  });

  let d = await res.json();

  alert(d.message);

  load();
}

// ================= WITHDRAW =================

async function withdrawNow(){

  let wallet =
    document.getElementById("wallet").value;

  let amount =
    document.getElementById("amount").value;

  let res = await fetch("/withdraw",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
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

app.get("/profile/:id/:name", async (req,res)=>{

  let user = await User.findOne({
    userId:req.params.id
  });

  if(!user){

    user = await User.create({
      userId:req.params.id,
      username:req.params.name,
      usdt:0,
      coins:0,
      totalAds:0,
      level:"Bronze"
    });

  }else{

    user.username = req.params.name;
    await user.save();
  }

  res.json(user);
});

// ================= ADS =================

app.post("/ads", async (req,res)=>{

  let {userId} = req.body;

  let user = await User.findOne({userId});

  if(!user){

    user = await User.create({
      userId,
      usdt:0,
      coins:0,
      totalAds:0
    });
  }

  user.usdt += 0.03;

  user.coins = Math.floor(user.usdt * 1000);

  user.totalAds += 1;

  const now = Date.now();

  user.lastAd = now;

  if(user.totalAds > 200){
    user.level = "Gold";
  }
  else if(user.totalAds > 100){
    user.level = "Silver";
  }
  else{
    user.level = "Bronze";
  }

  await user.save();

  res.json({
    success:true,
    usdt:user.usdt,
    coins:user.coins
  });
});

// ================= BONUS =================

app.post("/bonus", async (req,res)=>{

  let {userId} = req.body;

  let user = await User.findOne({userId});

  if(!user){
    return res.json({
      message:"User not found"
    });
  }

  const today =
    new Date().toDateString();

  if(user.lastBonus === today){

    return res.json({
      message:"Already claimed today"
    });
  }

  user.usdt += 0.01;

  user.coins = Math.floor(user.usdt * 1000);

  user.lastBonus = today;

  await user.save();

  res.json({
    message:"🎁 Bonus Added!"
  });
});

// ================= WITHDRAW =================

app.post("/withdraw", async (req,res)=>{

  let {userId,wallet,amount} = req.body;

  let user = await User.findOne({userId});

  if(!user){

    return res.json({
      message:"User not found"
    });
  }

  if(amount < 5){

    return res.json({
      message:"Minimum withdraw is $5"
    });
  }

  if(amount > user.usdt){

    return res.json({
      message:"Not enough balance"
    });
  }

  await Withdraw.create({
    userId,
    wallet,
    amount
  });

  res.json({
    message:"✅ Withdraw Submitted"
  });
});

// ================= ADMIN USERS =================

app.get("/admin/users/:id", async (req,res)=>{

  if(req.params.id !== ADMIN_ID){

    return res.send("Not allowed");
  }

  let users =
    await User.find().sort({usdt:-1});

  res.json(users);
});

// ================= ADMIN WITHDRAWS =================

app.get("/admin/withdraws/:id", async (req,res)=>{

  if(req.params.id !== ADMIN_ID){

    return res.send("Not allowed");
  }

  let data =
    await Withdraw.find().sort({date:-1});

  res.json(data);
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("Server running on",PORT);
});

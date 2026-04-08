const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const User = require('./models/User');
const SECRET = "supersecretkey"; // production: use env variable

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=>console.log("MongoDB connected")).catch(console.log);

const authMiddleware = async (req,res,next)=>{
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({success:false,message:"Unauthorized"});
  try{
    const decoded = jwt.verify(token,SECRET);
    req.user = await User.findById(decoded.id);
    next();
  }catch(e){ return res.status(401).json({success:false,message:"Invalid token"}); }
};

const createToken = (id)=> jwt.sign({id},SECRET,{expiresIn:'7d'});

// --- Routes ---
app.post('/api/register', async (req,res)=>{
  const {email,password,referral} = req.body;
  if(!email || !password) return res.json({success:false,message:"Missing fields"});
  const existing = await User.findOne({email});
  if(existing) return res.json({success:false,message:"Email exists"});
  const hash = await bcrypt.hash(password,10);
  const referralLink = `${email.split('@')[0]}_ref`;
  const user = await User.create({email,password:hash,referralLink});
  if(referral){
    const refUser = await User.findOne({referralLink:referral});
    if(refUser){ refUser.referrals+=1; await refUser.save(); }
  }
  const token = createToken(user._id);
  res.json({success:true,token});
});

app.post('/api/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.json({success:false,message:"User not found"});
  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.json({success:false,message:"Wrong password"});
  const token = createToken(user._id);
  res.json({success:true,token});
});

app.get('/api/user', authMiddleware, async (req,res)=>{
  const {coins,usdt,level,referrals,referralLink,withdrawUnlocked} = req.user;
  res.json({coins,usdt,level,referrals,referralLink,withdrawUnlocked});
});

app.post('/api/user/coins', authMiddleware, async (req,res)=>{
  const {coins:amount} = req.body;
  req.user.coins += amount;
  req.user.usdt = (req.user.coins / 1000).toFixed(2);
  await req.user.save();
  res.json({coins:req.user.coins,usdt:req.user.usdt,level:req.user.level});
});

app.post('/api/user/task', authMiddleware, async (req,res)=>{
  const {task} = req.body;
  let reward = 0;
  if(task==="Telegram") reward=500;
  else if(task==="TikTok") reward=1000;
  else if(task==="YouTube") reward=500;
  req.user.coins += reward;
  await req.user.save();
  res.json({coins:req.user.coins,referrals:req.user.referrals});
});

app.post('/api/user/withdraw', authMiddleware, async (req,res)=>{
  if(req.user.coins>=20000 && req.user.referrals>=10 || req.user.withdrawUnlocked){
    req.user.coins=0; req.user.usdt=0; req.user.withdrawUnlocked=false;
    await req.user.save();
    return res.json({success:true,message:"Withdraw successful!"});
  }
  res.json({success:false,message:"Cannot withdraw: Need 20,000 coins + 10 referrals or deposit $5"});
});

app.post('/api/user/depositUnlock', authMiddleware, async (req,res)=>{
  req.user.withdrawUnlocked = true;
  await req.user.save();
  res.json({success:true,message:"Deposit $5 successful! Withdraw unlocked."});
});

const PORT = process.env.PORT || 5000;
app.listen(PORT,()=>console.log(`Server running on ${PORT}`));

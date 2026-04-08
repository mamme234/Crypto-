require("dotenv").config();
const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");

const app=express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

const User=mongoose.model("User",{
username:String,
coins:{type:Number,default:0},
refs:{type:Number,default:0},
deposit:{type:Number,default:0},
telegram:{type:Boolean,default:false},
tiktok:{type:Boolean,default:false},
youtube:{type:Boolean,default:false}
});

app.get("/",(req,res)=>res.send("Server running"));

// LOGIN
app.post("/login",async(req,res)=>{
let {username,ref}=req.body;
let user=await User.findOne({username});

if(!user){
user=new User({username});
await user.save();

if(ref && ref!==username){
let refUser=await User.findOne({username:ref});
if(refUser){
refUser.refs+=1;
await refUser.save();
}
}
}

res.json({user});
});

// TAP
app.post("/tap",async(req,res)=>{
let user=await User.findOne({username:req.body.username});
user.coins+=1;
await user.save();
res.json({user});
});

// REWARD
app.post("/reward",async(req,res)=>{
let {username,type}=req.body;
let user=await User.findOne({username});

if(type==="tg"&&!user.telegram){user.coins+=500;user.telegram=true;}
if(type==="tiktok"&&!user.tiktok){user.coins+=1000;user.tiktok=true;}
if(type==="yt"&&!user.youtube){user.coins+=500;user.youtube=true;}

await user.save();
res.json({user});
});

// DEPOSIT
app.post("/deposit",async(req,res)=>{
let {username,amount}=req.body;
let user=await User.findOne({username});
user.deposit+=Number(amount);
await user.save();
res.json({user});
});

// WITHDRAW
app.post("/withdraw",async(req,res)=>{
let {username,amount}=req.body;
let user=await User.findOne({username});

if(user.refs<10 && user.deposit===0)
return res.json({error:"Need 10 referrals"});

if(user.deposit>0 && user.refs<5)
return res.json({error:"Need 5 referrals"});

if(user.coins < amount*100)
return res.json({error:"Not enough coins"});

user.coins-=amount*100;
await user.save();

res.json({message:"Withdraw success"});
});

app.listen(process.env.PORT||3000,()=>console.log("Server running"));

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID || "7154361039";
const SECRET_KEY = process.env.SECRET_KEY || "META_9xK2_secure_2026"; // Make sure this matches frontend

const CHANNEL_ID = "@gangs234";
const GROUP_ID = "@gangs234";

const BOT_USERNAME = "Studybuddy_2025Bot";

const WEB_APP_URL = "https://myapp1-khaki.vercel.app/";

/* ================= BOT ================= */

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

/* ================= DATABASE ================= */

mongoose.connect(MONGO_URL)
.then(()=>{
  console.log("✅ MongoDB Connected");
})
.catch((err)=>{
  console.log(err);
});

/* ================= MODELS ================= */

const User = mongoose.model("User", new mongoose.Schema({
  userId: {
    type: String,
    unique: true
  },
  username: {
    type: String,
    default: ""
  },
  firstName: {
    type: String,
    default: ""
  },
  balance: {
    type: Number,
    default: 0
  },
  refs: {
    type: Number,
    default: 0
  },
  adsWatched: {
    type: Number,
    default: 0
  },
  referredBy: {
    type: String,
    default: null
  },
  lastAdTime: {
    type: Number,
    default: 0
  },
  walletType: {
    type: String,
    default: ""
  },
  walletAddress: {
    type: String,
    default: ""
  },
  pendingWithdrawal: {
    type: Number,
    default: 0
  }
}));

const Withdrawal = mongoose.model("Withdrawal", new mongoose.Schema({
  userId: String,
  amount: Number,
  method: String,
  address: String,
  status: {
    type: String,
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}));

/* ================= SETTINGS ================= */

const MIN_WITHDRAW = 5;
const MIN_REFS = 10;
const MIN_ADS = 500;
const REF_REWARD = 0.1;
const AD_REWARD = 0.03;

/* ================= SAFE USER ================= */

async function getUser(userId, username = "", firstName = "User") {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({
      userId,
      username,
      firstName
    });
  }
  return user;
}

/* ================= FORCE JOIN ================= */

async function checkJoin(userId) {
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    return (
      member.status === "member" ||
      member.status === "administrator" ||
      member.status === "creator"
    );
  } catch (err) {
    return false;
  }
}

/* ================= DAILY POST ================= */

async function sendDailyPost() {
  try {
    const totalUsers = await User.countDocuments();
    const totalWithdraws = await Withdrawal.countDocuments();

    const text = `🔥 DAILY ACTIVITY REPORT 🔥

👥 Total Users: ${totalUsers}

💸 Total Withdrawals: ${totalWithdraws}

📺 Watch Ads & Earn Daily

🚀 Open Mini App:
${WEB_APP_URL}`;

    await bot.sendMessage(CHANNEL_ID, text);
    await bot.sendMessage(GROUP_ID, text);
    console.log("✅ Daily activity sent");
  } catch (err) {
    console.log(err);
  }
}

setInterval(() => {
  sendDailyPost();
}, 24 * 60 * 60 * 1000);

sendDailyPost();

/* ================= SERVER ================= */

app.get("/", (req, res) => {
  res.send("🚀 Meta Pro Earn Running");
});

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    res.json(user);
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= ADS ================= */

app.post("/ads", async (req, res) => {
  try {
    // Check authorization
    if (req.headers.authorization !== SECRET_KEY) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.json({
        success: false,
        message: "User ID required"
      });
    }

    const user = await getUser(userId);
    const now = Date.now();

    if (now - user.lastAdTime < 30000) {
      return res.json({
        success: false,
        message: "Wait 30 seconds between ads"
      });
    }

    user.balance += AD_REWARD;
    user.adsWatched += 1;
    user.lastAdTime = now;
    await user.save();

    res.json({
      success: true,
      balance: user.balance,
      adsWatched: user.adsWatched,
      reward: AD_REWARD
    });
  } catch (err) {
    console.log(err);
    res.json({
      success: false,
      message: err.message
    });
  }
});

/* ================= WITHDRAW REQUEST ================= */

app.post("/withdraw", async (req, res) => {
  try {
    const { userId, amount } = req.body;
    
    if (!userId || !amount) {
      return res.json({
        success: false,
        message: "Missing user ID or amount"
      });
    }

    const user = await getUser(userId);

    if (amount < MIN_WITHDRAW) {
      return res.json({
        success: false,
        message: `Minimum withdraw is ${MIN_WITHDRAW} USDT`
      });
    }

    if (user.balance < amount) {
      return res.json({
        success: false,
        message: "Insufficient balance"
      });
    }

    if (user.refs < MIN_REFS) {
      return res.json({
        success: false,
        message: `Need ${MIN_REFS} referrals. You have ${user.refs}`
      });
    }

    if (user.adsWatched < MIN_ADS) {
      return res.json({
        success: false,
        message: `Watch ${MIN_ADS} ads first. You have watched ${user.adsWatched}`
      });
    }

    user.pendingWithdrawal = amount;
    await user.save();

    // Ask for wallet address via bot
    await bot.sendMessage(
      userId,
      `💰 Withdrawal Request\n\nAmount: ${amount} USDT\n\nPlease send your USDT wallet address here.`
    );

    res.json({
      success: true,
      message: "Please send your wallet address in Telegram"
    });
  } catch (err) {
    console.log(err);
    res.json({
      success: false,
      message: err.message
    });
  }
});

/* ================= START COMMAND ================= */

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  try {
    const id = String(msg.chat.id);
    const username = msg.from.username ? "@" + msg.from.username : "@user" + id;
    const firstName = msg.from.first_name || "User";

    // Check channel join
    const joined = await checkJoin(id);
    if (!joined) {
      return bot.sendMessage(id, "📢 Please join our channel first to use this bot!", {
        reply_markup: {
          inline_keyboard: [[{
            text: "📢 Join Channel",
            url: "https://t.me/gangs234"
          }]]
        }
      });
    }

    // Get or create user
    let user = await User.findOne({ userId: id });
    
    // Handle referral
    const param = match ? match[1] : null;
    let isNewUser = false;
    
    if (!user) {
      // Create new user
      user = await User.create({
        userId: id,
        username: username,
        firstName: firstName
      });
      isNewUser = true;
    }

    // Process referral if exists and user is new
    if (param && param.startsWith("ref_") && isNewUser) {
      const refId = param.replace("ref_", "");
      
      if (refId !== id && !user.referredBy) {
        const refUser = await User.findOne({ userId: refId });
        
        if (refUser) {
          // Set referred by
          user.referredBy = refId;
          await user.save();
          
          // Give reward to referrer
          refUser.refs += 1;
          refUser.balance += REF_REWARD;
          await refUser.save();
          
          // Notify referrer
          bot.sendMessage(refId, `🎉 New referral joined!\n👤 ${firstName}\n💰 +${REF_REWARD} USDT`);
          
          // Notify new user
          bot.sendMessage(id, `🎁 You were referred by ${refUser.firstName || refUser.username || refId}\n💰 You get 0 USDT (referrer gets ${REF_REWARD} USDT)`);
        }
      }
    }

    // Send welcome message
    bot.sendMessage(id, `🔥 WELCOME TO META PRO EARN

👤 ${firstName}
💰 Balance: ${user.balance.toFixed(2)} USDT
👥 Referrals: ${user.refs}
📺 Ads Watched: ${user.adsWatched}

Earn by watching ads daily 🚀`, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🚀 Open App",
            web_app: { url: WEB_APP_URL }
          }],
          [{
            text: "👥 Referrals",
            callback_data: "refs"
          }, {
            text: "💰 Balance",
            callback_data: "balance"
          }],
          [{
            text: "💸 Withdraw",
            callback_data: "withdraw"
          }]
        ]
      }
    });
  } catch (err) {
    console.log(err);
  }
});

/* ================= CALLBACK QUERIES ================= */

bot.on("callback_query", async (query) => {
  try {
    const id = String(query.message.chat.id);
    const user = await User.findOne({ userId: id });
    
    if (!user) return;

    if (query.data === "balance") {
      return bot.answerCallbackQuery(query.id);
      // Already handled by message
    }
    
    if (query.data === "refs") {
      const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${id}`;
      return bot.sendMessage(id, `👥 Your Referrals: ${user.refs}

🔗 Your Referral Link:
${referralLink}

💡 Share this link with friends!
When they join, you get +${REF_REWARD} USDT`);
    }
    
    if (query.data === "withdraw") {
      if (user.balance < MIN_WITHDRAW) {
        return bot.sendMessage(id, `❌ Minimum withdraw is ${MIN_WITHDRAW} USDT\nYour balance: ${user.balance.toFixed(2)} USDT`);
      }
      
      if (user.refs < MIN_REFS) {
        return bot.sendMessage(id, `❌ Need ${MIN_REFS} referrals to withdraw\nYour referrals: ${user.refs}`);
      }
      
      if (user.adsWatched < MIN_ADS) {
        return bot.sendMessage(id, `❌ Need to watch ${MIN_ADS} ads before withdrawing\nAds watched: ${user.adsWatched}`);
      }
      
      return bot.sendMessage(id, `💸 Send the amount you want to withdraw (Min: ${MIN_WITHDRAW} USDT)\nMax: ${user.balance.toFixed(2)} USDT`);
    }
  } catch (err) {
    console.log(err);
  }
});

/* ================= TEXT MESSAGES (Withdraw amount) ================= */

bot.on("message", async (msg) => {
  try {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;
    
    const id = String(msg.chat.id);
    const user = await User.findOne({ userId: id });
    
    if (!user) return;
    
    // Check if user is in withdrawal flow (pending amount means we're waiting for wallet address)
    if (user.pendingWithdrawal > 0) {
      // This is the wallet address
      const amount = user.pendingWithdrawal;
      
      const withdraw = await Withdrawal.create({
        userId: id,
        amount: amount,
        method: "USDT (TRC20)",
        address: msg.text
      });
      
      user.walletAddress = msg.text;
      user.balance -= amount;
      user.pendingWithdrawal = 0;
      await user.save();
      
      // Notify admin
      bot.sendMessage(ADMIN_ID, `💸 NEW WITHDRAWAL REQUEST

👤 User: ${user.firstName}
🆔 ID: ${id}
💰 Amount: ${amount} USDT
📬 Wallet: ${msg.text}
🕐 Time: ${new Date().toLocaleString()}

Approve: /approve_${withdraw._id}
Reject: /reject_${withdraw._id}`);
      
      return bot.sendMessage(id, `✅ Withdrawal request sent!\nAmount: ${amount} USDT\n\nWe'll process it within 24-48 hours.`);
    }
    
    // Check if user is sending withdrawal amount
    const amount = parseFloat(msg.text);
    if (!isNaN(amount) && amount >= MIN_WITHDRAW && amount <= user.balance) {
      if (user.refs < MIN_REFS) {
        return bot.sendMessage(id, `❌ Need ${MIN_REFS} referrals. You have ${user.refs}`);
      }
      
      if (user.adsWatched < MIN_ADS) {
        return bot.sendMessage(id, `❌ Need ${MIN_ADS} ads. You have ${user.adsWatched}`);
      }
      
      user.pendingWithdrawal = amount;
      await user.save();
      
      return bot.sendMessage(id, `📬 Please send your USDT (TRC20) wallet address to receive ${amount} USDT`);
    }
    
    if (!isNaN(amount) && amount > user.balance) {
      return bot.sendMessage(id, `❌ Insufficient balance. Your balance: ${user.balance.toFixed(2)} USDT`);
    }
    
    if (!isNaN(amount) && amount < MIN_WITHDRAW) {
      return bot.sendMessage(id, `❌ Minimum withdrawal is ${MIN_WITHDRAW} USDT`);
    }
  } catch (err) {
    console.log(err);
  }
});

/* ================= ADMIN COMMANDS ================= */

bot.onText(/\/approve_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const withdrawId = match[1];
  const withdraw = await Withdrawal.findById(withdrawId);
  
  if (!withdraw) {
    return bot.sendMessage(ADMIN_ID, "❌ Withdrawal not found");
  }
  
  if (withdraw.status !== "pending") {
    return bot.sendMessage(ADMIN_ID, `⚠️ Already ${withdraw.status}`);
  }
  
  withdraw.status = "approved";
  await withdraw.save();
  
  bot.sendMessage(withdraw.userId, `✅ Withdrawal of ${withdraw.amount} USDT has been APPROVED!\n\nIt will be sent to your wallet shortly.`);
  bot.sendMessage(ADMIN_ID, `✅ Withdrawal ${withdrawId} approved`);
});

bot.onText(/\/reject_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const withdrawId = match[1];
  const withdraw = await Withdrawal.findById(withdrawId);
  
  if (!withdraw) {
    return bot.sendMessage(ADMIN_ID, "❌ Withdrawal not found");
  }
  
  if (withdraw.status !== "pending") {
    return bot.sendMessage(ADMIN_ID, `⚠️ Already ${withdraw.status}`);
  }
  
  withdraw.status = "rejected";
  await withdraw.save();
  
  // Refund user
  const user = await User.findOne({ userId: withdraw.userId });
  if (user) {
    user.balance += withdraw.amount;
    await user.save();
  }
  
  bot.sendMessage(withdraw.userId, `❌ Withdrawal of ${withdraw.amount} USDT has been REJECTED.\n\nAmount has been refunded to your balance.`);
  bot.sendMessage(ADMIN_ID, `❌ Withdrawal ${withdrawId} rejected and refunded`);
});

bot.onText(/\/stats/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const totalUsers = await User.countDocuments();
  const totalWithdrawals = await Withdrawal.countDocuments();
  const approvedWithdrawals = await Withdrawal.countDocuments({ status: "approved" });
  const pendingWithdrawals = await Withdrawal.countDocuments({ status: "pending" });
  const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
  
  bot.sendMessage(ADMIN_ID, `📊 BOT STATISTICS

👥 Total Users: ${totalUsers}
💰 Total User Balance: ${totalBalance[0]?.total?.toFixed(2) || 0} USDT

💸 Withdrawals:
• Total: ${totalWithdrawals}
• Approved: ${approvedWithdrawals}
• Pending: ${pendingWithdrawals}

🎯 Referral Reward: ${REF_REWARD} USDT
📺 Ad Reward: ${AD_REWARD} USDT`);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const message = match[1];
  const users = await User.find({});
  
  let sent = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(user.userId, `📢 ANNOUNCEMENT\n\n${message}`);
      sent++;
    } catch (err) {
      console.log(`Failed to send to ${user.userId}`);
    }
  }
  
  bot.sendMessage(ADMIN_ID, `✅ Broadcast sent to ${sent} users`);
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

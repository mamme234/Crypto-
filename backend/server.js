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
const SECRET_KEY = process.env.SECRET_KEY || "META_9xK2_secure_2026";

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
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch((err) => {
  console.log("❌ MongoDB Error:", err);
});

/* ================= MODELS ================= */

// User Schema with createdAt
const userSchema = new mongoose.Schema({
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
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model("User", userSchema);

const withdrawalSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userFirstName: String,
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
});

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

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

/* ================= DAILY POST WITH BUTTONS ================= */

async function sendDailyPost() {
  try {
    const totalUsers = await User.countDocuments();
    const totalWithdraws = await Withdrawal.countDocuments();
    const pendingWithdraws = await Withdrawal.countDocuments({ status: "pending" });
    const approvedWithdraws = await Withdrawal.countDocuments({ status: "approved" });
    
    // Get today's new users (last 24 hours)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: last24h }
    });
    
    // Get total ads watched
    const totalAdsResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: "$adsWatched" } } }
    ]);
    const totalAds = totalAdsResult[0]?.total || 0;
    
    // Get top 5 earners
    const topEarners = await User.find({})
      .sort({ balance: -1 })
      .limit(5);
    
    let topEarnersText = "";
    if (topEarners.length > 0) {
      topEarnersText = "🏆 TOP EARNERS 🏆\n";
      topEarners.forEach((user, index) => {
        topEarnersText += `${index + 1}. ${user.firstName} - ${user.balance.toFixed(2)} USDT\n`;
      });
    }
    
    // Format message with HTML
    const formattedText = `
<b>🔥 DAILY ACTIVITY REPORT</b>
━━━━━━━━━━━━━━━━━━━━

<b>📊 STATISTICS:</b>
• Total Users: <code>${totalUsers.toLocaleString()}</code>
• New Today: <code>${newUsersToday}</code>
• Total Ads Watched: <code>${totalAds.toLocaleString()}</code>
• Total Withdrawals: <code>${totalWithdraws}</code>
• Approved: <code>${approvedWithdraws}</code>
• Pending: <code>${pendingWithdraws}</code>

<b>💰 REWARDS:</b>
• Per Ad: <code>0.03 USDT</code>
• Per Referral: <code>0.10 USDT</code>

${topEarnersText ? `━━━━━━━━━━━━━━━━━━━━\n${topEarnersText}` : ''}
━━━━━━━━━━━━━━━━━━━━

<b>🚀 Tap the button below to start earning!</b>`;

    // Send to CHANNEL with buttons
    await bot.sendMessage(CHANNEL_ID, formattedText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💸 WATCH ADS & EARN",
              url: `https://t.me/${BOT_USERNAME}?start=earn`
            }
          ],
          [
            {
              text: "👥 INVITE FRIENDS",
              url: `https://t.me/${BOT_USERNAME}?start=invite`
            },
            {
              text: "💰 CHECK BALANCE",
              url: `https://t.me/${BOT_USERNAME}?start=balance`
            }
          ],
          [
            {
              text: "🚀 OPEN MINI APP",
              web_app: { url: WEB_APP_URL }
            }
          ]
        ]
      },
      parse_mode: "HTML"
    });

    // Send to GROUP with buttons
    await bot.sendMessage(GROUP_ID, formattedText, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💸 START EARNING",
              url: `https://t.me/${BOT_USERNAME}?start=earn`
            }
          ],
          [
            {
              text: "👥 REFERRAL",
              url: `https://t.me/${BOT_USERNAME}?start=ref`
            }
          ]
        ]
      },
      parse_mode: "HTML"
    });

    console.log("✅ Daily post sent at:", new Date().toLocaleString());
    
  } catch (err) {
    console.log("Daily post error:", err);
  }
}

// Schedule daily post at 9:00 AM every day
function scheduleDailyPost() {
  const now = new Date();
  const next9AM = new Date();
  next9AM.setHours(9, 0, 0, 0);
  
  if (now >= next9AM) {
    next9AM.setDate(next9AM.getDate() + 1);
  }
  
  const timeUntil9AM = next9AM - now;
  
  setTimeout(() => {
    sendDailyPost();
    // Then schedule every 24 hours
    setInterval(sendDailyPost, 24 * 60 * 60 * 1000);
  }, timeUntil9AM);
  
  console.log(`📅 Daily post scheduled for ${next9AM.toLocaleString()}`);
}

// Start scheduling
scheduleDailyPost();

// Send one immediately on startup (optional - comment if not needed)
// setTimeout(() => sendDailyPost(), 5000);

/* ================= SERVER ================= */

app.get("/", (req, res) => {
  res.json({
    status: "🚀 Meta Pro Earn Running",
    time: new Date().toISOString(),
    bot: BOT_USERNAME
  });
});

/* ================= PROFILE ================= */

app.get("/profile/:id", async (req, res) => {
  try {
    const user = await getUser(req.params.id);
    res.json({
      userId: user.userId,
      balance: user.balance,
      refs: user.refs,
      adsWatched: user.adsWatched,
      firstName: user.firstName,
      username: user.username
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= ADS ================= */

app.post("/ads", async (req, res) => {
  try {
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
    const { userId, amount, walletAddress } = req.body;
    
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

    if (!walletAddress) {
      return res.json({
        success: false,
        message: "Wallet address required"
      });
    }

    // Create withdrawal request
    const withdraw = await Withdrawal.create({
      userId: userId,
      userName: user.username,
      userFirstName: user.firstName,
      amount: amount,
      method: "USDT (TRC20)",
      address: walletAddress,
      status: "pending"
    });

    // Deduct from user balance
    user.balance -= amount;
    await user.save();

    // Send to admin for approval
    const adminMessage = `💸 NEW WITHDRAWAL REQUEST

━━━━━━━━━━━━━━━━━━━━
👤 User: ${user.firstName}
🆔 ID: ${userId}
📛 Username: ${user.username}
💰 Amount: ${amount} USDT
📬 Wallet: ${walletAddress}
🕐 Time: ${new Date().toLocaleString()}
📊 Balance After: ${user.balance.toFixed(2)} USDT
━━━━━━━━━━━━━━━━━━━━

✅ Approve: /approve_${withdraw._id}
❌ Reject: /reject_${withdraw._id}`;

    await bot.sendMessage(ADMIN_ID, adminMessage);

    // Send confirmation to user
    await bot.sendMessage(userId, `✅ Withdrawal request submitted successfully!

📊 Amount: ${amount} USDT
📬 Wallet: ${walletAddress}
⏳ Status: Pending Approval

Your request will be processed within 24-48 hours.
You will be notified once approved/rejected.`);

    res.json({
      success: true,
      message: "Withdrawal request submitted for admin approval"
    });

  } catch (err) {
    console.log(err);
    res.json({
      success: false,
      message: err.message
    });
  }
});

/* ================= GET PENDING WITHDRAWALS (Admin API) ================= */

app.get("/admin/withdrawals", async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader !== SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const pending = await Withdrawal.find({ status: "pending" }).sort({ createdAt: -1 });
    const approved = await Withdrawal.find({ status: "approved" }).sort({ createdAt: -1 }).limit(20);
    const rejected = await Withdrawal.find({ status: "rejected" }).sort({ createdAt: -1 }).limit(20);
    
    res.json({
      pending,
      approved,
      rejected
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================= BOT: START COMMAND ================= */

bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  try {
    const id = String(msg.chat.id);
    const username = msg.from.username ? "@" + msg.from.username : "No username";
    const firstName = msg.from.first_name || "User";
    const param = match ? match[1] : null;

    // Handle different start parameters from buttons
    if (param === "earn") {
      return bot.sendMessage(id, "💰 Ready to earn USDT?\n\nOpen the app below and start watching ads!", {
        reply_markup: {
          inline_keyboard: [[{
            text: "🚀 OPEN EARN APP",
            web_app: { url: WEB_APP_URL }
          }]]
        }
      });
    }
    
    if (param === "invite" || param === "ref") {
      const user = await User.findOne({ userId: id });
      const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${id}`;
      return bot.sendMessage(id, `👥 INVITE FRIENDS & EARN

You get ${REF_REWARD} USDT per referral!

🔗 Your Referral Link:
${referralLink}

👥 Current Referrals: ${user?.refs || 0}

Share the link with your friends!`, {
        reply_markup: {
          inline_keyboard: [[{
            text: "📤 SHARE LINK",
            url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20Meta%20Pro%20Earn%20and%20earn%20USDT%20by%20watching%20ads!`
          }]]
        }
      });
    }
    
    if (param === "balance") {
      const user = await User.findOne({ userId: id });
      if (!user) {
        // Create user if doesn't exist
        await getUser(id, username, firstName);
      }
      return bot.sendMessage(id, `💰 YOUR BALANCE

Current Balance: ${user?.balance?.toFixed(2) || 0} USDT
Referrals: ${user?.refs || 0}
Ads Watched: ${user?.adsWatched || 0}

Keep watching ads to earn more!`);
    }

    // Check channel join for regular start
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
    let isNewUser = false;
    
    if (!user) {
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
          user.referredBy = refId;
          await user.save();
          
          refUser.refs += 1;
          refUser.balance += REF_REWARD;
          await refUser.save();
          
          await bot.sendMessage(refId, `🎉 New referral joined!\n👤 ${firstName}\n💰 +${REF_REWARD} USDT`);
          await bot.sendMessage(id, `🎁 You were referred by ${refUser.firstName}\n💰 You get 0 USDT (referrer gets ${REF_REWARD} USDT)`);
        }
      }
    }

    // Send welcome message
    await bot.sendMessage(id, `🔥 WELCOME TO META PRO EARN

👤 ${firstName}
💰 Balance: ${user.balance.toFixed(2)} USDT
👥 Referrals: ${user.refs}
📺 Ads Watched: ${user.adsWatched}

Earn by watching ads daily 🚀`, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "🚀 OPEN APP",
            web_app: { url: WEB_APP_URL }
          }],
          [{
            text: "👥 REFERRALS",
            callback_data: "refs"
          }, {
            text: "💰 BALANCE",
            callback_data: "balance"
          }],
          [{
            text: "💸 WITHDRAW",
            callback_data: "withdraw"
          }]
        ]
      }
    });
  } catch (err) {
    console.log("Start error:", err);
  }
});

/* ================= BOT: CALLBACK QUERIES ================= */

bot.on("callback_query", async (query) => {
  try {
    const id = String(query.message.chat.id);
    const user = await User.findOne({ userId: id });
    
    if (!user) return;

    if (query.data === "balance") {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(id, `💰 Your Balance: ${user.balance.toFixed(2)} USDT\n👥 Referrals: ${user.refs}\n📺 Ads: ${user.adsWatched}`);
    }
    
    if (query.data === "refs") {
      const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${id}`;
      await bot.sendMessage(id, `👥 Your Referrals: ${user.refs}

🔗 Your Referral Link:
${referralLink}

💡 Share this link with friends!
When they join, you get +${REF_REWARD} USDT`, {
        reply_markup: {
          inline_keyboard: [[{
            text: "📤 SHARE LINK",
            url: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20Meta%20Pro%20Earn%20and%20earn%20USDT%20by%20watching%20ads!`
          }]]
        }
      });
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
      
      await bot.sendMessage(id, `💸 WITHDRAWAL REQUEST

Enter your withdrawal amount (Min: ${MIN_WITHDRAW} USDT)
Max: ${user.balance.toFixed(2)} USDT

Send the amount as a message.`);
    }
  } catch (err) {
    console.log("Callback error:", err);
  }
});

/* ================= BOT: TEXT MESSAGES ================= */

let userWithdrawState = new Map();

bot.on("message", async (msg) => {
  try {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;
    
    const id = String(msg.chat.id);
    const user = await User.findOne({ userId: id });
    
    if (!user) return;
    
    const state = userWithdrawState.get(id);
    
    if (state && state.step === 'amount') {
      const amount = parseFloat(msg.text);
      
      if (isNaN(amount) || amount < MIN_WITHDRAW) {
        await bot.sendMessage(id, `❌ Invalid amount. Minimum withdraw is ${MIN_WITHDRAW} USDT`);
        userWithdrawState.delete(id);
        return;
      }
      
      if (amount > user.balance) {
        await bot.sendMessage(id, `❌ Insufficient balance. Your balance: ${user.balance.toFixed(2)} USDT`);
        userWithdrawState.delete(id);
        return;
      }
      
      if (user.refs < MIN_REFS) {
        await bot.sendMessage(id, `❌ Need ${MIN_REFS} referrals. You have ${user.refs}`);
        userWithdrawState.delete(id);
        return;
      }
      
      if (user.adsWatched < MIN_ADS) {
        await bot.sendMessage(id, `❌ Need ${MIN_ADS} ads. You have ${user.adsWatched}`);
        userWithdrawState.delete(id);
        return;
      }
      
      userWithdrawState.set(id, { step: 'wallet', amount: amount });
      await bot.sendMessage(id, `📬 Amount: ${amount} USDT\n\nNow please send your USDT (TRC20) wallet address.`);
      
    } else if (state && state.step === 'wallet') {
      const walletAddress = msg.text.trim();
      const amount = state.amount;
      
      if (!walletAddress || (!walletAddress.startsWith('T') && !walletAddress.startsWith('0x'))) {
        await bot.sendMessage(id, `❌ Invalid wallet address. Please send a valid USDT (TRC20) address starting with 'T' or '0x'`);
        return;
      }
      
      const withdraw = await Withdrawal.create({
        userId: id,
        userName: user.username,
        userFirstName: user.firstName,
        amount: amount,
        method: "USDT (TRC20)",
        address: walletAddress,
        status: "pending"
      });
      
      user.balance -= amount;
      await user.save();
      userWithdrawState.delete(id);
      
      const adminMessage = `💸 NEW WITHDRAWAL REQUEST

━━━━━━━━━━━━━━━━━━━━
👤 User: ${user.firstName}
🆔 ID: ${id}
💰 Amount: ${amount} USDT
📬 Wallet: ${walletAddress}
🕐 Time: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━

✅ Approve: /approve_${withdraw._id}
❌ Reject: /reject_${withdraw._id}`;
      
      await bot.sendMessage(ADMIN_ID, adminMessage);
      await bot.sendMessage(id, `✅ Withdrawal request submitted!\n💰 Amount: ${amount} USDT\n⏳ Status: Pending Approval`);
      
    } else {
      const amount = parseFloat(msg.text);
      if (!isNaN(amount) && amount >= MIN_WITHDRAW && amount <= user.balance) {
        if (user.refs >= MIN_REFS && user.adsWatched >= MIN_ADS) {
          userWithdrawState.set(id, { step: 'wallet', amount: amount });
          await bot.sendMessage(id, `📬 Amount: ${amount} USDT\n\nNow please send your USDT (TRC20) wallet address.`);
        } else {
          await bot.sendMessage(id, `❌ You don't meet withdrawal requirements.\n\nReferrals: ${user.refs}/${MIN_REFS}\nAds Watched: ${user.adsWatched}/${MIN_ADS}`);
        }
      }
    }
  } catch (err) {
    console.log("Message error:", err);
  }
});

/* ================= ADMIN: APPROVE WITHDRAWAL ================= */

bot.onText(/\/approve_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) {
    return;
  }
  
  const withdrawId = match[1];
  const withdraw = await Withdrawal.findById(withdrawId);
  
  if (!withdraw) {
    return bot.sendMessage(ADMIN_ID, "❌ Withdrawal request not found");
  }
  
  if (withdraw.status !== "pending") {
    return bot.sendMessage(ADMIN_ID, `⚠️ This withdrawal is already ${withdraw.status}`);
  }
  
  withdraw.status = "approved";
  await withdraw.save();
  
  await bot.sendMessage(withdraw.userId, `✅ WITHDRAWAL APPROVED! 🎉

💰 Amount: ${withdraw.amount} USDT
📬 Wallet: ${withdraw.address}

Funds will be sent to your wallet shortly.`);
  
  await bot.sendMessage(ADMIN_ID, `✅ Withdrawal approved!\nUser: ${withdraw.userFirstName}\nAmount: ${withdraw.amount} USDT`);
});

/* ================= ADMIN: REJECT WITHDRAWAL ================= */

bot.onText(/\/reject_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) {
    return;
  }
  
  const withdrawId = match[1];
  const withdraw = await Withdrawal.findById(withdrawId);
  
  if (!withdraw) {
    return bot.sendMessage(ADMIN_ID, "❌ Withdrawal request not found");
  }
  
  if (withdraw.status !== "pending") {
    return bot.sendMessage(ADMIN_ID, `⚠️ This withdrawal is already ${withdraw.status}`);
  }
  
  withdraw.status = "rejected";
  await withdraw.save();
  
  const user = await User.findOne({ userId: withdraw.userId });
  if (user) {
    user.balance += withdraw.amount;
    await user.save();
  }
  
  await bot.sendMessage(withdraw.userId, `❌ WITHDRAWAL REJECTED

💰 Amount: ${withdraw.amount} USDT has been refunded to your balance.`);
  
  await bot.sendMessage(ADMIN_ID, `❌ Withdrawal rejected!\nUser: ${withdraw.userFirstName}\nAmount: ${withdraw.amount} USDT (Refunded)`);
});

/* ================= ADMIN: STATS COMMAND ================= */

bot.onText(/\/stats/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const totalUsers = await User.countDocuments();
  const totalWithdrawals = await Withdrawal.countDocuments();
  const pendingWithdrawals = await Withdrawal.countDocuments({ status: "pending" });
  const approvedWithdrawals = await Withdrawal.countDocuments({ status: "approved" });
  const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
  const totalAds = await User.aggregate([{ $group: { _id: null, total: { $sum: "$adsWatched" } } }]);
  
  await bot.sendMessage(ADMIN_ID, `📊 BOT STATISTICS

👥 Total Users: ${totalUsers}
💰 Total Balance: ${totalBalance[0]?.total?.toFixed(2) || 0} USDT
📺 Total Ads Watched: ${totalAds[0]?.total || 0}

💸 Withdrawals:
• Total: ${totalWithdrawals}
• Approved: ${approvedWithdrawals}
• Pending: ${pendingWithdrawals}

🎯 Reward Rates:
• Ad Reward: ${AD_REWARD} USDT
• Referral Reward: ${REF_REWARD} USDT`);
});

/* ================= ADMIN: PENDING WITHDRAWALS ================= */

bot.onText(/\/pending/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const pending = await Withdrawal.find({ status: "pending" }).sort({ createdAt: -1 });
  
  if (pending.length === 0) {
    return bot.sendMessage(ADMIN_ID, "📭 No pending withdrawals.");
  }
  
  let message = `📋 PENDING WITHDRAWALS (${pending.length})\n\n`;
  
  for (let i = 0; i < Math.min(pending.length, 10); i++) {
    const w = pending[i];
    message += `${i+1}. ${w.userFirstName}\n`;
    message += `   💰 ${w.amount} USDT\n`;
    message += `   🕐 ${w.createdAt.toLocaleString()}\n`;
    message += `   /approve_${w._id} | /reject_${w._id}\n\n`;
  }
  
  await bot.sendMessage(ADMIN_ID, message);
});

/* ================= ADMIN: BROADCAST ================= */

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const message = match[1];
  const users = await User.find({});
  
  let sent = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      await bot.sendMessage(user.userId, `📢 ANNOUNCEMENT\n\n${message}`);
      sent++;
    } catch (err) {
      failed++;
    }
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  await bot.sendMessage(ADMIN_ID, `✅ Broadcast sent!\n📤 Sent: ${sent}\n❌ Failed: ${failed}`);
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`📅 Daily post scheduled`);
});

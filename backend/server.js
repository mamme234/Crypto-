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

const WEB_APP_URL = "https://your-miniapp-url.vercel.app/";

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

// User Schema
const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  username: { type: String, default: "" },
  firstName: { type: String, default: "" },
  balance: { type: Number, default: 0 },
  refs: { type: Number, default: 0 },
  adsWatched: { type: Number, default: 0 },
  referredBy: { type: String, default: null },
  lastAdTime: { type: Number, default: 0 },
  walletType: { type: String, default: "" },
  walletAddress: { type: String, default: "" },
  pendingWithdrawal: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastPostReceived: { type: Date, default: null } // Track when user last got a post
});

const User = mongoose.model("User", userSchema);

// Withdrawal Schema
const withdrawalSchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userFirstName: String,
  amount: Number,
  method: String,
  address: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);

/* ================= SETTINGS ================= */

const MIN_WITHDRAW = 5;
const MIN_REFS = 10;
const MIN_ADS = 500;
const REF_REWARD = 0.1;
const AD_REWARD = 0.03;
const POST_INTERVAL_HOURS = 5; // POST EVERY 5 HOURS

/* ================= HELPER FUNCTIONS ================= */

async function getUser(userId, username = "", firstName = "User") {
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId, username, firstName });
  }
  return user;
}

async function checkJoin(userId) {
  try {
    const member = await bot.getChatMember(CHANNEL_ID, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (err) {
    return false;
  }
}

/* ================= SEND POST TO SINGLE USER ================= */

async function sendPostToUser(user) {
  try {
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${user.userId}`;
    
    const message = `🔥 META PRO EARN - EARNING OPPORTUNITY 🔥

━━━━━━━━━━━━━━━━━━━━
💰 Your Stats:
• Balance: ${user.balance.toFixed(2)} USDT
• Referrals: ${user.refs}
• Ads Watched: ${user.adsWatched}
━━━━━━━━━━━━━━━━━━━━

🎯 EARN MORE:
• Watch Ads: +0.03 USDT each
• Invite Friends: +0.10 USDT per referral
• No limits, no hidden fees!

🚀 Ready to earn? Tap the button below!`;

    await bot.sendMessage(user.userId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 START EARNING NOW", web_app: { url: WEB_APP_URL } }],
          [{ text: "👥 INVITE FRIENDS", url: referralLink }],
          [{ text: "💰 CHECK BALANCE", callback_data: "balance" }]
        ]
      },
      parse_mode: "HTML"
    });
    
    // Update last post time
    user.lastPostReceived = new Date();
    await user.save();
    
    console.log(`✅ Post sent to ${user.firstName} (${user.userId})`);
    return true;
  } catch (err) {
    console.log(`❌ Failed to send post to ${user.userId}:`, err.message);
    return false;
  }
}

/* ================= SEND POSTS TO ALL USERS (EVERY 5 HOURS) ================= */

async function sendPostsToAllUsers() {
  console.log(`\n📢 [${new Date().toLocaleString()}] Starting 5-hour broadcast to all users...`);
  
  try {
    // Get all users
    const users = await User.find({});
    console.log(`📊 Total users: ${users.length}`);
    
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      
      // Check if user should receive post (every 5 hours)
      const shouldSend = !user.lastPostReceived || 
        (new Date() - user.lastPostReceived) >= (POST_INTERVAL_HOURS * 60 * 60 * 1000);
      
      if (!shouldSend) {
        skipped++;
        continue;
      }
      
      // Send post with delay between users to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const success = await sendPostToUser(user);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }
    
    console.log(`📊 Broadcast complete! Sent: ${sent}, Failed: ${failed}, Skipped (recent): ${skipped}`);
    
    // Also send to channel and group
    await sendToChannelAndGroup();
    
  } catch (err) {
    console.log("Broadcast error:", err);
  }
}

/* ================= SEND TO CHANNEL & GROUP ================= */

async function sendToChannelAndGroup() {
  try {
    const totalUsers = await User.countDocuments();
    const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
    const totalAds = await User.aggregate([{ $group: { _id: null, total: { $sum: "$adsWatched" } } }]);
    
    const channelMessage = `🔥 META PRO EARN - DAILY UPDATE 🔥

━━━━━━━━━━━━━━━━━━━━
📊 GLOBAL STATS:
• Total Users: ${totalUsers.toLocaleString()}
• Total Ads Watched: ${(totalAds[0]?.total || 0).toLocaleString()}
• Total Balance: ${(totalBalance[0]?.total || 0).toFixed(2)} USDT
━━━━━━━━━━━━━━━━━━━━

💰 EARN RATES:
• Per Ad: 0.03 USDT
• Per Referral: 0.10 USDT

🚀 Open the app and start earning!`;

    await bot.sendMessage(CHANNEL_ID, channelMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💸 START EARNING", url: `https://t.me/${BOT_USERNAME}?start=earn` }],
          [{ text: "🚀 OPEN MINI APP", web_app: { url: WEB_APP_URL } }]
        ]
      }
    });
    
    await bot.sendMessage(GROUP_ID, `🔥 New earning opportunities available! Open the app to earn USDT!`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 START EARNING", web_app: { url: WEB_APP_URL } }]
        ]
      }
    });
    
    console.log("✅ Channel and group messages sent");
  } catch (err) {
    console.log("Channel/group message error:", err);
  }
}

/* ================= SCHEDULE 5-HOUR POSTS ================= */

// Start the interval - runs every 5 hours
function startFiveHourBroadcast() {
  // Run immediately on startup
  setTimeout(() => {
    sendPostsToAllUsers();
  }, 5000); // Wait 5 seconds after server starts
  
  // Then schedule every 5 hours
  setInterval(sendPostsToAllUsers, POST_INTERVAL_HOURS * 60 * 60 * 1000);
  
  console.log(`⏰ 5-hour broadcast scheduled! Next: ${new Date(Date.now() + POST_INTERVAL_HOURS * 60 * 60 * 1000).toLocaleString()}`);
}

/* ================= API ENDPOINTS ================= */

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "🚀 Meta Pro Earn Running",
    time: new Date().toISOString(),
    bot: BOT_USERNAME,
    broadcastInterval: `${POST_INTERVAL_HOURS} hours`
  });
});

// Register user (with referral)
app.post("/register", async (req, res) => {
  try {
    const { userId, tgName, firstName, referredBy } = req.body;
    
    let user = await User.findOne({ userId });
    
    if (!user) {
      user = await User.create({
        userId,
        username: tgName,
        firstName: firstName || "User"
      });
      
      // Handle referral
      if (referredBy && referredBy !== userId) {
        const referrer = await User.findOne({ userId: referredBy });
        if (referrer && !user.referredBy) {
          user.referredBy = referredBy;
          await user.save();
        }
      }
    }
    
    res.json({
      success: true,
      referralCode: userId,
      user: {
        userId: user.userId,
        balance: user.balance,
        refs: user.refs,
        adsWatched: user.adsWatched
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get profile
app.get("/profile/:userId", async (req, res) => {
  try {
    const user = await getUser(req.params.userId);
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

// Complete ad watch - GIVE REWARD
app.post("/ads", async (req, res) => {
  try {
    if (req.headers.authorization !== SECRET_KEY) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.json({ success: false, message: "User ID required" });
    }

    const user = await getUser(userId);
    const now = Date.now();

    // 30 second cooldown between ads
    if (now - user.lastAdTime < 30000) {
      return res.json({
        success: false,
        message: "Wait 30 seconds between ads"
      });
    }

    // GIVE REWARD
    user.balance += AD_REWARD;
    user.adsWatched += 1;
    user.lastAdTime = now;
    
    // Check if this is first ad - give referral bonus to referrer
    const isFirstAd = user.adsWatched === 1;
    
    await user.save();

    // Give referral bonus to referrer if this is first ad
    if (isFirstAd && user.referredBy) {
      const referrer = await User.findOne({ userId: user.referredBy });
      if (referrer) {
        referrer.balance += REF_REWARD;
        referrer.refs += 1;
        await referrer.save();
        
        // Notify referrer
        try {
          await bot.sendMessage(referrer.userId, `🎉 Your referral ${user.firstName} watched their first ad!\n💰 +${REF_REWARD} USDT added!`);
        } catch(e) { console.log("Could not notify referrer"); }
      }
    }

    res.json({
      success: true,
      balance: user.balance,
      adsWatched: user.adsWatched,
      reward: AD_REWARD,
      isFirstAd: isFirstAd
    });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: err.message });
  }
});

// Request withdrawal
app.post("/withdraw", async (req, res) => {
  try {
    const { userId, amount, walletAddress } = req.body;
    
    if (!userId || !amount) {
      return res.json({ success: false, message: "Missing user ID or amount" });
    }

    const user = await getUser(userId);

    if (amount < MIN_WITHDRAW) {
      return res.json({ success: false, message: `Minimum withdraw is ${MIN_WITHDRAW} USDT` });
    }

    if (user.balance < amount) {
      return res.json({ success: false, message: "Insufficient balance" });
    }

    if (user.refs < MIN_REFS) {
      return res.json({ success: false, message: `Need ${MIN_REFS} referrals. You have ${user.refs}` });
    }

    if (user.adsWatched < MIN_ADS) {
      return res.json({ success: false, message: `Watch ${MIN_ADS} ads first. You have watched ${user.adsWatched}` });
    }

    if (!walletAddress) {
      return res.json({ success: false, message: "Wallet address required" });
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

    // Send to admin
    const adminMessage = `💸 NEW WITHDRAWAL REQUEST\n\n👤 User: ${user.firstName}\n🆔 ID: ${userId}\n💰 Amount: ${amount} USDT\n📬 Wallet: ${walletAddress}\n\n✅ /approve_${withdraw._id}\n❌ /reject_${withdraw._id}`;
    await bot.sendMessage(ADMIN_ID, adminMessage);

    // Confirm to user
    await bot.sendMessage(userId, `✅ Withdrawal request submitted!\n💰 Amount: ${amount} USDT\n⏳ Status: Pending Approval`);

    res.json({ success: true, message: "Withdrawal request submitted" });
  } catch (err) {
    console.log(err);
    res.json({ success: false, message: err.message });
  }
});

/* ================= TELEGRAM BOT COMMANDS ================= */

// Start command
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  try {
    const id = String(msg.chat.id);
    const username = msg.from.username ? "@" + msg.from.username : "";
    const firstName = msg.from.first_name || "User";
    const param = match ? match[1] : null;

    // Check channel join
    const joined = await checkJoin(id);
    if (!joined) {
      return bot.sendMessage(id, "📢 Please join our channel first to use this bot!", {
        reply_markup: {
          inline_keyboard: [[{ text: "📢 Join Channel", url: "https://t.me/gangs234" }]]
        }
      });
    }

    // Get or create user
    let user = await User.findOne({ userId: id });
    let isNewUser = false;
    
    if (!user) {
      user = await User.create({ userId: id, username, firstName });
      isNewUser = true;
    }

    // Process referral
    if (param && param.startsWith("ref_") && isNewUser) {
      const refId = param.replace("ref_", "");
      if (refId !== id && !user.referredBy) {
        user.referredBy = refId;
        await user.save();
        await bot.sendMessage(id, `🎁 You were referred! Watch your first ad to help your referrer earn a bonus!`);
      }
    }

    // Send welcome message
    await bot.sendMessage(id, `🔥 WELCOME TO META PRO EARN\n\n👤 ${firstName}\n💰 Balance: ${user.balance.toFixed(2)} USDT\n👥 Referrals: ${user.refs}\n📺 Ads: ${user.adsWatched}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 OPEN APP", web_app: { url: WEB_APP_URL } }],
          [{ text: "👥 Referrals", callback_data: "refs" }, { text: "💰 Balance", callback_data: "balance" }],
          [{ text: "💸 Withdraw", callback_data: "withdraw" }]
        ]
      }
    });
  } catch (err) {
    console.log("Start error:", err);
  }
});

// Callback queries
bot.on("callback_query", async (query) => {
  const id = String(query.message.chat.id);
  const user = await User.findOne({ userId: id });
  if (!user) return;

  if (query.data === "balance") {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(id, `💰 Balance: ${user.balance.toFixed(2)} USDT\n👥 Referrals: ${user.refs}\n📺 Ads: ${user.adsWatched}`);
  }
  
  if (query.data === "refs") {
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${id}`;
    await bot.sendMessage(id, `👥 Your Referrals: ${user.refs}\n\n🔗 ${referralLink}\n\nShare this link! When they watch their first ad, you get +${REF_REWARD} USDT`);
  }
  
  if (query.data === "withdraw") {
    if (user.balance < MIN_WITHDRAW) {
      return bot.sendMessage(id, `❌ Min withdraw: ${MIN_WITHDRAW} USDT\nYour balance: ${user.balance.toFixed(2)} USDT`);
    }
    if (user.refs < MIN_REFS) {
      return bot.sendMessage(id, `❌ Need ${MIN_REFS} referrals (you have ${user.refs})`);
    }
    if (user.adsWatched < MIN_ADS) {
      return bot.sendMessage(id, `❌ Need ${MIN_ADS} ads (you have ${user.adsWatched})`);
    }
    await bot.sendMessage(id, `💸 Send amount (Min: ${MIN_WITHDRAW} USDT, Max: ${user.balance.toFixed(2)} USDT)`);
    
    user.pendingWithdrawal = 1;
    await user.save();
  }
});

// Handle withdrawal amount
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  
  const id = String(msg.chat.id);
  const user = await User.findOne({ userId: id });
  if (!user || user.pendingWithdrawal !== 1) return;
  
  const amount = parseFloat(msg.text);
  if (isNaN(amount)) {
    return bot.sendMessage(id, "❌ Please send a valid number for withdrawal amount.");
  }
  
  if (amount < MIN_WITHDRAW) {
    return bot.sendMessage(id, `❌ Minimum withdrawal is ${MIN_WITHDRAW} USDT`);
  }
  
  if (amount > user.balance) {
    return bot.sendMessage(id, `❌ Insufficient balance. You have ${user.balance.toFixed(2)} USDT`);
  }
  
  user.pendingWithdrawal = 2;
  user.pendingAmount = amount;
  await user.save();
  
  await bot.sendMessage(id, `📬 Amount: ${amount} USDT\n\nNow please send your USDT (TRC20) wallet address.`);
});

// Handle wallet address
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;
  
  const id = String(msg.chat.id);
  const user = await User.findOne({ userId: id });
  if (!user || user.pendingWithdrawal !== 2) return;
  
  const walletAddress = msg.text.trim();
  const amount = user.pendingAmount;
  
  if (!walletAddress || (!walletAddress.startsWith('T') && !walletAddress.startsWith('0x'))) {
    return bot.sendMessage(id, "❌ Invalid wallet address. Send a valid USDT (TRC20) address starting with 'T'");
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
  user.pendingWithdrawal = 0;
  user.pendingAmount = null;
  await user.save();
  
  const adminMessage = `💸 WITHDRAWAL REQUEST\n\n👤 ${user.firstName}\n💰 ${amount} USDT\n📬 ${walletAddress}\n\n/approve_${withdraw._id} | /reject_${withdraw._id}`;
  await bot.sendMessage(ADMIN_ID, adminMessage);
  await bot.sendMessage(id, `✅ Withdrawal request submitted!\n💰 ${amount} USDT\n⏳ Pending approval`);
});

// Admin: Approve withdrawal
bot.onText(/\/approve_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const withdraw = await Withdrawal.findById(match[1]);
  if (!withdraw) return bot.sendMessage(ADMIN_ID, "Not found");
  
  if (withdraw.status !== "pending") return bot.sendMessage(ADMIN_ID, `Already ${withdraw.status}`);
  
  withdraw.status = "approved";
  await withdraw.save();
  
  await bot.sendMessage(withdraw.userId, `✅ WITHDRAWAL APPROVED!\n💰 ${withdraw.amount} USDT\nFunds will be sent shortly.`);
  await bot.sendMessage(ADMIN_ID, `✅ Approved ${withdraw.amount} USDT to ${withdraw.userFirstName}`);
});

// Admin: Reject withdrawal
bot.onText(/\/reject_(.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const withdraw = await Withdrawal.findById(match[1]);
  if (!withdraw) return bot.sendMessage(ADMIN_ID, "Not found");
  
  if (withdraw.status !== "pending") return bot.sendMessage(ADMIN_ID, `Already ${withdraw.status}`);
  
  withdraw.status = "rejected";
  await withdraw.save();
  
  const user = await User.findOne({ userId: withdraw.userId });
  if (user) {
    user.balance += withdraw.amount;
    await user.save();
  }
  
  await bot.sendMessage(withdraw.userId, `❌ WITHDRAWAL REJECTED\n💰 ${withdraw.amount} USDT refunded.`);
  await bot.sendMessage(ADMIN_ID, `❌ Rejected ${withdraw.amount} USDT to ${withdraw.userFirstName}`);
});

// Admin: Manual broadcast command
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const message = match[1];
  const users = await User.find({});
  
  let sent = 0;
  for (const user of users) {
    try {
      await bot.sendMessage(user.userId, `📢 ANNOUNCEMENT\n\n${message}`);
      sent++;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch(e) {}
  }
  
  await bot.sendMessage(ADMIN_ID, `✅ Broadcast sent to ${sent} users`);
});

// Admin: Stats command
bot.onText(/\/stats/, async (msg) => {
  if (String(msg.chat.id) !== String(ADMIN_ID)) return;
  
  const totalUsers = await User.countDocuments();
  const totalBalance = await User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]);
  const totalAds = await User.aggregate([{ $group: { _id: null, total: { $sum: "$adsWatched" } } }]);
  const pendingWithdrawals = await Withdrawal.countDocuments({ status: "pending" });
  
  await bot.sendMessage(ADMIN_ID, `📊 STATS\n\nUsers: ${totalUsers}\nBalance: ${(totalBalance[0]?.total || 0).toFixed(2)} USDT\nAds: ${totalAds[0]?.total || 0}\nPending: ${pendingWithdrawals}\n\n📡 Broadcast interval: ${POST_INTERVAL_HOURS} hours`);
});

/* ================= START SERVER ================= */

// Start the 5-hour broadcast
startFiveHourBroadcast();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`⏰ Broadcasting to users every ${POST_INTERVAL_HOURS} hours`);
});

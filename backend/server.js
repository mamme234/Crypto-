// ==================== SERVER.JS - COMPLETE BACKEND ====================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const TelegramBot = require('node-telegram-bot-api');
const socketIO = require('socket.io');
const http = require('http');
const axios = require('axios');
const moment = require('moment');
const crypto = require('crypto');
const cron = require('node-cron');
const winston = require('winston');

// ==================== CONFIGURATION ====================
const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGODB_URI;

// ==================== LOGGER ====================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

// ==================== MIDDLEWARE ====================
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// ==================== DATABASE ====================
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    logger.info('✅ MongoDB Connected');
    console.log('✅ MongoDB Connected');
}).catch(err => {
    logger.error('❌ MongoDB Error:', err);
    console.error('❌ MongoDB Error:', err);
});

// ==================== MODELS ====================

// User Model
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, unique: true, required: true },
    username: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    avatar: { type: String },
    phoneNumber: { type: String },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now },
    lastStreakDate: { type: Date },
    joinDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    isBanned: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    referralCode: { type: String, unique: true },
    referredBy: { type: String },
    devices: [{ type: String }],
    ipAddresses: [{ type: String }],
    totalAdsWatched: { type: Number, default: 0 },
    dailyAdsWatched: { type: Number, default: 0 },
    lastAdWatch: { type: Date },
    achievements: [{
        id: String,
        name: String,
        unlockedAt: { type: Date, default: Date.now }
    }],
    settings: {
        darkMode: { type: Boolean, default: true },
        hapticFeedback: { type: Boolean, default: true },
        soundEffects: { type: Boolean, default: true },
        notifications: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Wallet Model
const WalletSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    bonusEarnings: { type: Number, default: 0 },
    adEarnings: { type: Number, default: 0 },
    currency: { type: String, default: 'USDT' },
    lastUpdated: { type: Date, default: Date.now }
});

// Transaction Model
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['ad_reward', 'referral_bonus', 'daily_bonus', 'spin_win', 
               'task_complete', 'mystery_box', 'withdrawal', 'promo_code',
               'achievement', 'event_bonus', 'admin_adjustment'],
        required: true 
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number },
    description: { type: String },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    metadata: { type: Object },
    createdAt: { type: Date, default: Date.now }
});

// Referral Model
const ReferralSchema = new mongoose.Schema({
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referredId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referralCode: { type: String, required: true },
    status: { type: String, enum: ['pending', 'active', 'completed'], default: 'active' },
    earnings: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Reward Model
const RewardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['daily', 'weekly', 'monthly', 'spin', 'mystery', 'task', 'achievement', 'event'],
        required: true 
    },
    amount: { type: Number, required: true },
    multiplier: { type: Number, default: 1 },
    claimed: { type: Boolean, default: false },
    claimDate: { type: Date },
    expiresAt: { type: Date },
    metadata: { type: Object },
    createdAt: { type: Date, default: Date.now }
});

// Task Model
const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: '📋' },
    type: { 
        type: String, 
        enum: ['join_channel', 'join_group', 'visit_website', 'daily_login', 
               'watch_ad', 'special_event', 'limited_time'],
        required: true 
    },
    reward: { type: Number, required: true },
    requirement: { type: Object },
    targetUrl: { type: String },
    isActive: { type: Boolean, default: true },
    isDaily: { type: Boolean, default: false },
    isLimited: { type: Boolean, default: false },
    totalCompletions: { type: Number, default: 0 },
    maxCompletions: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Task Completion Model
const TaskCompletionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    completed: { type: Boolean, default: false },
    rewardClaimed: { type: Boolean, default: false },
    completionDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Withdrawal Model
const WithdrawalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    walletAddress: { type: String, required: true },
    network: { type: String, default: 'TRC20' },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'completed', 'failed'],
        default: 'pending' 
    },
    transactionId: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: { type: String },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
});

// Promo Code Model
const PromoCodeSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true },
    rewardType: { type: String, enum: ['balance', 'bonus', 'free_spin'], required: true },
    rewardAmount: { type: Number, required: true },
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

// Notification Model
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: ['reward', 'withdrawal', 'referral', 'system', 'event', 'reminder'],
        required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    data: { type: Object },
    createdAt: { type: Date, default: Date.now }
});

// Leaderboard Model
const LeaderboardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly', 'all_time'], required: true },
    earnings: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    rank: { type: Number },
    updatedAt: { type: Date, default: Date.now }
});

// Admin Model
const AdminSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'moderator'], default: 'admin' },
    permissions: [{ type: String }],
    lastActive: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

// Settings Model
const SettingsSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
    updatedAt: { type: Date, default: Date.now }
});

// Statistics Model
const StatisticsSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    totalUsers: { type: Number, default: 0 },
    activeUsers: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    totalAdsWatched: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    adImpressions: { type: Number, default: 0 },
    averageSession: { type: Number, default: 0 },
    countries: { type: Object },
    devices: { type: Object }
});

// ==================== CREATE MODELS ====================
const User = mongoose.model('User', UserSchema);
const Wallet = mongoose.model('Wallet', WalletSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Referral = mongoose.model('Referral', ReferralSchema);
const Reward = mongoose.model('Reward', RewardSchema);
const Task = mongoose.model('Task', TaskSchema);
const TaskCompletion = mongoose.model('TaskCompletion', TaskCompletionSchema);
const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);
const PromoCode = mongoose.model('PromoCode', PromoCodeSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const Settings = mongoose.model('Settings', SettingsSchema);
const Statistics = mongoose.model('Statistics', StatisticsSchema);

// ==================== TELEGRAM BOT ====================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const text = `
🎉 *Welcome to Premium Earn App!*

Earn USDT by watching ads, referring friends, and completing tasks.

🚀 *Features:*
💰 Earn USDT rewards
👥 Refer friends & earn 10%
🎯 Daily tasks & bonuses
🎰 Lucky spin wheel
📦 Mystery boxes

*Start earning now:* ${process.env.APP_URL}

Use /help for more commands.
    `;
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
        return bot.sendMessage(chatId, 'Please start the app first using /start');
    }
    const wallet = await Wallet.findOne({ userId: user._id });
    bot.sendMessage(chatId, `
💰 *Your Balance*
Balance: $${wallet?.balance.toFixed(2) || '0.00'} USDT
Pending: $${wallet?.pendingBalance.toFixed(2) || '0.00'} USDT
Total Earned: $${wallet?.totalEarned.toFixed(2) || '0.00'} USDT
    `, { parse_mode: 'Markdown' });
});

bot.onText(/\/daily/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
        return bot.sendMessage(chatId, 'Please start the app first using /start');
    }
    const today = moment().startOf('day');
    const lastClaim = await Reward.findOne({ 
        userId: user._id, 
        type: 'daily',
        claimDate: { $gte: today.toDate() }
    });
    if (lastClaim) {
        return bot.sendMessage(chatId, '⏰ You already claimed your daily reward today!');
    }
    const reward = parseFloat(process.env.DAILY_REWARD) || 0.50;
    const wallet = await Wallet.findOne({ userId: user._id });
    wallet.balance += reward;
    wallet.totalEarned += reward;
    await wallet.save();
    await Reward.create({
        userId: user._id,
        type: 'daily',
        amount: reward,
        claimed: true,
        claimDate: new Date()
    });
    bot.sendMessage(chatId, `🎉 Daily reward claimed! +$${reward.toFixed(2)} USDT`);
});

bot.onText(/\/refer/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await User.findOne({ telegramId: String(chatId) });
    if (!user) {
        return bot.sendMessage(chatId, 'Please start the app first using /start');
    }
    const code = user.referralCode || user.telegramId;
    bot.sendMessage(chatId, `
👥 *Referral Program*
Share your referral link and earn 10% of their earnings!

Your referral link: ${process.env.APP_URL}?start=ref_${code}

📊 Referrals: ${await Referral.countDocuments({ referrerId: user._id })}
Earnings: $${(await Wallet.findOne({ userId: user._id }))?.referralEarnings.toFixed(2) || '0.00'}
    `, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, async (msg) => {
    bot.sendMessage(msg.chat.id, `
📚 *Available Commands*

/start - Welcome message
/balance - Check your balance
/daily - Claim daily reward
/refer - Get referral link
/spin - Lucky spin
/tasks - Available tasks
/leaderboard - Top earners
/withdraw - Request withdrawal
/history - Transaction history
/profile - Your profile
/help - This message

🌟 *Premium Features*
Join our community to unlock more rewards!
    `, { parse_mode: 'Markdown' });
});

// ==================== MIDDLEWARE ====================

const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user || user.isBanned) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

const adminAuth = async (req, res, next) => {
    try {
        const admin = await Admin.findOne({ userId: req.user._id });
        if (!admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        req.admin = admin;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/telegram', async (req, res) => {
    try {
        const { telegramId, username, firstName, lastName, avatar, hash, referralCode } = req.body;
        
        // Simple hash verification (you can enhance this)
        if (hash && hash.length > 0) {
            // Telegram hash verification logic
        }
        
        let user = await User.findOne({ telegramId });
        const isNew = !user;
        
        if (!user) {
            const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            user = await User.create({
                telegramId,
                username,
                firstName,
                lastName,
                avatar,
                referralCode: refCode,
                referredBy: referralCode || null
            });
            
            await Wallet.create({
                userId: user._id,
                balance: 0,
                pendingBalance: 0,
                totalEarned: 0,
                totalWithdrawn: 0
            });
            
            // Handle referral
            if (referralCode) {
                const referrer = await User.findOne({ referralCode });
                if (referrer && referrer._id.toString() !== user._id.toString()) {
                    await Referral.create({
                        referrerId: referrer._id,
                        referredId: user._id,
                        referralCode
                    });
                    
                    const referrerWallet = await Wallet.findOne({ userId: referrer._id });
                    const bonus = parseFloat(process.env.REFERRAL_BONUS) || 1.00;
                    referrerWallet.balance += bonus;
                    referrerWallet.totalEarned += bonus;
                    referrerWallet.referralEarnings += bonus;
                    await referrerWallet.save();
                    
                    await bot.sendMessage(referrer.telegramId, 
                        `🎉 New referral! ${firstName} joined using your link. +$${bonus.toFixed(2)} USDT bonus!`
                    );
                }
            }
        }
        
        user.lastLogin = new Date();
        await user.save();
        
        // Update streak
        const today = moment().startOf('day');
        const lastLoginDate = moment(user.lastLogin).startOf('day');
        const diffDays = today.diff(lastLoginDate, 'days');
        
        if (diffDays === 1) {
            user.streak += 1;
            await user.save();
        } else if (diffDays > 1) {
            user.streak = 1;
            await user.save();
        }
        
        const token = jwt.sign({ id: user._id, telegramId: user.telegramId }, JWT_SECRET, { expiresIn: '7d' });
        const wallet = await Wallet.findOne({ userId: user._id });
        
        res.json({
            token,
            user: {
                id: user._id,
                telegramId: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                avatar: user.avatar,
                level: user.level,
                xp: user.xp,
                streak: user.streak,
                referralCode: user.referralCode,
                isNew: isNew,
                isVerified: user.isVerified
            },
            wallet: {
                balance: wallet.balance,
                pendingBalance: wallet.pendingBalance,
                totalEarned: wallet.totalEarned,
                totalWithdrawn: wallet.totalWithdrawn,
                referralEarnings: wallet.referralEarnings
            }
        });
    } catch (error) {
        logger.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// ==================== USER ROUTES ====================

app.get('/api/user/profile', auth, async (req, res) => {
    try {
        const user = req.user;
        const wallet = await Wallet.findOne({ userId: user._id });
        const referrals = await Referral.countDocuments({ referrerId: user._id });
        const notifications = await Notification.find({ userId: user._id, read: false }).limit(10);
        
        res.json({
            user: {
                id: user._id,
                telegramId: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                avatar: user.avatar,
                level: user.level,
                xp: user.xp,
                streak: user.streak,
                joinDate: user.joinDate,
                referralCode: user.referralCode,
                isVerified: user.isVerified,
                totalAdsWatched: user.totalAdsWatched,
                achievements: user.achievements || [],
                settings: user.settings
            },
            wallet: {
                balance: wallet.balance,
                pendingBalance: wallet.pendingBalance,
                totalEarned: wallet.totalEarned,
                totalWithdrawn: wallet.totalWithdrawn,
                referralEarnings: wallet.referralEarnings,
                adEarnings: wallet.adEarnings,
                bonusEarnings: wallet.bonusEarnings
            },
            stats: {
                referrals,
                notificationsCount: notifications.length
            },
            notifications
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/user/settings', auth, async (req, res) => {
    try {
        const { darkMode, hapticFeedback, soundEffects, notifications } = req.body;
        req.user.settings = { darkMode, hapticFeedback, soundEffects, notifications };
        await req.user.save();
        res.json({ success: true, settings: req.user.settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== WALLET ROUTES ====================

app.get('/api/wallet/balance', auth, async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.user._id });
        res.json(wallet || { balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/wallet/transactions', auth, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));
        const total = await Transaction.countDocuments({ userId: req.user._id });
        res.json({ transactions, total, limit: parseInt(limit), skip: parseInt(skip) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/wallet/withdraw', auth, async (req, res) => {
    try {
        const { amount, walletAddress, network } = req.body;
        const minWithdrawal = parseFloat(process.env.MIN_WITHDRAWAL) || 10;
        
        if (!amount || amount < minWithdrawal) {
            return res.status(400).json({ error: `Minimum withdrawal is $${minWithdrawal} USDT` });
        }
        
        const wallet = await Wallet.findOne({ userId: req.user._id });
        if (wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        const pending = await Withdrawal.countDocuments({ 
            userId: req.user._id, 
            status: 'pending' 
        });
        if (pending >= 3) {
            return res.status(400).json({ error: 'Maximum 3 pending withdrawals allowed' });
        }
        
        const withdrawal = await Withdrawal.create({
            userId: req.user._id,
            amount,
            walletAddress,
            network: network || 'TRC20',
            status: 'pending'
        });
        
        wallet.balance -= amount;
        wallet.pendingBalance += amount;
        await wallet.save();
        
        await Transaction.create({
            userId: req.user._id,
            type: 'withdrawal',
            amount: -amount,
            balanceBefore: wallet.balance + amount,
            balanceAfter: wallet.balance,
            description: `Withdrawal request of $${amount.toFixed(2)} USDT`,
            status: 'pending'
        });
        
        res.json({ 
            success: true, 
            withdrawal,
            message: 'Withdrawal request submitted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REWARD ROUTES ====================

app.post('/api/rewards/watch-ad', auth, async (req, res) => {
    try {
        const user = req.user;
        const wallet = await Wallet.findOne({ userId: user._id });
        const maxAds = parseInt(process.env.MAX_ADS_PER_DAY) || 10;
        const adReward = parseFloat(process.env.AD_REWARD) || 0.50;
        
        const today = moment().startOf('day');
        const adsToday = await Transaction.countDocuments({
            userId: user._id,
            type: 'ad_reward',
            createdAt: { $gte: today.toDate() }
        });
        
        if (adsToday >= maxAds) {
            return res.status(400).json({ error: `Daily ad limit reached (${maxAds} ads/day)` });
        }
        
        const lastAd = await Transaction.findOne({
            userId: user._id,
            type: 'ad_reward'
        }).sort({ createdAt: -1 });
        
        if (lastAd) {
            const cooldown = moment().diff(moment(lastAd.createdAt), 'seconds');
            if (cooldown < 30) {
                return res.status(400).json({ 
                    error: `Please wait ${30 - cooldown} seconds before next ad`,
                    cooldown: 30 - cooldown
                });
            }
        }
        
        // Check weekend bonus
        const isWeekend = [0, 6].includes(moment().day());
        const multiplier = isWeekend ? (parseFloat(process.env.WEEKEND_MULTIPLIER) || 2) : 1;
        const reward = adReward * multiplier;
        
        wallet.balance += reward;
        wallet.totalEarned += reward;
        wallet.adEarnings += reward;
        await wallet.save();
        
        user.totalAdsWatched += 1;
        user.dailyAdsWatched += 1;
        user.lastAdWatch = new Date();
        await user.save();
        
        const transaction = await Transaction.create({
            userId: user._id,
            type: 'ad_reward',
            amount: reward,
            balanceBefore: wallet.balance - reward,
            balanceAfter: wallet.balance,
            description: `Ad reward with ${multiplier}x multiplier`,
            metadata: { multiplier }
        });
        
        // Check achievements
        await checkAchievements(user._id);
        await updateLeaderboard(user._id, reward);
        
        res.json({
            success: true,
            reward: reward,
            multiplier: multiplier,
            balance: wallet.balance,
            transaction
        });
    } catch (error) {
        logger.error('Watch ad error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/daily', auth, async (req, res) => {
    try {
        const user = req.user;
        const wallet = await Wallet.findOne({ userId: user._id });
        const dailyReward = parseFloat(process.env.DAILY_REWARD) || 0.50;
        
        const today = moment().startOf('day');
        const claimed = await Reward.findOne({
            userId: user._id,
            type: 'daily',
            claimDate: { $gte: today.toDate() }
        });
        
        if (claimed) {
            return res.status(400).json({ error: 'Daily reward already claimed' });
        }
        
        const streakBonus = Math.min(user.streak, 30) * (parseFloat(process.env.STREAK_MULTIPLIER) || 0.05) + 1;
        const reward = dailyReward * streakBonus;
        
        wallet.balance += reward;
        wallet.totalEarned += reward;
        wallet.bonusEarnings += reward;
        await wallet.save();
        
        await Reward.create({
            userId: user._id,
            type: 'daily',
            amount: reward,
            claimed: true,
            claimDate: new Date()
        });
        
        await Transaction.create({
            userId: user._id,
            type: 'daily_bonus',
            amount: reward,
            balanceBefore: wallet.balance - reward,
            balanceAfter: wallet.balance,
            description: `Daily reward with ${user.streak} day streak`
        });
        
        await checkAchievements(user._id);
        
        res.json({
            success: true,
            reward: reward,
            streak: user.streak,
            balance: wallet.balance
        });
    } catch (error) {
        logger.error('Daily reward error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/spin', auth, async (req, res) => {
    try {
        const user = req.user;
        const wallet = await Wallet.findOne({ userId: user._id });
        const maxSpins = parseInt(process.env.MAX_SPINS_PER_DAY) || 3;
        
        const today = moment().startOf('day');
        const spins = await Reward.countDocuments({
            userId: user._id,
            type: 'spin',
            claimDate: { $gte: today.toDate() }
        });
        
        if (spins >= maxSpins) {
            return res.status(400).json({ error: `Daily spin limit reached (${maxSpins} spins/day)` });
        }
        
        const rewards = [
            { amount: 0.25, probability: 0.30 },
            { amount: 0.50, probability: 0.25 },
            { amount: 1.00, probability: 0.20 },
            { amount: 2.00, probability: 0.10 },
            { amount: 5.00, probability: 0.05 },
            { amount: 0, probability: 0.10 }
        ];
        
        const random = Math.random();
        let cumulative = 0;
        let selected = rewards[0];
        
        for (const reward of rewards) {
            cumulative += reward.probability;
            if (random <= cumulative) {
                selected = reward;
                break;
            }
        }
        
        const reward = selected.amount;
        
        if (reward > 0) {
            wallet.balance += reward;
            wallet.totalEarned += reward;
            wallet.bonusEarnings += reward;
            await wallet.save();
            
            await Transaction.create({
                userId: user._id,
                type: 'spin_win',
                amount: reward,
                balanceBefore: wallet.balance - reward,
                balanceAfter: wallet.balance,
                description: `Spin win: $${reward.toFixed(2)} USDT`
            });
        }
        
        await Reward.create({
            userId: user._id,
            type: 'spin',
            amount: reward,
            claimed: true,
            claimDate: new Date(),
            metadata: { spinNumber: spins + 1 }
        });
        
        res.json({
            success: true,
            reward: reward,
            isWinner: reward > 0,
            spinsRemaining: maxSpins - spins - 1,
            balance: wallet.balance
        });
    } catch (error) {
        logger.error('Spin error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/mystery', auth, async (req, res) => {
    try {
        const user = req.user;
        const wallet = await Wallet.findOne({ userId: user._id });
        
        const today = moment().startOf('day');
        const boxes = await Reward.countDocuments({
            userId: user._id,
            type: 'mystery',
            claimDate: { $gte: today.toDate() }
        });
        
        if (boxes >= 1) {
            return res.status(400).json({ error: 'Mystery box already claimed today' });
        }
        
        const rewards = [
            { amount: 1.00, probability: 0.30 },
            { amount: 2.00, probability: 0.25 },
            { amount: 5.00, probability: 0.15 },
            { amount: 10.00, probability: 0.05 },
            { amount: 0.50, probability: 0.25 }
        ];
        
        const random = Math.random();
        let cumulative = 0;
        let selected = rewards[0];
        
        for (const reward of rewards) {
            cumulative += reward.probability;
            if (random <= cumulative) {
                selected = reward;
                break;
            }
        }
        
        const reward = selected.amount;
        
        if (reward > 0) {
            wallet.balance += reward;
            wallet.totalEarned += reward;
            wallet.bonusEarnings += reward;
            await wallet.save();
            
            await Transaction.create({
                userId: user._id,
                type: 'mystery_box',
                amount: reward,
                balanceBefore: wallet.balance - reward,
                balanceAfter: wallet.balance,
                description: `Mystery box: $${reward.toFixed(2)} USDT`
            });
        }
        
        await Reward.create({
            userId: user._id,
            type: 'mystery',
            amount: reward,
            claimed: true,
            claimDate: new Date()
        });
        
        res.json({
            success: true,
            reward: reward,
            balance: wallet.balance
        });
    } catch (error) {
        logger.error('Mystery box error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== REFERRAL ROUTES ====================

app.get('/api/referrals/stats', auth, async (req, res) => {
    try {
        const referrals = await Referral.find({ referrerId: req.user._id })
            .populate('referredId', 'username firstName lastName avatar joinDate')
            .sort({ createdAt: -1 });
        
        const stats = {
            total: referrals.length,
            active: referrals.filter(r => r.status === 'active').length,
            earnings: (await Wallet.findOne({ userId: req.user._id })).referralEarnings || 0
        };
        
        res.json({ stats, referrals });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/referrals/link', auth, async (req, res) => {
    try {
        const code = req.user.referralCode;
        const link = `${process.env.APP_URL}?start=ref_${code}`;
        res.json({ code, link });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASK ROUTES ====================

app.get('/api/tasks', auth, async (req, res) => {
    try {
        const tasks = await Task.find({ isActive: true });
        const completions = await TaskCompletion.find({ 
            userId: req.user._id,
            completed: true,
            rewardClaimed: true
        });
        
        const completedIds = completions.map(c => c.taskId.toString());
        
        const tasksWithStatus = tasks.map(task => ({
            ...task.toObject(),
            completed: completedIds.includes(task._id.toString())
        }));
        
        res.json({ tasks: tasksWithStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/complete', auth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.taskId);
        if (!task || !task.isActive) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const existing = await TaskCompletion.findOne({
            userId: req.user._id,
            taskId: task._id
        });
        
        if (existing && existing.completed) {
            return res.status(400).json({ error: 'Task already completed' });
        }
        
        if (task.isDaily) {
            const today = moment().startOf('day');
            const dailyCompletion = await TaskCompletion.findOne({
                userId: req.user._id,
                taskId: task._id,
                completionDate: { $gte: today.toDate() }
            });
            if (dailyCompletion) {
                return res.status(400).json({ error: 'Daily task already completed' });
            }
        }
        
        const completion = await TaskCompletion.create({
            userId: req.user._id,
            taskId: task._id,
            completed: true,
            rewardClaimed: false,
            completionDate: new Date()
        });
        
        const wallet = await Wallet.findOne({ userId: req.user._id });
        wallet.balance += task.reward;
        wallet.totalEarned += task.reward;
        await wallet.save();
        
        completion.rewardClaimed = true;
        await completion.save();
        
        await Transaction.create({
            userId: req.user._id,
            type: 'task_complete',
            amount: task.reward,
            balanceBefore: wallet.balance - task.reward,
            balanceAfter: wallet.balance,
            description: `Task: ${task.title}`
        });
        
        res.json({
            success: true,
            reward: task.reward,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LEADERBOARD ROUTES ====================

app.get('/api/leaderboard/:period', async (req, res) => {
    try {
        const { period } = req.params;
        const { limit = 50 } = req.query;
        
        const leaderboard = await Leaderboard.find({ period })
            .populate('userId', 'username firstName lastName avatar level')
            .sort({ earnings: -1 })
            .limit(parseInt(limit));
        
        res.json({ leaderboard });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== PROMO CODE ROUTES ====================

app.post('/api/promo/redeem', auth, async (req, res) => {
    try {
        const { code } = req.body;
        
        const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
        if (!promo) {
            return res.status(404).json({ error: 'Invalid promo code' });
        }
        
        if (promo.expiresAt && new Date() > promo.expiresAt) {
            return res.status(400).json({ error: 'Promo code expired' });
        }
        
        if (promo.usedCount >= promo.usageLimit) {
            return res.status(400).json({ error: 'Promo code usage limit reached' });
        }
        
        if (promo.usedBy.includes(req.user._id)) {
            return res.status(400).json({ error: 'You already used this promo code' });
        }
        
        const wallet = await Wallet.findOne({ userId: req.user._id });
        
        if (promo.rewardType === 'balance' || promo.rewardType === 'bonus') {
            wallet.balance += promo.rewardAmount;
            wallet.totalEarned += promo.rewardAmount;
            if (promo.rewardType === 'bonus') {
                wallet.bonusEarnings += promo.rewardAmount;
            }
        }
        await wallet.save();
        
        promo.usedCount += 1;
        promo.usedBy.push(req.user._id);
        await promo.save();
        
        await Transaction.create({
            userId: req.user._id,
            type: 'promo_code',
            amount: promo.rewardAmount,
            balanceBefore: wallet.balance - promo.rewardAmount,
            balanceAfter: wallet.balance,
            description: `Promo code: ${promo.code}`
        });
        
        res.json({
            success: true,
            reward: promo.rewardAmount,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/stats', auth, adminAuth, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ 
            lastLogin: { $gte: moment().subtract(24, 'hours').toDate() }
        });
        const bannedUsers = await User.countDocuments({ isBanned: true });
        
        const totalBalance = await Wallet.aggregate([
            { $group: { _id: null, total: { $sum: '$balance' } } }
        ]);
        
        res.json({
            users: {
                total: totalUsers,
                active: activeUsers,
                banned: bannedUsers
            },
            finances: {
                totalBalance: totalBalance[0]?.total || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', auth, adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { username: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { telegramId: search }
            ];
        }
        
        const users = await User.find(query)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await User.countDocuments(query);
        
        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/users/:userId/ban', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.isBanned = true;
        await user.save();
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/users/:userId/unban', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.isBanned = false;
        await user.save();
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:userId/balance', auth, adminAuth, async (req, res) => {
    try {
        const { amount, type } = req.body;
        const wallet = await Wallet.findOne({ userId: req.params.userId });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        
        if (type === 'add') {
            wallet.balance += amount;
            wallet.totalEarned += amount;
        } else if (type === 'subtract') {
            if (wallet.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
            wallet.balance -= amount;
        }
        await wallet.save();
        
        await Transaction.create({
            userId: req.params.userId,
            type: 'admin_adjustment',
            amount: type === 'add' ? amount : -amount,
            description: `Admin ${type}: $${amount.toFixed(2)} USDT`
        });
        
        res.json({ success: true, balance: wallet.balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/broadcast', auth, adminAuth, async (req, res) => {
    try {
        const { message } = req.body;
        const users = await User.find({ isActive: true, isBanned: false });
        let sent = 0;
        
        for (const user of users) {
            try {
                await bot.sendMessage(user.telegramId, message, { parse_mode: 'Markdown' });
                sent++;
            } catch (error) {
                logger.error(`Failed to send to ${user.telegramId}:`, error.message);
            }
        }
        
        res.json({ success: true, sent, total: users.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/promo/create', auth, adminAuth, async (req, res) => {
    try {
        const { code, rewardType, rewardAmount, usageLimit, expiresAt } = req.body;
        
        const existing = await PromoCode.findOne({ code: code.toUpperCase() });
        if (existing) return res.status(400).json({ error: 'Promo code already exists' });
        
        const promo = await PromoCode.create({
            code: code.toUpperCase(),
            rewardType,
            rewardAmount,
            usageLimit: usageLimit || 1,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.user._id
        });
        
        res.json({ success: true, promo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/withdrawals', auth, adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = status ? { status } : {};
        
        const withdrawals = await Withdrawal.find(query)
            .populate('userId', 'username firstName lastName telegramId')
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await Withdrawal.countDocuments(query);
        
        res.json({
            withdrawals,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/withdrawals/:withdrawalId/approve', auth, adminAuth, async (req, res) => {
    try {
        const withdrawal = await Withdrawal.findById(req.params.withdrawalId);
        if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
        
        withdrawal.status = 'approved';
        withdrawal.completedAt = new Date();
        await withdrawal.save();
        
        const wallet = await Wallet.findOne({ userId: withdrawal.userId });
        wallet.pendingBalance -= withdrawal.amount;
        wallet.totalWithdrawn += withdrawal.amount;
        await wallet.save();
        
        const user = await User.findById(withdrawal.userId);
        if (user) {
            await bot.sendMessage(user.telegramId, 
                `✅ Withdrawal approved!\nAmount: $${withdrawal.amount.toFixed(2)} USDT`
            );
        }
        
        res.json({ success: true, withdrawal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/withdrawals/:withdrawalId/reject', auth, adminAuth, async (req, res) => {
    try {
        const { reason } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.withdrawalId);
        if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
        
        withdrawal.status = 'rejected';
        withdrawal.reviewNotes = reason;
        await withdrawal.save();
        
        const wallet = await Wallet.findOne({ userId: withdrawal.userId });
        wallet.balance += withdrawal.amount;
        wallet.pendingBalance -= withdrawal.amount;
        await wallet.save();
        
        res.json({ success: true, withdrawal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== HELPER FUNCTIONS ====================

async function checkAchievements(userId) {
    const user = await User.findById(userId);
    const wallet = await Wallet.findOne({ userId });
    const referrals = await Referral.countDocuments({ referrerId: userId });
    const adsWatched = user.totalAdsWatched;
    const streak = user.streak;
    
    const achievements = [];
    
    if (adsWatched >= 100 && !user.achievements.some(a => a.id === '100_ads')) {
        achievements.push({ id: '100_ads', name: '100 Ads Watched' });
    }
    if (referrals >= 10 && !user.achievements.some(a => a.id === '10_referrals')) {
        achievements.push({ id: '10_referrals', name: '10 Referrals' });
    }
    if (streak >= 30 && !user.achievements.some(a => a.id === '30_day_streak')) {
        achievements.push({ id: '30_day_streak', name: '30-Day Streak' });
    }
    if (wallet.totalWithdrawn > 0 && !user.achievements.some(a => a.id === 'first_withdrawal')) {
        achievements.push({ id: 'first_withdrawal', name: 'First Withdrawal' });
    }
    
    if (achievements.length > 0) {
        for (const achievement of achievements) {
            user.achievements.push({
                id: achievement.id,
                name: achievement.name,
                unlockedAt: new Date()
            });
            
            const reward = 2.00;
            wallet.balance += reward;
            wallet.totalEarned += reward;
            await wallet.save();
            
            await Transaction.create({
                userId: user._id,
                type: 'achievement',
                amount: reward,
                description: `Achievement: ${achievement.name}`
            });
            
            await bot.sendMessage(user.telegramId, 
                `🏅 Achievement Unlocked: ${achievement.name}!\n+$${reward.toFixed(2)} USDT bonus!`
            );
        }
        await user.save();
    }
}

async function updateLeaderboard(userId, amount) {
    const periods = ['daily', 'weekly', 'monthly', 'all_time'];
    
    for (const period of periods) {
        let entry = await Leaderboard.findOne({ userId, period });
        if (!entry) {
            entry = await Leaderboard.create({
                userId,
                period,
                earnings: 0,
                referrals: 0
            });
        }
        entry.earnings += amount;
        await entry.save();
    }
}

// ==================== CRON JOBS ====================

// Daily statistics
cron.schedule('0 0 * * *', async () => {
    try {
        const yesterday = moment().subtract(1, 'day').startOf('day');
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ 
            lastLogin: { $gte: yesterday.toDate() }
        });
        const newUsers = await User.countDocuments({
            createdAt: { $gte: yesterday.toDate(), $lt: moment(yesterday).endOf('day').toDate() }
        });
        
        await Statistics.create({
            date: yesterday.toDate(),
            totalUsers,
            activeUsers,
            newUsers
        });
        
        logger.info('Statistics updated for', yesterday.toDate());
    } catch (error) {
        logger.error('Statistics update error:', error);
    }
});

// Reset daily limits
cron.schedule('0 0 * * *', async () => {
    try {
        await User.updateMany({}, { dailyAdsWatched: 0 });
        logger.info('Daily ads reset');
    } catch (error) {
        logger.error('Daily reset error:', error);
    }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);
    
    socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
    });
    
    socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
    });
});

// ==================== START SERVER ====================

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api`);
    console.log(`🤖 Bot: @${process.env.BOT_USERNAME || 'your_bot'}`);
    console.log(`💾 Database: ${MONGO_URI}`);
    logger.info(`Server started on port ${PORT}`);
});

// ==================== ERROR HANDLING ====================

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

module.exports = { app, server, io };

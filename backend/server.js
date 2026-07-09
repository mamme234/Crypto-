// ==================== ALPHA PRO BACKEND ====================
// Complete working backend with all features

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const moment = require('moment');

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// FIXED CORS - Allow all origins for testing
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests'
});
app.use('/api/', limiter);

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        time: new Date().toISOString(),
        message: 'Alpha Pro Backend is running! 🚀'
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Alpha Pro Backend',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            api: '/api',
            auth: '/api/auth/telegram',
            profile: '/api/user/profile',
            balance: '/api/wallet/balance',
            transactions: '/api/wallet/transactions',
            withdraw: '/api/wallet/withdraw',
            watch_ad: '/api/rewards/watch-ad',
            daily: '/api/rewards/daily',
            spin: '/api/rewards/spin',
            mystery: '/api/rewards/mystery',
            referrals: '/api/referrals/stats',
            referral_link: '/api/referrals/link',
            tasks: '/api/tasks',
            leaderboard: '/api/leaderboard/:period'
        }
    });
});

// ==================== DATABASE (Mock - No DB Required) ====================
// Using in-memory storage for simplicity
// This works WITHOUT MongoDB!

const users = {};
const wallets = {};
const transactions = {};
const referrals = {};
const tasks = {};
const leaderboards = {};
let userIdCounter = 1;

// Sample tasks
const defaultTasks = [
    { id: '1', title: 'Join Telegram Channel', description: 'Subscribe to our channel', icon: '📢', reward: 0.50, type: 'join_channel' },
    { id: '2', title: 'Invite 5 Friends', description: 'Get 5 referrals', icon: '👥', reward: 2.00, type: 'referral' },
    { id: '3', title: 'Watch 10 Ads', description: 'Watch rewarded ads', icon: '🎥', reward: 5.00, type: 'watch_ad' },
    { id: '4', title: 'Daily Login', description: 'Login 7 days in a row', icon: '📅', reward: 1.00, type: 'daily_login' },
];

// Initialize tasks
defaultTasks.forEach(task => {
    tasks[task.id] = { ...task, isActive: true, completions: 0 };
});

// ==================== JWT HELPERS ====================
const JWT_SECRET = process.env.JWT_SECRET || 'alpha_pro_secret_key';

function generateToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

// ==================== AUTH MIDDLEWARE ====================
function auth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    const user = users[decoded.id];
    if (!user || user.isBanned) {
        return res.status(401).json({ error: 'User not found or banned' });
    }
    
    req.user = user;
    req.userId = decoded.id;
    next();
}

// ==================== USER FUNCTIONS ====================
function createUser(telegramId, username, firstName, lastName, avatar, referralCode) {
    const id = String(userIdCounter++);
    const user = {
        id,
        telegramId,
        username: username || 'user',
        firstName: firstName || 'User',
        lastName: lastName || '',
        avatar: avatar || '',
        level: 1,
        xp: 0,
        streak: 0,
        lastLogin: new Date(),
        joinDate: new Date(),
        isActive: true,
        isBanned: false,
        isVerified: false,
        referralCode: referralCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
        referredBy: null,
        totalAdsWatched: 0,
        dailyAdsWatched: 0,
        achievements: [],
        settings: {
            darkMode: true,
            hapticFeedback: true,
            soundEffects: true,
            notifications: true
        }
    };
    
    users[id] = user;
    
    // Create wallet
    wallets[id] = {
        userId: id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        referralEarnings: 0,
        bonusEarnings: 0,
        adEarnings: 0,
        currency: 'USDT'
    };
    
    transactions[id] = [];
    referrals[id] = [];
    
    return user;
}

function getUser(id) {
    return users[id];
}

function getWallet(id) {
    return wallets[id] || { balance: 0, pendingBalance: 0, totalEarned: 0, totalWithdrawn: 0 };
}

function addTransaction(userId, type, amount, description, status = 'completed') {
    const tx = {
        id: Date.now().toString(),
        userId,
        type,
        amount,
        balanceBefore: getWallet(userId).balance,
        balanceAfter: getWallet(userId).balance + amount,
        description,
        status,
        createdAt: new Date()
    };
    
    if (!transactions[userId]) transactions[userId] = [];
    transactions[userId].unshift(tx);
    
    return tx;
}

function updateBalance(userId, amount, type, description) {
    const wallet = getWallet(userId);
    wallet.balance += amount;
    wallet.totalEarned += Math.max(0, amount);
    
    if (type === 'ad_reward') wallet.adEarnings += amount;
    if (type === 'referral_bonus') wallet.referralEarnings += amount;
    if (type === 'daily_bonus' || type === 'spin_win' || type === 'mystery_box') {
        wallet.bonusEarnings += amount;
    }
    
    addTransaction(userId, type, amount, description);
    return wallet;
}

// ==================== AUTH ROUTE ====================
app.post('/api/auth/telegram', async (req, res) => {
    try {
        const { telegramId, username, firstName, lastName, avatar, referralCode } = req.body;
        
        // Find or create user
        let user = Object.values(users).find(u => u.telegramId === telegramId);
        let isNew = false;
        
        if (!user) {
            isNew = true;
            user = createUser(telegramId, username, firstName, lastName, avatar, referralCode);
            
            // Handle referral
            if (referralCode) {
                const referrer = Object.values(users).find(u => u.referralCode === referralCode);
                if (referrer && referrer.id !== user.id) {
                    user.referredBy = referrer.id;
                    referrals[referrer.id] = referrals[referrer.id] || [];
                    referrals[referrer.id].push({
                        referredId: user.id,
                        referralCode,
                        status: 'active',
                        earnings: 0,
                        createdAt: new Date()
                    });
                    
                    // Give referrer bonus
                    const bonus = 1.00;
                    const wallet = getWallet(referrer.id);
                    wallet.balance += bonus;
                    wallet.totalEarned += bonus;
                    wallet.referralEarnings += bonus;
                    addTransaction(referrer.id, 'referral_bonus', bonus, `Referral bonus for ${firstName}`);
                }
            }
        }
        
        // Update user
        user.lastLogin = new Date();
        
        // Update streak
        const today = moment().startOf('day');
        const lastLoginDate = moment(user.lastLogin).startOf('day');
        const diffDays = today.diff(lastLoginDate, 'days');
        
        if (diffDays === 1) {
            user.streak += 1;
        } else if (diffDays > 1) {
            user.streak = 1;
        }
        
        const token = generateToken(user.id);
        const wallet = getWallet(user.id);
        
        res.json({
            token,
            user: {
                id: user.id,
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
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed: ' + error.message });
    }
});

// ==================== USER ROUTES ====================
app.get('/api/user/profile', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(user.id);
        const referralsCount = (referrals[user.id] || []).length;
        const notifications = [];
        
        res.json({
            user: {
                id: user.id,
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
                referrals: referralsCount,
                notificationsCount: 0
            },
            notifications
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/user/settings', auth, (req, res) => {
    try {
        const { darkMode, hapticFeedback, soundEffects, notifications } = req.body;
        req.user.settings = { darkMode, hapticFeedback, soundEffects, notifications };
        res.json({ success: true, settings: req.user.settings });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== WALLET ROUTES ====================
app.get('/api/wallet/balance', auth, (req, res) => {
    try {
        const wallet = getWallet(req.userId);
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/wallet/transactions', auth, (req, res) => {
    try {
        const userTransactions = transactions[req.userId] || [];
        const { limit = 20, skip = 0 } = req.query;
        const paginated = userTransactions.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
        res.json({
            transactions: paginated,
            total: userTransactions.length,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/wallet/withdraw', auth, (req, res) => {
    try {
        const { amount, walletAddress, network } = req.body;
        const minWithdrawal = 10;
        
        if (!amount || amount < minWithdrawal) {
            return res.status(400).json({ error: `Minimum withdrawal is $${minWithdrawal} USDT` });
        }
        
        const wallet = getWallet(req.userId);
        if (wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Process withdrawal
        wallet.balance -= amount;
        wallet.pendingBalance += amount;
        wallet.totalWithdrawn += amount;
        
        addTransaction(req.userId, 'withdrawal', -amount, `Withdrawal of $${amount.toFixed(2)} USDT to ${walletAddress}`, 'pending');
        
        res.json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            withdrawal: {
                amount,
                walletAddress,
                network: network || 'TRC20',
                status: 'pending'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REWARD ROUTES ====================
app.post('/api/rewards/watch-ad', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(req.userId);
        const maxAds = 10;
        const adReward = 0.50;
        
        // Check daily limit
        const today = moment().startOf('day');
        const adsToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'ad_reward' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (adsToday >= maxAds) {
            return res.status(400).json({ error: `Daily ad limit reached (${maxAds} ads/day)` });
        }
        
        // Check cooldown (30 seconds)
        const lastAd = (transactions[req.userId] || [])
            .find(t => t.type === 'ad_reward');
        
        if (lastAd) {
            const cooldown = moment().diff(moment(lastAd.createdAt), 'seconds');
            if (cooldown < 30) {
                return res.status(400).json({
                    error: `Please wait ${30 - cooldown} seconds before next ad`,
                    cooldown: 30 - cooldown
                });
            }
        }
        
        // Weekend bonus
        const isWeekend = [0, 6].includes(moment().day());
        const multiplier = isWeekend ? 2 : 1;
        const reward = adReward * multiplier;
        
        // Update wallet
        wallet.balance += reward;
        wallet.totalEarned += reward;
        wallet.adEarnings += reward;
        
        user.totalAdsWatched += 1;
        user.dailyAdsWatched += 1;
        
        addTransaction(req.userId, 'ad_reward', reward, `Ad reward with ${multiplier}x multiplier`);
        
        res.json({
            success: true,
            reward: reward,
            multiplier: multiplier,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/daily', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(req.userId);
        const dailyReward = 0.50;
        
        // Check if already claimed today
        const today = moment().startOf('day');
        const claimed = (transactions[req.userId] || [])
            .find(t => t.type === 'daily_bonus' && moment(t.createdAt).isSame(today, 'day'));
        
        if (claimed) {
            return res.status(400).json({ error: 'Daily reward already claimed' });
        }
        
        // Streak bonus
        const streakBonus = Math.min(user.streak, 30) * 0.05 + 1;
        const reward = dailyReward * streakBonus;
        
        wallet.balance += reward;
        wallet.totalEarned += reward;
        wallet.bonusEarnings += reward;
        
        addTransaction(req.userId, 'daily_bonus', reward, `Daily reward with ${user.streak} day streak`);
        
        res.json({
            success: true,
            reward: reward,
            streak: user.streak,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/spin', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(req.userId);
        const maxSpins = 3;
        
        // Check spin limit
        const today = moment().startOf('day');
        const spinsToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'spin_win' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (spinsToday >= maxSpins) {
            return res.status(400).json({ error: `Daily spin limit reached (${maxSpins} spins/day)` });
        }
        
        // Spin wheel
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
            addTransaction(req.userId, 'spin_win', reward, `Spin win: $${reward.toFixed(2)} USDT`);
        }
        
        res.json({
            success: true,
            reward: reward,
            isWinner: reward > 0,
            spinsRemaining: maxSpins - spinsToday - 1,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/mystery', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(req.userId);
        
        // Check if mystery box available
        const today = moment().startOf('day');
        const boxesToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'mystery_box' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (boxesToday >= 1) {
            return res.status(400).json({ error: 'Mystery box already claimed today' });
        }
        
        // Random reward
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
            addTransaction(req.userId, 'mystery_box', reward, `Mystery box: $${reward.toFixed(2)} USDT`);
        }
        
        res.json({
            success: true,
            reward: reward,
            balance: wallet.balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== REFERRAL ROUTES ====================
app.get('/api/referrals/stats', auth, (req, res) => {
    try {
        const userReferrals = referrals[req.userId] || [];
        const wallet = getWallet(req.userId);
        
        res.json({
            stats: {
                total: userReferrals.length,
                active: userReferrals.filter(r => r.status === 'active').length,
                earnings: wallet.referralEarnings || 0
            },
            referrals: userReferrals
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/referrals/link', auth, (req, res) => {
    try {
        const code = req.user.referralCode;
        const link = `${process.env.APP_URL || 'https://crypto-4bbj.onrender.com'}?start=ref_${code}`;
        res.json({ code, link });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASK ROUTES ====================
app.get('/api/tasks', auth, (req, res) => {
    try {
        const taskList = Object.values(tasks).filter(t => t.isActive);
        const userTransactions = transactions[req.userId] || [];
        
        const tasksWithStatus = taskList.map(task => {
            const completed = userTransactions.some(t => 
                t.type === 'task_complete' && t.description?.includes(task.title)
            );
            return { ...task, completed };
        });
        
        res.json({ tasks: tasksWithStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/:taskId/complete', auth, (req, res) => {
    try {
        const task = tasks[req.params.taskId];
        if (!task || !task.isActive) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const userTransactions = transactions[req.userId] || [];
        const alreadyCompleted = userTransactions.some(t => 
            t.type === 'task_complete' && t.description?.includes(task.title)
        );
        
        if (alreadyCompleted) {
            return res.status(400).json({ error: 'Task already completed' });
        }
        
        const wallet = getWallet(req.userId);
        wallet.balance += task.reward;
        wallet.totalEarned += task.reward;
        
        addTransaction(req.userId, 'task_complete', task.reward, `Task: ${task.title}`);
        
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
app.get('/api/leaderboard/:period', (req, res) => {
    try {
        const { period } = req.params;
        const { limit = 50 } = req.query;
        
        // Calculate earnings for each user
        const leaderboardData = Object.keys(users).map(userId => {
            const user = users[userId];
            const userTransactions = transactions[userId] || [];
            const earnings = userTransactions
                .filter(t => t.amount > 0)
                .reduce((sum, t) => sum + t.amount, 0);
            
            return {
                userId: {
                    _id: userId,
                    firstName: user.firstName,
                    username: user.username,
                    avatar: user.avatar,
                    level: user.level
                },
                earnings: earnings,
                referrals: (referrals[userId] || []).length
            };
        });
        
        const sorted = leaderboardData
            .sort((a, b) => b.earnings - a.earnings)
            .slice(0, parseInt(limit));
        
        res.json({ leaderboard: sorted });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log('🚀 Alpha Pro Backend Started!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
    console.log(`✅ Health: http://localhost:${PORT}/health`);
    console.log(`📊 All endpoints available at: http://localhost:${PORT}/`);
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

module.exports = app;

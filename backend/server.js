// ==================== ALPHA PRO BACKEND ====================
// Complete working backend with updated reward rates

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

// ==================== CONFIGURATION ====================
const BOT_USERNAME = '@Studybuddy_2025Bot';
const APP_URL = 'https://myapp1-khaki.vercel.app';
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// ==================== REWARD CONFIGURATION ====================
const REWARDS = {
    AD_REWARD: 0.05,           // $0.05 per ad
    DAILY_BONUS: 0.10,         // $0.10 daily bonus
    REFERRAL_BONUS: 0.30,      // $0.30 per referral
    SPIN_MIN: 0.03,            // $0.03 minimum spin
    SPIN_MAX: 0.50,            // $0.50 maximum spin
    WEEKEND_BONUS: 0.60,       // $0.60 weekend bonus
    MYSTERY_MIN: 0.05,         // $0.05 minimum mystery box
    MYSTERY_MAX: 0.50,         // $0.50 maximum mystery box
};

// ==================== WITHDRAWAL RULES ====================
const WITHDRAWAL_RULES = {
    MIN_AMOUNT: 10,            // Minimum $10 to withdraw
    MIN_REFERRALS: 10,         // Must have 10 referrals
    MIN_ADS_WATCHED: 500,      // Must watch 500 ads
};

// ==================== MIDDLEWARE ====================
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        message: 'Alpha Pro Backend is running! 🚀',
        bot: BOT_USERNAME,
        app: APP_URL,
        rewards: REWARDS,
        withdrawal: WITHDRAWAL_RULES
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'Alpha Pro Backend',
        version: '2.0.0',
        status: 'running',
        bot: BOT_USERNAME,
        app: APP_URL,
        rewards: REWARDS,
        withdrawal: WITHDRAWAL_RULES,
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

// ==================== DATABASE (In-Memory) ====================
const users = {};
const wallets = {};
const transactions = {};
const referrals = {};
const tasks = {};
const leaderboards = {};
let userIdCounter = 1;

const defaultTasks = [
    { id: '1', title: 'Join Telegram Channel', description: 'Subscribe to our channel', icon: '📢', reward: 0.10, type: 'join_channel' },
    { id: '2', title: 'Invite 5 Friends', description: 'Get 5 referrals', icon: '👥', reward: 0.50, type: 'referral' },
    { id: '3', title: 'Watch 100 Ads', description: 'Watch 100 rewarded ads', icon: '🎥', reward: 1.00, type: 'watch_ad' },
    { id: '4', title: 'Daily Login', description: 'Login 7 days in a row', icon: '📅', reward: 0.20, type: 'daily_login' },
];

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

// ==================== TELEGRAM BOT ====================
const TelegramBot = require('node-telegram-bot-api');
let bot = null;

// Initialize bot if token is provided
if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot Started!');
    console.log(`📱 Bot: ${BOT_USERNAME}`);
    console.log(`🔗 Mini App: ${APP_URL}`);
    
    // ==================== BOT COMMANDS ====================
    
    // /start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const referralCode = msg.text?.split(' ')[1] || '';
        
        const welcomeMessage = `
🚀 *Welcome to Alpha Pro!*

🎉 *Welcome to Ultimate Earn!*

💰 Watch rewarded ads
🎁 Claim daily bonuses
👥 Invite friends
🏆 Climb the leaderboard

Tap the button below to start your journey.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 Open Mini App', url: APP_URL }],
                    [{ text: '🎁 Claim Bonus', callback_data: 'claim_bonus' }],
                    [{ text: '👥 Invite Friends', callback_data: 'invite_friends' }],
                    [{ text: '🏆 Leaderboard', callback_data: 'leaderboard' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, welcomeMessage, options);
    });

    // /daily command
    bot.onText(/\/daily/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
🎁 *Daily Bonus*

🔥 Your Daily Bonus is Ready!

Don't lose your streak.

🎁 Claim today's reward now and keep your streak alive!
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎁 Claim Bonus', url: APP_URL }],
                    [{ text: '📊 Check Balance', callback_data: 'balance' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /earn command
    bot.onText(/\/earn/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
💰 *Earn Reminder*

💸 Ready to earn?

New rewarded ads are available.

Complete today's tasks and grow your balance.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💰 Start Earning', url: APP_URL }],
                    [{ text: '📋 View Tasks', callback_data: 'tasks' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /refer command
    bot.onText(/\/refer/, async (msg) => {
        const chatId = msg.chat.id;
        const user = Object.values(users).find(u => u.telegramId === String(chatId));
        const refCode = user?.referralCode || chatId;
        const refLink = `${APP_URL}?start=ref_${refCode}`;
        
        const message = `
👥 *Referral Campaign*

👥 Invite Friends & Earn Together!

Share your referral link:

\`${refLink}\`

🎉 Every eligible friend who joins and becomes active helps you earn more rewards.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👥 Invite Now', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=Join%20Alpha%20Pro%20and%20earn%20USDT%20rewards!` }],
                    [{ text: '📊 My Stats', callback_data: 'referral_stats' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /leaderboard command
    bot.onText(/\/leaderboard/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
🏆 *Weekly Leaderboard*

Think you can reach the Top 10?

Complete tasks, stay active, and see your name among the best users.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏆 Open Mini App', url: APP_URL }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /spin command
    bot.onText(/\/spin/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
🎡 *Lucky Spin*

🎡 Your Lucky Spin Awaits!

Try your luck today and see what reward you unlock.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎡 Spin Now', url: APP_URL }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /withdraw command
    bot.onText(/\/withdraw/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
💳 *Withdrawal Update*

💳 Good News!

Reached the minimum withdrawal requirement?

📋 Requirements:
• Minimum: $${WITHDRAWAL_RULES.MIN_AMOUNT} USDT
• ${WITHDRAWAL_RULES.MIN_REFERRALS} Referrals
• ${WITHDRAWAL_RULES.MIN_ADS_WATCHED} Ads Watched

Submit your withdrawal request directly from the Mini App.
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 Withdraw Now', url: APP_URL }],
                    [{ text: '📊 Check Balance', callback_data: 'balance' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /help command
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
📚 *Available Commands*

/start - Welcome message
/balance - Check your balance
/daily - Claim daily reward
/refer - Get referral link
/earn - Start earning
/spin - Lucky spin
/tasks - Available tasks
/leaderboard - Top earners
/withdraw - Request withdrawal
/help - This message

📱 *Open App:* ${APP_URL}

🌟 *Premium Features*
Join our community to unlock more rewards!
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 Open Mini App', url: APP_URL }],
                    [{ text: '👥 Invite Friends', callback_data: 'invite_friends' }],
                    [{ text: '📞 Support', callback_data: 'support' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /balance command
    bot.onText(/\/balance/, async (msg) => {
        const chatId = msg.chat.id;
        const user = Object.values(users).find(u => u.telegramId === String(chatId));
        
        if (!user) {
            return bot.sendMessage(chatId, 'Please start the app first using /start');
        }
        
        const wallet = getWallet(user.id);
        const referralsCount = (referrals[user.id] || []).length;
        
        const message = `
💰 *Your Balance*

Balance: $${wallet?.balance.toFixed(2) || '0.00'} USDT
Pending: $${wallet?.pendingBalance.toFixed(2) || '0.00'} USDT
Total Earned: $${wallet?.totalEarned.toFixed(2) || '0.00'} USDT
Total Withdrawn: $${wallet?.totalWithdrawn.toFixed(2) || '0.00'} USDT

📊 *Stats*
Referrals: ${referralsCount}
Ads Watched: ${user?.totalAdsWatched || 0}
Level: ${user?.level || 1}
Streak: ${user?.streak || 0} days
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💳 Wallet', url: APP_URL }],
                    [{ text: '📊 Transaction History', callback_data: 'history' }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // /tasks command
    bot.onText(/\/tasks/, async (msg) => {
        const chatId = msg.chat.id;
        const message = `
📋 *Available Tasks*

Complete tasks to earn rewards!

1️⃣ Join Telegram Channel - $0.10
2️⃣ Invite 5 Friends - $0.50
3️⃣ Watch 100 Ads - $1.00
4️⃣ Daily Login (7 days) - $0.20

Open the Mini App to start completing tasks!
        `;
        
        const options = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 View Tasks', url: APP_URL }]
                ]
            },
            parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, message, options);
    });

    // ==================== CALLBACK QUERY HANDLER ====================
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        // Answer callback
        bot.answerCallbackQuery(callbackQuery.id);
        
        switch(data) {
            case 'claim_bonus':
                bot.sendMessage(chatId, '🎁 Open the Mini App to claim your daily bonus!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎁 Claim Now', url: APP_URL }]
                        ]
                    }
                });
                break;
                
            case 'invite_friends':
                const user = Object.values(users).find(u => u.telegramId === String(chatId));
                const refCode = user?.referralCode || chatId;
                const refLink = `${APP_URL}?start=ref_${refCode}`;
                bot.sendMessage(chatId, `👥 Share your referral link:\n\n${refLink}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📤 Share', url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=Join%20Alpha%20Pro%20and%20earn%20USDT%20rewards!` }],
                            [{ text: '📋 Copy Link', callback_data: 'copy_link' }]
                        ]
                    }
                });
                break;
                
            case 'copy_link':
                const user2 = Object.values(users).find(u => u.telegramId === String(chatId));
                const code = user2?.referralCode || chatId;
                bot.sendMessage(chatId, `Your referral link: ${APP_URL}?start=ref_${code}`);
                break;
                
            case 'leaderboard':
                bot.sendMessage(chatId, '🏆 Open the Mini App to view the leaderboard!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏆 View Leaderboard', url: APP_URL }]
                        ]
                    }
                });
                break;
                
            case 'balance':
                bot.sendMessage(chatId, '💰 Use /balance to check your balance');
                break;
                
            case 'tasks':
                bot.sendMessage(chatId, '📋 Use /tasks to view available tasks');
                break;
                
            case 'referral_stats':
                const user3 = Object.values(users).find(u => u.telegramId === String(chatId));
                if (!user3) {
                    bot.sendMessage(chatId, 'Please start the app first using /start');
                    return;
                }
                const referralsCount = (referrals[user3.id] || []).length;
                const wallet = getWallet(user3.id);
                bot.sendMessage(chatId, `📊 *Your Referral Stats*\n\nTotal Referrals: ${referralsCount}\nReferral Earnings: $${wallet.referralEarnings.toFixed(2)}`, {
                    parse_mode: 'Markdown'
                });
                break;
                
            case 'history':
                bot.sendMessage(chatId, '📊 Open the Mini App to view your transaction history!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💳 View History', url: APP_URL }]
                        ]
                    }
                });
                break;
                
            case 'support':
                bot.sendMessage(chatId, '📞 *Support*\n\nFor any issues or questions, please contact:\n\n📧 Email: support@alphapro.com\n🐦 Telegram: @AlphaProSupport\n\nWe\'re here to help! 💪', {
                    parse_mode: 'Markdown'
                });
                break;
                
            default:
                bot.sendMessage(chatId, 'Open the Mini App for more options!', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🚀 Open Mini App', url: APP_URL }]
                        ]
                    }
                });
        }
    });

    // ==================== AUTO MESSAGES (CRON) ====================
    
    // Daily Bonus Reminder (Every day at 9:00 AM)
    setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 9 && now.getMinutes() === 0) {
            const allUsers = Object.values(users);
            for (const user of allUsers) {
                try {
                    await bot.sendMessage(user.telegramId, `
🎁 *Daily Bonus*

🔥 Your Daily Bonus is Ready!

Don't lose your streak.

🎁 Claim today's reward now and keep your streak alive!
                    `, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🎁 Claim Bonus', url: APP_URL }]
                            ]
                        },
                        parse_mode: 'Markdown'
                    });
                } catch (e) {
                    // User might have blocked the bot
                }
            }
            console.log('📤 Daily bonus reminders sent');
        }
    }, 60000);

    // Earn Reminder (Every day at 12:00 PM)
    setInterval(async () => {
        const now = new Date();
        if (now.getHours() === 12 && now.getMinutes() === 0) {
            const allUsers = Object.values(users);
            for (const user of allUsers) {
                try {
                    await bot.sendMessage(user.telegramId, `
💰 *Earn Reminder*

💸 Ready to earn?

New rewarded ads are available.

Complete today's tasks and grow your balance.
                    `, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💰 Start Earning', url: APP_URL }]
                            ]
                        },
                        parse_mode: 'Markdown'
                    });
                } catch (e) {}
            }
            console.log('📤 Earn reminders sent');
        }
    }, 60000);

    // Weekly Leaderboard (Every Monday at 10:00 AM)
    setInterval(async () => {
        const now = new Date();
        if (now.getDay() === 1 && now.getHours() === 10 && now.getMinutes() === 0) {
            const allUsers = Object.values(users);
            for (const user of allUsers) {
                try {
                    await bot.sendMessage(user.telegramId, `
🏆 *Weekly Leaderboard*

Think you can reach the Top 10?

Complete tasks, stay active, and see your name among the best users.
                    `, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🏆 Open Mini App', url: APP_URL }]
                            ]
                        },
                        parse_mode: 'Markdown'
                    });
                } catch (e) {}
            }
            console.log('📤 Weekly leaderboard reminders sent');
        }
    }, 60000);

    console.log('🤖 Bot commands and auto-messages initialized');
    console.log('📅 Daily reminders set for 9:00 AM, 12:00 PM');
    console.log('📅 Weekly leaderboard reminder set for Monday 10:00 AM');
}

// ==================== AUTH ROUTE ====================
app.post('/api/auth/telegram', async (req, res) => {
    try {
        const { telegramId, username, firstName, lastName, avatar, referralCode } = req.body;
        
        let user = Object.values(users).find(u => u.telegramId === telegramId);
        let isNew = false;
        
        if (!user) {
            isNew = true;
            user = createUser(telegramId, username, firstName, lastName, avatar, referralCode);
            
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
                    
                    const bonus = REWARDS.REFERRAL_BONUS;
                    const wallet = getWallet(referrer.id);
                    wallet.balance += bonus;
                    wallet.totalEarned += bonus;
                    wallet.referralEarnings += bonus;
                    addTransaction(referrer.id, 'referral_bonus', bonus, `Referral bonus for ${firstName}`);
                    
                    if (bot) {
                        try {
                            await bot.sendMessage(referrer.telegramId, 
                                `🎉 New referral! ${firstName} joined using your link.\n+$${bonus.toFixed(2)} USDT bonus!`
                            );
                        } catch (e) {}
                    }
                }
            }
        }
        
        user.lastLogin = new Date();
        
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
                isVerified: user.isVerified,
                totalAdsWatched: user.totalAdsWatched
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
                dailyAdsWatched: user.dailyAdsWatched,
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
        const user = req.user;
        const wallet = getWallet(req.userId);
        const referralsCount = (referrals[req.userId] || []).length;
        
        // Check withdrawal rules
        if (amount < WITHDRAWAL_RULES.MIN_AMOUNT) {
            return res.status(400).json({ 
                error: `Minimum withdrawal is $${WITHDRAWAL_RULES.MIN_AMOUNT} USDT`,
                rule: 'min_amount',
                required: WITHDRAWAL_RULES.MIN_AMOUNT
            });
        }
        
        if (referralsCount < WITHDRAWAL_RULES.MIN_REFERRALS) {
            return res.status(400).json({ 
                error: `You need ${WITHDRAWAL_RULES.MIN_REFERRALS} referrals to withdraw. You have ${referralsCount}.`,
                rule: 'min_referrals',
                required: WITHDRAWAL_RULES.MIN_REFERRALS,
                current: referralsCount
            });
        }
        
        if (user.totalAdsWatched < WITHDRAWAL_RULES.MIN_ADS_WATCHED) {
            return res.status(400).json({ 
                error: `You need to watch ${WITHDRAWAL_RULES.MIN_ADS_WATCHED} ads to withdraw. You have watched ${user.totalAdsWatched}.`,
                rule: 'min_ads',
                required: WITHDRAWAL_RULES.MIN_ADS_WATCHED,
                current: user.totalAdsWatched
            });
        }
        
        if (wallet.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Process withdrawal
        wallet.balance -= amount;
        wallet.pendingBalance += amount;
        wallet.totalWithdrawn += amount;
        
        addTransaction(req.userId, 'withdrawal', -amount, `Withdrawal of $${amount.toFixed(2)} USDT to ${walletAddress}`, 'pending');
        
        // Notify admin or user
        if (bot) {
            try {
                await bot.sendMessage(user.telegramId, 
                    `💸 Withdrawal request submitted!\nAmount: $${amount.toFixed(2)} USDT\nAddress: ${walletAddress}\nStatus: Pending`
                );
            } catch (e) {}
        }
        
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
        const adReward = REWARDS.AD_REWARD;
        
        const today = moment().startOf('day');
        const adsToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'ad_reward' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (adsToday >= maxAds) {
            return res.status(400).json({ error: `Daily ad limit reached (${maxAds} ads/day)` });
        }
        
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
        let reward = adReward;
        let multiplier = 1;
        
        if (isWeekend) {
            reward = REWARDS.WEEKEND_BONUS;
            multiplier = 2;
        }
        
        wallet.balance += reward;
        wallet.totalEarned += reward;
        wallet.adEarnings += reward;
        
        user.totalAdsWatched += 1;
        user.dailyAdsWatched += 1;
        
        addTransaction(req.userId, 'ad_reward', reward, `Ad reward${multiplier > 1 ? ` with ${multiplier}x weekend bonus` : ''}`);
        
        res.json({
            success: true,
            reward: reward,
            multiplier: multiplier,
            balance: wallet.balance,
            isWeekend: isWeekend
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/rewards/daily', auth, (req, res) => {
    try {
        const user = req.user;
        const wallet = getWallet(req.userId);
        const dailyReward = REWARDS.DAILY_BONUS;
        
        const today = moment().startOf('day');
        const claimed = (transactions[req.userId] || [])
            .find(t => t.type === 'daily_bonus' && moment(t.createdAt).isSame(today, 'day'));
        
        if (claimed) {
            return res.status(400).json({ error: 'Daily reward already claimed' });
        }
        
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
        
        const today = moment().startOf('day');
        const spinsToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'spin_win' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (spinsToday >= maxSpins) {
            return res.status(400).json({ error: `Daily spin limit reached (${maxSpins} spins/day)` });
        }
        
        // Spin wheel - rewards between $0.03 and $0.50
        const reward = Math.round((REWARDS.SPIN_MIN + Math.random() * (REWARDS.SPIN_MAX - REWARDS.SPIN_MIN)) * 100) / 100;
        
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
        
        const today = moment().startOf('day');
        const boxesToday = (transactions[req.userId] || [])
            .filter(t => t.type === 'mystery_box' && moment(t.createdAt).isSame(today, 'day'))
            .length;
        
        if (boxesToday >= 1) {
            return res.status(400).json({ error: 'Mystery box already claimed today' });
        }
        
        // Mystery box - rewards between $0.05 and $0.50
        const reward = Math.round((REWARDS.MYSTERY_MIN + Math.random() * (REWARDS.MYSTERY_MAX - REWARDS.MYSTERY_MIN)) * 100) / 100;
        
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
        const link = `${APP_URL}?start=ref_${code}`;
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
    console.log(`🤖 Bot: ${BOT_USERNAME}`);
    console.log(`📱 Mini App: ${APP_URL}`);
    console.log(`💰 Reward Rates:`);
    console.log(`   📺 Ad Reward: $${REWARDS.AD_REWARD}`);
    console.log(`   🎁 Daily Bonus: $${REWARDS.DAILY_BONUS}`);
    console.log(`   👥 Referral Bonus: $${REWARDS.REFERRAL_BONUS}`);
    console.log(`   🎡 Spin Reward: $${REWARDS.SPIN_MIN} - $${REWARDS.SPIN_MAX}`);
    console.log(`   ⚡ Weekend Bonus: $${REWARDS.WEEKEND_BONUS}`);
    console.log(`💳 Withdrawal Rules:`);
    console.log(`   💰 Min Amount: $${WITHDRAWAL_RULES.MIN_AMOUNT}`);
    console.log(`   👥 Min Referrals: ${WITHDRAWAL_RULES.MIN_REFERRALS}`);
    console.log(`   📺 Min Ads: ${WITHDRAWAL_RULES.MIN_ADS_WATCHED}`);
});

// ==================== ERROR HANDLING ====================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

module.exports = app;

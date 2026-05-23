const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

/* FRONTEND */
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 3000;

/* START BOT */
spawn("node", ["bot.js"], {
    cwd: __dirname,
    stdio: "inherit"
});

/* DB CONNECT */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* USER MODEL */
const User = mongoose.model("User", new mongoose.Schema({
    userId: String,
    balance: { type: Number, default: 0 },
    refs: { type: Number, default: 0 },
    adsWatched: { type: Number, default: 0 },
    refUsed: { type: Boolean, default: false },
    lastAd: { type: Number, default: 0 }
}));

/* WITHDRAW MODEL */
const Withdraw = mongoose.model("Withdraw", new mongoose.Schema({
    userId: String,
    amount: Number,
    status: { type: String, default: "pending" },
    date: { type: Date, default: Date.now }
}));

/* SETTINGS */
const MIN_WITHDRAW = 5;
const MIN_REFS = 10;
const MIN_ADS = 500;
const REF_VALUE = 0.1;

/* SAFE USER */
async function getUser(userId) {
    let user = await User.findOne({ userId });

    if (!user) {
        user = await User.create({
            userId,
            balance: 0,
            refs: 0,
            adsWatched: 0,
            refUsed: false,
            lastAd: 0
        });
    }

    return user;
}

/* PROFILE */
app.get("/profile/:id", async (req, res) => {
    const user = await getUser(req.params.id);
    res.json(user);
});

/* ADS WATCH */
app.post("/ads", async (req, res) => {
    const user = await getUser(req.body.userId);

    const now = Date.now();

    // anti spam (10 sec)
    if (now - user.lastAd < 10000) {
        return res.json({
            success: false,
            message: "Wait before watching next ad"
        });
    }

    user.lastAd = now;
    user.balance += 0.03;
    user.adsWatched += 1;

    await user.save();

    res.json({
        success: true,
        balance: user.balance,
        adsWatched: user.adsWatched
    });
});

/* REFERRAL */
app.post("/ref", async (req, res) => {
    const { userId, refId } = req.body;

    if (!refId || userId === refId) {
        return res.json({ success: false });
    }

    const user = await getUser(userId);
    const ref = await getUser(refId);

    if (user.refUsed) {
        return res.json({ success: false });
    }

    user.refUsed = true;

    ref.balance += REF_VALUE;
    ref.refs += 1;

    await user.save();
    await ref.save();

    res.json({ success: true });
});

/* WITHDRAW */
app.post("/withdraw", async (req, res) => {
    const { userId, amount } = req.body;

    const user = await getUser(userId);

    // RULE 1
    if (amount < MIN_WITHDRAW) {
        return res.json({
            success: false,
            message: "❌ Minimum withdraw is 5 USDT"
        });
    }

    // RULE 2
    if (user.balance < amount) {
        return res.json({
            success: false,
            message: "❌ Insufficient balance"
        });
    }

    // RULE 3
    if (user.refs < MIN_REFS) {
        return res.json({
            success: false,
            message: "❌ Need at least 10 referrals"
        });
    }

    // RULE 4
    if (user.adsWatched < MIN_ADS) {
        return res.json({
            success: false,
            message: "❌ Watch 500 ads to unlock withdraw"
        });
    }

    user.balance -= amount;
    await user.save();

    await Withdraw.create({
        userId,
        amount,
        status: "pending"
    });

    res.json({
        success: true,
        message: "✅ Withdraw request submitted"
    });
});

/* START SERVER */
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});

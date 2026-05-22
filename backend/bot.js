const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling:true });

const API = "http://localhost:3000";
const ADMIN_ID = process.env.ADMIN_ID;

/* START */
bot.onText(/\/start/, (msg)=>{
bot.sendMessage(msg.chat.id, "🔥 Meta Pro Earn V2 Admin Bot Running");
});

/* VIEW WITHDRAW REQUESTS */
bot.onText(/\/withdraws/, async (msg)=>{

if(String(msg.chat.id) !== ADMIN_ID){
return bot.sendMessage(msg.chat.id, "Unauthorized");
}

const res = await axios.get(`${API}/withdraws/${ADMIN_ID}`);

if(res.data.length === 0){
return bot.sendMessage(msg.chat.id, "No pending requests");
}

res.data.forEach(w=>{
bot.sendMessage(msg.chat.id,
`🧾 ID: ${w._id}\n👤 User: ${w.userId}\n💰 Amount: ${w.amount}`);
});
});

/* APPROVE WITHDRAW */
bot.onText(/\/approve (.+)/, async (msg, match)=>{

if(String(msg.chat.id) !== ADMIN_ID){
return;
}

await axios.post(`${API}/approve`, {
adminId: ADMIN_ID,
withdrawId: match[1]
});

bot.sendMessage(msg.chat.id, "✅ Approved");
});

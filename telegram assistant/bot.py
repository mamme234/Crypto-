import os
import time
import logging
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)

# ───────── LOGGING (IMPORTANT FOR RENDER) ─────────
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

print("🚀 BOT STARTING...")

# ───────── ENV SAFETY ─────────
TOKEN = os.getenv("BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not TOKEN:
    raise Exception("❌ BOT_TOKEN is missing in Render Environment Variables")

msg_count = 0
mode = "ai"

CHANNEL = "KING_OF_CRY"

# ───────── AI FUNCTION ─────────
def ai_reply(text):
    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a helpful Telegram assistant."},
                    {"role": "user", "content": text}
                ]
            },
            timeout=15
        )

        return r.json()["choices"][0]["message"]["content"]

    except Exception as e:
        print("AI ERROR:", e)
        return "⚡ AI temporarily unavailable"

# ───────── START PANEL ─────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton("🤖 AI", callback_data="ai"),
            InlineKeyboardButton("💼 LUXURY", callback_data="luxury")
        ],
        [
            InlineKeyboardButton("📊 STATS", callback_data="stats")
        ]
    ]

    await update.message.reply_text(
        "👑 Stable Telegram Assistant",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

# ───────── BUTTONS ─────────
async def buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global mode, msg_count

    query = update.callback_query
    await query.answer()

    if query.data == "ai":
        mode = "ai"
        await query.edit_message_text("🤖 AI MODE ACTIVE")

    elif query.data == "luxury":
        mode = "luxury"
        await query.edit_message_text(
            "💼 I am currently away.\n📞 Call +251934600018"
        )

    elif query.data == "stats":
        await query.edit_message_text(f"📊 Messages: {msg_count}")

# ───────── MESSAGE HANDLER ─────────
async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global msg_count

    msg_count += 1
    text = update.message.text

    # forward to channel safely
    try:
        await context.bot.send_message(CHANNEL, f"📩 {text}")
    except Exception as e:
        print("Channel error:", e)

    # AI mode
    if mode == "ai":
        reply = ai_reply(text)
        await update.message.reply_text(reply)
    else:
        await update.message.reply_text(
            "💼 I’m away right now.\nCall +251934600018"
        )

# ───────── ERROR HANDLER ─────────
async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    print("BOT ERROR:", context.error)

# ───────── APP ─────────
app = Application.builder().token(TOKEN).build()

app.add_handler(CommandHandler("start", start))
app.add_handler(CallbackQueryHandler(buttons))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))
app.add_error_handler(error_handler)

print("🚀 BOT RUNNING STABLE...")
app.run_polling()

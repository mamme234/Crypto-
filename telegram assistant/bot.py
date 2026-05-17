import os
import sys
import logging
import requests
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters
)

# ───────── LOGGING (IMPORTANT) ─────────
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

print("🚀 BOT STARTING...")

# ───────── ENV CHECK ─────────
TOKEN = os.getenv("BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

print("TOKEN EXISTS:", bool(TOKEN))
print("OPENAI EXISTS:", bool(OPENAI_API_KEY))

if not TOKEN:
    print("❌ BOT_TOKEN MISSING (Render Environment Variables)")
    sys.exit(1)

# ───────── VARIABLES ─────────
msg_count = 0
mode = "ai"
CHANNEL = "KING_OF_CRY"

# ───────── AI FUNCTION ─────────
def ai_reply(text):
    if not OPENAI_API_KEY:
        return "⚡ AI key missing"

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
                    {"role": "system", "content": "You are a Telegram assistant."},
                    {"role": "user", "content": text}
                ]
            },
            timeout=15
        )

        return r.json()["choices"][0]["message"]["content"]

    except Exception as e:
        print("AI ERROR:", e)
        return "⚡ AI unavailable"

# ───────── START COMMAND ─────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton("🤖 AI MODE", callback_data="ai"),
            InlineKeyboardButton("💼 LUXURY", callback_data="luxury")
        ],
        [
            InlineKeyboardButton("📊 STATS", callback_data="stats")
        ]
    ]

    await update.message.reply_text(
        "👑 Stable Telegram Bot Online",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

# ───────── BUTTON HANDLER ─────────
async def buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global mode

    query = update.callback_query
    await query.answer()

    if query.data == "ai":
        mode = "ai"
        await query.edit_message_text("🤖 AI MODE ENABLED")

    elif query.data == "luxury":
        mode = "luxury"
        await query.edit_message_text(
            "💼 I am currently away.\n📞 Call +251934600018"
        )

    elif query.data == "stats":
        await query.edit_message_text(f"📊 Bot is running\nMessages handled successfully")

# ───────── MESSAGE HANDLER ─────────
async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global msg_count

    msg_count += 1
    text = update.message.text

    # forward safely
    try:
        await context.bot.send_message(
            chat_id=CHANNEL,
            text=f"📩 {text}"
        )
    except Exception as e:
        print("CHANNEL ERROR:", e)

    # reply mode
    if mode == "ai":
        reply = ai_reply(text)
        await update.message.reply_text(reply)
    else:
        await update.message.reply_text(
            "💼 I am away.\n📞 Call +251934600018"
        )

# ───────── ERROR HANDLER ─────────
async def error_handler(update, context):
    print("BOT ERROR:", context.error)

# ───────── MAIN APP ─────────
def main():
    print("🚀 INITIALIZING APP...")

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(buttons))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))
    app.add_error_handler(error_handler)

    print("🚀 BOT RUNNING 24/7 SAFE MODE")

    app.run_polling(
        drop_pending_updates=True
    )

# ───────── ENTRY ─────────
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("🔥 FATAL ERROR:")
        import traceback
        traceback.print_exc()
        sys.exit(1)

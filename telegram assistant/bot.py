import os
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

# ───────── LOGGING ─────────
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    level=logging.INFO
)

print("🚀 BOT STARTING...")

# ───────── ENV ─────────
TOKEN = os.getenv("BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not TOKEN:
    print("❌ BOT_TOKEN missing")
    exit()

print("TOKEN OK:", bool(TOKEN))
print("OPENAI OK:", bool(OPENAI_API_KEY))

# ───────── SETTINGS ─────────
msg_count = 0
mode = "ai"
CHANNEL = "@KING_OF_CRY"

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
            timeout=20
        )

        data = r.json()

        if "choices" not in data:
            print("OPENAI ERROR:", data)
            return "⚡ AI error"

        return data["choices"][0]["message"]["content"]

    except Exception as e:
        print("AI EXCEPTION:", e)
        return "⚡ AI unavailable"

# ───────── START MENU ─────────
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
        "👑 Telegram Assistant Online",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

# ───────── BUTTONS ─────────
async def buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global mode

    query = update.callback_query
    await query.answer()

    if query.data == "ai":
        mode = "ai"
        await query.edit_message_text("🤖 AI MODE ON")

    elif query.data == "luxury":
        mode = "luxury"
        await query.edit_message_text(
            "💼 Away on business\n📞 +251934600018"
        )

    elif query.data == "stats":
        await query.edit_message_text(f"📊 Messages handled: {msg_count}")

# ───────── MESSAGE HANDLER ─────────
async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global msg_count

    msg_count += 1
    text = update.message.text

    # forward to channel
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

# ───────── MAIN ─────────
def main():
    print("🚀 INITIALIZING BOT...")

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(buttons))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))
    app.add_error_handler(error_handler)

    print("🚀 BOT RUNNING SUCCESSFULLY")

    app.run_polling(drop_pending_updates=True)

# ───────── RUN ─────────
if __name__ == "__main__":
    main()

import os
import time
import requests
from gtts import gTTS
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

OWNER_ID = 7154361039
CHANNEL = "KING_OF_CRY"

msg_count = 0
mode = "ai"
last_active = time.time()
replied = set()

# ───────── AI ─────────
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
                    {"role": "system", "content": "You are a professional assistant."},
                    {"role": "user", "content": text}
                ]
            }
        )
        return r.json()["choices"][0]["message"]["content"]
    except:
        return "⚡ AI unavailable"

# ───────── START PANEL ─────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🤖 AI", callback_data="ai"),
         InlineKeyboardButton("💼 Luxury", callback_data="luxury")],
        [InlineKeyboardButton("📊 Stats", callback_data="stats")]
    ]

    await update.message.reply_text(
        "👑 CEO Assistant Bot Panel",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

# ───────── BUTTONS ─────────
async def buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global mode, msg_count

    query = update.callback_query
    await query.answer()

    if query.data == "ai":
        mode = "ai"
        await query.edit_message_text("🤖 AI mode ON")

    elif query.data == "luxury":
        mode = "luxury"
        await query.edit_message_text("💼 Luxury mode ON")

    elif query.data == "stats":
        await query.edit_message_text(f"📊 Messages: {msg_count}")

# ───────── MESSAGE HANDLER ─────────
async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global msg_count, last_active

    msg_count += 1

    text = update.message.text

    # forward to channel
    try:
        await context.bot.send_message(CHANNEL, f"📩 {text}")
    except:
        pass

    # AI reply
    if mode == "ai":
        reply = ai_reply(text)
        await update.message.reply_text(reply)
        return

    # luxury mode
    await update.message.reply_text(
        "👑 I’m currently away.\nCall +251934600018 for urgent matters."
    )

# ───────── MAIN ─────────
app = Application.builder().token(TOKEN).build()

app.add_handler(CommandHandler("start", start))
app.add_handler(CallbackQueryHandler(buttons))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))

print("🚀 Bot Running...")
app.run_polling()

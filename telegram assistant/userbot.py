import os
import time
import requests
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button
from gtts import gTTS

load_dotenv()

# ───────── ENV ─────────
API_ID = int(os.getenv("API_ID"))
API_HASH = os.getenv("API_HASH")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

OWNER_ID = 7154361039
CHANNEL = "KING_OF_CRY"

client = TelegramClient("my_session", API_ID, API_HASH)

last_active = time.time()
msg_count = 0
mode = "ai"
replied_users = set()

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
                    {
                        "role": "system",
                        "content": "You are a professional Telegram assistant."
                    },
                    {
                        "role": "user",
                        "content": text
                    }
                ]
            }
        )

        data = r.json()
        return data["choices"][0]["message"]["content"]

    except Exception as e:
        return f"⚠ AI Error: {e}"

# ───────── VOICE SYSTEM ─────────
def text_to_voice(text):
    filename = "voice.mp3"
    tts = gTTS(text=text, lang="en")
    tts.save(filename)
    return filename

# ───────── CONTROL PANEL ─────────
@client.on(events.NewMessage(pattern="/panel"))
async def panel(event):
    if event.sender_id != OWNER_ID:
        return

    keyboard = [
        [
            Button.inline("🤖 AI", b"ai"),
            Button.inline("💼 Luxury", b"luxury")
        ],
        [
            Button.inline("📊 Stats", b"stats"),
            Button.inline("🔄 Reset", b"reset")
        ]
    ]

    await event.reply(
        "👑 Telegram CEO Assistant Panel",
        buttons=keyboard
    )

# ───────── BUTTONS ─────────
@client.on(events.CallbackQuery)
async def buttons(event):
    global mode
    global msg_count

    if event.sender_id != OWNER_ID:
        return

    data = event.data.decode()

    if data == "ai":
        mode = "ai"
        await event.answer("🤖 AI mode enabled")

    elif data == "luxury":
        mode = "luxury"
        await event.answer("💼 Luxury mode enabled")

    elif data == "stats":
        await event.edit(f"📊 Total messages: {msg_count}")

    elif data == "reset":
        msg_count = 0
        await event.answer("♻ Stats reset")

# ───────── TRACK ACTIVITY ─────────
@client.on(events.NewMessage(outgoing=True))
async def track(event):
    global last_active
    last_active = time.time()

# ───────── MAIN MESSAGE HANDLER ─────────
@client.on(events.NewMessage(incoming=True))
async def handler(event):
    global msg_count

    if not event.is_private:
        return

    msg_count += 1

    text = event.raw_text
    user_id = event.sender_id

    # forward to channel
    try:
        await client.send_message(
            CHANNEL,
            f"📩 New Message:\n\n{text}"
        )
    except:
        pass

    # offline check
    if time.time() - last_active < 300:
        return

    # avoid spam
    if user_id in replied_users:
        return

    replied_users.add(user_id)

    # AI mode
    if mode == "ai":
        reply = ai_reply(text)

        try:
            voice = text_to_voice(reply)

            await client.send_file(
                event.chat_id,
                voice,
                voice_note=True
            )

            os.remove(voice)

        except:
            pass

        await event.reply(reply)
        return

    # Luxury mode
    await event.reply(
        "👑 I am currently unavailable due to private business commitments.\n\n"
        "📞 For urgent matters call: +251934600018"
    )

print("🚀 Telegram Assistant Running...")

client.start()
client.run_until_disconnected()

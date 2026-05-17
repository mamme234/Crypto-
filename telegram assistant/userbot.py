from telethon import TelegramClient, events, Button
import time
import requests
from gtts import gTTS
import os

api_id = 1234567
api_hash = "YOUR_API_HASH"
OPENAI_API_KEY = "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"

client = TelegramClient("my_session", api_id, api_hash)

OWNER_ID = 7154361039
CHANNEL = "KING_OF_CRY"

last_active = time.time()
mode = "ai"

msg_count = 0
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
                    {"role": "system", "content": "Reply short, professional, helpful."},
                    {"role": "user", "content": text}
                ]
            }
        )
        return r.json()["choices"][0]["message"]["content"]
    except:
        return "I’m currently unavailable."

# ───────── VOICE SYSTEM ─────────
def text_to_voice(text, filename="voice.mp3"):
    tts = gTTS(text=text, lang="en")
    tts.save(filename)
    return filename

# ───────── CONTROL PANEL ─────────
@client.on(events.NewMessage(pattern="/panel"))
async def panel(event):
    if event.sender_id != OWNER_ID:
        return

    buttons = [
        [Button.inline("🤖 AI Mode", b"ai"),
         Button.inline("💼 Luxury", b"luxury")],

        [Button.inline("📊 Stats", b"stats"),
         Button.inline("🔄 Reset", b"reset")]
    ]

    await event.reply("👑 Control Panel:", buttons=buttons)

# ───────── BUTTON HANDLER ─────────
@client.on(events.CallbackQuery)
async def callback(event):
    global mode, msg_count

    if event.sender_id != OWNER_ID:
        return

    data = event.data.decode()

    if data == "ai":
        mode = "ai"
        await event.answer("AI mode ON")

    elif data == "luxury":
        mode = "luxury"
        await event.answer("Luxury mode ON")

    elif data == "stats":
        await event.edit(f"📊 Messages: {msg_count}")

    elif data == "reset":
        msg_count = 0
        await event.answer("Reset done")

# ───────── TRACK ACTIVITY ─────────
@client.on(events.NewMessage(outgoing=True))
async def track(event):
    global last_active
    last_active = time.time()

# ───────── MAIN SYSTEM ─────────
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
        await client.send_message(CHANNEL, f"📩 {text}")
    except:
        pass

    # offline check
    if time.time() - last_active < 300:
        return

    if user_id in replied:
        return

    replied.add(user_id)

    # ───── AI MODE ─────
    if mode == "ai":
        reply = ai_reply(text)

        # voice reply (optional)
        voice_file = text_to_voice(reply)
        await client.send_file(event.chat_id, voice_file, voice_note=True)

        await event.reply(reply)
        os.remove(voice_file)
        return

    # ───── LUXURY MODE ─────
    await event.reply("I’m currently away. Call +251934600018")

print("🚀 TELEGRAM ASSISTANT RUNNING...")
client.start()
client.run_until_disconnected()

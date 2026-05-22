require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= CONFIG ================= */

const PORT = process.env.PORT || 3000;

/* IMPORTANT FIX */
const MONGO_URL = process.env.MONGO_URL;

/* ================= FRONTEND ================= */

app.use(
  express.static(
    path.join(__dirname, "../frontend")
  )
);

/* ================= START BOT ================= */

spawn(
  "node",
  [path.join(__dirname, "bot.js")],
  {
    cwd: __dirname,
    stdio: "inherit"
  }
);

/* ================= MONGODB ================= */

mongoose.connect(MONGO_URL)

.then(() => {

  console.log("✅ MongoDB Connected");

})

.catch((err) => {

  console.log("❌ MongoDB Error");
  console.log(err);

});

/* ================= TEST ROUTE ================= */

app.get("/", (req, res) => {

  res.send("🚀 Server Running");

});

/* ================= START SERVER ================= */

app.listen(PORT, () => {

  console.log(
    `🚀 Running on port ${PORT}`
  );

});

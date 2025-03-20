import fs from "fs";
import config from '../config.cjs';
import dotenv from "dotenv";

dotenv.config();

const settingsPath = "./data/AntiDelete.json";

// Load settings or use `.env` default
let antiDeleteSettings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath))
  : { gc: process.env.ANTI_DELETE === "true", ib: process.env.ANTI_DELETE === "true" };

// Save settings function
const saveSettings = () => {
  fs.writeFileSync(settingsPath, JSON.stringify(antiDeleteSettings, null, 2));
};

// 📌 Anti-Delete Command Handler
const antiDeleteCommand = async (m, sock) => {
  const args = m.body.split(" ");
  const option = args[1]?.toLowerCase();
  const chatId = m.from;
  const isGroup = m.isGroup;

  if (!option) {
    return await sock.sendMessage(chatId, { text: "⚠️ *Usage:* `.antidelete on/off/rest/gc/ib`" }, { quoted: m });
  }

  if (option === "on") {
    antiDeleteSettings.gc = true;
    antiDeleteSettings.ib = true;
  } else if (option === "off") {
    antiDeleteSettings.gc = false;
    antiDeleteSettings.ib = false;
  } else if (option === "rest") {
    antiDeleteSettings.gc = process.env.ANTI_DELETE === "true";
    antiDeleteSettings.ib = process.env.ANTI_DELETE === "true";
  } else if (option === "gc") {
    antiDeleteSettings.gc = true;
    antiDeleteSettings.ib = false;
  } else if (option === "ib") {
    antiDeleteSettings.gc = false;
    antiDeleteSettings.ib = true;
  } else {
    return await sock.sendMessage(chatId, { text: "⚠️ *Usage:* `.antidelete on/off/rest/gc/ib`" }, { quoted: m });
  }

  saveSettings();
  return await sock.sendMessage(chatId, {
    text: `✅ *Anti-Delete Updated!*\n🔹 Groups: ${antiDeleteSettings.gc ? "Enabled" : "Disabled"}\n🔹 Inbox: ${antiDeleteSettings.ib ? "Enabled" : "Disabled"}`,
  }, { quoted: m });
};

export default antiDeleteCommand;

import fs from "fs";
import config from "../config.cjs";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const settingsPath = "./data/AntiDelete.json";

// Load settings or set defaults
let antiDeleteSettings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath))
  : { gc: process.env.ANTI_DELETE === "true", ib: process.env.ANTI_DELETE === "true" };

// ✅ Save settings function
const saveSettings = () => {
  fs.writeFileSync(settingsPath, JSON.stringify(antiDeleteSettings, null, 2));
};

// 📌 Handle Deleted Messages
const messageRevokeHandler = async (m, sock) => {
  const chatId = m.remoteJid;
  const isGroup = chatId.endsWith("@g.us");

  if ((isGroup && !antiDeleteSettings.gc) || (!isGroup && !antiDeleteSettings.ib)) return;
  if (!m.message?.protocolMessage) return;

  const { protocolMessage } = m.message;
  const { key: deletedMessageKey, type: protocolType } = protocolMessage;
  if (protocolType !== 0) return;

  try {
    const msg = await sock.loadMessage(chatId, deletedMessageKey);
    if (!msg) return;

    const senderJid = msg.key.participant || msg.key.remoteJid;
    const timestamp = new Date().toLocaleString();
    let text = `🚨 *Anti-Delete Alert!*\n👤 *Sender:* @${senderJid.split("@")[0]}\n🕒 *Time:* ${timestamp}`;

    // Media Handling
    const mediaTypes = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];
    const messageType = Object.keys(msg.message || {})[0];

    if (mediaTypes.includes(messageType)) {
      const buffer = await downloadMediaMessage(msg, "buffer").catch(() => null);
      if (buffer) {
        let mediaPayload;
        const mediaOptions = { quoted: m, caption: text, mentions: [senderJid] };

        switch (messageType) {
          case "imageMessage":
            mediaPayload = { image: buffer, ...mediaOptions };
            break;
          case "videoMessage":
            mediaPayload = { video: buffer, mimetype: "video/mp4", ...mediaOptions };
            break;
          case "audioMessage":
            mediaPayload = { audio: buffer, mimetype: "audio/ogg", ptt: true, ...mediaOptions };
            break;
          case "stickerMessage":
            mediaPayload = { sticker: buffer };
            break;
          default:
            mediaPayload = { document: buffer, mimetype: msg.message[messageType]?.mimetype, ...mediaOptions };
        }

        await sock.sendMessage(chatId, mediaPayload);
        return;
      }
    }

    // Text Message Handling
    const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (textMessage) {
      await sock.sendMessage(chatId, { text: `${text}\n\n📝 *Message:* ${textMessage}`, mentions: [senderJid] }, { quoted: m });
    }
  } catch (error) {
    console.error("Anti-Delete Error:", error);
  }
};

// ✅ Command Handler for Enable/Disable
const handleAntiDeleteCommand = async (m, sock) => {
  const chatId = m.from;
  const text = m.body.trim().toLowerCase();
  const senderJid = m.sender;
  const isGroup = m.isGroup;

  // Check if the sender is an admin
  const participants = isGroup ? await sock.groupMetadata(chatId).then((meta) => meta.participants) : [];
  const groupAdmins = isGroup ? participants.filter((p) => p.admin).map((p) => p.id) : [];
  const isAdmin = isGroup ? groupAdmins.includes(senderJid) : false;
  const isOwner = senderJid === config.OWNER_NUMBER + "@s.whatsapp.net";

  if (!isOwner && isGroup && !isAdmin) {
    return sock.sendMessage(chatId, { text: "❌ *Only Admins can change Anti-Delete settings!*" }, { quoted: m });
  }

  switch (text) {
    case ".antidelete on":
      antiDeleteSettings.gc = true;
      antiDeleteSettings.ib = true;
      saveSettings();
      return sock.sendMessage(chatId, { text: "✅ *Anti-Delete enabled for both Groups & Private Chats!*" }, { quoted: m });

    case ".antidelete off":
      antiDeleteSettings.gc = false;
      antiDeleteSettings.ib = false;
      saveSettings();
      return sock.sendMessage(chatId, { text: "❌ *Anti-Delete disabled for both Groups & Private Chats!*" }, { quoted: m });

    case ".antidel gc":
      antiDeleteSettings.gc = !antiDeleteSettings.gc;
      saveSettings();
      return sock.sendMessage(chatId, { text: `🔄 *Anti-Delete for Groups is now* ${antiDeleteSettings.gc ? "✅ ON" : "❌ OFF"}` }, { quoted: m });

    case ".antidel ib":
      antiDeleteSettings.ib = !antiDeleteSettings.ib;
      saveSettings();
      return sock.sendMessage(chatId, { text: `🔄 *Anti-Delete for Private Chats is now* ${antiDeleteSettings.ib ? "✅ ON" : "❌ OFF"}` }, { quoted: m });

    case ".antidel reset":
      antiDeleteSettings.gc = process.env.ANTI_DELETE === "true";
      antiDeleteSettings.ib = process.env.ANTI_DELETE === "true";
      saveSettings();
      return sock.sendMessage(chatId, { text: "🔄 *Anti-Delete settings reset to ENV default!*" }, { quoted: m });

    default:
      return;
  }
};

// ✅ Export as Default Function for Plugin Loader
export default async function (m, sock) {
  if (m.message?.protocolMessage) {
    await messageRevokeHandler(m, sock);
  }

  if (m.body?.startsWith(".antidelete") || m.body?.startsWith(".antidel")) {
    await handleAntiDeleteCommand(m, sock);
  }
}

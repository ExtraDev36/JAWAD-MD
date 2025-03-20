import fs from "fs";
import config from '../config.cjs';
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const settingsPath = "./data/AntiDelete.json";

// Load settings
let antiDeleteSettings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath))
  : { gc: process.env.ANTI_DELETE === "true", ib: process.env.ANTI_DELETE === "true" };

// 📌 Handle Deleted Messages (Send to Bot Number Only)
const messageRevokeHandler = async (m, sock) => {
  const chatId = m.remoteJid;
  const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net"; // Bot's number
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

        await sock.sendMessage(botNumber, mediaPayload);
        return;
      }
    }

    // Text Message Handling
    const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (textMessage) {
      await sock.sendMessage(botNumber, { text: `${text}\n\n📝 *Message:* ${textMessage}`, mentions: [senderJid] }, { quoted: m });
    }
  } catch (error) {
    console.error("Anti-Delete Error:", error);
  }
};

export { antiDeleteCommand, messageRevokeHandler };

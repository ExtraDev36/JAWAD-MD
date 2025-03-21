import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import config from '../config.cjs';

const settingsPath = './mydata/AntiDelete.json';
let antiDeleteSettings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath))
    : {};

const saveSettings = () => fs.writeFileSync(settingsPath, JSON.stringify(antiDeleteSettings, null, 2));

const antiDeleteCommand = async (m, Matrix) => {
    const botNumber = Matrix.user.id.split(':')[0] + '@s.whatsapp.net';
    if (m.sender !== botNumber) return await Matrix.sendMessage(m.chat, { text: '❌ *Only the bot can use this command!*' }, { quoted: m });

    const args = m.body.slice(config.PREFIX.length).trim().split(/ +/);
    if (args.length < 2) return await Matrix.sendMessage(m.chat, { text: '⚠️ *Use:* `.antidelete on` or `.antidelete off`' }, { quoted: m });

    const option = args[1].toLowerCase();
    if (option === 'on') {
        antiDeleteSettings[m.chat] = true;
        saveSettings();
        return await Matrix.sendMessage(m.chat, { text: '✅ *Anti-Delete is now activated!*' }, { quoted: m });
    }
    if (option === 'off') {
        delete antiDeleteSettings[m.chat];
        saveSettings();
        return await Matrix.sendMessage(m.chat, { text: '❌ *Anti-Delete has been deactivated!*' }, { quoted: m });
    }

    return await Matrix.sendMessage(m.chat, { text: '⚠️ *Invalid option!* Use `.antidelete on` or `.antidelete off`' }, { quoted: m });
};

const messageRevokeHandler = async (m, Matrix) => {
    const botNumber = Matrix.user.id.split(':')[0] + '@s.whatsapp.net';
    const globalAntiDelete = process.env.ANTI_DELETE === 'true';  // Default setting from .env

    // Check if user enabled/disabled Anti-Delete
    const isEnabled = antiDeleteSettings[m.key.remoteJid] ?? globalAntiDelete;
    if (!isEnabled || m.key.fromMe || !m.message?.protocolMessage) return;

    const { remoteJid: chat } = m.key;
    const { protocolMessage } = m.message;
    const { key: deletedMessageKey, type: protocolType } = protocolMessage;

    if (protocolType !== 0) return;

    try {
        const msg = await Matrix.loadMessage(chat, deletedMessageKey);
        if (!msg) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const senderName = msg.pushName || 'Unknown';
        const timestamp = new Date().toLocaleString();

        // Forward the deleted message to bot's number
        const forwardChat = botNumber;
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        let forwardText = `🚨 *Deleted Message Detected!*\n👤 *Sender:* @${sender.split('@')[0]}\n🕒 *Time:* ${timestamp}`;
        if (textMessage) forwardText += `\n\n📝 *Message:* ${textMessage}`;

        await Matrix.sendMessage(forwardChat, { text: forwardText, mentions: [sender] });

        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        const messageType = Object.keys(msg.message || {})[0];

        if (mediaTypes.includes(messageType)) {
            const buffer = await downloadMediaMessage(msg, 'buffer').catch(() => null);
            if (buffer) {
                let mediaPayload;
                const mediaOptions = { quoted: m, mentions: [sender] };

                switch (messageType) {
                    case 'imageMessage': mediaPayload = { image: buffer, ...mediaOptions }; break;
                    case 'videoMessage': mediaPayload = { video: buffer, mimetype: 'video/mp4', ...mediaOptions }; break;
                    case 'audioMessage': mediaPayload = { audio: buffer, mimetype: 'audio/ogg', ptt: true, ...mediaOptions }; break;
                    case 'stickerMessage': mediaPayload = { sticker: buffer }; break;
                    default: mediaPayload = { document: buffer, mimetype: msg.message[messageType]?.mimetype, ...mediaOptions };
                }

                await Matrix.sendMessage(forwardChat, mediaPayload); // Forward media to bot
            }
        }
    } catch (error) {
        console.error('AntiDelete Error:', error);
    }
};

export { antiDeleteCommand, messageRevokeHandler };

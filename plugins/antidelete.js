import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import config from '../config.cjs';

const settingsPath = './data/AntiDelete.json';
let antiDeleteSettings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath))
    : {};

const saveSettings = () => fs.writeFileSync(settingsPath, JSON.stringify(antiDeleteSettings, null, 2));

const antiDeleteCommand = async (m, Matrix) => {
    // ✅ Extract command
    const args = m.body.slice(config.PREFIX.length).trim().split(/ +/);
    const cmd = args[0]?.toLowerCase();

    // ✅ Only allow `.antidelete` or `.antidel`
    if (!['antidelete', 'antidel'].includes(cmd)) return;

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
    if (!m.message?.protocolMessage) return;

    const chat = m.key.remoteJid;
    const deletedMessageKey = m.message.protocolMessage.key;

    // ✅ Check if Anti-Delete is enabled
    const isEnabled = antiDeleteSettings[chat] ?? process.env.ANTI_DELETE === 'true';
    if (!isEnabled) return;

    try {
        const msg = await Matrix.loadMessage(chat, deletedMessageKey);
        if (!msg) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        const timestamp = new Date().toLocaleString();

        let forwardText = `🚨 *Deleted Message Detected!*\n👤 *Sender:* @${sender.split('@')[0]}\n🕒 *Time:* ${timestamp}`;
        if (textMessage) forwardText += `\n\n📝 *Message:* ${textMessage}`;

        await Matrix.sendMessage(chat, { text: forwardText, mentions: [sender] });

        // ✅ Forward media if exists
        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'];
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
                }

                await Matrix.sendMessage(chat, mediaPayload);
            }
        }
    } catch (error) {
        console.error('AntiDelete Error:', error);
    }
};

export { antiDeleteCommand, messageRevokeHandler };

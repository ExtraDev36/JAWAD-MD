import { downloadMediaMessage } from '@whiskeysockets/baileys';
import config from '../config.cjs';

const antiDeleteHandler = async (m, sock) => {
    try {
        if (!config.ANTI_DELETE || !m.message?.protocolMessage) return;

        const botNumber = Matrix.user.id.split(':')[0] + '@s.whatsapp.net'; // ✅ Bot ke IB me forward hoga
        const { remoteJid: chat } = m.key;
        const { protocolMessage } = m.message;
        const { key: deletedMessageKey, type: protocolType } = protocolMessage;

        if (protocolType !== 0) return;

        const msg = await sock.loadMessage(chat, deletedMessageKey);
        if (!msg) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        const timestamp = new Date().toLocaleString();

        let forwardText = `🚨 *Deleted Message Detected!*\n👤 *Sender:* @${sender.split('@')[0]}\n🕒 *Time:* ${timestamp}`;
        if (textMessage) forwardText += `\n\n📝 *Message:* ${textMessage}`;

        // ✅ Ab sirf bot ke inbox (IB) me message forward hoga
        await sock.sendMessage(botNumber, { text: forwardText, mentions: [sender] });

        const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
        const messageType = Object.keys(msg.message || {})[0];

        if (mediaTypes.includes(messageType)) {
            const buffer = await downloadMediaMessage(msg, 'buffer').catch(() => null);
            if (buffer) {
                let mediaPayload;
                const mediaOptions = { mentions: [sender] };

                switch (messageType) {
                    case 'imageMessage': mediaPayload = { image: buffer, ...mediaOptions }; break;
                    case 'videoMessage': mediaPayload = { video: buffer, mimetype: 'video/mp4', ...mediaOptions }; break;
                    case 'audioMessage': mediaPayload = { audio: buffer, mimetype: 'audio/ogg', ptt: true, ...mediaOptions }; break;
                    case 'stickerMessage': mediaPayload = { sticker: buffer }; break;
                    default: mediaPayload = { document: buffer, mimetype: msg.message[messageType]?.mimetype, ...mediaOptions };
                }

                await sock.sendMessage(botNumber, mediaPayload);
            }
        }
    } catch (error) {
        console.error('❌ Error in Anti-Delete handler:', error);
        await sock.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', { text: `🚨 *Error in Anti-Delete Handler:*\n${error}` });
    }
};

export default antiDeleteHandler;

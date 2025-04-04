import pkg from '@whiskeysockets/baileys';
const { proto, downloadContentFromMessage } = pkg;
import config from '../config.cjs';

class AntiDeleteSystem {
    constructor() {
        this.enabled = config.ANTI_DELETE || false;
        this.messageCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanExpiredMessages(), this.cacheExpiry);
        this.botNumber = ''; // Will be set later
    }

    cleanExpiredMessages() {
        const now = Date.now();
        for (const [key, msg] of this.messageCache.entries()) {
            if (now - msg.timestamp > this.cacheExpiry) {
                this.messageCache.delete(key);
            }
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        });
    }

    destroy() {
        clearInterval(this.cleanupInterval);
    }
}

const antiDelete = new AntiDeleteSystem();

const AntiDelete = async (m, Matrix) => {
    antiDelete.botNumber = Matrix.user.id.split(':')[0]?.split('@')[0] + '@s.whatsapp.net';
    const prefix = config.PREFIX;
    const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const text = m.body?.slice(prefix.length).trim().split(' ') || [];
    const cmd = text[0]?.toLowerCase();
    const subCmd = text[1]?.toLowerCase();

    const formatJid = (jid) => jid ? jid.replace(/@s\.whatsapp\.net|@g\.us/g, '') : 'Unknown';
    
    const getChatInfo = async (jid) => {
        if (!jid) return { name: 'Unknown Chat', isGroup: false };
        
        if (jid.includes('@g.us')) {
            try {
                const groupMetadata = await Matrix.groupMetadata(jid);
                return {
                    name: groupMetadata?.subject || 'Unknown Group',
                    isGroup: true
                };
            } catch {
                return { name: 'Unknown Group', isGroup: true };
            }
        }
        return { name: 'Private Chat', isGroup: false };
    };

    // Command handler
    if (cmd === 'antidelete') {
        if (m.sender !== ownerJid) {
            await m.reply('🚫 *You are not authorized to use this command!*');
            return;
        }
        
        try {
            const mode = config.DELETE_PATH === "same" ? "Same Chat + Bot Inbox" : "Owner PM";
            const responses = {
                on: 
`━━〔 *ANTI-DELETE SYSTEM* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *Status:* ✅ Activated
┃◈┃• *Scope:* All Chats
┃◈┃• *Mode:* ${mode}
┃◈┃• *Cache:* 5 Minutes
┃◈╰─────────────·๏
🔰 *Deleted messages will now be recovered!*`,

                off: 
`━━〔 *ANTI-DELETE SYSTEM* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *Status:* ❌ Deactivated
┃◈┃• *Cache:* Cleared
┃◈╰─────────────·๏
⚠️ *Message recovery is now disabled!*`,

                help: 
`━━〔 *ANTI-DELETE HELP* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *${prefix}antidelete on* - Enable protection
┃◈┃• *${prefix}antidelete off* - Disable protection
┃◈╰─────────────·๏
📊 *Current Status:* ${antiDelete.enabled ? '✅ Active' : '❌ Inactive'}
🌐 *Current Mode:* ${mode}`
            };

            if (subCmd === 'on') {
                antiDelete.enabled = true;
                await m.reply(responses.on);
            } 
            else if (subCmd === 'off') {
                antiDelete.enabled = false;
                antiDelete.messageCache.clear();
                await m.reply(responses.off);
            }
            else {
                await m.reply(responses.help);
            }
            await m.React('✅');
            return;
        } catch (error) {
            console.error('AntiDelete Command Error:', error);
            await m.React('❌');
        }
    }

    // Message caching
    Matrix.ev.on('messages.upsert', async ({ messages }) => {
        if (!antiDelete.enabled || !messages?.length) return;
        
        for (const msg of messages) {
            if (msg.key.fromMe || !msg.message || msg.key.remoteJid === 'status@broadcast') continue;
            
            try {
                const content = msg.message.conversation || 
                              msg.message.extendedTextMessage?.text ||
                              msg.message.imageMessage?.caption ||
                              msg.message.videoMessage?.caption ||
                              msg.message.documentMessage?.caption;

                let media, type, mimetype;
                
                const mediaTypes = ['image', 'video', 'audio', 'sticker', 'document'];
                for (const mediaType of mediaTypes) {
                    if (msg.message[`${mediaType}Message`]) {
                        const mediaMsg = msg.message[`${mediaType}Message`];
                        try {
                            const stream = await downloadContentFromMessage(mediaMsg, mediaType);
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                buffer = Buffer.concat([buffer, chunk]);
                            }
                            media = buffer;
                            type = mediaType;
                            mimetype = mediaMsg.mimetype;
                            break;
                        } catch (e) {
                            console.error(`Error downloading ${mediaType} media:`, e);
                        }
                    }
                }
                
                if (msg.message.audioMessage?.ptt) {
                    try {
                        const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }
                        media = buffer;
                        type = 'voice';
                        mimetype = msg.message.audioMessage.mimetype;
                    } catch (e) {
                        console.error('Error downloading voice message:', e);
                    }
                }
                
                if (content || media) {
                    antiDelete.messageCache.set(msg.key.id, {
                        content,
                        media,
                        type,
                        mimetype,
                        sender: msg.key.participant || msg.key.remoteJid,
                        senderFormatted: `@${formatJid(msg.key.participant || msg.key.remoteJid)}`,
                        timestamp: Date.now(),
                        chatJid: msg.key.remoteJid
                    });
                }
            } catch (error) {
                console.error('Error caching message:', error);
            }
        }
    });

    // Deletion handler
    Matrix.ev.on('messages.update', async (updates) => {
        if (!antiDelete.enabled || !updates?.length) return;

        for (const update of updates) {
            try {
                const { key, update: updateData } = update;
                
                const isDeleted = updateData?.messageStubType === proto.WebMessageInfo.StubType.REVOKE || 
                                 updateData?.status === proto.WebMessageInfo.Status.DELETED;
                
                if (!isDeleted || key.fromMe || !antiDelete.messageCache.has(key.id)) continue;

                const cachedMsg = antiDelete.messageCache.get(key.id);
                antiDelete.messageCache.delete(key.id);
                
                // Always send log to bot's inbox
                const logDestination = antiDelete.botNumber;
                // Send to same chat or owner based on config
                const mainDestination = config.DELETE_PATH === "same" ? key.remoteJid : ownerJid;
                
                const chatInfo = await getChatInfo(cachedMsg.chatJid);
                const deletedBy = updateData?.participant ? 
                    `@${formatJid(updateData.participant)}` : 
                    (key.participant ? `@${formatJid(key.participant)}` : 'Unknown');

                const messageType = cachedMsg.type ? 
                    cachedMsg.type.charAt(0).toUpperCase() + cachedMsg.type.slice(1) : 
                    'Text';
                
                const baseInfo = 
`━━〔 *DELETED ${messageType} RECOVERED* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *Sender:* ${cachedMsg.senderFormatted}
┃◈┃• *Deleted By:* ${deletedBy}
┃◈┃• *Chat:* ${chatInfo.name}${chatInfo.isGroup ? ' (Group)' : ''}
┃◈┃• *Deleted At:* ${antiDelete.formatTime(Date.now())}
┃◈╰─────────────·๏`;

                // Send to main destination
                if (cachedMsg.media) {
                    const messageOptions = {
                        [cachedMsg.type]: cachedMsg.media,
                        mimetype: cachedMsg.mimetype,
                        caption: baseInfo
                    };

                    if (cachedMsg.type === 'voice') messageOptions.ptt = true;

                    await Matrix.sendMessage(mainDestination, messageOptions);
                    await Matrix.sendMessage(logDestination, messageOptions);
                } 
                else if (cachedMsg.content) {
                    const textMessage = `${baseInfo}\n💬 *Content:*\n${cachedMsg.content}`;
                    await Matrix.sendMessage(mainDestination, { text: textMessage });
                    await Matrix.sendMessage(logDestination, { text: textMessage });
                }
            } catch (error) {
                console.error('Error handling deleted message:', error);
            }
        }
    });
};

export default AntiDelete;

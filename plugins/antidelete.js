import pkg from '@whiskeysockets/baileys';
const { proto, downloadContentFromMessage } = pkg;
import config from '../config.cjs';
import fs from 'fs';
import path from 'path';

// Database file path
const DB_FILE = path.join(process.cwd(), 'database.json');

class AntiDeleteSystem {
    constructor() {
        this.enabled = config.ANTI_DELETE || false; // Use config default
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanExpiredMessages(), this.cacheExpiry);
        this.loadDatabase();
    }

    // Load database from file
    loadDatabase() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const data = fs.readFileSync(DB_FILE, 'utf8');
                this.messageCache = new Map(JSON.parse(data));
            } else {
                this.messageCache = new Map();
            }
        } catch (error) {
            console.error('Error loading database:', error);
            this.messageCache = new Map();
        }
    }

    // Save database to file
    saveDatabase() {
        try {
            const data = JSON.stringify(Array.from(this.messageCache.entries()));
            fs.writeFileSync(DB_FILE, data);
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    // Add message to cache and save to file
    addMessage(key, message) {
        this.messageCache.set(key, message);
        this.saveDatabase();
    }

    // Delete message from cache and update file
    deleteMessage(key) {
        if (this.messageCache.has(key)) {
            this.messageCache.delete(key);
            this.saveDatabase();
        }
    }

    cleanExpiredMessages() {
        const now = Date.now();
        let changed = false;
        
        for (const [key, msg] of this.messageCache.entries()) {
            if (now - msg.timestamp > this.cacheExpiry) {
                this.messageCache.delete(key);
                changed = true;
            }
        }
        
        if (changed) {
            this.saveDatabase();
        }
    }

    formatTime(timestamp) {
        const options = {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        };
        return new Date(timestamp).toLocaleString('en-US', options);
    }

    destroy() {
        clearInterval(this.cleanupInterval);
        this.saveDatabase();
    }
}

const antiDelete = new AntiDeleteSystem();

const AntiDelete = async (m, Matrix) => {
    const botNumber = await Matrix.decodeJid(Matrix.user.id);
    const ownerJid = botNumber + '@s.whatsapp.net';
    const isCreator = [ownerJid].includes(m.sender);
    const prefix = config.PREFIX;
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
        if (!isCreator) {
            await m.reply('🚫 *You are not authorized to use this command!*');
            return;
        }
        
        try {
            const mode = config.ANTI_DELETE_PATH === "same" ? "Same Chat" : "Owner PM";
            const responses = {
                on: `━━〔 *ANTI-DELETE* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃• *Status:* 🟢 ENABLED\n┃◈┃• *Protection:* ACTIVE\n┃◈┃• *Scope:* All Chats\n┃◈┃• *Cache:* 5 minutes\n┃◈┃• *Mode:* ${mode}\n┃◈╰─────────────·๏\n┃◈• Deleted messages will be recovered!`,
                off: `━━〔 *ANTI-DELETE* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃• *Status:* 🔴 DISABLED\n┃◈┃• *Protection:* INACTIVE\n┃◈┃• *Cache:* Cleared\n┃◈╰─────────────·๏\n┃◈• Deleted messages will not be recovered`,
                help: `━━〔 *ANTI-DELETE* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃• *Command:* ${prefix}antidelete on\n┃◈┃• *Description:* Enable anti-delete\n┃◈┃• *Command:* ${prefix}antidelete off\n┃◈┃• *Description:* Disable anti-delete\n┃◈╰─────────────·๏\n┃◈• *Current Status:* ${antiDelete.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n┃◈• *Current Mode:* ${mode}`,
                status: `━━〔 *ANTI-DELETE STATUS* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃• *Current State:* ${antiDelete.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n┃◈┃• *Mode:* ${mode}\n┃◈┃• *Cache Duration:* 5 minutes\n┃◈╰─────────────·๏`
            };

            if (subCmd === 'on') {
                antiDelete.enabled = true;
                await m.reply(responses.on);
            } 
            else if (subCmd === 'off') {
                antiDelete.enabled = false;
                antiDelete.messageCache.clear();
                antiDelete.saveDatabase();
                await m.reply(responses.off);
            }
            else if (subCmd === 'status') {
                await m.reply(responses.status);
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
                
                // Voice note handling
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
                    antiDelete.addMessage(msg.key.id, {
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
                
                // Check if message was actually deleted
                const isDeleted = updateData?.messageStubType === proto.WebMessageInfo.StubType.REVOKE || 
                                 updateData?.status === proto.WebMessageInfo.Status.DELETED;
                
                if (!isDeleted || key.fromMe || !antiDelete.messageCache.has(key.id)) {
                    continue;
                }

                const cachedMsg = antiDelete.messageCache.get(key.id);
                antiDelete.deleteMessage(key.id);
                
                const destination = config.ANTI_DELETE_PATH === "same" ? key.remoteJid : ownerJid;
                const chatInfo = await getChatInfo(cachedMsg.chatJid);
                
                const deletedBy = updateData?.participant ? 
                    `@${formatJid(updateData.participant)}` : 
                    (key.participant ? `@${formatJid(key.participant)}` : 'Unknown');

                const messageType = cachedMsg.type ? 
                    cachedMsg.type.charAt(0).toUpperCase() + cachedMsg.type.slice(1) : 
                    'Text';
                
                const baseInfo = `━━〔 *ANTIDELETE ALERT ⚠️* 〕━━┈⊷\n┃◈╭─────────────·๏\n┃◈┃• *Type:* ${messageType}\n┃◈┃• *Sender:* ${cachedMsg.senderFormatted}\n┃◈┃• *Deleted By:* ${deletedBy}\n┃◈┃• *Chat:* ${chatInfo.name}${chatInfo.isGroup ? ' (Group)' : ''}\n┃◈┃• *Sent At:* ${antiDelete.formatTime(cachedMsg.timestamp)}\n┃◈┃• *Deleted At:* ${antiDelete.formatTime(Date.now())}\n┃◈╰─────────────·๏`;

                if (cachedMsg.media) {
                    const messageOptions = {
                        [cachedMsg.type]: cachedMsg.media,
                        mimetype: cachedMsg.mimetype,
                        caption: baseInfo
                    };

                    if (cachedMsg.type === 'voice') {
                        messageOptions.ptt = true;
                    }

                    await Matrix.sendMessage(destination, messageOptions);
                } 
                else if (cachedMsg.content) {
                    await Matrix.sendMessage(destination, {
                        text: `${baseInfo}\n┃◈• *Content:*\n${cachedMsg.content}`
                    });
                }
            } catch (error) {
                console.error('Error handling deleted message:', error);
            }
        }
    });
};

export default AntiDelete;

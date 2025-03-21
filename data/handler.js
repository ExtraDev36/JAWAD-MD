import { serialize } from '../lib/Serializer.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../config.cjs';
import { smsg } from '../lib/myfunc.cjs';
import { handleAntilink } from './antilink.js';
import antiDeleteHandler from './antideleteHandler.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to get group admins
export const getGroupAdmins = (participants) => {
    return participants.filter(i => i.admin === "superadmin" || i.admin === "admin").map(i => i.id);
};

const Handler = async (chatUpdate, sock, logger) => {
    try {
        if (chatUpdate.type !== 'notify') return;

        const m = serialize(JSON.parse(JSON.stringify(chatUpdate.messages[0])), sock, logger);
        if (!m.message) return;

        const botNumber = await sock.decodeJid(sock.user.id);
        const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
        const participants = m.isGroup ? await sock.groupMetadata(m.from).then(metadata => metadata.participants) : [];
        const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botNumber) : false;
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false;
        const isCreator = [ownerNumber, botNumber].includes(m.sender);

        if (!sock.public && !isCreator) return;

        // ✅ Command Detection Fix
        const PREFIX = /^[\\/!#.]/;
        const isCOMMAND = (body) => PREFIX.test(body);
        const prefixMatch = isCOMMAND(m.body) ? m.body.match(PREFIX) : null;
        const prefix = prefixMatch ? prefixMatch[0] : '/';
        const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
        const text = m.body.slice(prefix.length + cmd.length).trim();

        // ✅ Anti-Delete should only run on deleted messages, not commands
        if (!isCOMMAND(m.body)) {
            await antiDeleteHandler(m, sock);
        }

        // Handle Anti-Link System
        await handleAntilink(m, sock, logger, isBotAdmins, isAdmins, isCreator);

        // ✅ Load Plugins Dynamically
        const pluginDir = path.resolve(__dirname, '..', 'plugins');
        
        try {
            const pluginFiles = await fs.readdir(pluginDir);
            for (const file of pluginFiles) {
                if (file.endsWith('.js')) {
                    const pluginPath = path.join(pluginDir, file);
                    try {
                        const pluginModule = await import(`file://${pluginPath}`);
                        const loadPlugins = pluginModule.default;
                        await loadPlugins(m, sock);
                    } catch (err) {
                        console.error(`❌ Failed to load plugin: ${pluginPath}`, err);
                    }
                }
            }
        } catch (err) {
            console.error(`❌ Plugin folder not found: ${pluginDir}`, err);
        }

    } catch (e) {
        console.error("❌ Error in handler:", e);
    }
};

export default Handler;

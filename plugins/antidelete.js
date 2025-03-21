import config from '../config.cjs';

const antiDeleteCommand = async (m, sock) => {
    try {
        const isCreator = m.sender === config.OWNER_NUMBER + '@s.whatsapp.net';
        if (!isCreator) return m.reply("*📛 OWNER ONLY COMMAND*");

        const cmd = m.body.trim().split(/\s+/)[0].slice(config.PREFIX.length).toLowerCase();
        const text = m.body.slice(cmd.length + config.PREFIX.length).trim();
        let responseMessage;

        if (text === 'on') {
            config.ANTI_DELETE = true;
            responseMessage = "✅ *Anti-Delete is now enabled.*\nDeleted messages will be restored!";
        } else if (text === 'off') {
            config.ANTI_DELETE = false;
            responseMessage = "❌ *Anti-Delete is now disabled.*\nDeleted messages will not be recovered.";
        } else {
            responseMessage = "⚠️ *Usage:*\n- `.antidelete on` → Enable Anti-Delete\n- `.antidelete off` → Disable Anti-Delete";
        }

        await sock.sendMessage(m.from, { text: responseMessage }, { quoted: m });

    } catch (error) {
        console.error("❌ Error in Anti-Delete Command:", error);
        await sock.sendMessage(m.from, { text: '🚨 *Error processing your request.*' }, { quoted: m });
    }
};

export default antiDeleteCommand;

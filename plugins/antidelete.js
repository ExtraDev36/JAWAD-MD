import config from "../config.cjs";

const antideleteCommand = async (m, Matrix) => {
  try {
    const botNumber = await Matrix.decodeJid(Matrix.user.id);
    const isCreator = [botNumber, config.OWNER_NUMBER + "@s.whatsapp.net"].includes(m.sender);
    if (!isCreator) return Matrix.sendMessage(m.from, { text: "*📛 OWNER ONLY COMMAND*" }, { quoted: m });

    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim();

    let responseMessage;
    if (text === "on") {
      config.ANTI_DELETE = true;
      responseMessage = "✅ *Anti-Delete is now enabled.*\nDeleted messages will be restored!";
    } else if (text === "off") {
      config.ANTI_DELETE = false;
      responseMessage = "❌ *Anti-Delete is now disabled.*\nDeleted messages will not be recovered.";
    } else {
      responseMessage = "⚠️ *Usage:*\n- `.antidelete on` → Enable Anti-Delete\n- `.antidelete off` → Disable Anti-Delete";
    }

    await Matrix.sendMessage(m.from, { text: responseMessage }, { quoted: m });

  } catch (error) {
    console.error("❌ Error in Anti-Delete Command:", error);
    await Matrix.sendMessage(m.from, { text: "🚨 *Error processing your request.*" }, { quoted: m });
  }
};

export default antideleteCommand;

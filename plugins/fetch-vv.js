import pkg from '@whiskeysockets/baileys';
const { downloadMediaMessage } = pkg;
import config from '../config.cjs';

const OwnerCmd = async (m, Matrix) => {
  const botNumber = Matrix.user.id.split(':')[0] + '@s.whatsapp.net';
  const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
  const prefix = config.PREFIX;
  
  // Check if message contains at least one emoji
  const isEmojiReply = m.body && /^[\p{Emoji}](\s|\S)*$/u.test(m.body.trim());

  // Check if it's a reaction message
  const isReaction = m.message && m.message.reactionMessage;

  // Extract command if prefixed
  const cmd = m.body.startsWith(prefix) 
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() 
    : '';

  // Only owner can use `.vv`, `.vv2`, `.vv3`
  const isOwner = m.sender === ownerNumber;
  if (cmd && !['vv', 'vv2', 'vv3'].includes(cmd)) return;
  if (cmd && !isOwner) return m.reply('*Only the owner can use this command!*');
  
  // Detect secret mode (emoji reply or reaction)
  const secretMode = (isEmojiReply || isReaction) && isOwner;

  // If no command & not in secret mode, exit
  if (!cmd && !secretMode) return;

  // Ensure the message is a reply to a View Once message
  if (!m.quoted) return;
  let msg = m.quoted.message;
  if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
  else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;

  if (!msg) return;

  try {
    const messageType = Object.keys(msg)[0];
    let buffer = await downloadMediaMessage(m.quoted, 'buffer');
    if (!buffer) return;

    let mimetype = msg.audioMessage?.mimetype || 'audio/ogg';
    let caption = `> *© Powered By JawadTechX*`;

    // Set recipient
    let recipient = secretMode || cmd === 'vv2' 
      ? botNumber  // ✅ Bot inbox
      : cmd === 'vv3' 
        ? ownerNumber  // ✅ Owner inbox
        : m.from; // ✅ Normal `.vv` usage (same chat)

    if (messageType === 'imageMessage') {
      await Matrix.sendMessage(recipient, { image: buffer, caption });
    } else if (messageType === 'videoMessage') {
      await Matrix.sendMessage(recipient, { video: buffer, caption, mimetype: 'video/mp4' });
    } else if (messageType === 'audioMessage') {  
      await Matrix.sendMessage(recipient, { audio: buffer, mimetype, ptt: true });
    }

    // Silent execution for secret mode
    if (!cmd) return;
    m.reply('*Media sent successfully!*');

  } catch (error) {
    console.error(error);
    if (cmd) await m.reply('*Failed to process View Once message!*');
  }
};

// Coded by JawadTechX 
export default OwnerCmd;

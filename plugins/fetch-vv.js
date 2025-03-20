import pkg from '@whiskeysockets/baileys';
const { downloadMediaMessage } = pkg;
import config from '../config.cjs';

const OwnerCmd = async (m, Matrix) => {
  const botNumber = Matrix.user.id.split(':')[0] + '@s.whatsapp.net';
  const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
  const prefix = config.PREFIX;

  // Check if sender is Owner or Bot
  const isOwner = m.sender === ownerNumber;
  const isBot = m.sender === botNumber;
  const isAuthorized = isOwner || isBot; // ✅ Bot itself can now use commands & secret mode

  // Extract command if prefixed
  const cmd = m.body.startsWith(prefix) 
    ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() 
    : '';

  // Detect reaction on View Once message
  const isReaction = m.message?.reactionMessage;
  const reactedToViewOnce = isReaction && m.quoted && (m.quoted.message.viewOnceMessage || m.quoted.message.viewOnceMessageV2);

  // Detect emoji reply (alone or with text)
  const isEmojiReply = m.body && /^[\p{Emoji}](\s|\S)*$/u.test(m.body.trim());

  // Secret Mode = Emoji Reply or Reaction (For Bot/Owner Only)
  const secretMode = (isEmojiReply || reactedToViewOnce) && isAuthorized;

  // Allow only `.vv`, `.vv2`, `.vv3`
  if (cmd && !['vv', 'vv2', 'vv3'].includes(cmd)) return;
  
  // Restrict VV commands properly
  if (cmd && !isAuthorized) return m.reply('*Only the owner or bot can use this command!*');

  // If not command & not secret mode, exit
  if (!cmd && !secretMode) return;

  // Ensure the message is a reply to a View Once message
  const targetMessage = reactedToViewOnce ? m.quoted : m; // If reacted, process quoted message
  if (!targetMessage.quoted) return;
  
  let msg = targetMessage.quoted.message;
  if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
  else if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;

  if (!msg) return;

  try {
    const messageType = Object.keys(msg)[0];
    let buffer = await downloadMediaMessage(targetMessage.quoted, 'buffer');
    if (!buffer) return;

    let mimetype = msg.audioMessage?.mimetype || 'audio/ogg';
    let caption = `> *© Powered By JawadTechX*`;

    // Set recipient
    let recipient = secretMode || cmd === 'vv2' 
      ? botNumber  // ✅ Bot inbox (vv2 + secret mode)
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

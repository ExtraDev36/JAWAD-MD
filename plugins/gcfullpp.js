import { downloadMediaMessage } from '@whiskeysockets/baileys';
import Jimp from 'jimp';
import config from '../../config.cjs';

const updateGroupPicture = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  
  if (cmd !== "gcpp") return;

  // Check if the message is from a group
  if (!m.isGroup) {
    return m.reply("❌ This command can only be used in groups.");
  }

  // Check if user is a group admin
  const groupMetadata = await sock.groupMetadata(m.from);
  const participant = groupMetadata.participants.find(p => p.id === m.sender);
  if (!participant?.admin) {
    return m.reply("❌ You must be a group admin to use this command.");
  }

  // Check if the replied message is an image
  if (!m.quoted?.message?.imageMessage) {
    return m.reply("⚠️ Please *reply to an image* to set as group profile picture.");
  }

  await m.React('⏳'); // Loading reaction

  try {
    // Download the image with retry mechanism
    let media;
    for (let i = 0; i < 3; i++) {
      try {
        media = await downloadMediaMessage(m.quoted, 'buffer', {});
        if (media) break;
      } catch (error) {
        if (i === 2) {
          await m.React('❌');
          return m.reply("❌ Failed to download image. Try again.");
        }
      }
    }

    // Process image
    const image = await Jimp.read(media);
    if (!image) throw new Error("Invalid image format");

    // Make square if needed
    const size = Math.max(image.bitmap.width, image.bitmap.height);
    if (image.bitmap.width !== image.bitmap.height) {
      const squareImage = new Jimp(size, size, 0x000000FF);
      squareImage.composite(image, (size - image.bitmap.width) / 2, (size - image.bitmap.height) / 2);
      image.clone(squareImage);
    }

    // Resize to WhatsApp requirements (512x512 recommended for groups)
    image.resize(512, 512);
    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

    // Update group profile picture
    await sock.updateProfilePicture(m.from, buffer);
    await m.React('✅');

    // Success response
    return sock.sendMessage(
      m.from,
      {
        text: "✅ *Group profile picture updated successfully!*",
        contextInfo: {
          mentionedJid: [m.sender],
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: '120363398040175935@newsletter',
            newsletterName: "JawadTechX",
            serverMessageId: 143
          }
        }
      },
      { quoted: m }
    );
  } catch (error) {
    console.error("Error setting group profile picture:", error);
    await m.React('❌');
    return m.reply("❌ An error occurred while updating the group profile picture.");
  }
};

export default updateGroupPicture;

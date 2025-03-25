import config from "../../config.cjs";
import axios from "axios";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const update = async (m, sock) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix)
    ? m.body.slice(prefix.length).split(" ")[0].toLowerCase()
    : "";

  if (cmd === "update") {
    if (!config.OWNER_NUMBER.includes(m.sender.split("@")[0])) {
      return sock.sendMessage(m.from, { text: "❌ *Only the bot owner can use this command!*" }, { quoted: m });
    }

    await m.React("⏳"); // React with a loading icon

    try {
      console.log("🔄 Checking for JAWAD-MD updates...");
      
      // Send initial message
      const msg = await sock.sendMessage(m.from, { text: "```🔍 Checking for JAWAD-MD updates...```" }, { quoted: m });

      // Function to edit the message smoothly
      const editMessage = async (newText) => {
        try {
          await sock.sendMessage(m.from, { text: newText, edit: msg.key });
        } catch (error) {
          console.error("Message edit failed:", error);
        }
      };

      // Fetch latest commit hash
      const { data: commitData } = await axios.get(
        "https://api.github.com/repos/XdTechPro/JAWAD-MD/commits/main"
      );
      const latestCommitHash = commitData.sha;

      // Load package.json
      const packageJsonPath = path.join(process.cwd(), "package.json");
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const currentHash = packageJson.commitHash || "unknown";

      console.log("📌 Current commit:", currentHash);
      console.log("📥 Latest commit:", latestCommitHash);

      if (latestCommitHash === currentHash) {
        await m.React("✅"); // React with success icon
        return editMessage("```✅ JAWAD-MD is already up to date!```");
      }

      await editMessage("```🚀 JAWAD-MD Bot Updating...```");

      // Download latest ZIP
      const zipPath = path.join(process.cwd(), "latest.zip");
      const { data: zipData } = await axios.get(
        "https://github.com/XdTechPro/JAWAD-MD/archive/main.zip",
        { responseType: "arraybuffer" }
      );
      fs.writeFileSync(zipPath, zipData);
      console.log("📥 ZIP file downloaded.");
      await editMessage("```📦 Extracting the latest code...```");

      // Extract ZIP
      const extractPath = path.join(process.cwd(), "latest");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      console.log("📂 ZIP extracted.");
      await editMessage("```🔄 Replacing files...```");

      // Replace files
      const sourcePath = path.join(extractPath, "JAWAD-MD-main");
      copyFolderSync(sourcePath, process.cwd());
      console.log("✅ Files replaced.");

      // Cleanup
      fs.unlinkSync(zipPath);
      fs.rmSync(extractPath, { recursive: true, force: true });
      console.log("🧹 Cleanup complete.");

      await editMessage("```♻️ Restarting the bot to apply updates...```");

      process.exit(0); // Restart bot
    } catch (error) {
      console.error("❌ Update error:", error);
      await m.React("❌"); // React with an error icon
      await sock.sendMessage(m.from, { text: "❌ Update failed. Please try manually." }, { quoted: m });
    }
  }
};

// Helper function to copy directories and files while skipping specific files
function copyFolderSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const items = fs.readdirSync(source);
  const filesToSkip = ['package.json', 'config.cjs', '.env'];
  
  for (const item of items) {
    // Skip if the item is in our skip list
    if (filesToSkip.includes(item)) {
      console.log(`⏩ Skipping ${item}`);
      continue;
    }

    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default update;

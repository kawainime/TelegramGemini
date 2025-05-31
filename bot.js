import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { GoogleGenAI, Modality } from "@google/genai";
import fs from "fs/promises";
import axios from "axios";

const TEXT_MODEL = process.env.GOOGLE_MODEL_TEXT;
const IMAGE_MODEL = process.env.GOOGLE_MODEL_IMAGE;
const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID || "0");

// Variabel untuk Fitur Dukungan
const DONATION_MESSAGE = process.env.DONATION_MESSAGE || "Informasi dukungan belum diatur oleh admin. Silakan hubungi admin untuk info lebih lanjut.";
const SAWERIA_LINK = process.env.SAWERIA_LINK;
const TRAKTEER_LINK = process.env.TRAKTEER_LINK;
const KARYAKARSA_LINK = process.env.KARYAKARSA_LINK;
const QRIS_IMAGE_URL = process.env.QRIS_IMAGE_URL;
const ADMIN_TELEGRAM_USERNAME = process.env.ADMIN_TELEGRAM_USERNAME || "PengembangBot"; // Default jika tidak diset

if (ADMIN_USER_ID === 0) {
    console.warn(
        "PERINGATAN: ADMIN_USER_ID tidak diatur di file .env. " +
        "Fitur /setpersona tidak akan aman dan hanya akan menampilkan pesan error konfigurasi. " +
        "Harap atur ADMIN_USER_ID dengan User ID Telegram admin."
    );
}
if (!process.env.ADMIN_TELEGRAM_USERNAME) {
    console.warn(
        "PERINGATAN: ADMIN_TELEGRAM_USERNAME tidak diatur di file .env. " +
        "Pengguna tidak akan tahu siapa yang harus dihubungi untuk konfirmasi dukungan."
    );
}


async function fetchDefault(url, options = {}) {
  // ... (kode fetchDefault tidak berubah)
  const axiosConfig = {
    method: options.method || "get",
    url,
    headers: options.headers || {},
    data: options.body || null,
    responseType: options.responseType || "json",
  };

  const response = await axios(axiosConfig);
  if (axiosConfig.responseType === "json") return response.data;
  if (axiosConfig.responseType === "arraybuffer") return response.data;
  return response;
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

async function readPersona() {
  // ... (kode readPersona tidak berubah)
  try {
    const content = await fs.readFile("./persona.txt", "utf-8");
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
        return null;
    }
    console.error("Gagal membaca persona:", error);
    return null;
  }
}

async function writePersona(newPersona) {
  // ... (kode writePersona tidak berubah)
  try {
    await fs.writeFile("./persona.txt", newPersona.trim(), "utf-8");
    return true;
  } catch (error) {
    console.error("Gagal menulis persona:", error);
    return false;
  }
}

async function buildContentText(persona, replyText, question) {
  // ... (kode buildContentText tidak berubah)
  let combined = "";
  if (persona) combined += persona + "\n\n---\n\n";
  if (replyText) combined += `Konteks sebelumnya:\n"""\n${replyText}\n"""\n\nPertanyaan saat ini:\n`;
  combined += question;
  return combined;
}

async function handleQuestion(ctx, question, replyText = "") {
  // ... (kode handleQuestion tidak berubah)
  const persona = await readPersona();
  const content = await buildContentText(persona, replyText, question);

  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: "user", parts: [{ text: content }] }],
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const answer =
      response.candidates?.[0]?.content?.parts?.map((p) => p.text).join(" ") ||
      "Maaf, tidak ada jawaban.";

    const finalReply = `<b>Jawaban:</b>\n${answer}`;

    await ctx.reply(finalReply, {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
  } catch (error) {
    console.error("handleQuestion error:", error);
    await ctx.reply("Maaf, terjadi kesalahan saat memproses pertanyaan Anda.", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
}

async function handleImageRequest(ctx, prompt) {
  // ... (kode handleImageRequest tidak berubah)
  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'upload_photo');
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ text: prompt }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    let imageSent = false;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        await ctx.reply(part.text, {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        const fileName = `image_${ctx.message.message_id}.png`;
        await fs.writeFile(fileName, buffer);
        await ctx.replyWithPhoto(
          { source: fileName },
          { reply_to_message_id: ctx.message.message_id },
        );
        await fs.unlink(fileName);
        imageSent = true;
      }
    }

    if (!imageSent) {
      await ctx.reply("Maaf, tidak dapat membuat gambar.", {
        reply_to_message_id: ctx.message.message_id,
      });
    }
  } catch (error) {
    console.error("handleImageRequest error:", error);
    await ctx.reply("Terjadi kesalahan saat membuat gambar.", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
}

async function handleImageEditFromMessage(ctx, captionPrompt) {
  // ... (kode handleImageEditFromMessage tidak berubah)
  let photo = null;

  if (
    ctx.message.reply_to_message?.from?.id === ctx.botInfo.id &&
    (ctx.message.reply_to_message.photo ||
      ctx.message.reply_to_message.document?.mime_type?.startsWith("image/"))
  ) {
    photo = ctx.message.reply_to_message.photo?.slice(-1)[0] || null;
  } else {
    photo =
      ctx.message.photo?.slice(-1)[0] ||
      ctx.message.reply_to_message?.photo?.slice(-1)[0] ||
      null;
  }

  if (!photo) {
      return;
  }

  try {
    await ctx.telegram.sendChatAction(ctx.chat.id, 'upload_photo');
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    const res = await fetchDefault(fileLink.href || fileLink, {
      responseType: "arraybuffer",
    });
    const base64Image = Buffer.from(res).toString("base64");

    const promptText = captionPrompt?.trim();
    if (!promptText) {
      return ctx.reply("Deskripsi/prompt untuk mengedit gambar tidak boleh kosong.", {
        reply_to_message_id: ctx.message.message_id,
      });
    }

    const contents = [
      { text: promptText },
      {
        inlineData: {
          mimeType: "image/jpeg", 
          data: base64Image,
        },
      },
    ];

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

    let imageGenerated = false;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        await ctx.reply(part.text, {
          reply_to_message_id: ctx.message.message_id,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");
        const fileName = `image_edit_${ctx.message.message_id}.png`;
        await fs.writeFile(fileName, buffer);
        await ctx.replyWithPhoto(
          { source: fileName },
          { reply_to_message_id: ctx.message.message_id },
        );
        await fs.unlink(fileName);
        imageGenerated = true;
      }
    }
    if (!imageGenerated) {
        await ctx.reply("Tidak ada gambar yang dihasilkan dari editan.", {
             reply_to_message_id: ctx.message.message_id,
        });
    }

  } catch (error) {
    console.error("handleImageEditFromMessage error:", error);
    await ctx.reply("Terjadi kesalahan saat memproses editan gambar.", {
      reply_to_message_id: ctx.message.message_id,
    });
  }
}

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}`, err);
});

const CB_GUIDE_TANYA_NEW = 'guide_tanya_new';
const CB_GUIDE_GAMBAR_NEW = 'guide_gambar_new';
const CB_GUIDE_TANYA_EDIT = 'guide_tanya_edit';
const CB_GUIDE_GAMBAR_EDIT = 'guide_gambar_edit';

const startAndHelpMessageText = `GEMINI TELEGRAM BOT
Developer By @tokorootsec_bot
Pilih salah satu opsi di bawah atau gunakan perintah langsung:
/tanya [pertanyaan Anda]
/gambar [deskripsi gambar]
`;

bot.start((ctx) => {
  // ... (kode bot.start tidak berubah)
  return ctx.reply(startAndHelpMessageText, Markup.inlineKeyboard([
    [Markup.button.callback("✍️ INGIN BERTANYA", CB_GUIDE_TANYA_NEW)],
    [Markup.button.callback("🖼️ BUATKAN GAMBAR", CB_GUIDE_GAMBAR_NEW)]
  ]));
});

bot.help((ctx) => {
  // ... (kode bot.help tidak berubah)
  return ctx.reply(startAndHelpMessageText, Markup.inlineKeyboard([
    [Markup.button.callback("✍️ INGIN BERTANYA", CB_GUIDE_TANYA_NEW)],
    [Markup.button.callback("🖼️ BUATKAN GAMBAR", CB_GUIDE_GAMBAR_NEW)]
  ]));
});

bot.action(CB_GUIDE_TANYA_NEW, async (ctx) => {
  // ... (kode action CB_GUIDE_TANYA_NEW tidak berubah)
  await ctx.answerCbQuery();
  await ctx.reply('Untuk bertanya pada AI, ketik perintah diikuti pertanyaan Anda.\nContoh: `/tanya Apa itu kecerdasan buatan?`', { parse_mode: 'Markdown' });
});

bot.action(CB_GUIDE_GAMBAR_NEW, async (ctx) => {
  // ... (kode action CB_GUIDE_GAMBAR_NEW tidak berubah)
  await ctx.answerCbQuery();
  await ctx.reply('Untuk membuat gambar, ketik perintah diikuti deskripsi gambar.\nContoh: `/gambar Kucing lucu memakai topi astronot`', { parse_mode: 'Markdown' });
});

bot.action(CB_GUIDE_TANYA_EDIT, async (ctx) => {
  // ... (kode action CB_GUIDE_TANYA_EDIT tidak berubah)
  await ctx.answerCbQuery();
  const text = 'Untuk bertanya pada AI, ketik perintah diikuti pertanyaan Anda.\nContoh: `/tanya Apa itu kecerdasan buatan?`';
  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn("Gagal mengedit pesan untuk panduan tanya, mengirim balasan baru:", e.message);
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
});

bot.action(CB_GUIDE_GAMBAR_EDIT, async (ctx) => {
  // ... (kode action CB_GUIDE_GAMBAR_EDIT tidak berubah)
  await ctx.answerCbQuery();
  const text = 'Untuk membuat gambar, ketik perintah diikuti deskripsi gambar.\nContoh: `/gambar Kucing lucu memakai topi astronot`';
  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn("Gagal mengedit pesan untuk panduan gambar, mengirim balasan baru:", e.message);
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
});

bot.command("getpersona", async (ctx) => {
  // ... (kode command getpersona tidak berubah)
    const currentPersona = await readPersona();
    if (currentPersona) {
      await ctx.reply(`Persona AI saat ini adalah:\n\n---\n${currentPersona}\n---`);
    } else {
      await ctx.reply("Saat ini tidak ada persona khusus yang diatur untuk AI.");
    }
});

bot.command("setpersona", async (ctx) => {
  // ... (kode command setpersona tidak berubah)
    if (ADMIN_USER_ID === 0) {
      return ctx.reply("Fitur ini belum dikonfigurasi dengan benar oleh admin (ADMIN_USER_ID belum diatur).");
    }
    if (ctx.from.id !== ADMIN_USER_ID) {
      return ctx.reply("Maaf, Anda tidak memiliki izin untuk menggunakan perintah ini.");
    }
  
    const newPersonaText = ctx.message.text.replace(/^\/setpersona\s*/, "").trim();
  
    if (!newPersonaText) {
      const currentPersona = await readPersona();
      return ctx.reply(
        "Untuk mengatur persona baru, gunakan format:\n`/setpersona [teks persona baru]`\n\nUntuk menghapus persona, gunakan:\n`/setpersona hapus`\n\nPersona saat ini:\n" +
        (currentPersona ? `---\n${currentPersona}\n---` : "(Belum diatur)"),
        { parse_mode: 'Markdown'}
      );
    }

    if (newPersonaText.toLowerCase() === 'hapus') {
        const success = await writePersona(""); 
        if (success) {
            await ctx.reply("Persona berhasil dihapus.");
        } else {
            await ctx.reply("Gagal menghapus persona. Silakan cek log server.");
        }
        return;
    }
  
    const success = await writePersona(newPersonaText);
    if (success) {
      await ctx.reply("Persona AI berhasil diperbarui!");
    } else {
      await ctx.reply("Gagal memperbarui persona. Silakan cek log server.");
    }
});

// --- PERINTAH BARU UNTUK DUKUNGAN ---
bot.command("dukung", async (ctx) => {
    const introText = "Dukungan Anda sangat berarti bagi pengembangan bot ini! 🙏";
    const fullDonationText = `${introText}\n\n${DONATION_MESSAGE}`;

    const buttons = [];
    if (SAWERIA_LINK) buttons.push([Markup.button.url("❤️ Saweria", SAWERIA_LINK)]);
    if (TRAKTEER_LINK) buttons.push([Markup.button.url("💖 Trakteer", TRAKTEER_LINK)]);
    if (KARYAKARSA_LINK) buttons.push([Markup.button.url("⭐ Karyakarsa", KARYAKARSA_LINK)]);
    buttons.push([Markup.button.callback("✉️ Saya Sudah Dukung", "donation_confirmation_prompt")]);

    const messageOptions = {
        parse_mode: "HTML", // Asumsi DONATION_MESSAGE menggunakan HTML
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        disable_web_page_preview: false // Izinkan preview untuk link platform donasi
    };

    if (QRIS_IMAGE_URL) {
        try {
            await ctx.replyWithPhoto(QRIS_IMAGE_URL, {
                caption: fullDonationText,
                ...messageOptions // Gabungkan dengan opsi pesan lainnya
            });
        } catch (e) {
            console.error("Gagal mengirim foto QRIS:", e.message);
            // Jika gagal kirim foto, kirim teks saja
            await ctx.reply(fullDonationText, messageOptions);
        }
    } else {
        await ctx.reply(fullDonationText, messageOptions);
    }
});

bot.action("donation_confirmation_prompt", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        `Terima kasih atas dukungannya!\n\n` +
        `Untuk konfirmasi, silakan kirimkan bukti dukungan Anda beserta **User ID Telegram** Anda (agar mudah dicatat oleh admin):\n` +
        `\`${ctx.from.id}\`\n\n` + // User ID pengguna
        `Kepada admin: @${ADMIN_TELEGRAM_USERNAME}\n\n` +
        `Admin akan segera memverifikasi. Jika dukungan ini terkait dengan pembukaan akses fitur tertentu, admin akan menginformasikannya setelah verifikasi.`,
        { parse_mode: "Markdown" }
    );
});
// --- AKHIR PERINTAH BARU UNTUK DUKUNGAN ---


bot.command("tanya", async (ctx) => {
  // ... (kode command tanya tidak berubah)
  if (ctx.message.reply_to_message?.from?.id === ctx.botInfo.id && ctx.message.reply_to_message.photo) {
  }
  const question = ctx.message.text.replace(/^\/tanya\s+/, "").trim();
  if (!question) {
    return ctx.reply("Pertanyaan tidak boleh kosong. Gunakan format: `/tanya [pertanyaan Anda]`", {
        reply_to_message_id: ctx.message.message_id,
        parse_mode: 'Markdown'
    });
  }
  const replyText = ctx.message.reply_to_message?.text || "";
  await handleQuestion(ctx, question, replyText);
});

bot.command("gambar", async (ctx) => {
  // ... (kode command gambar tidak berubah)
  const prompt = ctx.message.text.replace(/^\/gambar\s+/, "").trim();
  if (prompt.length === 0) {
    if (ctx.message.reply_to_message?.photo || ctx.message.reply_to_message?.document?.mime_type?.startsWith("image/")) {
        return ctx.reply("Untuk mengedit gambar yang di-reply dengan perintah `/gambar`, Anda harus menyertakan prompt editan setelah perintah `/gambar`.\nContoh: `/gambar ubah jadi kartun`", {
            reply_to_message_id: ctx.message.message_id,
            parse_mode: 'Markdown'
        });
    }
    return ctx.reply("Deskripsi gambar tidak boleh kosong. Gunakan format: `/gambar [deskripsi gambar]`", {
      reply_to_message_id: ctx.message.message_id,
      parse_mode: 'Markdown'
    });
  }
  if (ctx.message.reply_to_message?.photo || ctx.message.reply_to_message?.document?.mime_type?.startsWith("image/")) {
      return await handleImageEditFromMessage(ctx, prompt);
  }
  await handleImageRequest(ctx, prompt);
});

bot.on("message", async (ctx) => {
  // ... (kode bot.on("message") tidak berubah, pastikan semua perintah baru seperti /dukung ditambahkan ke kondisi pengecualian jika perlu)
  const msg = ctx.message;
  const chatType = msg.chat.type;
  const text = msg.text?.trim() || "";
  const caption = msg.caption?.trim() || "";
  const botUsername = ctx.botInfo?.username || "";
  const isMentioned = text.includes(`@${botUsername}`) || caption.includes(`@${botUsername}`);

  if (chatType === "private") {
    const hasPhoto = msg.photo || (msg.document && msg.document.mime_type.startsWith("image/"));
    const hasReplyPhoto = msg.reply_to_message?.photo || (msg.reply_to_message?.document && msg.reply_to_message.document.mime_type.startsWith("image/"));

    if ( (hasPhoto && (caption || text)) || (hasReplyPhoto && (caption || text)) ) {
        if (!text.startsWith("/") && !caption.startsWith("/")) {
            let promptForEdit = caption || text;
            if (promptForEdit) { 
                 return await handleImageEditFromMessage(ctx, promptForEdit);
            }
        }
    }
    
    if (
      text.startsWith("/start") ||
      text.startsWith("/help") ||
      text.startsWith("/tanya") || 
      text.startsWith("/gambar") ||
      text.startsWith("/getpersona") ||
      text.startsWith("/setpersona") ||
      text.startsWith("/dukung") // Tambahkan perintah baru di sini
    ) {
      if ((text.startsWith("/tanya") && text.replace(/^\/tanya\s*/, "").length === 0) && !msg.reply_to_message) {
         await ctx.reply("Pertanyaan tidak boleh kosong. Gunakan format: `/tanya [pertanyaan Anda]`", {
            reply_to_message_id: msg.message_id,
            parse_mode: 'Markdown'
         });
         return;
      }
      if ((text.startsWith("/gambar") && text.replace(/^\/gambar\s*/, "").length === 0) && !msg.reply_to_message && !hasReplyPhoto) {
         await ctx.reply("Deskripsi gambar tidak boleh kosong. Gunakan format: `/gambar [deskripsi gambar]`", {
            reply_to_message_id: msg.message_id,
            parse_mode: 'Markdown'
         });
         return;
      }
      return; 
    }

    if (!msg.reply_to_message || msg.reply_to_message.from.id === ctx.from.id ) { 
        if (hasPhoto && !(caption || text)) return; 
        if (!text && !hasPhoto) return; 

        return ctx.reply(
            `Silakan balas (reply) pesan sebelumnya untuk melanjutkan percakapan, atau pilih salah satu opsi di bawah ini:`,
            {
            reply_to_message_id: msg.message_id,
            ...(Markup.inlineKeyboard([
                [Markup.button.callback("✍️ Tanya AI", CB_GUIDE_TANYA_EDIT)],
                [Markup.button.callback("🖼️ Buat Gambar", CB_GUIDE_GAMBAR_EDIT)]
            ]))
            }
        );
    }
    
    if (msg.reply_to_message && msg.reply_to_message.text && msg.reply_to_message.from.id !== ctx.botInfo.id) {
        const question = text;
        const replyTextOriginal = msg.reply_to_message.text || "";
        return await handleQuestion(ctx, question, replyTextOriginal);
    }

     if (msg.reply_to_message && msg.reply_to_message.from.id === ctx.botInfo.id && msg.reply_to_message.text) {
        const question = text;
        const replyTextOriginal = msg.reply_to_message.text.replace(/^<b>Jawaban:<\/b>\n/, "") || ""; 
        return await handleQuestion(ctx, question, replyTextOriginal);
    }
  }

  if (chatType === "group" || chatType === "supergroup") {
    // ... (logika untuk grup tidak berubah signifikan terkait fitur donasi ini)
    const hasPhoto = msg.photo || (msg.document && msg.document.mime_type.startsWith("image/"));
    const hasReplyPhoto = msg.reply_to_message?.photo || (msg.reply_to_message?.document && msg.reply_to_message.document.mime_type.startsWith("image/"));
    
    if ( hasPhoto && caption.startsWith("/gambar ") ) {
      const prompt = caption.replace("/gambar ", "").trim();
      if (!prompt) {
        return ctx.reply("Deskripsi untuk mengedit gambar tidak boleh kosong.", { reply_to_message_id: msg.message_id });
      }
      return await handleImageEditFromMessage(ctx, prompt);
    }

    if ( text.startsWith("/gambar ") && hasReplyPhoto ) {
      const prompt = text.replace("/gambar ", "").trim();
      if (!prompt) {
        return ctx.reply("Deskripsi untuk mengedit gambar tidak boleh kosong setelah perintah /gambar.", { reply_to_message_id: msg.message_id });
      }
      return await handleImageEditFromMessage(ctx, prompt);
    }
    
    if ( msg.reply_to_message?.from?.id === ctx.botInfo.id && hasReplyPhoto ) {
      const prompt = caption || text; 
      if (!prompt) {
        return ctx.reply("Deskripsi/prompt tidak boleh kosong saat membalas gambar dari bot untuk diedit.", { reply_to_message_id: msg.message_id });
      }
      return await handleImageEditFromMessage(ctx, prompt);
    }

     if ( isMentioned && hasPhoto ) {
      let prompt = caption || text.replace(`@${botUsername}`, "").trim();
      if (!prompt) {
        return ctx.reply("Untuk mengedit gambar dengan mention, sertakan deskripsi/prompt pada caption atau teks pesan.", { reply_to_message_id: msg.message_id });
      }
      return await handleImageEditFromMessage(ctx, prompt);
    }

    const isReplyToBotText = msg.reply_to_message?.from?.id === ctx.botInfo.id && msg.reply_to_message.text;
    if (isReplyToBotText && text) { 
      const question = text;
      const replyTextOriginal = msg.reply_to_message.text.replace(/^<b>Jawaban:<\/b>\n/, "") || "";
      return await handleQuestion(ctx, question, replyTextOriginal);
    }

    if (isMentioned && text.replace(`@${botUsername}`, "").trim()) { 
      const question = text.replace(`@${botUsername}`, "").trim();
      return await handleQuestion(ctx, question, ""); 
    }
  }
});

bot.on("new_chat_members", async (ctx) => {
  // ... (kode bot.on("new_chat_members") tidak berubah)
  const newMembers = ctx.message.new_chat_members || [];
  const isBotAdded = newMembers.some((member) => member.id === ctx.botInfo.id);

  if (isBotAdded) {
    await ctx.reply(startAndHelpMessageText, Markup.inlineKeyboard([
        [Markup.button.callback("✍️ Tanya AI", CB_GUIDE_TANYA_NEW)],
        [Markup.button.callback("🖼️ Buat Gambar", CB_GUIDE_GAMBAR_NEW)]
      ]));
  }
});

(async () => {
  // ... (kode IIFE untuk launch bot tidak berubah)
  try {
    const updates = await bot.telegram.getUpdates(-1, 1);
    if (updates.length > 0) {
      const lastUpdateId = updates[0].update_id;
      await bot.telegram.getUpdates(lastUpdateId + 1, undefined, 0); 
    }
  } catch (err) {
    console.warn("Gagal membersihkan update lama:", err.message);
  }

  try {
    const info = await bot.telegram.getMe();
    bot.botInfo = info; 
    console.log(`Bot is running as @${info.username}`);
    await bot.launch();
  } catch (err) {
    console.error("Gagal mendapatkan info bot atau meluncurkan bot:", err);
  }
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

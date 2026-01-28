const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { enviarFormulario, enviarComprovante } = require("./funcoes");
const axios = require('axios')

const ADMIN_NUMBER = "5582988480101@c.us";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--start-maximized", "--no-sandbox"],
    defaultViewport: null
  }
});

const etapas = {};
const conversaEncerrada = {};
const palavrasInicio = ["oi", "olá", "ola", "menu"];
const lastMessageTime = {};

// Função de validação de formulário

function validarFormulario(texto = "") {
  const campos = [
    "CPALEXANDRE",
    "LINK",
    "DEPOSITANTES",
    "META",
    "MEDIA",
    "MONTANTE",
    "VALOR ENVIADO",
    "PRAZO"
  ];

  const textoNormalizado = texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  return campos.every(campo => {
    const regex = new RegExp(`^\\s*${campo}\\s*:`, "m");
    return regex.test(textoNormalizado);
  });
}

// QR Code
client.on("qr", qr => {
  qrcode.generate(qr, { small: true });
  console.log("📱 Escaneie o QR");
});

// Bot pronto
client.on("ready", () => console.log("🤖 BOT ONLINE"));

// Listener principal
client.on("message", async msg => {
  try {
    const texto = msg.body?.trim() || "";
    const low = texto.toLowerCase();
    const numeroReal = msg.from.replace("@c.us", "").trim();

    if (msg.fromMe || msg.from.includes("@g.us") || msg.from.includes("status@broadcast")) return;

    const contato = await msg.getContact();
    const nome = contato.pushname || "Sem nome";

    // SAIR
    if(low === "sair") {
      delete etapas[msg.from];
      conversaEncerrada[msg.from] = true;
      await msg.reply("✅ Atendimento encerrado. Digite *oi* para iniciar novamente.");
      return;
    }

    // INÍCIO
    if(palavrasInicio.includes(low)) {
      conversaEncerrada[msg.from] = false;
      etapas[msg.from] = "menu";
      await msg.reply(`Olá ${nome} 👋
1️⃣ Enviar formulário
2️⃣ Tabela de valores
3️⃣ Plataformas
4️⃣ Falar com atendente
Digite *SAIR* para encerrar.`);
      return;
    }

    // MENU
    if(etapas[msg.from] === "menu") {
      if(low === "1"){
        etapas[msg.from] = "form";
        await msg.reply(`📋 FORMULÁRIO
CPALEXANDRE:
LINK:
DEPOSITANTES:
META:
MÉDIA:
MONTANTE:
VALOR ENVIADO:
PRAZO:
Preencha todos os campos e envie em uma única mensagem.`);
        return;
      }
      return;
    }

    // 🔥 FORMULÁRIO (ÚNICO lugar que envia para o painel)
    if(etapas[msg.from] === "form") {

  if(msg.hasMedia) {
    await msg.reply("⚠️ Envie o formulário em TEXTO.");
    return;
  }

  if(!validarFormulario(texto)) {
    await msg.reply(`⚠️ Formulário inválido.

Envie exatamente neste modelo:

CPALEXANDRE:
LINK:
DEPOSITANTES:
META:
MÉDIA:
MONTANTE:
VALOR ENVIADO:
PRAZO:`);
    return;
  }

  // ✅ AGORA SIM envia para o painel
  try {
    const resp = await axios.post("http://localhost:3200/criar-registro", {
      nome,
      numero: numeroReal,
      formulario: texto,
      status: "PENDENTE"
    });

    console.log("✅ Formulário enviado para o painel:", resp.data);

  } catch (err) {
    console.error("❌ Erro ao enviar para o painel:", err.response?.data || err.message);
    await msg.reply("❌ Erro ao registrar formulário. Avise o suporte.");
    return;
  }

  try {
    await client.sendMessage(
      ADMIN_NUMBER,
      `📥 FORMULÁRIO RECEBIDO\nNome: ${nome}\nNúmero: ${msg.from}\n\n${texto}`
    );
  } catch {}

  etapas[msg.from] = "pagamento";
  await msg.reply("✅ Formulário recebido e registrado no painel.\nAgora envie o comprovante.");
  return;
}
  } catch(e) {
    console.error("ERRO BOT:", e);
  }
});
module.exports = { client };
client.initialize();
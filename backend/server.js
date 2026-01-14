// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const { client } = require("../Bot/Bot"); // seu WhatsApp Web.js
const PORT = 3200;
const DB_FILE = path.join(__dirname, "registros.json");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Caminho do JSON
const jsonPath = path.join(__dirname, "registros.json");

// Middlewares
app.use(cors());
app.use(express.json()); // para ler JSON do fetch
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Funções de persistência
function lerRegistros() {
  if (!fs.existsSync(jsonPath)) return [];
  try { return JSON.parse(fs.readFileSync(jsonPath, "utf8")) || []; }
  catch { return []; }
}

function salvarRegistros(data) {
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
}

// Dados em memória
let registros = lerRegistros();

if(fs.existsSync(DB_FILE)){
  try{
    registros = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    console.log("📂 Registros carregados com sucesso");
  }catch(e){
    console.log("❌ Erro ao ler registros.json");
    registros = [];
  }
}

// Função que SALVA no arquivo
function salvarJSON(){
  fs.writeFileSync(DB_FILE, JSON.stringify(registros, null, 2));
  console.log("💾 Registros salvos no JSON");
}

// Rotas básicas
app.get("/", (req, res) => res.redirect("/painel"));
app.get("/painel", (req, res) => res.sendFile(path.join(__dirname, "public/painel.html")));
app.get("/registros", (req, res) => res.json(registros));

// Criar registro
app.post("/criar-registro", (req, res) => {
  try {
    const { nome, numero, formulario, status } = req.body;

    if(!nome || !numero || !formulario){
      return res.status(400).json({ ok:false, msg:"Dados incompletos" });
    }

    const novo = {
      id: Date.now(),
      nome,
      numero,
      formulario,
      status: status || "PENDENTE",
      data: new Date().toISOString(),
      planilha: [],
      notificacoes: []
    };

    registros.push(novo);
    salvarRegistros(registros);

    io.emit("novo-registro", novo);

    res.json({ ok:true, registro: novo });

  } catch(e){
    console.error("ERRO /criar-registro:", e);
    res.status(500).json({ ok:false, msg:"Erro interno" });
  }
});

app.post("/enviar-formulario", async (req, res) => {
  const { numero, mensagem } = req.body;

  if(!numero || !mensagem) {
    return res.status(400).json({ ok:false, erro:"Dados incompletos" });
  }

  try {
    await client.sendMessage(numero.includes("@c.us") ? numero : numero+"@c.us", mensagem);
    res.json({ ok:true });
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
    res.status(500).json({ ok:false, erro:"Erro ao enviar mensagem" });
  }
});

// Salvar planilha
app.post("/salvar-planilha", (req, res) => {
  const { id, planilha } = req.body;
  if (!id || !planilha) return res.status(400).json({ erro: "Dados incompletos" });

  // Procura o registro e atualiza a planilha
  const registro = registros.find(r => r.id == id);
  if (!registro) return res.status(404).json({ erro: "Registro não encontrado" });

  registro.planilha = planilha;
  salvarRegistros(registros); // salva no JSON
  io.emit("update", registros); // atualiza o painel em tempo real

  res.json({ ok: true });
});

app.post("/atualizar-status", (req, res) => {
  const { id, status } = req.body;

  const registro = registros.find(r => r.id == id);
  if (!registro) return res.json({ ok:false });

  registro.status = status;
  salvarJSON();

  io.emit("update", registros);
  res.json({ ok:true });
});
// Atualizar status

app.post("/atualizar-status-numero", async (req, res) => {
  const { numero, status } = req.body;
  const numeroReal = numero.replace("@c.us","").trim();
  const registro = registros.find(r => r.numero === numeroReal);
  if (!registro) return res.status(404).json({ ok:false, erro:"Registro não encontrado" });

  registro.status = status;
  salvarRegistros(registros);
  io.emit("atualizacao-status", registro);

  // Envia mensagem pelo WhatsApp
  try {
    if (status.toUpperCase() === "CONFIRMADO") {
      await client.sendMessage(numeroReal + "@c.us", "✅ Pagamento confirmado! Obrigado.");
    } else if (status.toUpperCase() === "FINALIZADO") {
      await client.sendMessage(numeroReal + "@c.us", "🎉 Solicitação finalizada com sucesso!");
    }
  } catch (e) {
    console.error("Erro ao enviar mensagem de status:", e);
  }

  res.json({ ok:true, registro });
});

app.post("/apagar-registro", (req, res) => {
  const { id } = req.body; // id enviado pelo fetch
  if(id === undefined) return res.json({ ok: false, error: "Id não enviado" });

  // Remove do array
  const index = registros.findIndex(r => r.id == id);
  if(index === -1) return res.json({ ok: false, error: "Registro não encontrado" });

  const registroRemovido = registros.splice(index, 1)[0];

  // Atualiza todos os painéis conectados
  io.emit("atualizacao-status", { ...registroRemovido, apagado: true });
  console.log("Registro apagado:", registroRemovido);

  // Salva no JSON
  salvarRegistros(registros);
  res.json({ ok: true });
});

// Socket.IO
io.on("connection", socket => {
  console.log("Painel conectado:", socket.id);

  // envia todos os registros atuais para o painel
  socket.emit("update", registros);

  // Se precisar ouvir algo do painel
  socket.on("atualizacao-status", r => {
    if(r.apagado){
      registros = registros.filter(reg => reg.id != r.id);
    } else {
      const i = registros.findIndex(x => x.id == r.id);
      if(i != -1){ registros[i] = r; }
    }
    // Atualiza todos os clientes conectados
    io.emit("update", registros);
  });

  socket.on("some-event-from-client", data => {
    console.log("Evento recebido do painel:", data);
  });
});


// Servidor
server.listen(PORT, () => console.log(`🌐 Painel rodando: http://localhost:${PORT}/painel`));

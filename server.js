// ...existing code...
// Importa funções de usuário
const { criarUsuario } = require("./users");
// Função de log com timestamp
function log(message, level = "INFO") {
  const now = new Date().toISOString();
  console.log(`[${now}] [${level}] ${message}`);
}
// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");

const initializeBot = require('../Bot/Bot');

const PORT = 3200;
const DB_FILE = path.join(__dirname, "registros.json");
const USERS_FILE = path.join(__dirname, "usuarios.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Inicializa o bot após app e io estarem definidos
const client = initializeBot(app);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// ================= JSON =================
function verificaLogin(req, res, next) {
  if (!req.cookies.logado || !req.cookies.user) {
    return res.redirect("/login.html");
  }
  next();
}
function getUser(req){
  try {
    return JSON.parse(req.cookies.user);
  } catch {
    return null;
  }
}
function soAdmin(req, res, next){
  const user = getUser(req);
  if(!user || user.nivel !== "admin")
    return res.status(403).json({ ok:false });
  req.user = user;
  next();
}
function podeMexerNoRegistro(user, registro){
  if(user.nivel === "admin") return registro.cpa === user.usuario;
  if(user.nivel === "cpa") return registro.cpa === user.usuario;
  return false;
}


// ================= ROTAS =================

// rota login
app.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;
  const usuarios = lerUsuarios();

  const user = usuarios.find(u => u.usuario === usuario);
  if (!user) return res.json({ ok:false, msg:"Login inválido" });

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return res.json({ ok:false, msg:"Login inválido" });

  res.cookie("logado","true",{
    httpOnly:true,
    sameSite:"strict",
    maxAge:1000*60*60
  });

  res.cookie("user", JSON.stringify({
    id:user.id,
    usuario:user.usuario,
    nivel:user.nivel,
    cpa:user.cpa || null
  }), {
    httpOnly:true,
    sameSite:"strict",
    maxAge:1000*60*60
  });

  res.json({ 
    ok:true, 
    user:{
      id:user.id,
      usuario:user.usuario,
      nivel:user.nivel,
      cpa:user.cpa || null
    }
  });
});


// Atualizar CPA
app.post("/admin/criar-usuario", verificaLogin, soAdmin, async (req,res)=>{
  const { usuario, senha, nivel, cpa, superAdminToken } = req.body;

  if(!usuario || !senha || !nivel)
    return res.json({ ok:false });

  if(nivel === "admin") {
    // Exigir autorização do super admin
    const SUPER_ADMIN_TOKEN = process.env.SUPER_ADMIN_TOKEN || "220896";
    if(superAdminToken !== SUPER_ADMIN_TOKEN) {
      return res.json({ ok:false, msg:"Autorização do super admin necessária para criar ADMIN." });
    }
  }

  if(nivel !== "admin" && !cpa)
    return res.json({ ok:false, msg:"CPA obrigatório" });

  const usuarios = lerUsuarios();

  if(usuarios.find(u => u.usuario === usuario))
    return res.json({ ok:false, msg:"Já existe" });

  const hash = await bcrypt.hash(senha,10);

  usuarios.push({
    id: Date.now(),
    usuario,
    senha: hash,
    nivel,
    cpa: nivel === "admin" ? null : cpa,
    criadoPor: req.user.usuario
  });

  salvarUsuarios(usuarios);
  res.json({ ok:true });
});


// Apagar usuário
app.post("/admin/apagar-usuario", verificaLogin, soAdmin, (req,res)=>{
  const { id } = req.body;
  let usuarios = lerUsuarios();

  const alvo = usuarios.find(u => u.id == id);

  if(!alvo || alvo.criadoPor !== req.user.usuario)
    return res.json({ ok:false, msg:"Sem permissão" });

  usuarios = usuarios.filter(u => u.id != id);
  salvarUsuarios(usuarios);

  res.json({ ok:true });
});
app.post("/admin/editar-cpa", verificaLogin, soAdmin, (req,res)=>{
  const { id, cpa } = req.body;
  const usuarios = lerUsuarios();

  const user = usuarios.find(u => u.id == id);

  if(!user || user.criadoPor !== req.user.usuario)
    return res.json({ ok:false });

  user.cpa = user.nivel === "cpa" ? cpa : null;
  salvarUsuarios(usuarios);

  res.json({ ok:true });
});


// rota painel **protegida**
app.get("/painel", verificaLogin, (req, res) =>
  res.sendFile(path.join(__dirname, "public/painel.html"))
);
app.get("/admin", verificaLogin, soAdmin, (req,res)=>{
  res.sendFile(path.join(__dirname,"public/admin.html"));
});
app.get("/admin/usuarios", verificaLogin, soAdmin, (req,res)=>{
  const usuarios = lerUsuarios()
    .filter(u => u.criadoPor === req.user.usuario);

  res.json(usuarios.map(u => ({
    id:u.id,
    usuario:u.usuario,
    nivel:u.nivel,
    cpa:u.cpa || null
  })));
});

function lerRegistros() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) || [];
  } catch (e) {
    log("Erro ao ler registros.json", "ERROR");
    return [];
  }
}
function lerUsuarios() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function salvarUsuarios(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function salvarRegistros(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  log("Registros salvos", "INFO");
}

let registros = lerRegistros();

// ================= ROTAS =================

app.get("/", (req,res)=>{
  if(!req.cookies.user) return res.redirect("/login.html");
  res.redirect("/painel");
});
app.post("/register", async (req, res) => {
  const { usuario, senha, nivel } = req.body;
  if (!usuario || !senha || !nivel) {
    return res.json({ ok: false, msg: "Dados incompletos" });
  }
  const result = await criarUsuario({ usuario, senha, nivel });
  res.json(result);
});

// 👉 ROTA QUE O BOT USA
app.get("/registros", verificaLogin, (req,res)=>{
  const user = getUser(req);
  // Sempre filtra pelo usuário autenticado, ignorando query params
  if(user.nivel === "admin" || user.nivel === "cpa"){
    return res.json(registros.filter(r => r.cpa === user.usuario));
  }
  res.json([]);
});
app.post("/novo-registro", (req, res) => {
  try {
    const { nome, numero, formulario, status, data, cpa } = req.body;

    if (!nome || !numero || !cpa) {
      return res.status(400).json({ ok: false, msg: "Dados incompletos" });
    }

    const novo = {
      id: Date.now(),
      nome,
      numero: numero.includes("@c.us") ? numero : numero + "@c.us",
      formulario: formulario || "",
      status: status || "PENDENTE",
      cpa,
      data: data || new Date().toISOString(),
      planilha: [],
      notificacoes: []
    };

    registros.push(novo);
    salvarRegistros(registros);

    io.emit("novo-registro", novo);
    io.emit("update", registros);

    res.json({ ok: true, registro: novo });

  } catch (e) {
    console.error("ERRO /novo-registro:", e);
    res.status(500).json({ ok: false });
  }
});
// Enviar mensagem manual pelo painel
app.post("/enviar-formulario", verificaLogin, async (req, res) => {
  const { numero, mensagem } = req.body;

  if (!client || !client.info)
  return res.status(503).json({ ok: false, erro: "WhatsApp não conectado" });

  try {
    await client.sendMessage(
      numero.includes("@c.us") ? numero : numero + "@c.us",
      mensagem
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("Erro WhatsApp:", e);
    res.status(500).json({ ok: false });
  }
});

// Atualizar status por ID
app.post("/atualizar-status", verificaLogin, async (req, res) => {
  const { id, status } = req.body;

  const registro = registros.find(r => r.id == id);
  if (!registro) return res.json({ ok: false });

  const user = getUser(req);
  if (!podeMexerNoRegistro(user, registro))
    return res.status(403).json({ ok:false });

  // ✅ só altera depois de validar
  registro.status = status;
  salvarRegistros(registros);

  io.emit("update", registros);

  try {
    if (!client || !client.info) throw new Error("BOT_OFFLINE");

    const numero = registro.numero.includes("@c.us")
      ? registro.numero
      : registro.numero + "@c.us";

    if (status.toUpperCase() === "CONFIRMADO")
      await client.sendMessage(numero, "✅ Pagamento confirmado!");

    if (status.toUpperCase() === "FINALIZADO")
      await client.sendMessage(numero, "🎉 Atendimento finalizado!");

  } catch (e) {
    log("Erro ao notificar cliente", "ERROR");
  }

  res.json({ ok: true });
});

// Apagar registro
app.post("/apagar-registro", verificaLogin, (req, res) => {
  const { id } = req.body;
  const index = registros.findIndex(r => r.id == id);
  if (index === -1) return res.json({ ok: false });
  const user = getUser(req);
if(!podeMexerNoRegistro(user, registros[index]))
  return res.status(403).json({ ok:false });

  registros.splice(index, 1);
  salvarRegistros(registros);

  io.emit("update", registros);
  res.json({ ok: true });
});

// ================= SOCKET =================

io.on("connection", socket => {
  log(`Painel conectado: ${socket.id}`, "INFO");
  socket.emit("update", registros);

  socket.on("disconnect", () => {
    log(`Painel desconectado: ${socket.id}`, "INFO");
  });
});

// ================= SERVER =================

server.listen(PORT, () =>
  log(`Painel rodando: http://localhost:${PORT}/painel`, "INFO"
));
// ================= BOT =================
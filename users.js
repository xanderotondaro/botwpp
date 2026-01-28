const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const USERS_FILE = path.join(__dirname, "usuarios.json");

let users = [];

// carregar usuários
try {
  if (fs.existsSync(USERS_FILE)) {
    users = JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) || [];
    // Usuários carregados
  } else {
    fs.writeFileSync(USERS_FILE, "[]");
    // usuarios.json criado
  }
} catch (e) {
  // Erro ao carregar usuarios.json
  users = [];
}

function salvarUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// criar usuário
async function criarUsuario({ usuario, senha, nivel }) {
  if (users.find(u => u.usuario === usuario)) {
    return { ok: false, msg: "Usuário já existe" };
  }

  const hash = await bcrypt.hash(senha, 10);

  users.push({
    id: Date.now(),
    usuario,
    senha: hash,
    nivel,
    criadoEm: new Date().toISOString()
  });

  salvarUsers();
  return { ok: true };
}

// login
async function loginUsuario(usuario, senha) {
  const user = users.find(u => u.usuario === usuario);
  if (!user) return { ok: false, msg: "Usuário não encontrado" };

  const valido = await bcrypt.compare(senha, user.senha);
  if (!valido) return { ok: false, msg: "Senha incorreta" };

  return {
    ok: true,
    user: {
      id: user.id,
      usuario: user.usuario,
      nivel: user.nivel
    }
  };
}

module.exports = {
  criarUsuario,
  loginUsuario
};

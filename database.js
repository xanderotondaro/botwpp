const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "registros.json");

// garante que registros seja um array
let registros = [];
try {
  if (fs.existsSync(DB_FILE)) {
    const dados = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(dados);
    registros = Array.isArray(parsed) ? parsed : [];
    // Registros carregados do JSON
  } else {
    // Arquivo registros.json não encontrado. Criando novo...
    salvarRegistros();
  }
} catch (erro) {
  console.error("❌ Erro ao carregar registros:", erro.message);
  registros = [];
}

function salvarRegistros() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(registros, null, 2));
  } catch (erro) {
    // Erro ao salvar registros
  }
}

function adicionarRegistro(dados) {
  const registro = {
    id: Date.now(),
    ...dados,
    status: dados.status || "PENDENTE",
    planilha: [],
    notificacoes: [],
    dataCriacao: new Date().toISOString(),
  };
  registros.push(registro);
  salvarRegistros();
  return registro;
}

function atualizarStatus(id, status) {
  const registro = registros.find(r => r.id == id);
  if (!registro) return null;
  registro.status = status;
  salvarRegistros();
  return registro;
}

function salvarPlanilha(id, planilha) {
  const registro = registros.find(r => r.id == id);
  if (!registro) return null;
  registro.planilha = planilha;
  salvarRegistros();
  return registro;
}

function apagarRegistro(id) {
  const tamanhoAnterior = registros.length;
  registros = registros.filter(r => r.id != id);
  if (registros.length < tamanhoAnterior) {
    salvarRegistros();
    return true;
  }
  return false;
}

module.exports = {
  registros,
  adicionarRegistro,
  atualizarStatus,
  salvarPlanilha,
  apagarRegistro
};
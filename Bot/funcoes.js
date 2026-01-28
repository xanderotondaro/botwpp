const axios = require("axios");

async function enviarFormulario(nome, numero, formulario){
  await axios.post("http://localhost:3200/novo-registro", {
    nome, numero, status:"PENDENTE", data:new Date().toISOString(), formulario
  });
}

async function enviarComprovante(nome, numero, comprovante){
  await axios.post("http://localhost:3200/novo-registro", {
    nome, numero, status:"PAGAMENTO CONFIRMADO", data:new Date().toISOString(), formulario:comprovante
  });
}

module.exports = { enviarFormulario, enviarComprovante };

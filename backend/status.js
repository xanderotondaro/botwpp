const statusMsg = {
  PENDENTE: "📥 Solicitação recebida, {nome}. Nossa equipe irá analisar suas informações.",
  ANALISE: "⏳ {nome}, seu pagamento está em análise. Em breve retornaremos.",
  CONFIRMADO: "✅ Pagamento confirmado, {nome}. Seu processo foi iniciado.",
  FINALIZADO: "🏁 Processo finalizado com sucesso, {nome}. Agradecemos a confiança."
};

module.exports = statusMsg; 
console.log("✅ Status personalizados adicionados.");
console.log("✅ versão atualizada.");
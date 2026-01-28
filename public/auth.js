const express = require("express");
const { criarUsuario, loginUsuario } = require("../users");

const router = express.Router();

/* CADASTRAR */
router.post("/register", async (req, res) => {
  const { usuario, senha, nivel } = req.body;
  if (!usuario || !senha || !nivel) {
    return res.json({ ok: false, msg: "Dados incompletos" });
  }

  const result = await criarUsuario({ usuario, senha, nivel });
  res.json(result);
});

/* LOGIN */
router.post("/login", async (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.json({ ok: false, msg: "Dados incompletos" });
  }

  const result = await loginUsuario(usuario, senha);
  res.json(result);
});

module.exports = router;

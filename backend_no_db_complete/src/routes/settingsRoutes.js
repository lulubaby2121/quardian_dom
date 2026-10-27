const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    notificacoes: true,
    tema: 'claro',
  });
});

router.put('/', (req, res) => {
  const { notificacoes, tema } = req.body;

  res.json({
    mensagem: 'Configurações atualizadas',
    notificacoes,
    tema,
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    {
      id: 1,
      mensagem: 'Nova solicitação de acesso',
      lida: false,
    },
    {
      id: 2,
      mensagem: 'Solicitação aprovada',
      lida: true,
    },
  ]);
});

router.put('/:id/read', (req, res) => {
  res.json({
    mensagem: 'Notificação marcada como lida',
    id: req.params.id,
  });
});

module.exports = router;

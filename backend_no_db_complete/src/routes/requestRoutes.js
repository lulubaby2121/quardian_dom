const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send('Requests OK');
});

router.post('/solicitar', (req, res) => {
  const { usuario, cameraId } = req.body;

  res.json({
    mensagem: 'Solicitação enviada',
    usuario,
    cameraId,
  });
});

router.put('/aprovar/:id', (req, res) => {
  res.json({
    mensagem: 'Solicitação aprovada',
    solicitacao: req.params.id,
  });
});

router.put('/recusar/:id', (req, res) => {
  res.json({
    mensagem: 'Solicitação recusada',
    solicitacao: req.params.id,
  });
});

module.exports = router;

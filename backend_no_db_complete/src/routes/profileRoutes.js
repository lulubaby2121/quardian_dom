const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'segredo';

function getTokenFromReq(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('token='));
  if (!match) return null;
  return match.split('=')[1];
}

router.get('/', async (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ error: 'não autenticado' });
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.id) return res.status(401).json({ error: 'token inválido' });

    const row = await get(
      `SELECT id, name AS nome, email, cpf, telefone, avatar_url, bio, created_at FROM users WHERE id = ?`,
      [payload.id]
    );
    if (!row) return res.status(404).json({ error: 'usuário não encontrado' });

    res.json(row);
  } catch (err) {
    console.error('profile error', err.message || err);
    res.status(500).json({ error: 'erro ao buscar perfil' });
  }
});

router.put('/', async (req, res) => {
  const { nome, email } = req.body;
  // implementação mínima: retornar recebido
  res.json({ mensagem: 'Perfil atualizado', nome, email });
});

module.exports = router;

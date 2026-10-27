const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const { all, get, run } = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'segredo';
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const allowedMediaTypes = new Map([
  ['image/jpeg', 'image'],
  ['image/png', 'image'],
  ['image/webp', 'image'],
  ['video/mp4', 'video'],
  ['video/webm', 'video'],
]);

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.id) return res.status(401).json({ error: 'Token inválido.' });
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const posts = await all(
      `SELECT p.id, p.user_id AS userId, p.category, p.content, p.created_at AS createdAt,
        u.name AS author
       FROM community_posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 50`
    );
    const result = await Promise.all(
      posts.map(async (post) => {
        const media = await all(
          `SELECT id, media_type AS mediaType, mime_type AS mimeType, file_name AS fileName
           FROM community_post_media WHERE post_id = ? ORDER BY id`,
          [post.id]
        );
        return { ...post, media };
      })
    );
    res.json(result);
  } catch (err) {
    console.error('feed list error', err);
    res.status(500).json({ error: 'Não foi possível carregar o feed.' });
  }
});

router.post('/', async (req, res) => {
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'Comunidade';
  const media = req.body.media;
  if (content.length > 280 || category.length > 40) {
    return res.status(400).json({ error: 'Texto ou categoria excede o limite permitido.' });
  }
  if (!content && !media) {
    return res.status(400).json({ error: 'Adicione um texto ou uma foto/vídeo.' });
  }

  let mediaBuffer;
  if (media) {
    const mediaType = allowedMediaTypes.get(media.mimeType);
    if (
      !mediaType ||
      typeof media.data !== 'string' ||
      typeof media.fileName !== 'string' ||
      media.data.length > Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 8
    ) {
      return res.status(400).json({ error: 'Formato ou tamanho de mídia não permitido.' });
    }
    mediaBuffer = Buffer.from(media.data, 'base64');
    if (
      mediaBuffer.length === 0 ||
      mediaBuffer.length > MAX_MEDIA_BYTES ||
      mediaBuffer.toString('base64') !== media.data
    ) {
      return res.status(400).json({ error: 'O arquivo precisa ter até 4 MB e estar válido.' });
    }
    media.mediaType = mediaType;
    media.fileName = path
      .basename(media.fileName.replace(/\\/g, '/'))
      .replace(/[\r\n"]/g, '')
      .slice(0, 255);
  }

  let postId;
  try {
    const postResult = await run(
      'INSERT INTO community_posts (user_id, category, content) VALUES (?, ?, ?)',
      [req.user.id, category || 'Comunidade', content]
    );
    postId = postResult.lastID;
    if (media) {
      await run(
        `INSERT INTO community_post_media (post_id, media_type, mime_type, file_name, data)
         VALUES (?, ?, ?, ?, ?)`,
        [postId, media.mediaType, media.mimeType, media.fileName, mediaBuffer]
      );
    }
    const post = await get(
      `SELECT p.id, p.user_id AS userId, p.category, p.content, p.created_at AS createdAt,
        u.name AS author
       FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
      [postId]
    );
    const savedMedia = await all(
      `SELECT id, media_type AS mediaType, mime_type AS mimeType, file_name AS fileName
       FROM community_post_media WHERE post_id = ? ORDER BY id`,
      [postId]
    );
    res.status(201).json({ ...post, media: savedMedia });
  } catch (err) {
    console.error('feed post error', err);
    if (postId) {
      try {
        await run('DELETE FROM community_posts WHERE id = ?', [postId]);
      } catch (cleanupError) {
        console.error('feed post cleanup error', cleanupError);
      }
    }
    res.status(500).json({ error: 'Não foi possível publicar no feed.' });
  }
});

router.get('/:postId/media/:mediaId', async (req, res) => {
  try {
    const media = await get(
      `SELECT m.mime_type AS mimeType, m.file_name AS fileName, m.data
       FROM community_post_media m
       JOIN community_posts p ON p.id = m.post_id
       WHERE p.id = ? AND m.id = ?`,
      [req.params.postId, req.params.mediaId]
    );
    if (!media) return res.status(404).json({ error: 'Mídia não encontrada.' });
    res.set({
      'Content-Type': media.mimeType,
      'Content-Length': media.data.length,
      'Content-Disposition': `inline; filename="${media.fileName.replace(/[\r\n"]/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(media.data);
  } catch (err) {
    console.error('feed media error', err);
    res.status(500).json({ error: 'Não foi possível carregar a mídia.' });
  }
});

module.exports = router;

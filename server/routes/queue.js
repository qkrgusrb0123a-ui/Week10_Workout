const router = require('express').Router();
const db = require('../db');
const queue = require('../services/queue');

const findConcert = db.prepare('SELECT id FROM concerts WHERE id = ?');

router.post('/join', (req, res) => {
  const { concertId, requestId } = req.body ?? {};
  const id = typeof concertId === 'string' ? Number(concertId) : concertId;
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: '유효하지 않은 공연 ID입니다.' });
  }
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[0-9a-f]{32}$/.test(requestId))) {
    return res.status(400).json({ error: '유효하지 않은 대기열 요청 ID입니다.' });
  }
  if (!findConcert.get(id)) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });

  res.json(queue.join(id, requestId));
});

router.get('/:ticketId', (req, res) => {
  const ticket = queue.get(req.params.ticketId);
  if (!ticket) return res.status(404).json({ error: '대기권이 없거나 만료되었습니다.' });
  res.json(ticket);
});

router.post('/:ticketId/leave', (req, res) => {
  queue.leave(req.params.ticketId);
  res.json({ status: 'cancelled' });
});

module.exports = router;

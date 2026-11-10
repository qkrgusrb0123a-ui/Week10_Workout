const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const concerts = db.prepare('SELECT id, title, venue, starts_at AS startsAt, poster_url AS posterUrl FROM concerts ORDER BY starts_at').all();
  res.json(concerts);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: '유효하지 않은 공연 ID입니다.' });
  const concert = db.prepare('SELECT id, title, venue, starts_at AS startsAt, poster_url AS posterUrl FROM concerts WHERE id = ?').get(id);
  if (!concert) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });
  const seats = db.prepare('SELECT seat_id AS seatId, status FROM seats WHERE concert_id = ? AND is_listed = 1 ORDER BY seat_id').all(id);
  res.json({ ...concert, seats });
});

module.exports = router;

// 공연 목록 및 공연별 좌석 조회 API입니다.
const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const concerts = db.prepare('SELECT id, title, venue, starts_at AS startsAt FROM concerts ORDER BY starts_at').all();
  res.json(concerts);
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: '유효하지 않은 공연 ID입니다.' });
  const concert = db.prepare('SELECT id, title, venue, starts_at AS startsAt FROM concerts WHERE id = ?').get(id);
  if (!concert) return res.status(404).json({ error: '공연을 찾을 수 없습니다.' });
  const seats = db.prepare('SELECT seat_id AS seatId, status FROM seats WHERE concert_id = ? ORDER BY seat_id').all(id);
  res.json({ ...concert, seats });
});

module.exports = router;

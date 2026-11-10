const { randomUUID } = require('node:crypto');
const router = require('express').Router();
const db = require('../db');
const queue = require('../services/queue');
const bookingChallenge = require('../services/booking');

const findReservation = db.prepare(`
  SELECT r.code, r.concert_id AS concertId, c.title AS concertTitle,
    r.seat_id AS seatId, r.nickname, r.status
  FROM reservations r JOIN concerts c ON c.id = r.concert_id
  WHERE r.code = ?
`);
const findSeat = db.prepare('SELECT status FROM seats WHERE concert_id = ? AND seat_id = ? AND is_listed = 1');
const reserveSeat = db.prepare(`
  UPDATE seats SET status = 'reserved'
  WHERE concert_id = ? AND seat_id = ? AND status = 'available' AND is_listed = 1
`);
const insertReservation = db.prepare(`
  INSERT INTO reservations (code, concert_id, seat_id, nickname, status)
  VALUES (?, ?, ?, ?, 'confirmed')
`);
const cancelReservation = db.prepare("UPDATE reservations SET status = 'cancelled' WHERE code = ?");
const releaseSeat = db.prepare(`
  UPDATE seats SET status = 'available', is_listed = CASE
    WHEN (SELECT count(*) FROM seats WHERE concert_id = @concertId AND is_listed = 1)
      > (SELECT seat_limit FROM concerts WHERE id = @concertId) THEN 0
    ELSE is_listed
  END
  WHERE concert_id = @concertId AND seat_id = @seatId
`);

const book = db.transaction((concertId, seatId, nickname) => {
  if (reserveSeat.run(concertId, seatId).changes === 0) {
    return findSeat.get(concertId, seatId)
      ? { status: 409, error: '이미 예매된 좌석입니다.' }
      : { status: 404, error: '좌석을 찾을 수 없습니다.' };
  }

  const code = randomUUID();
  insertReservation.run(code, concertId, seatId, nickname);
  return { status: 201, reservation: findReservation.get(code) };
});

const cancel = db.transaction((code) => {
  const reservation = findReservation.get(code);
  if (!reservation) return { status: 404, error: '예매 내역을 찾을 수 없습니다.' };
  if (reservation.status === 'cancelled') return { status: 409, error: '이미 취소된 예매입니다.' };

  cancelReservation.run(code);
  releaseSeat.run({ concertId: reservation.concertId, seatId: reservation.seatId });
  return { status: 200, reservation: { ...reservation, status: 'cancelled' } };
});

function validateBooking(req, res, next) {
  const { concertId, seatId, nickname, queueTicketId, ticketId } = req.body ?? {};
  const id = typeof concertId === 'string' ? Number(concertId) : concertId;
  const seat = typeof seatId === 'string' ? seatId.trim() : '';
  const name = typeof nickname === 'string' ? nickname.trim() : '';
  if (!Number.isSafeInteger(id) || id < 1 || !seat || !name || name.length > 30) {
    return res.status(400).json({ error: '공연, 좌석, 닉네임(1~30자)을 확인해 주세요.' });
  }

  const token = queueTicketId ?? ticketId;
  if (typeof token !== 'string' || !token) {
    return res.status(403).json({ error: '예매 화면에 먼저 입장해 주세요.' });
  }
  const ticket = queue.get(token);
  if (!ticket) return res.status(410).json({ error: '대기권이 없거나 만료되었습니다.' });
  if (ticket.concertId !== id || ticket.status !== 'admitted') {
    return res.status(403).json({ error: '이 공연의 예매 화면에 먼저 입장해 주세요.' });
  }

  res.locals.booking = { concertId: id, seatId: seat, nickname: name, ticket };
  next();
}

router.post('/challenge', validateBooking, (req, res) => {
  const { ticket, seatId } = res.locals.booking;
  res.set('Cache-Control', 'no-store').json(bookingChallenge.create(ticket, seatId));
});

router.post('/', validateBooking, (req, res) => {
  const { concertId, seatId, nickname, ticket } = res.locals.booking;
  const { challengeId, securityCode } = req.body;
  const error = bookingChallenge.verify(ticket.ticketId, seatId, challengeId, securityCode);
  if (error) return res.status(422).json({ error });

  const result = book.immediate(concertId, seatId, nickname);
  res.status(result.status).json(result.error ? { error: result.error } : result.reservation);
});

router.get('/:code', (req, res) => {
  const reservation = findReservation.get(req.params.code);
  if (!reservation) return res.status(404).json({ error: '예매 내역을 찾을 수 없습니다.' });
  res.json(reservation);
});

router.delete('/:code', (req, res) => {
  const result = cancel.immediate(req.params.code);
  res.status(result.status).json(result.error ? { error: result.error } : result.reservation);
});

module.exports = router;

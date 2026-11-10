const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'concert.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS concerts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    venue TEXT NOT NULL,
    starts_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seats (
    concert_id INTEGER NOT NULL,
    seat_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved')),
    PRIMARY KEY (concert_id, seat_id),
    FOREIGN KEY (concert_id) REFERENCES concerts(id)
  );
  CREATE TABLE IF NOT EXISTS reservations (
    code TEXT PRIMARY KEY NOT NULL,
    concert_id INTEGER NOT NULL,
    seat_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('confirmed', 'cancelled')),
    FOREIGN KEY (concert_id, seat_id) REFERENCES seats(concert_id, seat_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_reservation_per_seat
    ON reservations(concert_id, seat_id) WHERE status = 'confirmed';
`);

const stageRows = [[3, 2], [5, 5, 5], [6, 6, 6, 6, 6]];
const sampleShows = [
  { stage: 1, time: '14:00' },
  { stage: 2, time: '15:30' },
  { stage: 3, time: '17:00' },
  { stage: 2, time: '18:30' },
  { stage: 3, time: '20:00' }
];

function seatLayout(stage) {
  return stageRows[stage - 1].flatMap((seatCount, rowIndex) => {
    const row = String.fromCharCode(65 + rowIndex);
    return Array.from({ length: seatCount }, (_, index) => `${row}-${String(index + 1).padStart(2, '0')}`);
  });
}

function migrateCatalog() {
  db.exec('ALTER TABLE concerts ADD COLUMN poster_url TEXT');
  const findConcert = db.prepare('SELECT id FROM concerts WHERE title = ? ORDER BY id LIMIT 1');
  const legacy = findConcert.get('샘플 콘서트');
  if (legacy) {
    db.prepare('DELETE FROM reservations WHERE concert_id = ?').run(legacy.id);
    db.prepare('DELETE FROM seats WHERE concert_id = ?').run(legacy.id);
  }

  const addConcert = db.prepare('INSERT INTO concerts (title, venue, starts_at, poster_url) VALUES (?, ?, ?, ?)');
  const updateConcert = db.prepare('UPDATE concerts SET title = ?, venue = ?, starts_at = ?, poster_url = ? WHERE id = ?');
  const addSeat = db.prepare('INSERT INTO seats (concert_id, seat_id) VALUES (?, ?) ON CONFLICT(concert_id, seat_id) DO NOTHING');
  for (const [index, { stage, time }] of sampleShows.entries()) {
    const number = String(index + 1).padStart(2, '0');
    const title = '샘플 콘서트 ' + number;
    const details = [title, '스테이지 ' + stage, `2026-12-20T${time}:00+09:00`, `/images/concert-poster${number}.jpg`];
    const concert = (index === 0 && legacy) || findConcert.get(title);
    const concertId = concert ? concert.id : addConcert.run(...details).lastInsertRowid;
    if (concert) updateConcert.run(...details, concertId);

    for (const seatId of seatLayout(stage)) addSeat.run(concertId, seatId);
  }
}

function trimCatalog() {
  db.exec(`
    ALTER TABLE concerts ADD COLUMN seat_limit INTEGER;
    ALTER TABLE seats ADD COLUMN is_listed INTEGER NOT NULL DEFAULT 1 CHECK (is_listed IN (0, 1));
  `);
  const findSample = db.prepare('SELECT id FROM concerts WHERE poster_url = ?');
  for (const poster of ['02', '05']) {
    const concert = findSample.get(`/images/concert-poster${poster}.jpg`);
    if (!concert) continue;
    db.prepare('DELETE FROM reservations WHERE concert_id = ?').run(concert.id);
    db.prepare('DELETE FROM seats WHERE concert_id = ?').run(concert.id);
    db.prepare('DELETE FROM concerts WHERE id = ?').run(concert.id);
  }

  const updateConcert = db.prepare('UPDATE concerts SET title = ?, venue = ?, seat_limit = ? WHERE id = ?');
  const findReservedSeats = db.prepare("SELECT seat_id FROM seats WHERE concert_id = ? AND status = 'reserved'");
  const hideSeats = db.prepare('UPDATE seats SET is_listed = 0 WHERE concert_id = ?');
  const listSeat = db.prepare(`
    INSERT INTO seats (concert_id, seat_id) VALUES (?, ?)
    ON CONFLICT (concert_id, seat_id) DO UPDATE SET is_listed = 1
  `);
  const removeUnusedSeats = db.prepare(`
    DELETE FROM seats WHERE concert_id = ? AND is_listed = 0 AND NOT EXISTS (
      SELECT 1 FROM reservations r WHERE r.concert_id = seats.concert_id AND r.seat_id = seats.seat_id
    )
  `);

  for (const [index, poster] of ['01', '03', '04'].entries()) {
    const concert = findSample.get(`/images/concert-poster${poster}.jpg`);
    if (!concert) continue;
    const stage = index + 1;
    const layout = seatLayout(stage);
    const number = String(stage).padStart(2, '0');
    updateConcert.run('샘플 콘서트 ' + number, '스테이지 ' + stage, layout.length, concert.id);

    const listed = new Set(findReservedSeats.all(concert.id).map((seat) => seat.seat_id));
    for (const seatId of layout) {
      if (listed.size >= layout.length) break;
      listed.add(seatId);
    }
    hideSeats.run(concert.id);
    for (const seatId of listed) listSeat.run(concert.id, seatId);
    removeUnusedSeats.run(concert.id);
  }
}

if (db.pragma('user_version', { simple: true }) < 3) {
  const migrate = db.transaction(() => {
    const version = db.pragma('user_version', { simple: true });
    if (version >= 3) return;
    if (version < 1) migrateCatalog();
    if (version < 2) trimCatalog();

    db.exec(`
      UPDATE concerts
      SET poster_url = CASE title
        WHEN '샘플 콘서트 02' THEN '/images/concert-poster02.jpg'
        WHEN '샘플 콘서트 03' THEN '/images/concert-poster03.jpg'
      END
      WHERE (title = '샘플 콘서트 02' AND poster_url = '/images/concert-poster03.jpg')
         OR (title = '샘플 콘서트 03' AND poster_url = '/images/concert-poster04.jpg');
    `);
    db.pragma('user_version = 3');
  });
  migrate.immediate();
}

module.exports = db;

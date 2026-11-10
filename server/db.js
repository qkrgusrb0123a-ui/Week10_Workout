// SQLite 연결과 초기 테이블/샘플 데이터를 준비합니다.
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
`);

const count = db.prepare('SELECT COUNT(*) AS count FROM concerts').get().count;
if (count === 0) {
  const seed = db.transaction(() => {
    db.prepare('INSERT INTO concerts (id, title, venue, starts_at) VALUES (?, ?, ?, ?)')
      .run(1, '샘플 콘서트', '서울 공연장', '2026-12-20T18:00:00+09:00');
    const addSeat = db.prepare('INSERT INTO seats (concert_id, seat_id) VALUES (?, ?)');
    for (const seatId of ['A-01', 'A-02', 'A-03', 'B-01', 'B-02']) addSeat.run(1, seatId);
  });
  seed();
}

module.exports = db;

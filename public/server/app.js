// Express 서버: 정적 프런트엔드 제공 + API 요청 처리.
const express = require('express');
const path = require('node:path');
const db = require('./db');
const concertsRouter = require('./routes/concerts');

const app = express();
const port = Number(process.env.PORT || 3000);
app.disable('x-powered-by');
app.use(express.json());

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});
app.use('/api/concerts', concertsRouter);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res) => res.status(404).json({ error: '요청한 주소가 없습니다.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Concert Ticketing server listening on port ${port}`);
});

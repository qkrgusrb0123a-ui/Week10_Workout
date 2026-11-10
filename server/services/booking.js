const { randomInt, randomUUID } = require('node:crypto');

const challenges = new Map();
const lifetimeMs = 60_000;
const digits = [
  '01110 11011 11011 11011 11011 11011 01110',
  '00100 01100 00100 00100 00100 00100 01110',
  '01110 11011 00011 00110 01100 11000 11111',
  '11110 00011 00011 01110 00011 00011 11110',
  '00011 00111 01111 11011 11111 00011 00011',
  '11111 11000 11000 11110 00011 11011 01110',
  '01110 11000 11000 11110 11011 11011 01110',
  '11111 00011 00110 00110 01100 01100 01100',
  '01110 11011 11011 01110 11011 11011 01110',
  '01110 11011 11011 01111 00011 00011 01110'
].map((digit) => digit.split(' '));

function renderImage(answer) {
  const width = 168;
  const height = 48;
  const stride = Math.ceil(width * 3 / 4) * 4;
  const pixelOffset = 54;
  const bitmap = Buffer.alloc(pixelOffset + stride * height, 248);
  bitmap.fill(0, 0, pixelOffset);
  bitmap.write('BM');
  bitmap.writeUInt32LE(bitmap.length, 2);
  bitmap.writeUInt32LE(pixelOffset, 10);
  bitmap.writeUInt32LE(40, 14);
  bitmap.writeInt32LE(width, 18);
  bitmap.writeInt32LE(-height, 22);
  bitmap.writeUInt16LE(1, 26);
  bitmap.writeUInt16LE(24, 28);
  bitmap.writeUInt32LE(stride * height, 34);

  function pixel(x, y, [red, green, blue]) {
    const offset = pixelOffset + y * stride + x * 3;
    bitmap[offset] = blue;
    bitmap[offset + 1] = green;
    bitmap[offset + 2] = red;
  }

  for (let i = 0; i < 420; i += 1) {
    const shade = randomInt(192, 240);
    pixel(randomInt(width), randomInt(height), [shade, shade, 240]);
  }
  const lineOffset = randomInt(20);
  for (let x = 0; x < width; x += 1) {
    const y = 23 + Math.round(11 * Math.sin((x + lineOffset) / 12));
    pixel(x, y, [170, 142, 205]);
    pixel(x, y + 1, [170, 142, 205]);
  }
  for (const [index, digit] of Array.from(answer).entries()) {
    const shape = digits[Number(digit)];
    const left = 10 + index * 25 + randomInt(-2, 3);
    const top = randomInt(8, 14);
    const lean = randomInt(-3, 4);
    const ink = [randomInt(30, 72), randomInt(19, 66), randomInt(65, 110)];
    for (let y = 0; y < 28; y += 1) {
      const offset = Math.round((y - 14) * lean / 14);
      for (let x = 0; x < 20; x += 1) {
        if (shape[Math.floor(y / 4)][Math.floor(x / 4)] === '1') {
          pixel(left + x + offset, top + y, ink);
        }
      }
    }
  }

  return 'data:image/bmp;base64,' + bitmap.toString('base64');
}

function create(ticket, seatId) {
  const now = Date.now();
  for (const [ticketId, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(ticketId);
  }

  const challengeId = randomUUID();
  const answer = String(randomInt(1_000_000)).padStart(6, '0');
  const expiresAt = Math.min(now + lifetimeMs, ticket.expiresAt);
  challenges.set(ticket.ticketId, { challengeId, seatId, answer, expiresAt });
  return { challengeId, image: renderImage(answer) };
}

function verify(ticketId, seatId, challengeId, securityCode) {
  const challenge = challenges.get(ticketId);
  if (!challenge || challenge.challengeId !== challengeId || challenge.seatId !== seatId) {
    return '새 보안문자를 받아 입력해 주세요.';
  }

  challenges.delete(ticketId);
  if (challenge.expiresAt <= Date.now()) return '보안문자 입력 시간이 지났습니다.';
  if (typeof securityCode !== 'string' || securityCode.trim() !== challenge.answer) {
    return '보안문자가 일치하지 않습니다. 새 보안문자를 입력해 주세요.';
  }
  return null;
}

module.exports = { create, verify };

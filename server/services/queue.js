const { randomUUID } = require('node:crypto');

const tickets = new Map();
const activeLimit = positiveInteger(process.env.QUEUE_ACTIVE_LIMIT, 2);
const admissionMs = positiveInteger(process.env.QUEUE_ADMISSION_TTL_SECONDS, 120) * 1000;
const waitingMs = 30_000;

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function updateQueue(concertId, now) {
  let admitted = 0;
  for (const [id, ticket] of tickets) {
    if (ticket.expiresAt <= now) {
      tickets.delete(id);
    } else if (ticket.concertId === concertId && ticket.status === 'admitted') {
      admitted += 1;
    }
  }

  let position = 0;
  for (const ticket of tickets.values()) {
    if (ticket.concertId !== concertId || ticket.status !== 'waiting') continue;
    if (admitted < activeLimit) {
      ticket.status = 'admitted';
      ticket.expiresAt = now + admissionMs;
      ticket.position = null;
      admitted += 1;
    } else {
      ticket.position = ++position;
    }
  }
}

function publicTicket({ ticketId, concertId, status, position, expiresAt }) {
  return { ticketId, concertId, status, position, expiresAt };
}

function join(concertId, requestId) {
  const now = Date.now();
  updateQueue(concertId, now);
  if (requestId) {
    for (const ticket of tickets.values()) {
      if (ticket.concertId === concertId && ticket.requestId === requestId) {
        if (ticket.status === 'waiting') ticket.expiresAt = now + waitingMs;
        return publicTicket(ticket);
      }
    }
  }

  const ticketId = randomUUID();
  const ticket = { ticketId, concertId, requestId, status: 'waiting', expiresAt: now + waitingMs };
  tickets.set(ticketId, ticket);
  updateQueue(concertId, now);
  return publicTicket(ticket);
}

function get(ticketId) {
  const ticket = tickets.get(ticketId);
  if (!ticket) return null;

  const now = Date.now();
  updateQueue(ticket.concertId, now);
  if (!tickets.has(ticketId)) return null;
  if (ticket.status === 'waiting') ticket.expiresAt = now + waitingMs;
  return publicTicket(ticket);
}

function leave(ticketId) {
  const ticket = tickets.get(ticketId);
  if (!ticket) return;
  tickets.delete(ticketId);
  updateQueue(ticket.concertId, Date.now());
}

module.exports = { join, get, leave };

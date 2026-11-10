const API = {
  async request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch('/api' + path, {
        method,
        headers: body === undefined
          ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      });
    } catch (error) {
      const text = error.name === 'TimeoutError'
        ? '서버 응답 시간이 초과되었습니다. 다시 시도해 주세요.'
        : '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      throw new Error(text);
    }

    const data = response.status === 204 ? {} : await response.json().catch(() => null);
    if (!response.ok) {
      const bookingRoute = /^\/(reservations|queue)(\/|$)/.test(path);
      const missingRoute = response.status === 404 &&
        (!data || (data.error ?? data.message) === '요청한 주소가 없습니다.');
      const unavailable = bookingRoute && (missingRoute || response.status === 501);
      const feature = path.startsWith('/queue') ? '예매 입장' : '예매';
      const text = unavailable
        ? feature + ' 기능은 아직 서버에서 제공하지 않습니다.'
        : data?.message ?? data?.error ?? '요청을 처리하지 못했습니다 (' + response.status + ').';
      const error = new Error(text);
      error.status = response.status;
      error.unavailable = unavailable;
      throw error;
    }
    if (!data || typeof data !== 'object') throw new Error('서버 응답 형식을 확인해 주세요.');
    return data;
  },

  concerts() { return this.request('/concerts'); },
  concert(id) { return this.request('/concerts/' + encodeURIComponent(id)); },
  book(body) { return this.request('/reservations', { method: 'POST', body }); },
  reservation(code) { return this.request('/reservations/' + encodeURIComponent(code)); },
  cancel(code) { return this.request('/reservations/' + encodeURIComponent(code), { method: 'DELETE' }); },
  join(concertId) {
    return this.request('/queue/join', { method: 'POST', body: { concertId: Number(concertId) || concertId } });
  },
  queue(ticketId) { return this.request('/queue/' + encodeURIComponent(ticketId)); },
  leave(ticketId) { return this.request('/queue/' + encodeURIComponent(ticketId) + '/leave', { method: 'POST' }); }
};

const $ = (selector) => document.querySelector(selector);
const urlParam = (key) => new URLSearchParams(location.search).get(key);
const concertUrl = (id) => '/concert.html?id=' + encodeURIComponent(id);
const ticketKey = (id) => 'queueTicket:' + id;

function showNotice(element, text = '', state = '') {
  element.textContent = text;
  element.classList.toggle('is-error', state === 'error');
  element.classList.toggle('is-success', state === 'success');
  element.hidden = !text;
}

function html(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

function list(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  return Array.isArray(data?.data?.[key]) ? data.data[key] : [];
}

function concertInfo(data) {
  return data?.concert ?? data?.data?.concert ?? data?.data ?? data;
}

function reservationInfo(data) {
  return data?.reservation ?? data?.data?.reservation ?? data?.data ?? data;
}

function ticketInfo(data) {
  return data?.ticket ?? data?.data?.ticket ?? data?.data ?? data;
}

function isAdmitted(ticket) {
  return ticket.admitted === true || ticket.allowed === true ||
    ['admitted', 'ready', 'active', 'entered'].includes(String(ticket.status).toLowerCase());
}

function isTicketClosed(ticket) {
  return ['expired', 'cancelled', 'canceled'].includes(String(ticket.status).toLowerCase());
}

const concertDateTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'full',
  timeStyle: 'short'
});

function concertDate(concert) {
  const value = concert.startsAt ?? concert.starts_at ?? concert.date ?? concert.concertDate;
  if (!value) return '일정 미정';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : concertDateTime.format(date);
}

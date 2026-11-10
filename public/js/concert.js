const concertId = urlParam('id');
const seatMap = $('#seats');
const bookingForm = $('#booking');
const bookButton = $('#book-button');
const result = $('#result');
let seats = [];
let selected = null;
let ticketId = null;
let booking = false;

function normalizeSeats(data) {
  const direct = list(data, 'seats');
  const records = direct.length ? direct : list(concertInfo(data), 'seats');
  return records.map((seat) => ({
    id: String(seat.seatId ?? seat.id ?? seat.name ?? seat.label ?? ''),
    taken: seat.booked === true || seat.reserved === true || seat.available === false ||
      ['booked', 'reserved', 'occupied'].includes(String(seat.status).toLowerCase())
  })).filter((seat) => seat.id);
}

function updateSelection() {
  $('#selected').textContent = selected ?? '좌석을 선택해 주세요';
  bookButton.disabled = booking || !ticketId || !selected;
  for (const button of seatMap.querySelectorAll('button')) {
    const active = button.dataset.seatId === selected;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = booking || !ticketId || button.classList.contains('booked');
  }
}

function renderSeats() {
  const groups = new Map();
  const available = seats.filter((seat) => !seat.taken).length;
  $('#seat-count').textContent = seats.length
    ? '선택 가능 ' + available + '석 / 전체 ' + seats.length + '석'
    : '등록된 좌석이 없습니다.';

  for (const seat of seats) {
    const rowName = seat.id.match(/^(.+)-[^-]+$/)?.[1] ?? '';
    if (!groups.has(rowName)) {
      const row = document.createElement('div');
      row.className = 'seat-row';
      if (rowName) {
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', rowName + '열');
      }
      groups.set(rowName, row);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = seat.taken ? 'seat booked' : 'seat';
    button.dataset.seatId = seat.id;
    button.textContent = seat.id;
    button.setAttribute('aria-label', seat.id + (seat.taken ? ' 예약됨' : ''));
    button.addEventListener('click', () => {
      selected = selected === seat.id ? null : seat.id;
      showNotice(result);
      updateSelection();
    });
    groups.get(rowName).append(button);
  }
  seatMap.replaceChildren(...groups.values());
  updateSelection();
}

function setAdmission(token) {
  ticketId = token;
  $('#join').hidden = Boolean(token);
  $('#seat-link').hidden = !token;
  bookingForm.hidden = !token;
  $('#preview-note').hidden = Boolean(token);
  $('#seat-hint').textContent = token
    ? '예매할 좌석 1개를 선택해 주세요.'
    : '좌석을 확인하고 예매 화면에 입장하세요.';
  updateSelection();
}

async function loadConcert() {
  const notice = $('#notice');
  if (!concertId) {
    showNotice(notice, '공연을 선택해 주세요.', 'error');
    return;
  }

  try {
    const data = await API.concert(concertId);
    const concert = concertInfo(data);
    const title = concert.title ?? concert.name ?? '공연 상세';
    $('#concert-title').textContent = title;
    $('#concert-date').textContent = concertDate(concert);
    $('#concert-venue').textContent = concert.venue ?? concert.location ?? '장소 미정';
    $('#description').textContent = concert.description ?? '';
    $('#description').hidden = !concert.description;
    $('#join').href = '/waiting.html?concertId=' + encodeURIComponent(concertId);
    document.title = title + ' | ENCORE';
    seats = normalizeSeats(data);
    renderSeats();
    $('#detail').hidden = false;
    $('#seat-selection').hidden = false;
    showNotice(notice);
  } catch (error) {
    showNotice(notice, error.message, 'error');
    return;
  }

  const saved = sessionStorage.getItem(ticketKey(concertId));
  if (!saved) return;
  try {
    if (isAdmitted(ticketInfo(await API.queue(saved)))) {
      setAdmission(saved);
    }
  } catch (error) {
    if (!error.unavailable && [404, 410].includes(error.status)) {
      sessionStorage.removeItem(ticketKey(concertId));
    }
  }
}

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (booking || !selected || !ticketId) return;
  const nicknameInput = $('#nickname');
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    showNotice(result, '닉네임을 입력해 주세요.', 'error');
    nicknameInput.focus();
    return;
  }

  const seatId = selected;
  booking = true;
  updateSelection();
  showNotice(result, '예매 요청을 처리하고 있습니다.');
  try {
    const data = await API.book({
      concertId: Number(concertId) || concertId,
      seatId,
      nickname,
      queueTicketId: ticketId,
      ticketId
    });
    const reservation = reservationInfo(data);
    const code = reservation.code ?? reservation.reservationCode ?? data.code ?? data.reservationCode;
    seats.find((seat) => seat.id === seatId).taken = true;
    selected = null;
    if (code) {
      showNotice(result, '예매 완료 · 예매번호 ' + code, 'success');
      const link = document.createElement('a');
      link.className = 'text-link';
      link.href = '/reservation.html?code=' + encodeURIComponent(code);
      link.textContent = '예매 내역 확인 →';
      result.append(link);
    } else {
      showNotice(result, '예매 요청은 처리됐으나 서버 응답에 예매번호가 없습니다.');
    }
  } catch (error) {
    showNotice(result, error.message, 'error');
    if ([401, 403, 410].includes(error.status)) {
      sessionStorage.removeItem(ticketKey(concertId));
      selected = null;
      setAdmission(null);
    } else if (error.status === 409) {
      try {
        seats = normalizeSeats(await API.concert(concertId));
        if (!seats.some((seat) => seat.id === seatId && !seat.taken)) selected = null;
      } catch {
        selected = null;
      }
    }
  } finally {
    booking = false;
    renderSeats();
  }
});

loadConcert();

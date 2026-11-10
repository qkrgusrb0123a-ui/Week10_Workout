const concertId = urlParam('id');
const seatMap = $('#seats');
const bookingForm = $('#booking');
const bookButton = $('#book-button');
const result = $('#result');
const securityDialog = $('#security-dialog');
const securityForm = $('#security-form');
const securityImage = $('#security-image');
const securityInput = $('#security-code');
const securityNotice = $('#security-notice');
const securityRefresh = $('#security-refresh');
const securityCancel = $('#security-cancel');
const securityConfirm = $('#security-confirm');
const completionDialog = $('#completion-dialog');
const completionCode = $('#completion-code');
const copyNotice = $('#copy-notice');
let seats = [];
let selected = null;
let ticketId = null;
let busy = false;
let pendingBooking = null;
let challengeId = null;

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
  bookButton.disabled = busy || !ticketId || !selected;
  for (const button of seatMap.querySelectorAll('button')) {
    const active = button.dataset.seatId === selected;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = busy || !ticketId || button.classList.contains('booked');
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

function clearAdmission() {
  sessionStorage.removeItem(ticketKey(concertId));
  selected = null;
  setAdmission(null);
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
    const venue = concertVenue(concert.venue ?? concert.location);
    $('#concert-poster').src = concert.posterUrl ?? '/images/concert-poster01.jpg';
    $('#concert-title').textContent = title;
    $('#concert-date').textContent = concertDate(concert);
    $('#concert-venue').textContent = venue;
    if (/^STAGE 0[1-3]$/.test(venue)) $('#stage').textContent = venue;
    $('#description').textContent = concert.description ?? '';
    $('#description').hidden = !concert.description;
    $('#join').href = '/waiting.html?concertId=' + encodeURIComponent(concertId);
    document.title = title + ' | Concert Ticketing';
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

function setSecurityBusy(value) {
  busy = value;
  securityInput.disabled = value || !challengeId;
  securityConfirm.disabled = securityInput.disabled;
  securityRefresh.disabled = value;
  securityCancel.disabled = value;
  updateSelection();
}

async function loadChallenge(message) {
  challengeId = null;
  securityImage.hidden = true;
  securityImage.removeAttribute('src');
  securityInput.value = '';
  setSecurityBusy(true);
  showNotice(securityNotice, '보안문자를 불러오고 있습니다.');
  try {
    const challenge = await API.bookingChallenge(pendingBooking);
    challengeId = challenge.challengeId;
    securityImage.src = challenge.image;
    securityImage.hidden = false;
    showNotice(securityNotice, message, message ? 'error' : '');
  } catch (error) {
    if ([401, 403, 410].includes(error.status)) {
      securityDialog.close();
      clearAdmission();
      showNotice(result, error.message, 'error');
    } else {
      showNotice(securityNotice, error.message, 'error');
    }
  } finally {
    setSecurityBusy(false);
    if (challengeId && securityDialog.open) securityInput.focus();
  }
}

bookingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy || securityDialog.open || !selected || !ticketId) return;
  const nicknameInput = $('#nickname');
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    showNotice(result, '성명을 입력해 주세요.', 'error');
    nicknameInput.focus();
    return;
  }

  pendingBooking = { concertId, seatId: selected, nickname, queueTicketId: ticketId };
  showNotice(result);
  securityDialog.showModal();
  loadChallenge();
});

securityRefresh.addEventListener('click', () => loadChallenge());
securityCancel.addEventListener('click', () => securityDialog.close());
securityDialog.addEventListener('cancel', (event) => {
  if (busy) event.preventDefault();
});

securityForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !challengeId) return;
  const { seatId } = pendingBooking;
  const securityCode = securityInput.value.trim();
  setSecurityBusy(true);
  showNotice(securityNotice, '보안문자를 확인하고 있습니다.');
  try {
    const data = await API.book({ ...pendingBooking, challengeId, securityCode });
    securityDialog.close();
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
      completionCode.textContent = code;
      $('#completion-link').href = link.href;
      showNotice(copyNotice);
      completionDialog.showModal();
    } else {
      showNotice(result, '예매 요청은 처리됐으나 서버 응답에 예매번호가 없습니다.');
    }
  } catch (error) {
    if (error.status === 422) {
      await loadChallenge(error.message);
      return;
    }
    securityDialog.close();
    showNotice(result, error.message, 'error');
    if ([401, 403, 410].includes(error.status)) {
      clearAdmission();
    } else if (error.status === 409) {
      try {
        seats = normalizeSeats(await API.concert(concertId));
        if (!seats.some((seat) => seat.id === seatId && !seat.taken)) selected = null;
      } catch {
        selected = null;
      }
    }
  } finally {
    setSecurityBusy(false);
    renderSeats();
  }
});

$('#copy-code').addEventListener('click', async () => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(completionCode.textContent);
    } else {
      const range = document.createRange();
      range.selectNodeContents(completionCode);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      if (!document.execCommand('copy')) throw new Error();
      selection.removeAllRanges();
    }
    showNotice(copyNotice, '예매번호를 복사했습니다.', 'success');
  } catch {
    showNotice(copyNotice, '복사할 수 없습니다. 예매번호를 직접 선택해 복사해 주세요.', 'error');
  }
});

loadConcert();

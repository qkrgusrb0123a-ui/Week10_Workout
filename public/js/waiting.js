const concertId = urlParam('concertId');
const queueStatus = $('#status');
const queuePosition = $('#position');
const queueNotice = $('#notice');
const retry = $('#retry');
const leave = $('#leave');
const spinner = $('#spinner');
const queueKey = ticketKey(concertId);
let ticketId = null;
let pollTimer;

function stopQueue(text, errorText, canRetry = true) {
  queueStatus.textContent = text;
  queuePosition.hidden = true;
  spinner.hidden = true;
  retry.hidden = !canRetry;
  showNotice(queueNotice, errorText, 'error');
}

function updateQueue(ticket) {
  showNotice(queueNotice);
  if (isAdmitted(ticket)) {
    leave.disabled = true;
    queueStatus.textContent = '입장 순서가 되었습니다';
    location.replace(concertUrl(concertId));
    return;
  }
  if (isTicketClosed(ticket)) {
    ticketId = null;
    sessionStorage.removeItem(queueKey);
    leave.disabled = true;
    stopQueue('대기권을 다시 받아 주세요', '현재 대기권이 만료되었거나 취소되었습니다.');
    return;
  }

  const position = ticket.position ?? ticket.queuePosition ?? ticket.waitingNumber ?? ticket.rank;
  queueStatus.textContent = '예매 입장 순서를 기다리고 있습니다';
  queuePosition.textContent = position != null ? '현재 대기번호 ' + position + '번' : '';
  queuePosition.hidden = position == null;
  pollTimer = window.setTimeout(poll, 2500);
}

async function poll() {
  pollTimer = null;
  leave.disabled = true;
  try {
    updateQueue(ticketInfo(await API.queue(ticketId)));
  } catch (error) {
    if (!error.unavailable && [404, 410].includes(error.status)) {
      sessionStorage.removeItem(queueKey);
      ticketId = null;
      stopQueue('대기권을 다시 받아 주세요', '현재 대기권을 확인할 수 없습니다.');
    } else if (error.unavailable) {
      stopQueue('대기열을 이용할 수 없습니다', error.message);
    } else {
      showNotice(queueNotice, error.message, 'error');
      pollTimer = window.setTimeout(poll, 2500);
    }
  } finally {
    if (pollTimer) leave.disabled = false;
  }
}

async function start() {
  if (!concertId) {
    $('#back').innerHTML = '<span aria-hidden="true">←</span> 공연 목록';
    stopQueue('공연을 선택해 주세요', '대기열에 입장할 공연 정보가 없습니다.', false);
    return;
  }
  $('#back').href = concertUrl(concertId);
  retry.hidden = true;
  leave.disabled = true;
  spinner.hidden = false;
  queueStatus.textContent = '대기열에 연결하고 있습니다';
  showNotice(queueNotice);

  try {
    ticketId = sessionStorage.getItem(queueKey);
    let ticket;
    if (ticketId) {
      try {
        ticket = ticketInfo(await API.queue(ticketId));
        if (isTicketClosed(ticket)) ticket = null;
      } catch (error) {
        if (error.unavailable || ![404, 410].includes(error.status)) throw error;
      }
    }
    if (!ticket) {
      sessionStorage.removeItem(queueKey);
      ticketId = null;
      ticket = ticketInfo(await API.join(concertId));
      ticketId = ticket.ticketId ?? ticket.id ?? ticket.queueTicketId ?? ticket.token;
      if (!ticketId) throw new Error('서버 응답에 대기권 번호가 없습니다.');
      sessionStorage.setItem(queueKey, ticketId);
    }
    updateQueue(ticket);
    if (pollTimer) leave.disabled = false;
  } catch (error) {
    stopQueue('대기열을 이용할 수 없습니다', error.message);
  }
}

retry.addEventListener('click', start);
leave.addEventListener('click', async () => {
  if (!ticketId || leave.disabled) return;
  window.clearTimeout(pollTimer);
  pollTimer = null;
  leave.disabled = true;
  try {
    await API.leave(ticketId);
    sessionStorage.removeItem(queueKey);
    location.href = concertUrl(concertId);
  } catch (error) {
    showNotice(queueNotice, error.message, 'error');
    leave.disabled = false;
    pollTimer = window.setTimeout(poll, 2500);
  }
});

start();

const lookupForm = $('#lookup');
const codeInput = $('#code');
const lookupButton = lookupForm.querySelector('button');
const lookupNotice = $('#notice');
const reservationBox = $('#reservation');

function setLookupBusy(busy) {
  codeInput.disabled = busy;
  lookupButton.disabled = busy;
}

function renderReservation(reservation, code) {
  const cancelled = ['cancelled', 'canceled'].includes(String(reservation.status).toLowerCase());
  const title = reservation.concertTitle ?? reservation.title ?? reservation.concert?.title ?? reservation.concertId;
  const state = cancelled ? '취소됨'
    : ['confirmed', 'reserved', 'booked', 'active'].includes(String(reservation.status).toLowerCase()) ? '예매 완료'
      : reservation.status ?? '상태 미정';
  const facts = [
    ['예매번호', reservation.code ?? reservation.reservationCode ?? code],
    ['공연', title],
    ['좌석', reservation.seatId ?? reservation.seat?.seatId],
    ['닉네임', reservation.nickname]
  ];

  reservationBox.innerHTML = `
    <section class="panel reservation-ticket" aria-labelledby="ticket-title">
      <div class="ticket-heading">
        <h2 id="ticket-title">예매 정보</h2>
        <span class="ticket-state${cancelled ? ' is-cancelled' : ''}">${html(state)}</span>
      </div>
      <dl class="facts">${facts.map(([label, value]) =>
        `<div><dt>${label}</dt><dd>${html(value ?? '—')}</dd></div>`).join('')}</dl>
      ${cancelled ? '' : '<button class="button button-danger" type="button">예매 취소</button>'}
    </section>`;
  const cancelButton = reservationBox.querySelector('button');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => cancelReservation(code, reservation, cancelButton));
  }
}

async function cancelReservation(code, reservation, button) {
  if (!window.confirm('이 예매를 취소하시겠습니까?')) return;
  button.disabled = true;
  setLookupBusy(true);
  showNotice(lookupNotice, '예매를 취소하고 있습니다.');
  try {
    await API.cancel(code);
    renderReservation({ ...reservation, status: 'cancelled' }, code);
    showNotice(lookupNotice, '예매가 취소되었습니다.', 'success');
  } catch (error) {
    showNotice(lookupNotice, error.message, 'error');
    button.disabled = false;
  } finally {
    setLookupBusy(false);
  }
}

async function lookupReservation(code) {
  if (lookupButton.disabled) return;
  setLookupBusy(true);
  reservationBox.replaceChildren();
  showNotice(lookupNotice, '예매 정보를 확인하고 있습니다.');
  try {
    const data = reservationInfo(await API.reservation(code));
    if (!Object.keys(data).length) throw new Error('예매 정보를 확인할 수 없습니다.');
    renderReservation(data, code);
    showNotice(lookupNotice);
  } catch (error) {
    showNotice(lookupNotice, error.message, 'error');
  } finally {
    setLookupBusy(false);
  }
}

lookupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = codeInput.value.trim();
  if (code) {
    lookupReservation(code);
  } else {
    showNotice(lookupNotice, '예매번호를 입력해 주세요.', 'error');
    codeInput.focus();
  }
});

const incomingCode = urlParam('code')?.trim();
if (incomingCode) {
  codeInput.value = incomingCode;
  lookupReservation(incomingCode);
}

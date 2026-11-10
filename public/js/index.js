const concertList = $('#concerts');
const listNotice = $('#notice');
const keyword = $('#keyword');
let concerts = [];

function renderConcerts() {
  const query = keyword.value.trim().toLocaleLowerCase();
  const matches = concerts.filter((concert) => {
    const name = concert.title ?? concert.name ?? '';
    const venue = concert.venue ?? concert.location ?? '';
    return [name, venue, concertVenue(venue)].some((value) => String(value).toLocaleLowerCase().includes(query));
  });

  const cards = matches.map((concert) => {
    const title = concert.title ?? concert.name ?? '공연';
    const venue = concertVenue(concert.venue ?? concert.location);
    const poster = concert.posterUrl ?? '/images/concert-poster01.jpg';
    return `
      <article class="concert-card">
        <img class="card-poster" src="${html(poster)}" alt="" width="136" height="146" loading="lazy">
        <div>
          <span class="card-tag">CONCERT</span>
          <h3>${html(title)}</h3>
          <div class="card-facts"><p>${html(concertDate(concert))}</p><p>${html(venue)}</p></div>
        </div>
        <a class="button button-primary" href="${concertUrl(concert.id)}" aria-label="${html(title)} 상세 보기">상세 보기 <span aria-hidden="true">→</span></a>
      </article>`;
  });
  concertList.innerHTML = cards.join('');
  const empty = query ? '검색 조건에 맞는 공연이 없습니다.' : '등록된 공연이 없습니다.';
  showNotice(listNotice, matches.length ? '' : empty);
}

async function loadConcerts() {
  try {
    concerts = list(await API.concerts(), 'concerts').filter((concert) => concert?.id != null);
    $('#search').hidden = !concerts.length;
    renderConcerts();
  } catch (error) {
    showNotice(listNotice, error.message, 'error');
  }
}

keyword.addEventListener('input', renderConcerts);
loadConcerts();

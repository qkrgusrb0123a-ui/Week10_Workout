// README의 REST API 설계를 기준으로 작성. 실제 서버 응답 형식이 다르면 이 파일의 normalize 함수를 조정하세요.
const API={
 async request(path,options={}){let response;try{response=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}})}catch(e){throw Error('서버에 연결할 수 없습니다.')}const raw=await response.text();let data;try{data=raw?JSON.parse(raw):{}}catch{data={message:raw}}if(!response.ok)throw Error(data.message||data.error||`요청 실패 (${response.status})`);return data},
 concerts(){return this.request('/concerts')},concert(id){return this.request('/concerts/'+encodeURIComponent(id))},
 book(payload){return this.request('/reservations',{method:'POST',body:JSON.stringify(payload)})},
 reservation(code){return this.request('/reservations/'+encodeURIComponent(code))},
 cancel(code){return this.request('/reservations/'+encodeURIComponent(code),{method:'DELETE'})},
 join(concertId){return this.request('/queue/join',{method:'POST',body:JSON.stringify({concertId})})},
 queue(ticketId){return this.request('/queue/'+encodeURIComponent(ticketId))},
 leave(ticketId){return this.request('/queue/'+encodeURIComponent(ticketId)+'/leave',{method:'POST'})}
};
const $=s=>document.querySelector(s);
function message(target,text,type='alert'){target.className=type;target.textContent=text}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function list(data,key){return Array.isArray(data)?data:Array.isArray(data?.[key])?data[key]:Array.isArray(data?.data)?data.data:[]}
function concertInfo(data){return data?.concert||data?.data?.concert||data?.data||data}
function seatList(data){return list(data,'seats').length?list(data,'seats'):list(concertInfo(data),'seats')}
function reservationInfo(data){return data?.reservation||data?.data||data}
function bookingCode(data){return data?.code||data?.reservationCode||data?.reservation?.code||data?.reservation?.reservationCode||data?.data?.code||data?.data?.reservationCode}
function ticketInfo(data){return data?.ticket||data?.data||data}
function admitted(data){let t=ticketInfo(data);return t.admitted===true||t.allowed===true||['admitted','ready','active','entered'].includes(String(t.status||'').toLowerCase())}
function urlParam(k){return new URLSearchParams(location.search).get(k)}

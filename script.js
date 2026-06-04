const API_URL=window.TAXI_APP_CONFIG.API_URL;
const RATE=0.10;
let token=localStorage.taxiToken||'';
let user=JSON.parse(localStorage.taxiUser||'null');
let drivers=[];
let page='drivers';
let selectedCode='';
let opAmount='';
const app=document.getElementById('app');

function e(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))}
function n(v){return Number(v||0)}
function fmt(x){return n(x).toLocaleString('ka-GE')}
function gel(x){return n(x).toLocaleString('ka-GE',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₾'}
function cls(x){x=n(x);return x>0?'ok':x<0?'bad':'muted'}
function msg(t){alert(t)}
function digits(s){return String(s??'').replace(/\D/g,'')}
function norm(s){return String(s??'').toLowerCase().replace(/\s+/g,' ').trim()}
function driverByCode(code){return drivers.find(d=>String(d.code)==String(code))}

function matchScore(d,q){
  q=norm(q);
  const qDigits=digits(q);
  if(!q)return 0;
  const code=norm(d.code);
  const name=norm(d.fullName);
  const pid=digits(d.personalId);
  const phone=digits(d.phone);
  const nameWords=name.split(' ').filter(Boolean);

  if(code===q || (qDigits && (pid===qDigits || phone===qDigits))) return 1;
  if(code.startsWith(q) || name.startsWith(q) || nameWords.some(w=>w.startsWith(q)) || (qDigits && (pid.startsWith(qDigits) || phone.startsWith(qDigits)))) return 2;
  if(code.includes(q) || name.includes(q) || (qDigits && (pid.includes(qDigits) || phone.includes(qDigits)))) return 3;
  return 0;
}

function filter(q){
  q=norm(q);
  if(!q)return drivers;
  return drivers
    .map(d=>({d,score:matchScore(d,q)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>a.score-b.score || n(a.d.code)-n(b.d.code))
    .map(x=>x.d);
}

async function call(action,payload={}){
  const body={action,...payload,token};
  try{
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow'});
    const d=JSON.parse(await r.text());
    if(!d.ok)throw Error(d.error||'შეცდომა');
    return d;
  }catch(err){
    const r=await fetch(API_URL+'?payload='+encodeURIComponent(JSON.stringify(body)));
    const d=JSON.parse(await r.text());
    if(!d.ok)throw Error(d.error||'შეცდომა');
    return d;
  }
}

async function login(u,p){
  const d=await call('login',{username:u,password:p});
  token=d.token;
  user=d.user||{name:u};
  localStorage.taxiToken=token;
  localStorage.taxiUser=JSON.stringify(user);
  await load();
  render();
}

async function load(){
  try{await call('init')}catch(e){}
  const r=await call('listDrivers');
  drivers=(r.drivers||[]).map(d=>({
    code:d.code||d['კოდი']||'',
    fullName:d.fullName||d.name||d['სახელი გვარი']||'',
    personalId:d.personalId||d.pid||d['პირადი ნომერი']||'',
    phone:d.phone||d['ტელეფონი']||'',
    balance:n(d.balance??d.currentBalance??d['მიმდინარე ქულა']??d['საწყისი ქულა']??0),
    status:d.status||d['სტატუსი']||'აქტიური'
  })).sort((a,b)=>n(a.code)-n(b.code));
}

function render(){
  if(!token)return renderLogin();
  app.innerHTML=`<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="logo">🚕</div><div><div class="brand-title">Taxi Brand House</div><div class="brand-subtitle">ქულების სისტემა</div></div></div><div class="nav"><button class="nav-btn ${page=='drivers'?'active':''}" onclick="go('drivers')">🚕 ტაქსისტები</button><button class="nav-btn ${page=='sale'?'active':''}" onclick="go('sale')">＋ ქულის დამატება</button><button class="nav-btn ${page=='payout'?'active':''}" onclick="go('payout')">₾ თანხის გაცემა</button><button class="nav-btn ${page=='stats'?'active':''}" onclick="go('stats')">◈ სტატისტიკა</button></div><div class="sidebar-footer"><b>${e(user?.name||'მომხმარებელი')}</b><br><button class="btn ghost small" onclick="logout()">გასვლა</button></div></aside><main class="main"><header class="topbar"><div><h1 class="page-title">${title()}</h1><div class="page-subtitle">სწრაფი ძებნა კოდით, სახელით, პირადობით ან ტელეფონით</div></div><div class="top-actions"><button class="btn ghost" onclick="reload()">განახლება</button><button class="btn primary" onclick="openDriver()">ტაქსისტის დამატება</button></div></header><section class="content">${body()}</section></main></div>`;
  bind();
}

function renderLogin(){
  app.innerHTML=`<section class="login-screen"><form class="login-card" id="lf"><div class="login-logo">🚕</div><h1 class="login-title">Taxi Brand House</h1><p class="login-subtitle">შეიყვანე მომხმარებელი და პაროლი</p><input class="input" name="u" placeholder="მომხმარებელი" required><br><br><input class="input" name="p" type="password" placeholder="პაროლი" required><br><br><button class="btn primary" style="width:100%">შესვლა</button><p class="muted">საწყისი: admin / admin123</p></form></section>`;
  document.getElementById('lf').onsubmit=async ev=>{ev.preventDefault();try{await login(ev.target.u.value,ev.target.p.value)}catch(er){msg(er.message)}};
}

function title(){return page=='sale'?'ქულის დამატება':page=='payout'?'თანხის გაცემა':page=='stats'?'სტატისტიკა':'ტაქსისტები'}
function body(){return page=='sale'?op('sale'):page=='payout'?op('payout'):page=='stats'?stats():driversView()}

function driversView(){
  return `<div class="card"><div class="searchbar"><input id="q" class="input" placeholder="ძებნა: კოდი, სახელი, გვარი, პირადი ნომერი, ტელეფონი"><button class="btn primary" onclick="openDriver()">დამატება</button></div><div class="muted" style="margin-top:10px;font-size:13px">პირადი ნომერი იძებნება დაშორებების გარეშე. მაგალითი: 61004015882 იპოვის 610 040 158 82-საც.</div></div><div class="card" style="margin-top:14px"><div class="table-wrap"><table class="table"><thead><tr><th>კოდი</th><th>სახელი გვარი</th><th>პირადი</th><th>ტელეფონი</th><th>ქულა</th><th>სტატუსი</th><th>მოქმედება</th></tr></thead><tbody id="rows">${rows(drivers)}</tbody></table></div></div>`;
}

function rows(arr){
  return arr.map(d=>`<tr><td>${e(d.code)}</td><td><b>${e(d.fullName)}</b></td><td>${e(d.personalId)}</td><td>${e(d.phone)}</td><td class="points ${cls(d.balance)}">${fmt(d.balance)}</td><td><span class="badge">${e(d.status)}</span></td><td><button class="btn small ghost" onclick="openDriverByCode('${e(d.code)}')">რედაქტირება</button></td></tr>`).join('')||`<tr><td colspan="7"><div class="empty">მონაცემი არ არის</div></td></tr>`;
}

function op(type){
  const selected=driverByCode(selectedCode);
  let cash=type=='payout'?n(opAmount)*RATE:0;
  let amt=n(opAmount);
  let nb=selected?selected.balance+(type=='sale'?amt:-amt):0;
  return `<div class="grid cols-2"><div class="card"><h3 class="card-title">ტაქსისტის ძებნა</h3><input id="find" class="input" placeholder="კოდი / სახელი / გვარი / პირადი / ტელეფონი"><div id="list" style="display:grid;gap:8px;margin-top:12px">${driverList(drivers.slice(0,12))}</div></div><div class="card"><h3 class="card-title">ოპერაცია</h3>${selected?`<div class="driver-card"><div><strong>${e(selected.fullName)}</strong><small>${e(selected.code)} • ${e(selected.personalId)} • ${e(selected.phone)}</small></div><div class="big-balance ${cls(selected.balance)}">${fmt(selected.balance)}</div></div><br><input id="amount" class="input" type="number" min="1" placeholder="${type=='sale'?'ნავაჭრი':'გასაცემი ქულა'}" value="${e(opAmount)}"><div class="calc-box"><div class="calc-item"><span>ძველი ქულა</span><strong>${fmt(selected.balance)}</strong></div><div class="calc-item"><span>${type=='payout'?'მისაცემი თანხა':'დასამატებელი'}</span><strong>${type=='payout'?gel(cash):fmt(amt)}</strong></div><div class="calc-item"><span>ახალი ბალანსი</span><strong class="${cls(nb)}">${fmt(nb)}</strong></div></div><br><button class="btn ${type=='sale'?'success':'primary'}" onclick="saveOp('${type}')">დადასტურება</button>`:`<div class="empty">აირჩიე ტაქსისტი</div>`}</div></div>`;
}

function driverList(arr){
  return arr.map(d=>`<div class="driver-card" onclick="select('${e(d.code)}')"><div><strong>${e(d.fullName)}</strong><small>${e(d.code)} • ${e(d.personalId)} • ${e(d.phone)}</small></div><b class="points ${cls(d.balance)}">${fmt(d.balance)}</b></div>`).join('')||`<div class="empty">მონაცემი არ არის</div>`;
}

function stats(){
  let total=drivers.reduce((a,d)=>a+d.balance,0),neg=drivers.filter(d=>d.balance<0).length;
  return `<div class="grid cols-4"><div class="card metric"><div class="metric-label">სულ ტაქსისტები</div><div class="metric-value">${drivers.length}</div></div><div class="card metric"><div class="metric-label">აქტიური</div><div class="metric-value">${drivers.filter(d=>d.status=='აქტიური').length}</div></div><div class="card metric"><div class="metric-label">სულ დარჩენილი ქულა</div><div class="metric-value">${fmt(total)}</div></div><div class="card metric"><div class="metric-label">მინუსში</div><div class="metric-value">${neg}</div></div></div>`;
}

function bind(){
  let q=document.getElementById('q');
  if(q)q.oninput=()=>{document.getElementById('rows').innerHTML=rows(filter(q.value))};
  let f=document.getElementById('find');
  if(f)f.oninput=()=>{document.getElementById('list').innerHTML=driverList(filter(f.value).slice(0,25))};
  let a=document.getElementById('amount');
  if(a)a.oninput=()=>{opAmount=a.value;render()};
}

function select(code){selectedCode=code;opAmount='';render()}

async function saveOp(type){
  const selected=driverByCode(selectedCode);
  let amt=n(opAmount);
  if(!selected||amt<=0)return msg('შეავსე თანხა');
  try{
    await call(type=='sale'?'addSale':'addPayout',{driverCode:selected.code,amount:amt,points:amt});
    await load();
    render();
    msg('შენახულია');
  }catch(e){msg(e.message)}
}

function openDriverByCode(code){openDriver(driverByCode(code)||{})}

function openDriver(d={}){
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="md"><div class="modal-card"><div class="modal-head"><h2>${d.code?'რედაქტირება':'დამატება'}</h2><button class="btn ghost" onclick="md.remove()">×</button></div><input id="fn" class="input" placeholder="სახელი გვარი" value="${e(d.fullName||'')}"><br><br><input id="pid" class="input" placeholder="პირადი ნომერი" value="${e(d.personalId||'')}"><br><br><input id="ph" class="input" placeholder="ტელეფონი" value="${e(d.phone||'')}"><br><br><input id="bal" class="input" type="number" placeholder="ქულა" value="${n(d.balance)}"><br><br><select id="st" class="select"><option ${d.status=='აქტიური'?'selected':''}>აქტიური</option><option ${d.status=='შეჩერებული'?'selected':''}>შეჩერებული</option><option ${d.status=='გაუქმებული'?'selected':''}>გაუქმებული</option></select><br><br><button class="btn primary" onclick="saveDriver('${e(d.code||'')}')">შენახვა</button></div></div>`);
}

async function saveDriver(code){
  try{
    await call(code?'updateDriver':'addDriver',{code,fullName:fn.value,personalId:pid.value,phone:ph.value,balance:n(bal.value),status:st.value});
    md.remove();
    await load();
    render();
    msg('შენახულია');
  }catch(e){msg(e.message)}
}

function go(p){page=p;selectedCode='';opAmount='';render()}
async function reload(){await load();render()}
function logout(){localStorage.removeItem('taxiToken');localStorage.removeItem('taxiUser');token='';render()}

if(token)load().then(render).catch(()=>render());else render();

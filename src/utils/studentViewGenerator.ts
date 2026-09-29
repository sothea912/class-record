import { esc } from './helpers';
import { StudentRankResult, SubjectItem } from '../types';

export function buildStudentViewHtml(b64: string, className: string, label: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My Student Result — ${esc(className)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{
  --navy:#0B3C71;
  --blue:#1565C0;
  --sky:#0284C7;
  --mist:#F0F7FF;
  --paper:#FFFFFF;
  --canvas:#F8FAFC;
  --ink:#0F172A;
  --muted:#64748B;
  --line:#E2E8F0;
  --ok:#16A34A;
  --bad:#DC2626;
  --accent:#2563EB;
}
*{box-sizing:border-box}
body{
  margin:0;
  background:radial-gradient(circle at 50% 0%, #E0F2FE 0%, #F8FAFC 55%);
  color:var(--ink);
  font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;
  min-height:100vh;
  padding:32px 16px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}
.wrap{width:100%;max-width:540px;margin:0 auto}
.card{
  background:rgba(255,255,255,0.92);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(226,232,240,0.8);
  border-radius:24px;
  box-shadow:0 20px 45px -10px rgba(15,23,42,0.1), 0 0 0 1px rgba(255,255,255,0.5) inset;
  padding:32px;
}
.header-mark{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:6px 12px;
  background:#EFF6FF;
  border:1px solid #DBEAFE;
  border-radius:999px;
  color:var(--accent);
  font-size:12px;
  font-weight:600;
  margin-bottom:16px;
}
h1{font-size:1.45rem;font-weight:700;margin:0 0 6px;letter-spacing:-0.02em;color:var(--ink)}
.sub{color:var(--muted);font-size:0.88rem;margin:0 0 24px;line-height:1.5}
label{display:block;font-size:0.8rem;color:var(--muted);margin-bottom:6px;font-weight:600}
input{
  width:100%;
  padding:12px 14px;
  border:1px solid var(--line);
  border-radius:12px;
  font-size:0.95rem;
  margin-bottom:16px;
  font-family:inherit;
  color:var(--ink);
  background:#fff;
  transition:all 0.15s ease;
}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,0.15)}
button{
  width:100%;
  background:linear-gradient(135deg,#2563EB,#1D4ED8);
  color:#fff;
  border:0;
  padding:12px;
  border-radius:12px;
  font-size:0.95rem;
  font-weight:600;
  cursor:pointer;
  font-family:inherit;
  box-shadow:0 4px 12px rgba(37,99,235,0.25);
  transition:all 0.15s ease;
}
button:hover{filter:brightness(1.05);transform:translateY(-1px)}
button:active{transform:translateY(0)}
.err{color:var(--bad);font-size:0.85rem;background:#FEF2F2;border:1px solid #FEE2E2;padding:10px 12px;border-radius:10px;margin-bottom:16px}
.who{display:flex;gap:16px;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.who img,.who .ph{width:60px;height:60px;border-radius:50%;object-fit:cover;background:#E2E8F0;display:grid;place-items:center;font-weight:700;color:#64748B}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:0.88rem}
th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left}
th{color:var(--muted);font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;font-family:'JetBrains Mono',monospace}
.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:18px 0}
.stat{background:var(--mist);border:1px solid #E0F2FE;border-radius:14px;padding:12px 14px}
.stat b{display:block;font-size:1.35rem;font-weight:700;font-variant-numeric:tabular-nums}
.stat span{font-size:0.75rem;color:var(--muted);font-weight:500}
.foot{text-align:center;color:var(--muted);font-size:0.78rem;margin-top:20px}
.pill{display:inline-block;padding:4px 12px;border-radius:999px;font-size:0.78rem;font-weight:700}
.pill.pass{background:#DCFCE7;color:var(--ok)}
.pill.fail{background:#FEE2E2;color:var(--bad)}
.back{background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;box-shadow:none;margin-top:16px}
.back:hover{background:#E2E8F0;color:#1E293B}
</style>
</head>
<body>
<div class="wrap">
  <div class="card" id="app"></div>
  <p class="foot">${esc(className)} &middot; ${esc(label)}</p>
</div>
<script>
(function(){
  var DATA=null;
  try{ DATA=JSON.parse(decodeURIComponent(escape(atob('${b64}')))); }catch(e){ DATA=null; }
  var app=document.getElementById('app');

  function el(tag, props, children){
    var e=document.createElement(tag);
    if(props) for(var k in props){
      if(k==='class') e.className=props[k];
      else e.setAttribute(k, props[k]);
    }
    (children||[]).forEach(function(c){
      if(c==null) return;
      if(typeof c==='string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function showLogin(err){
    app.innerHTML='';
    var badge=el('div',{class:'header-mark'},['Academic Report Portal']);
    app.appendChild(badge);
    app.appendChild(el('h1',null,['Student Result Access']));
    app.appendChild(el('p',{class:'sub'},['Please enter your full name and the password assigned by your teacher.']));
    if(err) app.appendChild(el('div',{class:'err'},[err]));
    var name=el('input',{type:'text', placeholder:'Your full name (e.g. Chan Sokha)'});
    var pass=el('input',{type:'password', placeholder:'Your student password'});
    app.appendChild(el('label',null,['Full Name']));
    app.appendChild(name);
    app.appendChild(el('label',null,['Password']));
    app.appendChild(pass);
    var btn=el('button',null,['Unlock My Report']);
    app.appendChild(btn);

    function tryLogin(){
      if(!DATA){ showLogin('Unable to parse result payload. Ask your instructor to re-export.'); return; }
      var n=(name.value||'').trim().toLowerCase();
      var p=(pass.value||'').trim();
      if(!n || !p){ showLogin('Please enter both your name and password.'); return; }
      var found=null;
      for(var i=0;i<DATA.students.length;i++){
        var s=DATA.students[i];
        if(s.name.trim().toLowerCase()===n && s.password===p){ found=s; break; }
      }
      if(!found){ showLogin('Name or password not recognized. Please check the spelling.'); return; }
      showResult(found);
    }
    btn.onclick=tryLogin;
    pass.addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });
    name.focus();
  }

  function stat(value, capt){
    return el('div',{class:'stat'},[ el('b',null,[String(value)]), el('span',null,[capt]) ]);
  }

  function showResult(s){
    app.innerHTML='';
    var who=el('div',{class:'who'});
    who.appendChild(s.photo ? el('img',{src:s.photo, alt:s.name}) : el('div',{class:'ph'},[s.name.slice(0,2).toUpperCase()]));
    var info=el('div');
    info.appendChild(el('h1',null,[s.name]));
    info.appendChild(el('p',{class:'sub',style:'margin:0'},[(s.no?s.no+' \\u00b7 ':'')+DATA.class]));
    who.appendChild(info);
    app.appendChild(who);

    var table=el('table');
    table.appendChild(el('thead',null,[el('tr',null,[el('th',null,['Component']), el('th',{class:'num'},['Score']), el('th',{class:'num'},['Percent'])])]));
    var tbody=el('tbody');
    s.per.forEach(function(p){
      tbody.appendChild(el('tr',null,[ el('td',null,[p.name]), el('td',{class:'num'},[p.got+' / '+p.max]), el('td',{class:'num'},[p.pct+'%']) ]));
    });
    if(DATA.workMax){
      var wpct=DATA.workMax?Math.round(s.work/DATA.workMax*1000)/10:0;
      tbody.appendChild(el('tr',null,[ el('td',null,['Classwork Tasks']), el('td',{class:'num'},[s.work+' / '+DATA.workMax]), el('td',{class:'num'},[wpct+'%']) ]));
    }
    var apct=s.att.max?Math.round(s.att.score/s.att.max*1000)/10:0;
    tbody.appendChild(el('tr',null,[ el('td',null,['Attendance Score']), el('td',{class:'num'},[s.att.score+' / '+s.att.max]), el('td',{class:'num'},[apct+'%']) ]));
    table.appendChild(tbody);
    app.appendChild(table);

    var stats=el('div',{class:'stats'});
    stats.appendChild(stat(s.total+' / '+s.max,'Total Score'));
    stats.appendChild(stat(s.pct+'%','Overall Percent'));
    stats.appendChild(stat(s.grade,'Final Grade'));
    stats.appendChild(stat(s.rank+' of '+s.of,'Class Rank'));
    app.appendChild(stats);

    var statBox=el('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-top:12px'});
    statBox.appendChild(el('span',{class:'pill '+(s.status==='Pass'?'pass':'fail')},[s.status]));
    statBox.appendChild(el('span',{style:'font-size:0.8rem;color:var(--muted)'},['Class Average: '+DATA.period]));
    app.appendChild(statBox);

    var attSummary=el('p',{class:'sub',style:'margin-top:14px;font-size:0.8rem'},[
      'Attendance summary: '+s.att.P+' present, '+s.att.L+' late, '+s.att.E+' excused (−5 each), '+s.att.U+' unexcused (−1 each).'
    ]);
    app.appendChild(attSummary);

    var back=el('button',{class:'back'},['Lock & Log Out']);
    back.onclick=function(){ showLogin(); };
    app.appendChild(back);
  }

  if(DATA){ showLogin(); } else { app.innerHTML='<h1>File Error</h1><p class="sub">Corrupted file. Please ask your teacher to generate a new copy.</p>'; }
})();
<\/script>
</body>
</html>`;
}

export function downloadStudentViewFile(
  className: string,
  label: string,
  rows: StudentRankResult[],
  subs: SubjectItem[],
  workMax: number
): { success: boolean; message: string } {
  const missing = rows.filter(r => !r.student.password || r.student.password.trim() === '');
  if (missing.length) {
    const names = missing.slice(0, 3).map(r => r.student.name).join(', ');
    return {
      success: false,
      message: `Set a student view password for ${missing.length} student${missing.length === 1 ? '' : 's'} first (${names}${missing.length > 3 ? '…' : ''}).`,
    };
  }

  const payload = {
    class: className,
    period: label,
    workMax,
    students: rows.map(r => ({
      name: r.student.name,
      no: r.student.studentNo || '',
      photo: r.student.photo || '',
      password: r.student.password,
      per: subs.map(s => ({
        name: s.name,
        got: r.per[s.id].got,
        max: r.per[s.id].max,
        pct: r.per[s.id].pct,
      })),
      work: r.work,
      att: r.att,
      total: r.total,
      max: r.max,
      avg: r.avg,
      pct: r.pct,
      grade: r.grade,
      rank: r.rank,
      of: r.of,
      status: r.status,
    })),
  };

  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const html = buildStudentViewHtml(b64, className, label);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Student-View-${className.replace(/\s+/g, '_')}-${label.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  return {
    success: true,
    message: `Generated encrypted student portal for ${rows.length} student${rows.length === 1 ? '' : 's'}.`,
  };
}

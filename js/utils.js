/* ═══════════════════════════════════════════
   utils.js — Shared helper functions
   ═══════════════════════════════════════════ */

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + '分钟前';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + '小时前';
  return Math.floor(hrs / 24) + '天前';
}

export function isToday(iso) {
  return iso && iso.slice(0, 10) === todayStr();
}

export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function parseLocalDeadline(text) {
  const now = new Date();
  const m = text.match(/(今天|明天|后天|周[一二三四五六日]|下周[一二三四五六日]|(\d+)号前|(\d+)月(\d+)号|(\d+)点|(\d+):(\d+)|上午|下午|中午)/g);
  if (!m) return null;
  let d = new Date(now); d.setHours(18,0,0,0); let matchedDay = false;
  if (text.includes('明天')) { d.setDate(d.getDate()+1); matchedDay=true; }
  else if (text.includes('后天')) { d.setDate(d.getDate()+2); matchedDay=true; }
  else if (text.includes('今天')) { matchedDay=true; }
  else { const wm = text.match(/下周([一二三四五六日])/); if (wm) { const map={一:1,二:2,三:3,四:4,五:5,六:6,日:7}; const cur=d.getDay()||7; d.setDate(d.getDate()+map[wm[1]]-cur+7); matchedDay=true; } else { const tw=text.match(/周([一二三四五六日])/); if(tw){ const map={一:1,二:2,三:3,四:4,五:5,六:6,日:7}; const cur=d.getDay()||7; const diff=map[tw[1]]-cur; d.setDate(d.getDate()+(diff<=0?diff+7:diff)); matchedDay=true; }}}
  const md=text.match(/(\d+)月(\d+)号/); if(md){ d.setMonth(parseInt(md[1])-1); d.setDate(parseInt(md[2])); matchedDay=true; } else { const dm=text.match(/(\d+)号前/); if(dm){ const target=parseInt(dm[1]); if(target<now.getDate())d.setMonth(d.getMonth()+1); d.setDate(target); matchedDay=true; }}
  const t24=text.match(/(\d+):(\d+)/); if(t24){ d.setHours(parseInt(t24[1]),parseInt(t24[2]),0,0); } else { const hm=text.match(/(\d+)点/); if(hm){ let h=parseInt(hm[1]); if(text.includes('下午')&&h<12)h+=12; if(text.includes('上午')&&h===12)h=0; d.setHours(h,0,0,0); } else if(text.includes('中午'))d.setHours(12,0,0,0); else if(text.includes('下午')&&!matchedDay)d.setHours(15,0,0,0); else if(text.includes('上午')&&!matchedDay)d.setHours(9,0,0,0); }
  return matchedDay||t24||hm?d.toISOString().slice(0,16):null;
}

export function deadlineLabel(d) {
  if (!d) return null;
  const dl = new Date(d), now = new Date(), diff = Math.ceil((dl - now) / 86400000), hasTime = d.length > 10, isOverdue = dl < now;
  if (isOverdue) return { text: '⏰ 已逾期', cls: 'soon overdue' };
  if (diff === 0 && hasTime) { const hrs = Math.ceil((dl - now) / 3600000); return { text: hrs <= 0 ? '即将到期' : hrs + '小时后到期', cls: 'soon' }; }
  if (diff === 0) return { text: '今天截止', cls: 'soon' };
  if (diff <= 3) return { text: diff + '天后到期', cls: 'soon' };
  return { text: d.slice(0, 10), cls: '' };
}

export function getDaysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

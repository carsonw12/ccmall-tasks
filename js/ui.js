/* ═══════════════════════════════════════════
   ui.js — DOM rendering & interactions
   ═══════════════════════════════════════════ */

import { escHtml, timeAgo, deadlineLabel, isToday, getDaysUntil } from './utils.js';
import { TYPE_ICONS } from './models.js';

let undoTask = null, _undoCallback = null;

export function setUndoCallback(fn) { _undoCallback = fn; }
export function setUndoTask(task) { undoTask = task; }

export function showToast(msg, withUndo = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  if (withUndo) {
    el.innerHTML = msg + ' <button class="undo-btn" id="toastUndoBtn">撤销</button>';
    setTimeout(() => { const btn = document.getElementById('toastUndoBtn'); if (btn && _undoCallback) btn.onclick = _undoCallback; }, 0);
  } else { el.textContent = msg; }
  el.classList.add('show');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.classList.remove('show'); if (withUndo) undoTask = null; }, withUndo ? 4000 : 2000);
}

export function showProcessing(show, text = 'AI 正在分析...') {
  const el = document.getElementById('processingOverlay');
  if (!el) return;
  const textEl = el.querySelector('.text');
  if (textEl) textEl.textContent = text;
  el.classList.toggle('show', show);
}

export function updateStats(tasks) {
  const setNum = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const now = new Date();
  setNum('statPending', tasks.filter(t => (t.status || t.状态) !== '已完成').length);
  setNum('statToday', tasks.filter(t => isToday(t.createdAt || t.创建时间)).length);
  setNum('statDone', tasks.filter(t => (t.status || t.状态) === '已完成').length);
  setNum('statOverdue', tasks.filter(t => { const s = t.status || t.状态, d = t.deadline || t.截止时间; return s !== '已完成' && d && new Date(d) < now; }).length);
  const pending = tasks.filter(t => (t.status || t.状态) !== '已完成').length;
  const done = tasks.filter(t => (t.status || t.状态) === '已完成').length;
  const tabs = document.querySelectorAll('#tabs .tab');
  if (tabs[0]) tabs[0].querySelector('.count').textContent = pending;
  if (tabs[1]) tabs[1].querySelector('.count').textContent = tasks.length;
  if (tabs[2]) tabs[2].querySelector('.count').textContent = done;
}

export function updateFilterBrands(tasks, onFilterChange) {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
  const brands = [...new Set(tasks.map(t => t.brandName || t.品牌).filter(Boolean))];
  const chips = [...bar.querySelectorAll('.filter-chip')].slice(1);
  chips.forEach(c => { if (!brands.includes(c.dataset.filter)) c.remove(); });
  const existing = [...bar.querySelectorAll('.filter-chip')].slice(1).map(c => c.dataset.filter);
  brands.forEach(b => { if (!existing.includes(b)) { const chip = document.createElement('button'); chip.className = 'filter-chip'; chip.dataset.filter = b; chip.textContent = b; chip.onclick = () => { document.querySelectorAll('#filterBar .filter-chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); onFilterChange(b); }; bar.appendChild(chip); }});
}

export function renderTasks(tasks, { tab, filter, query, onToggle, onDelete, onDetail }) {
  const list = document.getElementById('taskList'), empty = document.getElementById('emptyState');
  if (!list) return;
  let filtered = [...tasks];
  if (tab === 'pending') filtered = filtered.filter(t => (t.status || t.状态) !== '已完成');
  else if (tab === 'done') filtered = filtered.filter(t => (t.status || t.状态) === '已完成');
  if (filter && filter !== 'all') filtered = filtered.filter(t => (t.brandName || t.品牌) === filter);
  if (query) { const q = query.toLowerCase(); filtered = filtered.filter(t => (t.content || t.任务内容 || '').toLowerCase().includes(q) || (t.brandName || t.品牌 || '').toLowerCase().includes(q) || (t.category || t.任务类型 || '').toLowerCase().includes(q) || (t.rawMessage || t.原始消息 || '').toLowerCase().includes(q)); }
  filtered.sort((a, b) => new Date(b.createdAt || b.创建时间) - new Date(a.createdAt || a.创建时间));
  if (!filtered.length) { list.innerHTML = ''; if (empty) { empty.style.display = 'flex'; const t = document.getElementById('emptyTitle'); if (t) t.textContent = query ? '没有匹配的任务' : '暂无任务'; } return; }
  if (empty) empty.style.display = 'none';
  list.innerHTML = filtered.map(t => buildTaskCard(t)).join('');
  list.querySelectorAll('.task-card').forEach(card => {
    let sx = 0, cx = 0, sw = false;
    card.addEventListener('touchstart', (e) => { if (e.target.closest('button')) return; sx = e.touches[0].clientX; cx = 0; sw = true; card.style.transition = 'none'; }, { passive: true });
    card.addEventListener('touchmove', (e) => { if (!sw) return; cx = e.touches[0].clientX - sx; if (Math.abs(cx) < 5) return; e.preventDefault(); const cl = Math.max(-120, Math.min(80, cx)); card.style.transform = `translateX(${cl}px)`; const w = card.parentElement, bg = w.querySelector('.swipe-bg'); if (cl > 20) { bg.querySelector('.left-action').style.opacity = Math.min(1, cl / 80); bg.querySelector('.right-action').style.opacity = '0'; } else if (cl < -20) { bg.querySelector('.right-action').style.opacity = Math.min(1, Math.abs(cl) / 80); bg.querySelector('.left-action').style.opacity = '0'; } }, { passive: false });
    card.addEventListener('touchend', () => { if (!sw) return; sw = false; card.style.transition = 'transform .2s cubic-bezier(.25,.8,.25,1.2)'; const id = card.dataset.id, w = card.parentElement, bg = w.querySelector('.swipe-bg'); if (cx > 60) { card.style.transform = 'translateX(80px)'; setTimeout(() => { card.style.transform = ''; bg.querySelector('.left-action').style.opacity = '0'; if (onToggle) onToggle(id); }, 200); } else if (cx < -60) { card.style.transform = 'translateX(-120px)'; setTimeout(() => { if (onDelete) onDelete(id); }, 250); } else { card.style.transform = ''; bg.querySelector('.left-action').style.opacity = '0'; bg.querySelector('.right-action').style.opacity = '0'; } });
    card.addEventListener('click', (e) => { if (Math.abs(cx) > 5) return; if (onDetail) onDetail(card.dataset.id); });
  });
}

function buildTaskCard(t) {
  const content = t.content || t.任务内容 || '', brand = t.brandName || t.品牌 || '';
  const category = t.category || t.任务类型 || '其他', source = t.source || t.来源 || '';
  const priority = t.priority || t.优先级 || '中', deadline = t.deadline || t.截止时间 || null;
  const status = t.status || t.状态 || '未处理', createdAt = t.createdAt || t.创建时间 || '';
  const done = status === '已完成', prioClass = { '高': 'high', '中': 'medium', '低': 'low' }[priority] || 'medium';
  const dl = deadlineLabel(deadline), icon = TYPE_ICONS[category] || '📌';
  const now = new Date(), isOverdue = !done && deadline && new Date(deadline) < now;
  const displayTime = deadline && deadline.length > 10 ? deadline.slice(11, 16) : '';
  return `<div class="swipe-wrap" data-id="${t.id}"><div class="swipe-bg"><div class="left-action">✓ 完成</div><div class="right-action">✕ 删除</div></div><div class="task-card ${done ? 'done' : ''}${isOverdue ? ' overdue' : ''}" data-id="${t.id}"><div class="priority-dot ${prioClass}"></div><div class="card-body"><div class="card-meta">${brand ? '<span class="brand-chip">' + escHtml(brand) + '</span>' : ''}<span class="type-chip">${icon} ${escHtml(category)}</span>${source ? '<span class="source-chip">👤 ' + escHtml(source) + '</span>' : ''}${isOverdue ? '<span style="font-size:10px;background:rgba(255,59,48,.12);color:var(--danger);padding:2px 6px;border-radius:4px;animation:pulse 2s infinite">🔔</span>' : ''}</div><div class="card-content ${done ? 'done-text' : ''}">${escHtml(content)}</div><div class="card-footer">${dl ? `<span class="deadline ${dl.cls}">📅 ${dl.text}${displayTime ? ' ' + displayTime : ''}</span>` : ''}<span class="time-ago">${timeAgo(createdAt)}</span></div></div></div></div>`;
}

export function showTaskDetail(task, onToggle) {
  const sheet = document.getElementById('detailSheet'), overlay = document.getElementById('detailOverlay');
  if (!sheet || !overlay) return;
  const content = task.content || task.任务内容 || '', brand = task.brandName || task.品牌 || '';
  const category = task.category || task.任务类型 || '', source = task.source || task.来源 || '';
  const priority = task.priority || task.优先级 || '中', deadline = task.deadline || task.截止时间 || null;
  const status = task.status || task.状态 || '未处理', rawMessage = task.rawMessage || task.原始消息 || '';
  const createdAt = task.createdAt || task.创建时间 || '', notes = task.notes || '';
  const isOverdue = status !== '已完成' && deadline && new Date(deadline) < new Date();
  const prioColor = { '高': 'rgba(255,59,48,.08)', '中': 'rgba(255,149,0,.08)', '低': 'rgba(52,199,89,.08)' }[priority] || '';
  const prioTextColor = { '高': 'var(--danger)', '中': 'var(--warning)', '低': 'var(--success)' }[priority] || '';
  sheet.innerHTML = `<h2>📋 任务详情</h2><div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px${isOverdue ? ';box-shadow:inset 0 0 0 1px var(--danger)' : ''}"><div style="font-size:17px;font-weight:600;margin-bottom:8px">${escHtml(content)}</div><div style="display:flex;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--sub)">${brand ? '<span style="background:rgba(0,122,255,.08);color:var(--info);padding:2px 8px;border-radius:4px">🏷 ' + escHtml(brand) + '</span>' : ''}<span style="background:var(--brand-chip-bg);padding:2px 8px;border-radius:4px">${escHtml(category)}</span><span style="background:rgba(255,149,0,.08);color:var(--warning);padding:2px 8px;border-radius:4px">${escHtml(source)}</span><span style="padding:2px 8px;border-radius:4px;background:${prioColor};color:${prioTextColor}">${priority}优先级</span>${isOverdue ? '<span style="background:rgba(255,59,48,.12);color:var(--danger);padding:2px 8px;border-radius:4px">⏰ 已逾期</span>' : ''}</div></div>${rawMessage ? '<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--sub);margin-bottom:4px">📝 原始消息</div><div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;font-size:14px;color:var(--sub)">' + escHtml(rawMessage) + '</div></div>' : ''}${notes ? '<div style="margin-bottom:12px"><div style="font-size:12px;color:var(--sub);margin-bottom:4px">📝 备注</div><div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;font-size:14px;color:var(--text)">' + escHtml(notes) + '</div></div>' : ''}<div style="font-size:12px;color:var(--sub)">创建于 ${new Date(createdAt).toLocaleString('zh-CN')}</div>${deadline ? '<div style="font-size:12px;color:var(--danger);margin-top:4px">⏰ 截止：' + deadline.replace('T', ' ') + '</div>' : ''}${deadline ? `<button class="btn-ios" style="width:100%;margin-top:10px;padding:10px;border-radius:var(--radius-sm);border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font-stack)" onclick="window._createReminderFile('${task.id}')">📌 添加到 iOS 提醒事项</button>` : ''}<div class="modal-actions" style="margin-top:16px"><button class="btn-cancel" onclick="document.getElementById('detailOverlay').classList.remove('show')">关闭</button><button class="btn-submit" style="background:${status === '已完成' ? 'var(--warning)' : 'var(--success)'};color:#fff" id="detailToggleBtn">${status === '已完成' ? '🔄 恢复' : '✅ 标记完成'}</button></div>`;
  const toggleBtn = document.getElementById('detailToggleBtn');
  if (toggleBtn && onToggle) toggleBtn.onclick = () => { onToggle(task.id); overlay.classList.remove('show'); };
  overlay.classList.add('show');
}

export function renderBrandList(brands, onBrandClick) {
  const container = document.getElementById('brandListContainer') || document.getElementById('taskList');
  if (!container) return;
  if (!brands.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-title">暂无品牌</div><div class="empty-desc">点击 + 添加品牌档案</div></div>'; return; }
  container.innerHTML = brands.map(b => { const daysToEnd = getDaysUntil(b.leaseEnd); const leaseWarn = daysToEnd <= 30 && daysToEnd >= 0 ? '<span class="lease-warning">⚠ 租约' + daysToEnd + '天后到期</span>' : daysToEnd < 0 ? '<span class="lease-warning">⚠ 租约已过期</span>' : ''; return `<div class="brand-card" data-id="${b.id}"><div class="brand-name">${escHtml(b.name)}</div><div class="brand-meta">${b.floor ? '<span>📍 ' + escHtml(b.floor) + '</span>' : ''}${b.category ? '<span>🏷 ' + escHtml(b.category) + '</span>' : ''}${b.area ? '<span>📐 ' + b.area + '㎡</span>' : ''}${b.monthlyRent ? '<span>💰 ' + b.monthlyRent + '/月</span>' : ''}${leaseWarn}</div>${b.contacts && b.contacts.length ? '<div style="font-size:12px;color:var(--sub);margin-top:4px">👥 ' + b.contacts.map(c => escHtml(c.name + (c.role ? '(' + c.role + ')' : ''))).join(', ') + '</div>' : ''}</div>`; }).join('');
  container.querySelectorAll('.brand-card').forEach(card => { card.addEventListener('click', () => { if (onBrandClick) onBrandClick(card.dataset.id); }); });
}

export function showBrandDetail(brand, tasks, contracts, { onClose }) {
  const sheet = document.getElementById('detailSheet'), overlay = document.getElementById('detailOverlay');
  if (!sheet || !overlay) return;
  const daysToEnd = getDaysUntil(brand.leaseEnd);
  const leaseStatus = daysToEnd <= 90 && daysToEnd >= 0
    ? '<span class="tag tag-warning">⚠ ' + daysToEnd + '天后到期</span>'
    : daysToEnd < 0
      ? '<span class="tag tag-danger">已过期</span>'
      : '<span class="tag tag-success">有效</span>';

  const relatedTasks = tasks.filter(t => (t.brandName || t.品牌) === brand.name);
  const relatedContracts = contracts.filter(c => c.brandName === brand.name || c.brandId === brand.id);

  // Parse notes for structured display
  const notesLines = brand.notes ? brand.notes.split('\n').filter(Boolean) : [];

  sheet.innerHTML = `
    <h2>🏢 ${escHtml(brand.name)}</h2>
    <div class="detail-section">
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
        ${brand.floor ? '<span class="tag tag-info">📍 ' + escHtml(brand.floor) + '</span>' : ''}
        ${brand.category ? '<span class="tag tag-default">' + escHtml(brand.category) + '</span>' : ''}
        ${leaseStatus}
      </div>
      <div class="contract-meta-grid">
        ${brand.area ? '<div class="contract-meta-item"><div class="label">面积</div><div class="value">' + brand.area + '㎡</div></div>' : ''}
        ${brand.monthlyRent ? '<div class="contract-meta-item"><div class="label">月租金</div><div class="value">¥' + brand.monthlyRent.toLocaleString() + '</div></div>' : ''}
        ${brand.leaseStart ? '<div class="contract-meta-item"><div class="label">合同开始</div><div class="value">' + brand.leaseStart + '</div></div>' : ''}
        ${brand.leaseEnd ? '<div class="contract-meta-item"><div class="label">合同到期</div><div class="value">' + brand.leaseEnd + '</div></div>' : ''}
      </div>
      ${notesLines.length ? '<div style="margin-top:10px;font-size:12px;color:var(--sub);line-height:1.5">' + notesLines.map(l => '<div>📝 ' + escHtml(l) + '</div>').join('') + '</div>' : ''}
    </div>

    ${relatedContracts.length ? `
    <div class="detail-section">
      <h3>📜 合同条款 (${relatedContracts.length})</h3>
      ${relatedContracts.slice(0, 10).map(c => '<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)"><strong>' + escHtml(c.title) + '</strong><div style="color:var(--sub);margin-top:2px;font-size:12px;line-height:1.4">' + escHtml(c.content.slice(0, 120)) + (c.content.length > 120 ? '...' : '') + '</div></div>').join('')}
    </div>` : ''}

    ${relatedTasks.length ? `
    <div class="detail-section">
      <h3>📋 关联任务 (${relatedTasks.length})</h3>
      ${relatedTasks.slice(0, 8).map(t => '<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">' + ((t.status || t.状态) === '已完成' ? '✅ ' : '○ ') + escHtml(t.content || t.任务内容 || '') + '</div>').join('')}
    </div>` : ''}

    ${brand.contacts && brand.contacts.length ? `
    <div class="detail-section">
      <h3>👥 联系人</h3>
      ${brand.contacts.map(c => '<div style="font-size:13px;padding:2px 0">' + escHtml(c.name) + (c.role ? ' · ' + escHtml(c.role) : '') + (c.phone ? ' · ' + escHtml(c.phone) : '') + '</div>').join('')}
    </div>` : ''}

    <div class="modal-actions">
      <button class="btn-cancel" id="brandDetailClose">关闭</button>
    </div>`;

  document.getElementById('brandDetailClose').onclick = () => overlay.classList.remove('show');
  overlay.classList.add('show');
}

export function renderContractList(contracts, brands, { onContractClick }) {
  const container = document.getElementById('contractListContainer') || document.getElementById('taskList');
  if (!container) return;
  if (!contracts.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">暂无合同条款</div><div class="empty-desc">添加合同条款后，AI 可以学习并回答相关问题</div></div>'; return; }
  const brandMap = new Map(brands.map(b => [b.id, b.name]));
  container.innerHTML = contracts.map(c => `<div class="clause-card" data-id="${c.id}"><div class="clause-title">${escHtml(c.title)}</div><div class="clause-content">${escHtml(c.content).slice(0, 150)}${c.content.length > 150 ? '...' : ''}</div><div class="clause-meta"><span class="tag tag-info">${escHtml(c.brandName || brandMap.get(c.brandId) || '通用')}</span><span class="tag tag-default">${escHtml(c.category)}</span>${c.tags && c.tags.length ? c.tags.map(tg => '<span class="tag tag-warning">' + escHtml(tg) + '</span>').join('') : ''}${c.sourceDoc ? '<span>📄 ' + escHtml(c.sourceDoc) + '</span>' : ''}</div></div>`).join('');
  container.querySelectorAll('.clause-card').forEach(card => { card.addEventListener('click', () => { if (onContractClick) onContractClick(card.dataset.id); }); });
}

export function renderAIChat(messages, containerId = 'chatMessages') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = messages.map(m => `<div class="chat-msg ${m.role}">${escHtml(m.content)}</div>`).join('');
  container.scrollTop = container.scrollHeight;
}

export function createReminderFile(task) {
  const content = task.content || task.任务内容 || '', brand = task.brandName || task.品牌 || '无';
  const category = task.category || task.任务类型 || '', source = task.source || task.来源 || '';
  const deadline = task.deadline || task.截止时间 || null;
  const nowISO = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const dueISO = deadline ? new Date(deadline).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z' : '';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CCmall//TaskCenter//CN', 'BEGIN:VTODO', `DTSTAMP:${nowISO}`, `SUMMARY:${content}`, `DESCRIPTION:品牌：${brand} | 类型：${category} | 来源：${source}`, dueISO ? `DUE:${dueISO}` : '', 'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:⏰ ${content}`, 'END:VALARM', 'END:VTODO', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'reminder-' + task.id.slice(0, 8) + '.ics'; a.click(); URL.revokeObjectURL(url);
}

export function updateHeaderDate() {
  const el = document.getElementById('headerDate'); if (!el) return;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'], now = new Date();
  el.textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + weekdays[now.getDay()];
}

export function initTheme() {
  const saved = localStorage.getItem('ccmall_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme'), next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next); localStorage.setItem('ccmall_theme', next);
  return next;
}

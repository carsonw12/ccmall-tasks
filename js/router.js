/* ═══════════════════════════════════════════
   router.js — Simple view switcher (SPA-like)
   ═══════════════════════════════════════════ */

let currentView = 'tasks';
const listeners = [];

export function getCurrentView() { return currentView; }
export function onViewChange(fn) { listeners.push(fn); }

export function navigate(view) {
  if (view === currentView) return;
  currentView = view;
  listeners.forEach(fn => fn(view));
  updateNavTabs(view);
  showView(view);
}

export function initRouter() {
  ['brandListContainer', 'contractListContainer', 'chatContainer'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  updateNavTabs(currentView);
}

function updateNavTabs(view) {
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
}

function showView(view) {
  const taskEls = ['taskList', 'searchBar', 'filterBar', 'tabs'];
  taskEls.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = view === 'tasks' ? '' : 'none'; });
  ['brandListContainer', 'contractListContainer', 'chatContainer'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const map = { brands: 'brandListContainer', contracts: 'contractListContainer', chat: 'chatContainer' };
  const target = map[view];
  if (target) { const el = document.getElementById(target); if (el) el.style.display = ''; }
  const fab = document.getElementById('fab');
  if (fab) { fab.style.display = (view === 'chat' || view === 'settings') ? 'none' : ''; fab.textContent = view === 'brands' ? '🏢' : view === 'contracts' ? '📜' : '+'; }
}

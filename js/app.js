/* ═══════════════════════════════════════════
   app.js — Main entry point
   ═══════════════════════════════════════════ */

import { genId, parseLocalDeadline } from './utils.js';
import { createTask, createBrand, createContractClause } from './models.js';
import { openDB, loadTasks, saveTask, deleteTask, migrateFromLocalStorage, loadBrands, saveBrand, deleteBrand, loadContracts, saveContract, deleteContract } from './db.js';
import { getApiKey, saveApiKey, parseTasksWithAI, askContractAI } from './ai.js';
import { getRemindInterval, getFeishuWebhookUrl, setFeishuWebhookUrl, setRemindInterval, initNotifications, requestNotificationPermission, startReminderChecker, loadSettings } from './notifications.js';
import { showToast, showProcessing, updateStats, updateFilterBrands, renderTasks, showTaskDetail, renderBrandList, showBrandDetail, renderContractList, renderAIChat, createReminderFile, updateHeaderDate, initTheme, toggleTheme, setUndoCallback } from './ui.js';
import { navigate, onViewChange, initRouter, getCurrentView } from './router.js';
import { SEED_BRANDS } from './seed-data.js';

let tasks = [], brands = [], contracts = [];
let currentTab = 'pending', currentFilter = 'all', searchQuery = '', chatMessages = [], undoTask = null;

window._createReminderFile = (id) => { const t = tasks.find(t => t.id === id); if (t) createReminderFile(t); };

async function toggleTask(id) {
  const t = tasks.find(t => t.id === id); if (!t) return;
  const wasDone = (t.status || t.状态) === '已完成';
  t.status = wasDone ? '未处理' : '已完成';
  if (t.status === '已完成') { t.completedAt = new Date().toISOString(); t.lastReminded = null; }
  else t.completedAt = null;
  await saveTask(t); await refreshAll();
  showToast(t.status === '已完成' ? '✅ 已完成' : '🔄 已恢复');
}

async function deleteWithUndo(id) {
  const t = tasks.find(t => t.id === id); if (!t) return;
  undoTask = t; await deleteTask(id); await refreshAll(); showToast('🗑 已删除', true);
}

async function undoDelete() {
  if (!undoTask) return;
  await saveTask(undoTask); undoTask = null; await refreshAll(); showToast('↩ 已恢复');
}

async function addTaskFromData(taskData) {
  if (!taskData.deadline && taskData.rawMessage) taskData.deadline = parseLocalDeadline(taskData.rawMessage);
  const task = createTask({ id: genId(), ...taskData });
  await saveTask(task);
}

async function processAndAddTasks(text) {
  showProcessing(true, 'AI 正在分析任务...');
  try {
    const tl = await parseTasksWithAI(text);
    if (tl && tl.length > 0) { for (const t of tl) await addTaskFromData(t); showToast('✅ 已添加 ' + tl.length + ' 个任务'); }
    else showToast('⚠️ 未能提取到任务');
  } catch (err) { showToast('❌ ' + err.message); }
  finally { showProcessing(false); }
  await refreshAll();
}

async function askAIAboutContracts(question) {
  if (!contracts.length) { showToast('⚠️ 请先添加合同条款'); return; }
  showProcessing(true, 'AI 正在查询合同条款...');
  try {
    const context = contracts.map(c => { const brand = brands.find(b => b.id === c.brandId); return `【${c.brandName || (brand ? brand.name : '')} - ${c.title}】\n${c.content}`; }).join('\n\n');
    const answer = await askContractAI(question, context);
    chatMessages.push({ role: 'user', content: question }); chatMessages.push({ role: 'ai', content: answer });
    renderAIChat(chatMessages);
  } catch (err) { showToast('❌ ' + err.message); }
  finally { showProcessing(false); }
}

async function refreshAll() {
  tasks = await loadTasks(); brands = await loadBrands(); contracts = await loadContracts();
  updateStats(tasks); updateFilterBrands(tasks, setFilter);
  const view = getCurrentView();
  if (view === 'tasks') renderTasks(tasks, { tab: currentTab, filter: currentFilter, query: searchQuery, onToggle: toggleTask, onDelete: deleteWithUndo, onDetail: showDetail });
  else if (view === 'brands') renderBrandList(brands, showBrandDetailView);
  else if (view === 'contracts') renderContractList(contracts, brands, { onContractClick: showContractDetail });
  const pendingCount = tasks.filter(t => (t.status || t.状态) !== '已完成').length;
  const badge = document.getElementById('navPendingBadge');
  if (badge) { badge.textContent = pendingCount; badge.style.display = pendingCount > 0 ? '' : 'none'; }
}

function setFilter(brand) { currentFilter = brand; refreshAll(); }

function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  refreshAll();
}

function showDetail(id) { const t = tasks.find(t => t.id === id); if (t) showTaskDetail(t, toggleTask); }

function showBrandDetailView(id) {
  const b = brands.find(b => b.id === id);
  if (b) showBrandDetail(b, tasks, contracts, { onClose: () => {} });
}

function showContractDetail(id) {
  const c = contracts.find(c => c.id === id); if (!c) return;
  const sheet = document.getElementById('detailSheet'), overlay = document.getElementById('detailOverlay');
  if (!sheet || !overlay) return;
  const brand = brands.find(b => b.id === c.brandId);
  sheet.innerHTML = `<h2>📜 ${c.title}</h2><div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px;white-space:pre-wrap;line-height:1.6;font-size:14px">${c.content}</div><div class="clause-meta"><span class="tag tag-info">${c.brandName || (brand ? brand.name : '通用')}</span><span class="tag tag-default">${c.category}</span>${c.tags && c.tags.length ? c.tags.map(tg => '<span class="tag tag-warning">' + tg + '</span>').join('') : ''}${c.sourceDoc ? '<span>📄 ' + c.sourceDoc + '</span>' : ''}<span>📅 ${new Date(c.createdAt).toLocaleDateString('zh-CN')}</span></div><div class="modal-actions" style="margin-top:16px"><button class="btn-cancel" id="contractDetailClose">关闭</button><button class="btn-danger" id="contractDetailDelete">🗑 删除</button></div>`;
  document.getElementById('contractDetailClose').onclick = () => overlay.classList.remove('show');
  document.getElementById('contractDetailDelete').onclick = async () => { await deleteContract(id); overlay.classList.remove('show'); await refreshAll(); showToast('🗑 条款已删除'); };
  overlay.classList.add('show');
}

function handleViewChange(view) {
  document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('show'));
  const searchBar = document.getElementById('searchBar'), tabs = document.getElementById('tabs'), filterBar = document.getElementById('filterBar');
  const taskList = document.getElementById('taskList'), brandList = document.getElementById('brandListContainer');
  const contractList = document.getElementById('contractListContainer'), chatContainer = document.getElementById('chatContainer');
  const showTasks = view === 'tasks';
  if (searchBar) searchBar.style.display = showTasks ? '' : 'none';
  if (tabs) tabs.style.display = showTasks ? '' : 'none';
  if (filterBar) filterBar.style.display = showTasks ? '' : 'none';
  if (taskList) taskList.style.display = showTasks ? '' : 'none';
  if (brandList) brandList.style.display = view === 'brands' ? '' : 'none';
  if (contractList) contractList.style.display = view === 'contracts' ? '' : 'none';
  if (chatContainer) chatContainer.style.display = view === 'chat' ? '' : 'none';
  const fab = document.getElementById('fab');
  if (fab) { fab.textContent = view === 'brands' ? '🏢' : view === 'contracts' ? '📜' : '+'; }
  refreshAll();
}

function exportTasks() {
  const data = { tasks, brands, contracts, exportedAt: new Date().toISOString() };
  const json = JSON.stringify(data, null, 2), blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'ccmall-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click(); URL.revokeObjectURL(url);
  showToast('📤 已导出 ' + tasks.length + '条任务 + ' + brands.length + '品牌 + ' + contracts.length + '条款');
}

async function importTasks(file) {
  try {
    const text = await file.text(), imported = JSON.parse(text);
    const impTasks = Array.isArray(imported) ? imported : (imported.tasks || []);
    const impBrands = imported.brands || [], impContracts = imported.contracts || [];
    const eT = new Set(tasks.map(t => t.id)), eB = new Set(brands.map(b => b.id)), eC = new Set(contracts.map(c => c.id));
    let aT = 0, aB = 0, aC = 0;
    for (const t of impTasks) { if (!t.id || eT.has(t.id)) continue; await saveTask(t); eT.add(t.id); aT++; }
    for (const b of impBrands) { if (!b.id || eB.has(b.id)) continue; await saveBrand(b); eB.add(b.id); aB++; }
    for (const ct of impContracts) { if (!ct.id || eC.has(ct.id)) continue; await saveContract(ct); eC.add(ct.id); aC++; }
    await refreshAll(); showToast('📥 导入：任务+' + aT + ' 品牌+' + aB + ' 条款+' + aC);
  } catch (err) { showToast('❌ 格式错误'); }
}

async function importSeedData() {
  showProcessing(true, '正在导入品牌合同数据...');
  try {
    const existingIds = new Set(brands.map(b => b.name));
    let addedBrands = 0, addedClauses = 0;

    for (const seed of SEED_BRANDS) {
      // Add brand if not exists
      if (!existingIds.has(seed.name)) {
        const brand = createBrand({
          id: genId(),
          name: seed.name,
          floor: seed.floor,
          category: seed.category,
          area: seed.area,
          monthlyRent: seed.rentPerSqm ? seed.rentPerSqm * seed.area : 0,
          leaseStart: seed.contractStart || null,
          leaseEnd: seed.contractEnd || null,
          contacts: seed.contactPerson ? [{ name: seed.contactPerson, phone: seed.contactPhone, role: '签约人' }] : [],
          notes: [
            seed.type === '联营' ? `联营合同 ${seed.contractNo} · 扣率${seed.commissionRate}` : `租赁合同 · ¥${seed.rentPerSqm}/㎡/月`,
            seed.salesTarget ? `销售任务 ${seed.salesTarget}万` : '',
            seed.supplierName ? `供应商: ${seed.supplierName}` : '',
            seed.shopNo ? `铺位: ${seed.shopNo}` : '',
            seed.notes && seed.notes !== '0' ? seed.notes : '',
          ].filter(Boolean).join('\n'),
        });
        await saveBrand(brand);
        existingIds.add(seed.name);
        addedBrands++;
      }

      // Extract contract clauses
      if (seed.clauses && seed.clauses.length > 0) {
        for (const clause of seed.clauses) {
          await saveContract(createContractClause({
            id: genId(),
            brandId: '',
            brandName: seed.name,
            title: seed.name + '合同条款',
            content: clause,
            category: seed.type === '联营' ? '租金' : '租金',
            tags: [seed.type, seed.category],
            sourceDoc: seed.contractNo || seed.name + '合同',
          }));
          addedClauses++;
        }
      }

      // Add key contract note as clause if it has meaningful content
      if (seed.notes && seed.notes !== '0' && seed.notes.length > 10 && seed.clauses.length === 0) {
        await saveContract(createContractClause({
          id: genId(),
          brandId: '',
          brandName: seed.name,
          title: seed.name + '合同备注',
          content: seed.notes,
          category: '其他',
          tags: [seed.type],
          sourceDoc: seed.contractNo || seed.name + '合同',
        }));
        addedClauses++;
      }
    }

    await refreshAll();
    showToast('📋 导入品牌×' + addedBrands + ' + 条款×' + addedClauses);
  } catch (err) {
    console.error(err);
    showToast('❌ 导入失败: ' + err.message);
  } finally {
    showProcessing(false);
  }
}

async function checkSharedContent() {
  const params = new URLSearchParams(window.location.search), text = params.get('text');
  if (text) { window.history.replaceState({}, '', window.location.pathname); await processAndAddTasks(decodeURIComponent(text)); }
}

// ─── Event Bindings ─────────────────────────────
function bindEvents() {
  const fab = document.getElementById('fab');
  fab.onclick = () => {
    const view = getCurrentView();
    if (view === 'tasks') { document.getElementById('modalOverlay').classList.add('show'); document.getElementById('taskInput').focus(); }
    else if (view === 'brands') document.getElementById('brandModal').classList.add('show');
    else if (view === 'contracts') document.getElementById('contractModal').classList.add('show');
  };

  document.getElementById('btnCancel').onclick = () => { document.getElementById('modalOverlay').classList.remove('show'); document.getElementById('taskInput').value = ''; };
  document.getElementById('btnSubmit').onclick = async () => { const text = document.getElementById('taskInput').value.trim(); if (!text) return; document.getElementById('modalOverlay').classList.remove('show'); document.getElementById('taskInput').value = ''; await processAndAddTasks(text); };
  document.querySelectorAll('#tabs .tab').forEach(tab => { tab.onclick = () => setTab(tab.dataset.tab); });
  document.querySelectorAll('#filterBar .filter-chip').forEach(chip => { chip.onclick = () => { document.querySelectorAll('#filterBar .filter-chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); setFilter(chip.dataset.filter); }; });

  const searchInput = document.getElementById('searchInput'), searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim(); searchClear.classList.toggle('visible', searchQuery.length > 0); refreshAll(); });
  searchClear.onclick = () => { searchInput.value = ''; searchQuery = ''; searchClear.classList.remove('visible'); refreshAll(); };

  document.getElementById('btnSettings').onclick = () => {
    document.getElementById('apiKeyInput').value = getApiKey();
    document.getElementById('feishuWebhookInput').value = getFeishuWebhookUrl();
    document.getElementById('remindSetting').value = getRemindInterval() || 'off';
    document.getElementById('themeToggleBtn').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️ 亮色' : '🌙 暗色';
    document.getElementById('settingsOverlay').classList.add('show');
  };
  document.getElementById('btnSettingsCancel').onclick = () => document.getElementById('settingsOverlay').classList.remove('show');
  document.getElementById('btnSettingsSave').onclick = () => {
    const key = document.getElementById('apiKeyInput').value.trim(); if (key) saveApiKey(key);
    setFeishuWebhookUrl(document.getElementById('feishuWebhookInput').value.trim());
    const rv = document.getElementById('remindSetting').value, interval = rv === 'off' ? 0 : parseInt(rv);
    setRemindInterval(interval); startReminderChecker(() => tasks);
    document.getElementById('settingsOverlay').classList.remove('show'); showToast('✅ 设置已保存');
  };
  document.getElementById('themeToggleBtn').onclick = () => {
    const next = toggleTheme();
    document.getElementById('themeToggleBtn').textContent = next === 'dark' ? '☀️ 亮色' : '🌙 暗色';
    showToast(next === 'dark' ? '🌙 暗色模式' : '☀️ 亮色模式');
  };

  document.getElementById('btnExport').onclick = exportTasks;
  document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
  document.getElementById('btnSeedData').onclick = () => { document.getElementById('settingsOverlay').classList.remove('show'); importSeedData(); };
  document.getElementById('importFile').onchange = (e) => { if (e.target.files[0]) { importTasks(e.target.files[0]); e.target.value = ''; } document.getElementById('settingsOverlay').classList.remove('show'); };
  document.getElementById('notifyEnable').onclick = async () => { const perm = await requestNotificationPermission(); if (perm === 'granted') showToast('🔔 通知已开启'); };
  document.getElementById('notifyPrompt').addEventListener('click', function(e) { if (e.target === this) this.classList.add('hidden'); });
  document.querySelectorAll('.modal-overlay').forEach(ov => { ov.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); }); });
  document.querySelectorAll('.nav-tab').forEach(tab => { tab.addEventListener('click', () => navigate(tab.dataset.view)); });

  // Brand modal
  document.getElementById('brandModalCancel').onclick = () => document.getElementById('brandModal').classList.remove('show');
  document.getElementById('brandModalSave').onclick = async () => {
    const name = document.getElementById('brandNameInput').value.trim();
    if (!name) { showToast('⚠️ 请输入品牌名称'); return; }
    await saveBrand(createBrand({ id: genId(), name, floor: document.getElementById('brandFloorInput').value.trim(), category: document.getElementById('brandCategoryInput').value.trim(), area: parseInt(document.getElementById('brandAreaInput').value) || 0, monthlyRent: parseInt(document.getElementById('brandRentInput').value) || 0, leaseStart: document.getElementById('brandLeaseStartInput').value || null, leaseEnd: document.getElementById('brandLeaseEndInput').value || null, contacts: [], notes: document.getElementById('brandNotesInput').value.trim() }));
    document.getElementById('brandModal').classList.remove('show'); await refreshAll(); showToast('✅ 品牌已添加');
  };

  // Contract modal
  document.getElementById('contractModalCancel').onclick = () => document.getElementById('contractModal').classList.remove('show');
  document.getElementById('contractModalSave').onclick = async () => {
    const title = document.getElementById('contractTitleInput').value.trim(), content = document.getElementById('contractContentInput').value.trim();
    if (!title || !content) { showToast('⚠️ 请填写标题和内容'); return; }
    const brandName = document.getElementById('contractBrandInput').value.trim(), brand = brands.find(b => b.name === brandName);
    await saveContract(createContractClause({ id: genId(), brandId: brand ? brand.id : '', brandName: brandName || '通用', title, content, category: document.getElementById('contractCategoryInput').value, tags: document.getElementById('contractTagsInput').value.split(',').map(s => s.trim()).filter(Boolean), sourceDoc: document.getElementById('contractSourceInput').value.trim() }));
    document.getElementById('contractModal').classList.remove('show');
    ['contractTitleInput', 'contractContentInput', 'contractBrandInput', 'contractTagsInput', 'contractSourceInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    await refreshAll(); showToast('✅ 条款已添加');
  };

  // Chat
  document.getElementById('chatSendBtn').onclick = async () => { const input = document.getElementById('chatInput'), question = input.value.trim(); if (!question) return; input.value = ''; await askAIAboutContracts(question); };
  document.getElementById('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('chatSendBtn').click(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); document.getElementById('modalOverlay').classList.add('show'); document.getElementById('taskInput').focus(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); document.getElementById('searchInput').focus(); }
  });
}

// ─── Boot ────────────────────────────────────────
setUndoCallback(undoDelete);

async function init() {
  await openDB();
  await migrateFromLocalStorage();
  loadSettings();
  tasks = await loadTasks(); brands = await loadBrands(); contracts = await loadContracts();
  initTheme(); updateHeaderDate(); initRouter(); bindEvents();
  onViewChange(handleViewChange);
  updateStats(tasks); updateFilterBrands(tasks, setFilter);
  renderTasks(tasks, { tab: currentTab, filter: currentFilter, query: searchQuery, onToggle: toggleTask, onDelete: deleteWithUndo, onDetail: showDetail });
  await initNotifications();
  if (getRemindInterval() || getFeishuWebhookUrl()) startReminderChecker(() => tasks);
  await checkSharedContent();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init().catch(err => { console.error('[app] Init failed:', err); showToast('⚠️ 初始化失败，请刷新页面'); });

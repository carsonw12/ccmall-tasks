/* ═══════════════════════════════════════════
   notifications.js — Browser + Feishu reminders
   ═══════════════════════════════════════════ */

import { put } from './db.js';
import { STORES } from './models.js';

const REMIND_SETTING_KEY = 'remind_interval', FEISHU_WEBHOOK_KEY = 'feishu_webhook_url';
let notificationsEnabled = false, remindInterval = 30, feishuWebhookUrl = '', reminderTimer = null;

export function isNotificationsEnabled() { return notificationsEnabled; }
export function getRemindInterval() { return remindInterval; }
export function getFeishuWebhookUrl() { return feishuWebhookUrl; }
export function setFeishuWebhookUrl(url) { feishuWebhookUrl = url; localStorage.setItem(FEISHU_WEBHOOK_KEY, url); }
export function setRemindInterval(minutes) { remindInterval = minutes; localStorage.setItem(REMIND_SETTING_KEY, String(minutes)); }
export function loadSettings() {
  const v = localStorage.getItem(REMIND_SETTING_KEY); remindInterval = v ? parseInt(v) : 30;
  feishuWebhookUrl = localStorage.getItem(FEISHU_WEBHOOK_KEY) || '';
}

export async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { notificationsEnabled = true; hideNotifyPrompt(); return; }
  if (Notification.permission === 'denied') { hideNotifyPrompt(); return; }
  showNotifyPrompt();
}

export async function requestNotificationPermission() {
  const perm = await Notification.requestPermission();
  if (perm === 'granted') notificationsEnabled = true;
  hideNotifyPrompt(); return perm;
}

function showNotifyPrompt() { const el = document.getElementById('notifyPrompt'); if (el) el.classList.remove('hidden'); }
function hideNotifyPrompt() { const el = document.getElementById('notifyPrompt'); if (el) el.classList.add('hidden'); }

function showBrowserNotification(task) {
  if (!notificationsEnabled) return;
  const content = (task.content || task.任务内容 || '').slice(0, 50);
  const brand = task.brandName || task.品牌 || '';
  const deadline = (task.deadline || task.截止时间 || '').replace('T', ' ');
  const body = [brand ? '🏷 ' + brand : '', deadline ? '⏰ ' + deadline : ''].filter(Boolean).join(' · ');
  try {
    new Notification(content, { body, requireInteraction: true,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="28" fill="%23161b2e"/><text x="60" y="72" text-anchor="middle" fill="%23f0b90b" font-size="52" font-family="sans-serif">📋</text></svg>',
      tag: task.id + '_' + Math.floor(Date.now() / 60000) });
  } catch (_) {}
}

async function sendFeishuNotification(task) {
  if (!feishuWebhookUrl) return;
  const content = task.content || task.任务内容 || '';
  const brand = task.brandName || task.品牌 || '通用';
  const category = task.category || task.任务类型 || '';
  const deadline = (task.deadline || task.截止时间 || '').replace('T', ' ');
  try {
    await fetch(feishuWebhookUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'interactive', card: { header: { title: { content: '⏰ 任务到期提醒', tag: 'plain_text' }, template: 'red' }, elements: [{ tag: 'markdown', content: `⏰ **任务提醒**\n> ${content}\n- 品牌：${brand}\n- 类型：${category}\n- 截止：${deadline}` }] } }),
    });
  } catch (_) {}
}

export async function checkReminders(tasks) {
  if ((!notificationsEnabled && !feishuWebhookUrl) || !remindInterval) return;
  const now = new Date();
  for (const t of tasks) {
    const status = t.status || t.状态, deadline = t.deadline || t.截止时间;
    if (status === '已完成' || !deadline) continue;
    const dl = new Date(deadline); if (dl > now) continue;
    const lr = t.lastReminded || t.last_reminded;
    if (lr && (now - new Date(lr)) < remindInterval * 60 * 1000) continue;
    showBrowserNotification(t); sendFeishuNotification(t);
    t.lastReminded = new Date().toISOString();
    try { await put(STORES.TASKS, t); } catch (_) {}
  }
}

export function startReminderChecker(getTasksFn) {
  if (reminderTimer) clearInterval(reminderTimer);
  if (!remindInterval) return;
  reminderTimer = setInterval(async () => { const tasks = getTasksFn(); await checkReminders(tasks); }, 5 * 60 * 1000);
  (async () => { const tasks = getTasksFn(); await checkReminders(tasks); })();
}

export function stopReminderChecker() { if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; } }

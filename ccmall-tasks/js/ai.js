/* ═══════════════════════════════════════════
   ai.js — DeepSeek API integration
   ═══════════════════════════════════════════ */

import { CATEGORIES, SOURCES, PRIORITIES } from './models.js';

const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY_STORAGE = 'deepseek_api_key';

export function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ''; }
export function saveApiKey(key) { localStorage.setItem(API_KEY_STORAGE, key); }

export async function parseTasksWithAI(text) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('请先在设置中配置 DeepSeek API Key');

  const prompt = buildTaskPrompt();
  const resp = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.1, max_tokens: 800,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }] }),
  });

  if (!resp.ok) { const err = await resp.text(); throw new Error('API 错误 (' + resp.status + '): ' + err.slice(0, 100)); }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const jm = content.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!jm) throw new Error('AI 未返回有效数据，请重试');

  const parsed = JSON.parse(jm[0]);
  const taskList = Array.isArray(parsed) ? parsed : [parsed];
  return taskList.map(t => ({
    brandName: t.brandName || t.品牌 || '',
    content: t.content || t.任务内容 || '',
    category: CATEGORIES.includes(t.category || t.任务类型) ? (t.category || t.任务类型) : '其他',
    source: SOURCES.includes(t.source || t.来源) ? (t.source || t.来源) : '员工',
    priority: PRIORITIES.includes(t.priority || t.优先级) ? (t.priority || t.优先级) : '中',
    deadline: t.deadline && t.deadline !== 'null' && t.deadline !== '' ? t.deadline : (t.截止时间 && t.截止时间 !== 'null' ? t.截止时间 : null),
    rawMessage: text,
  }));
}

export async function askContractAI(question, contractContext) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('请先设置 API Key');

  const prompt = `你是商场合同条款助手。你已学习以下合同条款内容：\n\n${contractContext}\n\n请基于以上条款内容回答用户的问题。如果条款中没有相关内容，请诚实说明。用专业但易懂的语言回答。引用具体条款时标注品牌和条款标题。`;

  const resp = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, max_tokens: 1200,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: question }] }),
  });

  if (!resp.ok) { const err = await resp.text(); throw new Error('API 错误 (' + resp.status + '): ' + err.slice(0, 100)); }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || 'AI 未返回回答';
}

function buildTaskPrompt() {
  return `你是任务结构化助手。从用户消息中提取任务。\n\n## 多任务识别\n消息包含多项独立任务时输出 JSON 数组，单项任务输出单个对象。\n\n## 字段\n- brandName：品牌名称字符串，无法识别则用空字符串\n- content：简洁可执行任务描述\n- category：${CATEGORIES.join('/')}\n- source：${SOURCES.join('/')}\n- priority：${PRIORITIES.join('/')}\n- deadline："YYYY-MM-DDTHH:MM" 或 null\n\n## 时间识别\n- "明天12点前"→明天12:00\n- "下午3点"→当天15:00\n- "下周一"→下周一09:00\n- "3号前"→当月3日18:00\n- 无时间有日期→18:00\n\n当前日期：${new Date().toISOString().slice(0,10)}`;
}

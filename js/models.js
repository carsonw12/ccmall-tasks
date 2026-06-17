/* ═══════════════════════════════════════════
   models.js — Data models, schemas & migration
   ═══════════════════════════════════════════ */

export const STORES = { TASKS: 'tasks', BRANDS: 'brands', CONTRACTS: 'contracts' };

const FIELD_MAP = {
  '品牌': 'brandName', '任务内容': 'content', '原始消息': 'rawMessage',
  '任务类型': 'category', '来源': 'source', '优先级': 'priority',
  '截止时间': 'deadline', '状态': 'status', '创建时间': 'createdAt',
  '完成时间': 'completedAt', 'last_reminded': 'lastReminded',
};

export function migrateTask(old) {
  const t = { id: old.id || '' };
  for (const [cn, en] of Object.entries(FIELD_MAP)) {
    if (old[cn] !== undefined) t[en] = old[cn];
  }
  t.content = t.content || ''; t.brandName = t.brandName || '';
  t.category = t.category || '其他'; t.source = t.source || '员工';
  t.priority = t.priority || '中'; t.status = t.status || '未处理';
  t.deadline = t.deadline || null; t.rawMessage = t.rawMessage || '';
  t.tags = t.tags || []; t.notes = t.notes || '';
  t.assignedTo = t.assignedTo || null; t.isRecurring = t.isRecurring || false;
  t.recurringRule = t.recurringRule || null;
  t.createdAt = t.createdAt || new Date().toISOString();
  t.completedAt = t.completedAt || null; t.lastReminded = t.lastReminded || null;
  return t;
}

export function isLegacyTask(task) {
  return task && ('任务内容' in task || '品牌' in task);
}

export function createTask(data = {}) {
  return {
    id: data.id || '', brandName: data.brandName || '', content: data.content || '',
    rawMessage: data.rawMessage || '', category: data.category || '其他',
    source: data.source || '员工', priority: data.priority || '中',
    deadline: data.deadline || null, status: data.status || '未处理',
    tags: data.tags || [], notes: data.notes || '',
    assignedTo: data.assignedTo || null, isRecurring: data.isRecurring || false,
    recurringRule: data.recurringRule || null,
    createdAt: data.createdAt || new Date().toISOString(),
    completedAt: data.completedAt || null, lastReminded: data.lastReminded || null,
  };
}

export function createBrand(data = {}) {
  return {
    id: data.id || '', name: data.name || '', floor: data.floor || '',
    area: data.area || 0, category: data.category || '',
    contacts: data.contacts || [], leaseStart: data.leaseStart || null,
    leaseEnd: data.leaseEnd || null, monthlyRent: data.monthlyRent || 0,
    notes: data.notes || '', createdAt: data.createdAt || new Date().toISOString(),
  };
}

export function createContractClause(data = {}) {
  return {
    id: data.id || '', brandId: data.brandId || '', brandName: data.brandName || '',
    title: data.title || '', content: data.content || '',
    category: data.category || '其他', tags: data.tags || [],
    sourceDoc: data.sourceDoc || '', createdAt: data.createdAt || new Date().toISOString(),
  };
}

export const CATEGORIES = ['销售', '合同', '财务', '沟通', '其他'];
export const SOURCES = ['员工', '自己', '领导'];
export const PRIORITIES = ['高', '中', '低'];
export const CONTRACT_CATEGORIES = ['租金', '违约金', '续约', '撤场', '装修', '分成', '其他'];
export const TYPE_ICONS = { '销售': '💰', '合同': '📄', '财务': '💵', '沟通': '💬', '其他': '📌' };

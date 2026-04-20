// ============================================
// Proposal Planning — shared day-of coordination
// ============================================

const PROPOSAL_PASSWORD = 'MARLYDOESNTKNOW';
const AUTH_STORAGE_KEY = 'proposalAuthed';

const PERSON_COLORS = [
    '#D4AF37', '#B8962E', '#2E7D5C', '#2563EB', '#C53030',
    '#7C3AED', '#D97706', '#0891B2', '#BE185D', '#525252'
];

// ── State ────────────────────────────────────────────
let allBudgetItems = [];
let allTasks = [];
let allPeople = [];
let allTeams = [];
let allTimelineEvents = [];
let allVendors = [];
let allNotes = [];

let taskView = 'kanban';
let timelineView = 'swimlane';
let currentCalDate = new Date();

let taskFilterState = { team: '', assignee: '', priority: '', category: '', search: '' };
let editingAssignees = [];
let editingTimelinePeople = [];
let editingTeamHelpers = [];
let editingPersonColor = PERSON_COLORS[0];

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const wait = setInterval(() => {
        if (window.firebaseAuth) {
            clearInterval(wait);
            initAuth();
        }
    }, 100);
});

function initAuth() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');

    const showApp = async () => {
        loginSection.style.display = 'none';
        appSection.style.display = 'block';
        try {
            if (!window.firebaseAuth.currentUser) {
                await window.firebaseSignInAnon(window.firebaseAuth);
            }
        } catch (err) {
            console.warn('Anonymous sign-in failed — continuing without Firebase auth', err);
        }
        loadAllData();
    };

    const showLogin = () => {
        loginSection.style.display = 'flex';
        appSection.style.display = 'none';
    };

    if (localStorage.getItem(AUTH_STORAGE_KEY) === 'true') {
        showApp();
    } else {
        showLogin();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('loginPassword').value;
        loginError.textContent = '';
        if (password === PROPOSAL_PASSWORD) {
            localStorage.setItem(AUTH_STORAGE_KEY, 'true');
            document.getElementById('loginPassword').value = '';
            showApp();
        } else {
            loginError.textContent = 'Incorrect password';
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        showLogin();
    });

    initNavigation();
    initBudgetHandlers();
    initTaskHandlers();
    initPersonHandlers();
    initTeamHandlers();
    initTimelineHandlers();
    initVendorHandlers();
    initNoteHandlers();
    initModalClosers();
}

function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.dataset.tab + 'Tab';
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if (tab.dataset.tab === 'dashboard') renderDashboard();
            if (tab.dataset.tab === 'timeline') renderTimeline();
        });
    });
}

function initModalClosers() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => modal.classList.remove('open'));
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
    });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Data loading ─────────────────────────────────────
async function loadAllData() {
    await Promise.all([
        loadCollection('proposal_expenses', (d) => allBudgetItems = d),
        loadCollection('proposal_tasks', (d) => allTasks = d),
        loadCollection('proposal_people', (d) => allPeople = d),
        loadCollection('proposal_teams', (d) => allTeams = d),
        loadCollection('proposal_timeline', (d) => allTimelineEvents = d),
        loadCollection('proposal_vendors', (d) => allVendors = d),
        loadCollection('proposal_notes', (d) => allNotes = d),
    ]);
    renderDashboard();
    renderBudget();
    renderTasks();
    renderTeams();
    renderPeople();
    renderTimeline();
    renderVendors();
    renderNotes();
    populateFilterDropdowns();
}

async function loadCollection(name, setter) {
    try {
        const snap = await window.firebaseGetDocs(window.firebaseCollection(window.firebaseDb, name));
        const list = [];
        snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        setter(list);
    } catch (err) {
        console.error('Error loading', name, err);
        setter([]);
    }
}

async function saveDoc(name, id, data) {
    if (id) {
        await window.firebaseUpdateDoc(window.firebaseDoc(window.firebaseDb, name, id), data);
        return id;
    }
    const ref = await window.firebaseAddDoc(window.firebaseCollection(window.firebaseDb, name), {
        ...data,
        createdAt: window.firebaseServerTimestamp()
    });
    return ref.id;
}

async function deleteDocById(name, id) {
    await window.firebaseDeleteDoc(window.firebaseDoc(window.firebaseDb, name, id));
}

// ── Helpers ──────────────────────────────────────────
function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
}

function formatMoney(n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function daysBetween(a, b) {
    const ms = b.getTime() - a.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function initialsOf(name) {
    return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function getPersonById(id) { return allPeople.find(p => p.id === id); }
function getVendorById(id) { return allVendors.find(v => v.id === id); }
function getTaskById(id) { return allTasks.find(t => t.id === id); }
function getTeamById(id) { return allTeams.find(t => t.id === id); }

function getTeamMemberIds(team) {
    if (!team) return [];
    const ids = [];
    if (team.leaderId) ids.push(team.leaderId);
    (team.helperIds || []).forEach(id => { if (!ids.includes(id)) ids.push(id); });
    return ids;
}

function getPersonTeams(personId) {
    return allTeams.filter(t => t.leaderId === personId || (t.helperIds || []).includes(personId));
}

// ── Dashboard ────────────────────────────────────────
function renderDashboard() {
    const planned = allBudgetItems.reduce((s, b) => s + (Number(b.planned) || 0), 0);
    const actual = allBudgetItems.reduce((s, b) => s + (Number(b.actual) || 0), 0);
    document.getElementById('dashBudgetUsed').textContent = formatMoney(actual);
    document.getElementById('dashBudgetTotal').textContent = `of ${formatMoney(planned)} planned`;
    const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
    document.getElementById('dashBudgetBar').style.width = pct + '%';

    const done = allTasks.filter(t => t.status === 'done').length;
    const total = allTasks.length;
    document.getElementById('dashTasksDone').textContent = `${done} / ${total}`;
    const tpct = total > 0 ? (done / total) * 100 : 0;
    document.getElementById('dashTasksBar').style.width = tpct + '%';
    document.getElementById('dashTasksPct').textContent = Math.round(tpct) + '% complete';

    document.getElementById('dashTeamCount').textContent = allPeople.length;

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdue = allTasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length;
    document.getElementById('dashOverdue').textContent = overdue;

    const booked = allVendors.filter(v => v.status === 'booked').length;
    document.getElementById('dashVendors').textContent = booked;
    const cats = new Set(allVendors.map(v => v.category).filter(Boolean));
    document.getElementById('dashVendorCategories').textContent = `${cats.size} categories`;

    const upcomingList = document.getElementById('upcomingTasksList');
    const upcoming = allTasks
        .filter(t => t.status !== 'done' && t.dueDate)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);

    if (upcoming.length === 0) {
        upcomingList.innerHTML = '<p class="empty-state">No upcoming tasks</p>';
    } else {
        upcomingList.innerHTML = upcoming.map(t => {
            const due = new Date(t.dueDate);
            const daysLeft = daysBetween(now, due);
            let cls = '';
            let label = daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : daysLeft + ' days';
            if (daysLeft < 0) { cls = 'overdue'; label = Math.abs(daysLeft) + 'd overdue'; }
            else if (daysLeft <= 3) cls = 'soon';
            const team = getTeamById(t.teamId);
            return `
                <div class="upcoming-item ${cls}">
                    <div style="flex:1">
                        <div class="upcoming-title">${escapeHtml(t.title)}</div>
                        <div class="upcoming-meta">${team ? escapeHtml(team.name) + ' · ' : ''}${escapeHtml(t.category || '—')}</div>
                    </div>
                    <div class="upcoming-meta">${label}</div>
                </div>
            `;
        }).join('');
    }

    const activity = [...allTasks, ...allBudgetItems, ...allNotes]
        .filter(x => x.createdAt)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5);
    const actEl = document.getElementById('recentActivityList');
    if (activity.length === 0) {
        actEl.innerHTML = '<p class="empty-state">No recent activity</p>';
    } else {
        actEl.innerHTML = activity.map(x => {
            const type = x.title ? 'Task' : x.planned !== undefined ? 'Expense' : 'Note';
            const name = x.title || x.name || '(untitled)';
            return `
                <div class="upcoming-item">
                    <div style="flex:1">
                        <div class="upcoming-title">${escapeHtml(name)}</div>
                        <div class="upcoming-meta">${type}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const catMap = {};
    allBudgetItems.forEach(b => {
        const c = b.category || 'Uncategorized';
        if (!catMap[c]) catMap[c] = { planned: 0, actual: 0 };
        catMap[c].planned += Number(b.planned) || 0;
        catMap[c].actual += Number(b.actual) || 0;
    });
    const brkEl = document.getElementById('dashBudgetBreakdown');
    const cats2 = Object.entries(catMap);
    if (cats2.length === 0) {
        brkEl.innerHTML = '<p class="empty-state">Add expenses to see breakdown</p>';
    } else {
        brkEl.innerHTML = cats2.map(([name, v]) => {
            const p = v.planned > 0 ? Math.min(100, (v.actual / v.planned) * 100) : 0;
            const over = v.actual > v.planned;
            return `
                <div class="category-row">
                    <div class="category-row-label">${escapeHtml(name)}</div>
                    <div class="category-row-bar">
                        <div class="category-row-fill ${over ? 'over' : ''}" style="width:${p}%"></div>
                    </div>
                    <div class="category-row-amount">${formatMoney(v.actual)} / ${formatMoney(v.planned)}</div>
                </div>
            `;
        }).join('');
    }
}

// ── Expenses (Budget) ────────────────────────────────
function initBudgetHandlers() {
    document.getElementById('addBudgetItemBtn').addEventListener('click', () => openBudgetModal());
    document.getElementById('saveBudgetBtn').addEventListener('click', saveBudgetItem);
    document.getElementById('deleteBudgetBtn').addEventListener('click', deleteBudgetItem);
}

function openBudgetModal(item) {
    const isEdit = !!item;
    document.getElementById('budgetModalTitle').textContent = isEdit ? 'Edit Expense' : 'Add Expense';
    document.getElementById('budgetItemId').value = item?.id || '';
    document.getElementById('budgetItemName').value = item?.name || '';
    document.getElementById('budgetItemCategory').value = item?.category || '';
    document.getElementById('budgetItemPlanned').value = item?.planned || '';
    document.getElementById('budgetItemActual').value = item?.actual || '';
    document.getElementById('budgetItemStatus').value = item?.status || 'planned';
    document.getElementById('budgetItemNotes').value = item?.notes || '';

    const vendorSel = document.getElementById('budgetItemVendor');
    vendorSel.innerHTML = '<option value="">— None —</option>' +
        allVendors.map(v => `<option value="${v.id}" ${item?.vendorId === v.id ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('');

    const paidBySel = document.getElementById('budgetItemPaidBy');
    const hint = document.getElementById('budgetItemPaidByHint');
    if (allPeople.length === 0) {
        paidBySel.innerHTML = '<option value="">— Add team members first —</option>';
        paidBySel.disabled = true;
        hint.textContent = 'Go to the Teams tab and add people before recording expenses.';
    } else {
        paidBySel.disabled = false;
        hint.textContent = '';
        paidBySel.innerHTML = '<option value="">— Select team member —</option>' +
            allPeople
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(p => {
                    const teams = getPersonTeams(p.id).map(t => t.name).join(', ');
                    const label = teams ? `${p.name} (${teams})` : p.name;
                    return `<option value="${p.id}" ${item?.paidBy === p.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                }).join('');
    }

    const cats = new Set(allBudgetItems.map(b => b.category).filter(Boolean));
    document.getElementById('budgetCategoriesDatalist').innerHTML =
        [...cats].map(c => `<option value="${escapeHtml(c)}">`).join('');

    document.getElementById('deleteBudgetBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('budgetModal');
}

async function saveBudgetItem() {
    const id = document.getElementById('budgetItemId').value;
    const data = {
        name: document.getElementById('budgetItemName').value.trim(),
        category: document.getElementById('budgetItemCategory').value.trim() || 'Uncategorized',
        planned: parseFloat(document.getElementById('budgetItemPlanned').value) || 0,
        actual: parseFloat(document.getElementById('budgetItemActual').value) || 0,
        status: document.getElementById('budgetItemStatus').value,
        vendorId: document.getElementById('budgetItemVendor').value || null,
        paidBy: document.getElementById('budgetItemPaidBy').value || '',
        notes: document.getElementById('budgetItemNotes').value.trim() || null
    };
    if (!data.name) { alert('Please enter an expense name'); return; }
    if (!data.paidBy) { alert('Please select who paid (team member)'); return; }

    try {
        await saveDoc('proposal_expenses', id, data);
        closeModal('budgetModal');
        await loadCollection('proposal_expenses', (d) => allBudgetItems = d);
        renderBudget();
        renderDashboard();
    } catch (err) {
        alert('Error saving: ' + err.message);
    }
}

async function deleteBudgetItem() {
    const id = document.getElementById('budgetItemId').value;
    if (!id || !confirm('Delete this expense?')) return;
    await deleteDocById('proposal_expenses', id);
    closeModal('budgetModal');
    await loadCollection('proposal_expenses', (d) => allBudgetItems = d);
    renderBudget();
    renderDashboard();
}

function renderBudget() {
    const planned = allBudgetItems.reduce((s, b) => s + (Number(b.planned) || 0), 0);
    const actual = allBudgetItems.reduce((s, b) => s + (Number(b.actual) || 0), 0);
    const paid = allBudgetItems
        .filter(b => b.status === 'paid')
        .reduce((s, b) => s + (Number(b.actual) || Number(b.planned) || 0), 0);
    const outstanding = actual - paid;

    document.getElementById('budgetTotalPlanned').textContent = formatMoney(planned);
    document.getElementById('budgetTotalActual').textContent = formatMoney(actual);
    document.getElementById('budgetTotalPaid').textContent = formatMoney(paid);
    document.getElementById('budgetTotalOutstanding').textContent = formatMoney(Math.max(0, outstanding));

    const pct = planned > 0 ? (actual / planned) * 100 : 0;
    const over = actual > planned;
    document.getElementById('budgetProgressText').textContent = Math.round(pct) + (over ? '% (over budget)' : '%');
    const fill = document.getElementById('budgetProgressFill');
    fill.style.width = Math.min(100, pct) + '%';
    fill.classList.toggle('over', over);

    const groups = {};
    allBudgetItems.forEach(b => {
        const c = b.category || 'Uncategorized';
        if (!groups[c]) groups[c] = [];
        groups[c].push(b);
    });

    const list = document.getElementById('budgetCategoriesList');
    if (allBudgetItems.length === 0) {
        list.innerHTML = '<p class="empty-state">No expenses yet. Click "+ Add Expense" to start.</p>';
        return;
    }

    list.innerHTML = Object.entries(groups).map(([cat, items]) => {
        const catPlanned = items.reduce((s, i) => s + (Number(i.planned) || 0), 0);
        const catActual = items.reduce((s, i) => s + (Number(i.actual) || 0), 0);
        return `
            <div class="budget-category">
                <div class="budget-category-header">
                    <span class="budget-category-title">${escapeHtml(cat)}</span>
                    <span class="budget-category-total">${formatMoney(catActual)} / ${formatMoney(catPlanned)}</span>
                </div>
                <div class="budget-items-list">
                    ${items.map(item => {
                        const vendor = getVendorById(item.vendorId);
                        const payer = getPersonById(item.paidBy);
                        return `
                            <div class="budget-item" data-id="${item.id}">
                                <div class="budget-item-name">
                                    ${escapeHtml(item.name)}
                                    ${vendor ? `<small>${escapeHtml(vendor.name)}</small>` : ''}
                                    ${payer ? `<small>Paid by: ${escapeHtml(payer.name)}</small>` : ''}
                                </div>
                                <div class="budget-item-amount">${formatMoney(item.planned)}</div>
                                <div class="budget-item-amount actual">${formatMoney(item.actual)}</div>
                                <div><span class="badge badge-${item.status || 'planned'}">${(item.status || 'planned').replace('_', ' ')}</span></div>
                                <div class="budget-item-amount">${escapeHtml(item.notes || '')}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.budget-item').forEach(el => {
        el.addEventListener('click', () => {
            const item = allBudgetItems.find(b => b.id === el.dataset.id);
            if (item) openBudgetModal(item);
        });
    });
}

// ── Tasks ────────────────────────────────────────────
function initTaskHandlers() {
    document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
    document.getElementById('deleteTaskBtn').addEventListener('click', deleteTask);

    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            taskView = btn.dataset.view;
            document.getElementById('tasksKanbanView').style.display = taskView === 'kanban' ? 'grid' : 'none';
            document.getElementById('tasksListView').style.display = taskView === 'list' ? 'block' : 'none';
            document.getElementById('tasksCalendarView').style.display = taskView === 'calendar' ? 'block' : 'none';
            renderTasks();
        });
    });

    ['taskFilterTeam', 'taskFilterAssignee', 'taskFilterPriority', 'taskFilterCategory'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const key = id.replace('taskFilter', '').toLowerCase();
            taskFilterState[key] = e.target.value;
            renderTasks();
        });
    });
    document.getElementById('taskSearch').addEventListener('input', (e) => {
        taskFilterState.search = e.target.value.toLowerCase();
        renderTasks();
    });

    document.getElementById('calPrevBtn').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderTasks();
    });
    document.getElementById('calNextBtn').addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderTasks();
    });
}

function populateFilterDropdowns() {
    const teamSel = document.getElementById('taskFilterTeam');
    teamSel.innerHTML = '<option value="">All Teams</option>' +
        allTeams.map(t => `<option value="${t.id}" ${taskFilterState.team === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

    const assigneeSel = document.getElementById('taskFilterAssignee');
    assigneeSel.innerHTML = '<option value="">All Assignees</option>' +
        allPeople.map(p => `<option value="${p.id}" ${taskFilterState.assignee === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');

    const cats = new Set(allTasks.map(t => t.category).filter(Boolean));
    const catSel = document.getElementById('taskFilterCategory');
    catSel.innerHTML = '<option value="">All Categories</option>' +
        [...cats].map(c => `<option value="${escapeHtml(c)}" ${taskFilterState.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

    document.getElementById('taskCategoriesDatalist').innerHTML =
        [...cats].map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function filteredTasks() {
    return allTasks.filter(t => {
        if (taskFilterState.team && t.teamId !== taskFilterState.team) return false;
        if (taskFilterState.assignee && !(t.assignees || []).includes(taskFilterState.assignee)) return false;
        if (taskFilterState.priority && t.priority !== taskFilterState.priority) return false;
        if (taskFilterState.category && t.category !== taskFilterState.category) return false;
        if (taskFilterState.search) {
            const s = taskFilterState.search;
            if (!(t.title || '').toLowerCase().includes(s) &&
                !(t.description || '').toLowerCase().includes(s)) return false;
        }
        return true;
    });
}

function renderTasks() {
    populateFilterDropdowns();
    if (taskView === 'kanban') renderKanban();
    else if (taskView === 'list') renderTaskList();
    else renderTaskCalendar();
}

function renderKanban() {
    const tasks = filteredTasks();
    const statuses = ['todo', 'doing', 'review', 'done'];

    statuses.forEach(status => {
        const list = document.querySelector(`.kanban-list[data-status="${status}"]`);
        const items = tasks.filter(t => (t.status || 'todo') === status);
        document.getElementById('kanbanCount' + status.charAt(0).toUpperCase() + status.slice(1)).textContent = items.length;

        list.innerHTML = items.map(taskCardHtml).join('') ||
            '<div class="empty-state" style="padding:1rem;font-size:.8rem">Drop tasks here</div>';

        list.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                const task = getTaskById(card.dataset.id);
                if (task) openTaskModal(task);
            });
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
        });
    });

    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', (e) => {
            e.preventDefault();
            col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async (e) => {
            e.preventDefault();
            col.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = col.dataset.status;
            const task = getTaskById(taskId);
            if (task && task.status !== newStatus) {
                task.status = newStatus;
                await window.firebaseUpdateDoc(
                    window.firebaseDoc(window.firebaseDb, 'proposal_tasks', taskId),
                    { status: newStatus }
                );
                renderTasks();
                renderDashboard();
            }
        });
    });
}

function taskCardHtml(t) {
    const assignees = (t.assignees || []).map(id => {
        const p = getPersonById(id);
        if (!p) return '';
        return `<span class="assignee-avatar" title="${escapeHtml(p.name)}" style="background:${p.color}">${initialsOf(p.name)}</span>`;
    }).join('');

    const now = new Date(); now.setHours(0, 0, 0, 0);
    let dueHtml = '';
    if (t.dueDate) {
        const due = new Date(t.dueDate);
        const days = daysBetween(now, due);
        let cls = '';
        let label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (t.status !== 'done') {
            if (days < 0) cls = 'overdue';
            else if (days <= 3) cls = 'soon';
        }
        dueHtml = `<span class="task-due ${cls}">${label}</span>`;
    }

    const team = getTeamById(t.teamId);
    const teamHtml = team ? `<span class="task-team-tag">${escapeHtml(team.name)}</span>` : '';

    return `
        <div class="task-card priority-${t.priority || 'medium'}" data-id="${t.id}" draggable="true">
            <div class="task-card-title">${escapeHtml(t.title)}</div>
            ${t.description ? `<div class="task-card-desc">${escapeHtml(t.description.slice(0, 80))}${t.description.length > 80 ? '…' : ''}</div>` : ''}
            <div class="task-card-meta">
                <div class="task-card-assignees">${assignees}</div>
                <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">${teamHtml}${dueHtml}</div>
            </div>
        </div>
    `;
}

function renderTaskList() {
    const tasks = filteredTasks();
    const tbody = document.getElementById('tasksListBody');
    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No tasks</td></tr>';
        return;
    }
    tbody.innerHTML = tasks.map(t => {
        const assignees = (t.assignees || []).map(id => {
            const p = getPersonById(id);
            return p ? `<span class="assignee-avatar" style="background:${p.color}">${initialsOf(p.name)}</span>` : '';
        }).join('');
        const team = getTeamById(t.teamId);
        return `
            <tr data-id="${t.id}" style="cursor:pointer">
                <td><strong>${escapeHtml(t.title)}</strong>${team ? `<br><small style="color:#9A9A9A">${escapeHtml(team.name)}</small>` : ''}</td>
                <td><div class="task-card-assignees">${assignees}</div></td>
                <td>${escapeHtml(t.category || '—')}</td>
                <td><span class="badge badge-${t.priority || 'medium'}">${t.priority || 'medium'}</span></td>
                <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                <td>${t.status || 'todo'}</td>
                <td><button class="btn btn-secondary btn-sm">Edit</button></td>
            </tr>
        `;
    }).join('');
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', () => {
            const task = getTaskById(tr.dataset.id);
            if (task) openTaskModal(task);
        });
    });
}

function renderTaskCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    document.getElementById('calMonthLabel').textContent =
        currentCalDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const grid = document.getElementById('calendarGrid');
    let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        .map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    const today = new Date();
    const tasks = filteredTasks().filter(t => t.dueDate);

    for (let i = startDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-num">${daysInPrev - i}</div></div>`;
    }

    const MAX_TASKS_VISIBLE = 3;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const iso = dateObj.toISOString().split('T')[0];
        const dayTasks = tasks.filter(t => t.dueDate === iso);
        const isToday = dateObj.toDateString() === today.toDateString();
        const visibleTasks = dayTasks.slice(0, MAX_TASKS_VISIBLE);
        const hiddenCount = dayTasks.length - visibleTasks.length;
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-num">${d}</div>
                <div class="calendar-day-tasks">
                    ${visibleTasks.map(t => `<div class="calendar-task" data-id="${t.id}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`).join('')}
                    ${hiddenCount > 0 ? `<div class="calendar-task-more">+${hiddenCount} more</div>` : ''}
                </div>
            </div>
        `;
    }

    const totalCells = startDay + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-num">${d}</div></div>`;
    }

    grid.innerHTML = html;
    grid.querySelectorAll('.calendar-task').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const t = getTaskById(el.dataset.id);
            if (t) openTaskModal(t);
        });
    });
}

function openTaskModal(task, prefill) {
    const isEdit = !!task;
    document.getElementById('taskModalTitle').textContent = isEdit ? 'Edit Task' : 'Add Task';
    document.getElementById('taskId').value = task?.id || '';
    document.getElementById('taskTitle').value = task?.title || '';
    document.getElementById('taskDescription').value = task?.description || '';
    document.getElementById('taskCategory').value = task?.category || '';
    document.getElementById('taskPriority').value = task?.priority || 'medium';
    document.getElementById('taskDueDate').value = task?.dueDate || '';
    document.getElementById('taskStatus').value = task?.status || 'todo';

    const teamSel = document.getElementById('taskTeam');
    const currentTeamId = task?.teamId || prefill?.teamId || '';
    teamSel.innerHTML = '<option value="">— No team —</option>' +
        allTeams.map(t => `<option value="${t.id}" ${currentTeamId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

    editingAssignees = task?.assignees ? [...task.assignees] : [];
    renderAssigneesChips('taskAssigneesList', editingAssignees, (arr) => editingAssignees = arr);

    const depSel = document.getElementById('taskDependencies');
    depSel.innerHTML = allTasks
        .filter(t => t.id !== task?.id)
        .map(t => `<option value="${t.id}" ${(task?.dependencies || []).includes(t.id) ? 'selected' : ''}>${escapeHtml(t.title)}</option>`)
        .join('');

    const cats = new Set(allTasks.map(t => t.category).filter(Boolean));
    document.getElementById('taskCategoriesDatalist').innerHTML =
        [...cats].map(c => `<option value="${escapeHtml(c)}">`).join('');

    document.getElementById('deleteTaskBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('taskModal');
}

function renderAssigneesChips(containerId, selected, onChange) {
    const container = document.getElementById(containerId);
    if (allPeople.length === 0) {
        container.innerHTML = '<small style="color:#9A9A9A">No people yet. Add people first.</small>';
        return;
    }
    container.innerHTML = allPeople.map(p => {
        const isSel = selected.includes(p.id);
        return `
            <span class="assignee-chip ${isSel ? 'selected' : ''}" data-id="${p.id}" style="${isSel ? 'background:' + p.color + ';border-color:' + p.color : ''}">
                <span class="chip-dot" style="background:${isSel ? 'white' : p.color}"></span>
                ${escapeHtml(p.name)}
            </span>
        `;
    }).join('');
    container.querySelectorAll('.assignee-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const id = chip.dataset.id;
            const idx = selected.indexOf(id);
            if (idx >= 0) selected.splice(idx, 1);
            else selected.push(id);
            onChange(selected);
            renderAssigneesChips(containerId, selected, onChange);
        });
    });
}

async function saveTask() {
    const id = document.getElementById('taskId').value;
    const dependencies = [...document.getElementById('taskDependencies').selectedOptions].map(o => o.value);
    const data = {
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDescription').value.trim() || null,
        category: document.getElementById('taskCategory').value.trim() || null,
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value || null,
        status: document.getElementById('taskStatus').value,
        teamId: document.getElementById('taskTeam').value || null,
        assignees: [...editingAssignees],
        dependencies: dependencies
    };
    if (!data.title) { alert('Please enter a title'); return; }

    try {
        await saveDoc('proposal_tasks', id, data);
        closeModal('taskModal');
        await loadCollection('proposal_tasks', (d) => allTasks = d);
        renderTasks();
        renderTeams();
        renderDashboard();
    } catch (err) {
        alert('Error saving: ' + err.message);
    }
}

async function deleteTask() {
    const id = document.getElementById('taskId').value;
    if (!id || !confirm('Delete this task?')) return;
    await deleteDocById('proposal_tasks', id);
    closeModal('taskModal');
    await loadCollection('proposal_tasks', (d) => allTasks = d);
    renderTasks();
    renderTeams();
    renderDashboard();
}

// ── People ───────────────────────────────────────────
function initPersonHandlers() {
    document.getElementById('addPersonBtn').addEventListener('click', () => openPersonModal());
    document.getElementById('savePersonBtn').addEventListener('click', savePerson);
    document.getElementById('deletePersonBtn').addEventListener('click', deletePerson);
}

function openPersonModal(person) {
    const isEdit = !!person;
    document.getElementById('personModalTitle').textContent = isEdit ? 'Edit Person' : 'Add Person';
    document.getElementById('personId').value = person?.id || '';
    document.getElementById('personName').value = person?.name || '';
    document.getElementById('personRole').value = person?.role || '';
    document.getElementById('personPhone').value = person?.phone || '';
    document.getElementById('personEmail').value = person?.email || '';
    document.getElementById('personNotes').value = person?.notes || '';

    editingPersonColor = person?.color || PERSON_COLORS[allPeople.length % PERSON_COLORS.length];
    renderColorPicker();

    document.getElementById('deletePersonBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('personModal');
}

function renderColorPicker() {
    const picker = document.getElementById('personColorPicker');
    const isCustom = !PERSON_COLORS.includes(editingPersonColor);

    const swatchesHtml = PERSON_COLORS.map(c => `
        <div class="color-swatch ${c === editingPersonColor ? 'selected' : ''}" data-color="${c}" style="background:${c}"></div>
    `).join('');

    const customStyle = isCustom ? `background:${escapeHtml(editingPersonColor)}` : '';
    const customHtml = `
        <label class="color-swatch color-swatch-custom ${isCustom ? 'selected' : ''}" title="Pick a custom color" style="${customStyle}">
            <input type="color" id="personCustomColor" value="${escapeHtml(editingPersonColor)}">
        </label>
    `;

    picker.innerHTML = swatchesHtml + customHtml;

    picker.querySelectorAll('.color-swatch[data-color]').forEach(sw => {
        sw.addEventListener('click', () => {
            editingPersonColor = sw.dataset.color;
            renderColorPicker();
        });
    });

    const customInput = document.getElementById('personCustomColor');
    if (customInput) {
        // Live preview on the custom swatch without rebuilding the DOM
        // (rebuilding would close the OS color picker mid-interaction)
        customInput.addEventListener('input', (e) => {
            const swatch = customInput.closest('.color-swatch-custom');
            if (swatch) swatch.style.background = e.target.value;
        });
        // Commit + re-render only after the picker is dismissed
        customInput.addEventListener('change', (e) => {
            editingPersonColor = e.target.value;
            renderColorPicker();
        });
    }
}

async function savePerson() {
    const id = document.getElementById('personId').value;
    const data = {
        name: document.getElementById('personName').value.trim(),
        role: document.getElementById('personRole').value.trim() || null,
        phone: document.getElementById('personPhone').value.trim() || null,
        email: document.getElementById('personEmail').value.trim() || null,
        color: editingPersonColor,
        notes: document.getElementById('personNotes').value.trim() || null
    };
    if (!data.name) { alert('Please enter a name'); return; }

    await saveDoc('proposal_people', id, data);
    closeModal('personModal');
    await loadCollection('proposal_people', (d) => allPeople = d);
    renderPeople();
    renderTeams();
    renderDashboard();
    renderTimeline();
    renderTasks();
}

async function deletePerson() {
    const id = document.getElementById('personId').value;
    if (!id || !confirm('Delete this person? They will be removed from teams, tasks, and timeline events.')) return;
    await deleteDocById('proposal_people', id);
    closeModal('personModal');
    await loadCollection('proposal_people', (d) => allPeople = d);
    renderPeople();
    renderTeams();
    renderDashboard();
    renderTimeline();
}

function renderPeople() {
    const grid = document.getElementById('teamGrid');
    if (allPeople.length === 0) {
        grid.innerHTML = '<p class="empty-state">No people yet. Add people to assign them to teams and tasks.</p>';
        return;
    }
    grid.innerHTML = allPeople.map(p => {
        const taskCount = allTasks.filter(t => (t.assignees || []).includes(p.id)).length;
        const doneCount = allTasks.filter(t => (t.assignees || []).includes(p.id) && t.status === 'done').length;
        const teams = getPersonTeams(p.id);
        const teamLabels = teams.map(t => {
            const isLeader = t.leaderId === p.id;
            return `<span class="team-chip ${isLeader ? 'leader' : ''}">${escapeHtml(t.name)}${isLeader ? ' · Leader' : ''}</span>`;
        }).join('');
        return `
            <div class="person-card" data-id="${p.id}" style="border-top-color:${p.color}">
                <div class="person-avatar-lg" style="background:${p.color}">${initialsOf(p.name)}</div>
                <div class="person-name">${escapeHtml(p.name)}</div>
                <div class="person-role">${escapeHtml(p.role || 'Team member')}</div>
                ${teamLabels ? `<div class="person-teams">${teamLabels}</div>` : ''}
                <div class="person-stats">
                    <div><span class="person-stat-num">${doneCount}/${taskCount}</span> tasks</div>
                </div>
                ${(p.phone || p.email) ? `
                    <div class="person-contact">
                        ${p.phone ? `<span>📞 ${escapeHtml(p.phone)}</span>` : ''}
                        ${p.email ? `<span>✉ ${escapeHtml(p.email)}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    grid.querySelectorAll('.person-card').forEach(card => {
        card.addEventListener('click', () => {
            const p = getPersonById(card.dataset.id);
            if (p) openPersonModal(p);
        });
    });
}

// ── Teams ────────────────────────────────────────────
function initTeamHandlers() {
    document.getElementById('addTeamBtn').addEventListener('click', () => openTeamModal());
    document.getElementById('saveTeamBtn').addEventListener('click', saveTeam);
    document.getElementById('deleteTeamBtn').addEventListener('click', deleteTeam);
}

function openTeamModal(team) {
    const isEdit = !!team;
    document.getElementById('teamModalTitle').textContent = isEdit ? 'Edit Team' : 'Add Team';
    document.getElementById('teamId').value = team?.id || '';
    document.getElementById('teamName').value = team?.name || '';
    document.getElementById('teamNotes').value = team?.notes || '';

    const leaderSel = document.getElementById('teamLeader');
    const hint = document.getElementById('teamLeaderHint');
    if (allPeople.length === 0) {
        leaderSel.innerHTML = '<option value="">— Add people first —</option>';
        leaderSel.disabled = true;
        hint.textContent = 'Click "+ Add Person" to add team members before creating a team.';
    } else {
        leaderSel.disabled = false;
        hint.textContent = '';
        leaderSel.innerHTML = '<option value="">— Select leader —</option>' +
            allPeople
                .slice()
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                .map(p => `<option value="${p.id}" ${team?.leaderId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
    }

    editingTeamHelpers = team?.helperIds ? [...team.helperIds] : [];
    renderAssigneesChips('teamHelpersList', editingTeamHelpers, (arr) => editingTeamHelpers = arr);

    document.getElementById('deleteTeamBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('teamModal');
}

async function saveTeam() {
    const id = document.getElementById('teamId').value;
    const leaderId = document.getElementById('teamLeader').value;
    const helperIds = editingTeamHelpers.filter(hid => hid !== leaderId);
    const data = {
        name: document.getElementById('teamName').value.trim(),
        leaderId: leaderId,
        helperIds: helperIds,
        notes: document.getElementById('teamNotes').value.trim() || null
    };
    if (!data.name) { alert('Please enter a team name'); return; }
    if (!data.leaderId) { alert('Please select a leader'); return; }

    await saveDoc('proposal_teams', id, data);
    closeModal('teamModal');
    await loadCollection('proposal_teams', (d) => allTeams = d);
    renderTeams();
    renderPeople();
    renderTasks();
}

async function deleteTeam() {
    const id = document.getElementById('teamId').value;
    if (!id || !confirm('Delete this team? Tasks assigned to this team will keep their task-level assignees but lose the team link.')) return;
    await deleteDocById('proposal_teams', id);
    closeModal('teamModal');
    await loadCollection('proposal_teams', (d) => allTeams = d);
    renderTeams();
    renderPeople();
    renderTasks();
}

function renderTeams() {
    const el = document.getElementById('teamsList');
    if (allTeams.length === 0) {
        el.innerHTML = '<p class="empty-state">No teams yet. Add a team — each team has a leader and helpers, with their own set of tasks.</p>';
        return;
    }
    el.innerHTML = allTeams.map(team => {
        const leader = getPersonById(team.leaderId);
        const helpers = (team.helperIds || []).map(getPersonById).filter(Boolean);
        const teamTasks = allTasks.filter(t => t.teamId === team.id);
        const doneCount = teamTasks.filter(t => t.status === 'done').length;
        const openCount = teamTasks.length - doneCount;

        const helpersHtml = helpers.length > 0 ? helpers.map(h => `
            <div class="team-helper" data-person-id="${h.id}">
                <span class="assignee-avatar" style="background:${h.color}">${initialsOf(h.name)}</span>
                <div>
                    <div class="team-helper-name">${escapeHtml(h.name)}</div>
                    ${h.role ? `<div class="team-helper-role">${escapeHtml(h.role)}</div>` : ''}
                </div>
            </div>
        `).join('') : '<p class="empty-state" style="padding:.5rem 0;font-size:.8rem">No helpers yet</p>';

        return `
            <div class="team-card" data-id="${team.id}">
                <div class="team-card-header">
                    <div>
                        <h3 class="team-card-name">${escapeHtml(team.name)}</h3>
                        <div class="team-card-stats">
                            <span>${teamTasks.length} task${teamTasks.length === 1 ? '' : 's'}</span>
                            <span>${doneCount} done</span>
                            <span>${openCount} open</span>
                        </div>
                    </div>
                    <div class="team-card-actions">
                        <button class="btn btn-ghost btn-sm team-view-tasks" data-team-id="${team.id}">View tasks</button>
                        <button class="btn btn-ghost btn-sm team-add-task" data-team-id="${team.id}">+ Add task</button>
                        <button class="btn btn-secondary btn-sm team-edit" data-team-id="${team.id}">Edit</button>
                    </div>
                </div>
                ${leader ? `
                    <div class="team-leader" data-person-id="${leader.id}">
                        <span class="assignee-avatar lg" style="background:${leader.color}">${initialsOf(leader.name)}</span>
                        <div>
                            <div class="team-leader-label">Leader</div>
                            <div class="team-leader-name">${escapeHtml(leader.name)}</div>
                            ${leader.role ? `<div class="team-helper-role">${escapeHtml(leader.role)}</div>` : ''}
                        </div>
                    </div>
                ` : '<p class="empty-state" style="padding:.5rem 0">No leader assigned</p>'}
                <div class="team-helpers-wrap">
                    <div class="team-helpers-label">Helpers</div>
                    <div class="team-helpers-grid">${helpersHtml}</div>
                </div>
                ${team.notes ? `<div class="team-notes">${escapeHtml(team.notes)}</div>` : ''}
            </div>
        `;
    }).join('');

    el.querySelectorAll('.team-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const team = getTeamById(btn.dataset.teamId);
            if (team) openTeamModal(team);
        });
    });
    el.querySelectorAll('.team-view-tasks').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            taskFilterState.team = btn.dataset.teamId;
            document.querySelector('.nav-tab[data-tab="tasks"]').click();
            renderTasks();
        });
    });
    el.querySelectorAll('.team-add-task').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTaskModal(null, { teamId: btn.dataset.teamId });
        });
    });
    el.querySelectorAll('.team-leader, .team-helper').forEach(el2 => {
        el2.addEventListener('click', (e) => {
            e.stopPropagation();
            const p = getPersonById(el2.dataset.personId);
            if (p) openPersonModal(p);
        });
    });
}

// ── Timeline ─────────────────────────────────────────
function initTimelineHandlers() {
    document.getElementById('addTimelineEventBtn').addEventListener('click', () => openTimelineModal());
    document.getElementById('saveTimelineBtn').addEventListener('click', saveTimelineEvent);
    document.getElementById('deleteTimelineBtn').addEventListener('click', deleteTimelineEvent);

    document.querySelectorAll('[data-timeline-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-timeline-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            timelineView = btn.dataset.timelineView;
            document.getElementById('timelineSwimlaneView').style.display = timelineView === 'swimlane' ? 'block' : 'none';
            document.getElementById('timelineAgendaView').style.display = timelineView === 'agenda' ? 'block' : 'none';
            renderTimeline();
        });
    });

    document.getElementById('timelineZoom').addEventListener('input', renderTimeline);
    document.getElementById('showConnections').addEventListener('change', renderTimeline);
    document.getElementById('highlightOverlaps').addEventListener('change', renderTimeline);
}

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function minutesToLabel(m) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

function renderTimeline() {
    if (timelineView === 'agenda') return renderTimelineAgenda();
    renderTimelineSwimlane();
}

function renderTimelineSwimlane() {
    if (allPeople.length === 0) {
        document.getElementById('timelineSwimlanes').innerHTML =
            '<p class="empty-state">Add people to the Teams tab, then add timeline events here.</p>';
        document.getElementById('timelineHours').innerHTML = '';
        return;
    }

    let startMin = 8 * 60;
    let endMin = 24 * 60;
    allTimelineEvents.forEach(e => {
        const s = timeToMinutes(e.start);
        const en = timeToMinutes(e.end);
        if (s < startMin) startMin = Math.floor(s / 60) * 60;
        if (en > endMin) endMin = Math.ceil(en / 60) * 60;
    });
    const totalMin = endMin - startMin;
    const hours = totalMin / 60;

    const hourWidth = parseInt(document.getElementById('timelineZoom').value);
    const totalWidth = hours * hourWidth;
    const LABEL_WIDTH = 180;
    const innerWidth = LABEL_WIDTH + totalWidth;

    document.documentElement.style.setProperty('--hour-width', hourWidth + 'px');

    const innerEl = document.querySelector('.timeline-swimlane-inner');
    if (innerEl) innerEl.style.width = innerWidth + 'px';

    let hoursHtml = `<div style="width:${LABEL_WIDTH}px;flex-shrink:0"></div>`;
    for (let h = 0; h < hours; h++) {
        const m = startMin + h * 60;
        hoursHtml += `<div class="timeline-hour" style="width:${hourWidth}px;flex-shrink:0">${minutesToLabel(m)}</div>`;
    }
    hoursHtml += `<div class="timeline-hour" style="width:0;flex-shrink:0;padding:0;position:relative"><span style="position:absolute;right:4px;top:50%;transform:translate(50%,-50%);white-space:nowrap">${minutesToLabel(endMin % 1440)}</span></div>`;
    const hoursEl = document.getElementById('timelineHours');
    hoursEl.innerHTML = hoursHtml;
    hoursEl.style.width = innerWidth + 'px';
    hoursEl.style.paddingLeft = '0';

    const eventsByPerson = {};
    allPeople.forEach(p => eventsByPerson[p.id] = []);
    allTimelineEvents.forEach(e => {
        (e.people || []).forEach(pid => {
            if (eventsByPerson[pid]) eventsByPerson[pid].push(e);
        });
    });

    const highlightOverlaps = document.getElementById('highlightOverlaps').checked;
    const overlappingIds = new Set();
    if (highlightOverlaps) {
        Object.values(eventsByPerson).forEach(list => {
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i], b = list[j];
                    const as = timeToMinutes(a.start), ae = timeToMinutes(a.end);
                    const bs = timeToMinutes(b.start), be = timeToMinutes(b.end);
                    if (as < be && bs < ae) {
                        overlappingIds.add(a.id);
                        overlappingIds.add(b.id);
                    }
                }
            }
        });
    }

    const swimlanesEl = document.getElementById('timelineSwimlanes');
    swimlanesEl.style.width = innerWidth + 'px';
    swimlanesEl.innerHTML = allPeople.map(p => {
        const events = eventsByPerson[p.id] || [];
        const eventsHtml = events.map(e => {
            const es = timeToMinutes(e.start);
            const ee = timeToMinutes(e.end);
            const left = ((es - startMin) / 60) * hourWidth;
            const naturalWidth = ((ee - es) / 60) * hourWidth;
            const width = Math.max(60, naturalWidth);
            const isOverlap = overlappingIds.has(e.id);
            const tooltip = `${escapeHtml(e.title)}\n${minutesToLabel(es)} – ${minutesToLabel(ee)}${e.location ? '\n' + escapeHtml(e.location) : ''}`;
            return `
                <div class="timeline-event ${isOverlap ? 'overlap-highlight' : ''}" data-id="${e.id}" style="left:${left}px;width:${width}px;background:${p.color}" title="${tooltip}">
                    <div class="timeline-event-title">${escapeHtml(e.title)}</div>
                    <div class="timeline-event-time">${minutesToLabel(es)} – ${minutesToLabel(ee)}${e.location ? ' · ' + escapeHtml(e.location) : ''}</div>
                </div>
            `;
        }).join('');
        return `
            <div class="swimlane" data-person="${p.id}" style="width:${innerWidth}px">
                <div class="swimlane-label" style="width:${LABEL_WIDTH}px;flex-shrink:0">
                    <div class="swimlane-avatar" style="background:${p.color}">${initialsOf(p.name)}</div>
                    <div>
                        <div class="swimlane-name">${escapeHtml(p.name)}</div>
                        <div class="swimlane-role">${escapeHtml(p.role || '')}</div>
                    </div>
                </div>
                <div class="swimlane-track" style="width:${totalWidth}px;flex-shrink:0">${eventsHtml}</div>
            </div>
        `;
    }).join('');

    swimlanesEl.querySelectorAll('.timeline-event').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const ev = allTimelineEvents.find(x => x.id === el.dataset.id);
            if (ev) openTimelineModal(ev);
        });
    });

    swimlanesEl.querySelectorAll('.swimlane-track').forEach(track => {
        track.addEventListener('click', (e) => {
            if (e.target !== track) return;
            const rect = track.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const minFromStart = (x / hourWidth) * 60;
            const clicked = startMin + Math.round(minFromStart / 15) * 15;
            const personId = track.closest('.swimlane').dataset.person;
            openTimelineModal(null, { personId, startMin: clicked });
        });
    });

    if (document.getElementById('showConnections').checked) {
        drawTimelineConnections(swimlanesEl, startMin, hourWidth);
    }
}

function drawTimelineConnections(container, startMin, hourWidth) {
    container.querySelectorAll('.timeline-connection-line').forEach(l => l.remove());

    allTimelineEvents.forEach(e => {
        if (!e.connectedTo) return;
        const from = allTimelineEvents.find(x => x.id === e.connectedTo);
        if (!from) return;

        const fromEl = container.querySelector(`.timeline-event[data-id="${from.id}"]`);
        const toEl = container.querySelector(`.timeline-event[data-id="${e.id}"]`);
        if (!fromEl || !toEl) return;

        const cRect = container.getBoundingClientRect();
        const fRect = fromEl.getBoundingClientRect();
        const tRect = toEl.getBoundingClientRect();

        const x1 = fRect.right - cRect.left;
        const y1 = fRect.top - cRect.top + fRect.height / 2;
        const x2 = tRect.left - cRect.left;
        const y2 = tRect.top - cRect.top + tRect.height / 2;

        const line = document.createElement('div');
        line.className = 'timeline-connection-line';
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        line.style.left = x1 + 'px';
        line.style.top = y1 + 'px';
        line.style.width = length + 'px';
        line.style.transform = `rotate(${angle}deg)`;
        line.style.transformOrigin = '0 0';
        container.appendChild(line);
    });
}

function renderTimelineAgenda() {
    const el = document.getElementById('timelineAgendaView');
    if (allTimelineEvents.length === 0) {
        el.innerHTML = '<p class="empty-state">No events yet</p>';
        return;
    }
    const sorted = [...allTimelineEvents].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    el.innerHTML = sorted.map(e => {
        const people = (e.people || []).map(id => {
            const p = getPersonById(id);
            return p ? `<span class="assignee-avatar" title="${escapeHtml(p.name)}" style="background:${p.color}">${initialsOf(p.name)}</span>` : '';
        }).join('');
        return `
            <div class="agenda-event" data-id="${e.id}">
                <div class="agenda-time">${minutesToLabel(timeToMinutes(e.start))}<br><small style="font-size:.7rem;color:#9A9A9A">${minutesToLabel(timeToMinutes(e.end))}</small></div>
                <div>
                    <div class="agenda-title">${escapeHtml(e.title)}</div>
                    ${e.location ? `<div class="agenda-location">📍 ${escapeHtml(e.location)}</div>` : ''}
                </div>
                <div class="agenda-people">${people}</div>
            </div>
        `;
    }).join('');
    el.querySelectorAll('.agenda-event').forEach(row => {
        row.addEventListener('click', () => {
            const ev = allTimelineEvents.find(x => x.id === row.dataset.id);
            if (ev) openTimelineModal(ev);
        });
    });
}

function openTimelineModal(ev, prefill) {
    const isEdit = !!ev;
    document.getElementById('timelineModalTitle').textContent = isEdit ? 'Edit Timeline Event' : 'Add Timeline Event';
    document.getElementById('timelineEventId').value = ev?.id || '';
    document.getElementById('timelineEventTitle').value = ev?.title || '';
    document.getElementById('timelineStart').value = ev?.start || (prefill ? minutesToHHMM(prefill.startMin) : '');
    document.getElementById('timelineEnd').value = ev?.end || (prefill ? minutesToHHMM(prefill.startMin + 30) : '');
    document.getElementById('timelineLocation').value = ev?.location || '';
    document.getElementById('timelineNotes').value = ev?.notes || '';

    editingTimelinePeople = ev?.people ? [...ev.people] : (prefill?.personId ? [prefill.personId] : []);
    renderAssigneesChips('timelinePeopleList', editingTimelinePeople, (arr) => editingTimelinePeople = arr);

    const connSel = document.getElementById('timelineConnectedTo');
    connSel.innerHTML = '<option value="">— None —</option>' +
        allTimelineEvents.filter(e => e.id !== ev?.id).map(e =>
            `<option value="${e.id}" ${ev?.connectedTo === e.id ? 'selected' : ''}>${escapeHtml(e.title)} (${e.start})</option>`
        ).join('');

    document.getElementById('deleteTimelineBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('timelineModal');
}

function minutesToHHMM(m) {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

async function saveTimelineEvent() {
    const id = document.getElementById('timelineEventId').value;
    const data = {
        title: document.getElementById('timelineEventTitle').value.trim(),
        start: document.getElementById('timelineStart').value,
        end: document.getElementById('timelineEnd').value,
        location: document.getElementById('timelineLocation').value.trim() || null,
        people: [...editingTimelinePeople],
        connectedTo: document.getElementById('timelineConnectedTo').value || null,
        notes: document.getElementById('timelineNotes').value.trim() || null
    };
    if (!data.title || !data.start || !data.end) { alert('Please fill title, start, and end'); return; }

    await saveDoc('proposal_timeline', id, data);
    closeModal('timelineModal');
    await loadCollection('proposal_timeline', (d) => allTimelineEvents = d);
    renderTimeline();
}

async function deleteTimelineEvent() {
    const id = document.getElementById('timelineEventId').value;
    if (!id || !confirm('Delete this timeline event?')) return;
    await deleteDocById('proposal_timeline', id);
    closeModal('timelineModal');
    await loadCollection('proposal_timeline', (d) => allTimelineEvents = d);
    renderTimeline();
}

// ── Vendors ──────────────────────────────────────────
function initVendorHandlers() {
    document.getElementById('addVendorBtn').addEventListener('click', () => openVendorModal());
    document.getElementById('saveVendorBtn').addEventListener('click', saveVendor);
    document.getElementById('deleteVendorBtn').addEventListener('click', deleteVendor);
}

function openVendorModal(vendor) {
    const isEdit = !!vendor;
    document.getElementById('vendorModalTitle').textContent = isEdit ? 'Edit Vendor' : 'Add Vendor';
    document.getElementById('vendorId').value = vendor?.id || '';
    document.getElementById('vendorName').value = vendor?.name || '';
    document.getElementById('vendorCategory').value = vendor?.category || '';
    document.getElementById('vendorPhone').value = vendor?.phone || '';
    document.getElementById('vendorEmail').value = vendor?.email || '';
    document.getElementById('vendorWebsite').value = vendor?.website || '';
    document.getElementById('vendorContact').value = vendor?.contact || '';
    document.getElementById('vendorStatus').value = vendor?.status || 'researching';
    document.getElementById('vendorNotes').value = vendor?.notes || '';
    document.getElementById('deleteVendorBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('vendorModal');
}

async function saveVendor() {
    const id = document.getElementById('vendorId').value;
    const data = {
        name: document.getElementById('vendorName').value.trim(),
        category: document.getElementById('vendorCategory').value.trim() || null,
        phone: document.getElementById('vendorPhone').value.trim() || null,
        email: document.getElementById('vendorEmail').value.trim() || null,
        website: document.getElementById('vendorWebsite').value.trim() || null,
        contact: document.getElementById('vendorContact').value.trim() || null,
        status: document.getElementById('vendorStatus').value,
        notes: document.getElementById('vendorNotes').value.trim() || null
    };
    if (!data.name) { alert('Please enter a name'); return; }

    await saveDoc('proposal_vendors', id, data);
    closeModal('vendorModal');
    await loadCollection('proposal_vendors', (d) => allVendors = d);
    renderVendors();
    renderDashboard();
}

async function deleteVendor() {
    const id = document.getElementById('vendorId').value;
    if (!id || !confirm('Delete this vendor?')) return;
    await deleteDocById('proposal_vendors', id);
    closeModal('vendorModal');
    await loadCollection('proposal_vendors', (d) => allVendors = d);
    renderVendors();
    renderDashboard();
}

function renderVendors() {
    const el = document.getElementById('vendorsList');
    if (allVendors.length === 0) {
        el.innerHTML = '<p class="empty-state">No vendors yet</p>';
        return;
    }
    el.innerHTML = allVendors.map(v => `
        <div class="vendor-card" data-id="${v.id}">
            <div class="vendor-header">
                <div>
                    <div class="vendor-name">${escapeHtml(v.name)}</div>
                    <div class="vendor-category">${escapeHtml(v.category || 'General')}</div>
                </div>
                <span class="vendor-status ${v.status || 'researching'}">${v.status || 'researching'}</span>
            </div>
            ${(v.phone || v.email || v.website || v.contact) ? `
                <div class="vendor-details">
                    ${v.contact ? `<div>👤 ${escapeHtml(v.contact)}</div>` : ''}
                    ${v.phone ? `<div>📞 ${escapeHtml(v.phone)}</div>` : ''}
                    ${v.email ? `<div>✉ ${escapeHtml(v.email)}</div>` : ''}
                    ${v.website ? `<div>🔗 <a href="${escapeHtml(v.website)}" target="_blank" rel="noopener">Website</a></div>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');
    el.querySelectorAll('.vendor-card').forEach(card => {
        card.addEventListener('click', () => {
            const v = getVendorById(card.dataset.id);
            if (v) openVendorModal(v);
        });
    });
}

// ── Notes ────────────────────────────────────────────
function initNoteHandlers() {
    document.getElementById('addNoteBtn').addEventListener('click', () => openNoteModal());
    document.getElementById('saveNoteBtn').addEventListener('click', saveNote);
    document.getElementById('deleteNoteBtn').addEventListener('click', deleteNote);
}

function openNoteModal(note) {
    const isEdit = !!note;
    document.getElementById('noteModalTitle').textContent = isEdit ? 'Edit Note' : 'Add Note';
    document.getElementById('noteId').value = note?.id || '';
    document.getElementById('noteTitle').value = note?.title || '';
    document.getElementById('noteContent').value = note?.content || '';
    document.getElementById('noteColor').value = note?.color || 'yellow';
    document.getElementById('notePinned').checked = !!note?.pinned;
    document.getElementById('deleteNoteBtn').style.display = isEdit ? 'inline-flex' : 'none';
    openModal('noteModal');
}

async function saveNote() {
    const id = document.getElementById('noteId').value;
    const data = {
        title: document.getElementById('noteTitle').value.trim() || null,
        content: document.getElementById('noteContent').value.trim() || null,
        color: document.getElementById('noteColor').value,
        pinned: document.getElementById('notePinned').checked
    };
    if (!data.title && !data.content) { alert('Please enter a title or content'); return; }

    await saveDoc('proposal_notes', id, data);
    closeModal('noteModal');
    await loadCollection('proposal_notes', (d) => allNotes = d);
    renderNotes();
    renderDashboard();
}

async function deleteNote() {
    const id = document.getElementById('noteId').value;
    if (!id || !confirm('Delete this note?')) return;
    await deleteDocById('proposal_notes', id);
    closeModal('noteModal');
    await loadCollection('proposal_notes', (d) => allNotes = d);
    renderNotes();
    renderDashboard();
}

function renderNotes() {
    const el = document.getElementById('notesBoard');
    if (allNotes.length === 0) {
        el.innerHTML = '<p class="empty-state">No notes yet. Jot down ideas, inspirations, or reminders.</p>';
        return;
    }
    const sorted = [...allNotes].sort((a, b) => {
        if (!!b.pinned - !!a.pinned !== 0) return !!b.pinned - !!a.pinned;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
    el.innerHTML = sorted.map(n => {
        const date = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : '';
        return `
            <div class="note-card color-${n.color || 'yellow'} ${n.pinned ? 'pinned' : ''}" data-id="${n.id}">
                ${n.title ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ''}
                <div class="note-content">${escapeHtml(n.content || '')}</div>
                ${date ? `<div class="note-date">${date}</div>` : ''}
            </div>
        `;
    }).join('');
    el.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => {
            const n = allNotes.find(x => x.id === card.dataset.id);
            if (n) openNoteModal(n);
        });
    });
}

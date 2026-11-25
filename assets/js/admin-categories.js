// File: plataforma cursos SyM/assets/js/admin-categories.js

import { onSessionChange, showToast, formatDate, getInitials } from './app.js';
import { initAdminSidebar, refreshPendingBadge } from './admin-utils.js';
import { getCategories, getPendingCategories, getAllCategories, approveCategory, rejectCategory, createCategory, updateCategory, deleteCategory } from './db.js';
import { getUserData } from './db.js';

const state = { all: [], pending: [], approved: [], editTarget: null, rejectTarget: null, deleteTarget: null };
const userNameCache = new Map();

// Helper: resolve UID → displayName (con cache)
async function getCreatedByName(createdBy) {
  if (!createdBy) return '—';
  // Si ya parece un nombre (no es UID de 28 chars alfanumérico), devolverlo
  if (!/^[A-Za-z0-9]{20,}$/.test(createdBy)) return createdBy;
  if (userNameCache.has(createdBy)) return userNameCache.get(createdBy);
  try {
    const userData = await getUserData(createdBy);
    const name = userData?.displayName || createdBy;
    userNameCache.set(createdBy, name);
    return name;
  } catch {
    return createdBy;
  }
}

// ─── Tabs ───────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.style.color = b === btn ? 'var(--accent)' : 'var(--text-muted)';
        b.style.borderBottom = b === btn ? '2px solid var(--accent)' : '2px solid transparent';
        b.setAttribute('aria-selected', b === btn);
      });
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('hidden', c.id !== `tab-${btn.dataset.tab}`);
        c.setAttribute('aria-hidden', c.id === `tab-${btn.dataset.tab}`);
      });
      if (btn.dataset.tab === 'approved') loadApproved();
      if (btn.dataset.tab === 'all') loadAll();
    });
  });
}

// ─── Tab: Todas (CRUD completo) ─────────────────────────────────
let allSearchTimer = null;

async function loadAll() {
  const categories = await getAllCategories();
  state.all = categories;

  document.getElementById('all-loading').classList.add('hidden');

  if (!categories.length) {
    document.getElementById('all-empty').classList.remove('hidden');
    return;
  }

  document.getElementById('all-empty').classList.add('hidden');
  renderAllList(categories);
  bindSearchAll();
}

function renderAllList(categories) {
  const list = document.getElementById('all-list');
  list.classList.remove('hidden');

  list.innerHTML = categories.map(cat => `
    <div class="card" style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;" id="category-all-${cat.id}">
      <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:200px;">
        <div style="width:36px;height:36px;border-radius:var(--radius-md);background:var(--accent-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10H7V7zm2 2h6v6H9V9z"/></svg>
        </div>
        <div>
          <h3 style="font-size:.9375rem;margin-bottom:.125rem;">${cat.name}</h3>
          <p style="font-size:.75rem;color:var(--text-muted);">
            ${cat.status === 'approved'
              ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Aprobada`
              : cat.status === 'pending'
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Pendiente`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> Rechazada`}
            · ${formatDate(cat.createdAt)}
            ${cat.createdBy ? ` · Por: <span class="creator-name" data-uid="${cat.createdBy}">${/^[A-Za-z0-9]{20,}$/.test(cat.createdBy) ? 'Cargando...' : cat.createdBy}</span>` : ''}
          </p>
        </div>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        ${cat.status !== 'approved' ? `
          <button class="btn btn-success btn-sm btn-approve-all" data-id="${cat.id}" data-name="${cat.name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Aprobar</button>
          <button class="btn btn-error btn-sm btn-reject-all" data-id="${cat.id}" data-name="${cat.name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Rechazar</button>
        ` : ''}
        <button class="btn btn-ghost btn-sm btn-edit" data-id="${cat.id}" data-name="${cat.name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Editar</button>
        <button class="btn btn-ghost btn-sm btn-delete" data-id="${cat.id}" data-name="${cat.name}" style="color:var(--error);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Eliminar</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.creator-name[data-uid]').forEach(async el => {
    const uid = el.dataset.uid;
    el.textContent = await getCreatedByName(uid);
  });

  list.querySelectorAll('.btn-approve-all').forEach(btn => {
    btn.addEventListener('click', () => handleApproveCategory(btn.dataset.id, btn.dataset.name));
  });
  list.querySelectorAll('.btn-reject-all').forEach(btn => {
    btn.addEventListener('click', () => openRejectCategoryModal(btn.dataset.id, btn.dataset.name));
  });
  list.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.id, btn.dataset.name));
  });
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteCategoryModal(btn.dataset.id, btn.dataset.name));
  });
}

function bindSearchAll() {
  const input = document.getElementById('search-categories');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(allSearchTimer);
    allSearchTimer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      const filtered = state.all.filter(cat =>
        cat.name.toLowerCase().includes(q) ||
        (cat.createdBy && cat.createdBy.toLowerCase().includes(q))
      );
      renderAllList(filtered);
      if (!filtered.length && q) {
        document.getElementById('all-empty').classList.remove('hidden');
        document.getElementById('all-empty').querySelector('p').textContent = `Sin resultados para "${input.value}"`;
      }
    }, 200);
  });
}

// ─── Tab: Pendientes ────────────────────────────────────────────
async function loadPending() {
  const categories = await getPendingCategories();
  state.pending = categories;

  document.getElementById('pending-loading').classList.add('hidden');

  if (!categories.length) {
    document.getElementById('pending-empty').classList.remove('hidden');
    return;
  }

  const list = document.getElementById('pending-list');
  list.classList.remove('hidden');

  list.innerHTML = categories.map(cat => `
    <div class="card" style="padding:1.25rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;" id="category-pending-${cat.id}">
      <div style="display:flex;align-items:center;gap:1rem;flex:1;min-width:200px;">
        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--warning-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--warning);">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        </div>
        <div>
          <h3 style="font-size:1rem;margin-bottom:.25rem;">${cat.name}</h3>
          <p style="font-size:.8125rem;color:var(--text-muted);">Propuesta por: <span class="creator-name" data-uid="${cat.createdBy}">${/^[A-Za-z0-9]{20,}$/.test(cat.createdBy) ? 'Cargando...' : cat.createdBy}</span> · ${formatDate(cat.createdAt)}</p>
        </div>
      </div>
      <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
        <button class="btn btn-success btn-sm btn-approve-category" data-id="${cat.id}" data-name="${cat.name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Aprobar</button>
        <button class="btn btn-error btn-sm btn-reject-category" data-id="${cat.id}" data-name="${cat.name}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Rechazar</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.creator-name[data-uid]').forEach(async el => {
    const uid = el.dataset.uid;
    el.textContent = await getCreatedByName(uid);
  });

  list.querySelectorAll('.btn-approve-category').forEach(btn => {
    btn.addEventListener('click', () => handleApproveCategory(btn.dataset.id, btn.dataset.name));
  });
  list.querySelectorAll('.btn-reject-category').forEach(btn => {
    btn.addEventListener('click', () => openRejectCategoryModal(btn.dataset.id, btn.dataset.name));
  });
}

// ─── Tab: Aprobadas (historial) ─────────────────────────────────
async function loadApproved() {
  const categories = await getCategories('approved');
  state.approved = categories;

  document.getElementById('approved-loading').classList.add('hidden');

  if (!categories.length) {
    document.getElementById('approved-empty').classList.remove('hidden');
    return;
  }

  const list = document.getElementById('approved-list');
  list.classList.remove('hidden');

  list.innerHTML = categories.map(cat => `
    <div class="card" style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;" id="category-approved-${cat.id}">
      <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:200px;">
        <div style="width:36px;height:36px;border-radius:var(--radius-md);background:var(--success-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--success);">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <div>
          <h3 style="font-size:.9375rem;margin-bottom:.125rem;">${cat.name}</h3>
          <p style="font-size:.75rem;color:var(--text-muted);">Aprobada · ${formatDate(cat.createdAt)}</p>
        </div>
      </div>
      <span style="font-size:.7rem;font-weight:600;color:var(--success);background:var(--success-dim);padding:.2rem .5rem;border-radius:999px;">Activa</span>
    </div>`).join('');
}

// ─── Modal Nueva/Editar Categoría ───────────────────────────────
function bindCategoryModal() {
  // Abrir modal nueva
  document.getElementById('btn-new-category').addEventListener('click', () => {
    state.editTarget = null;
    document.getElementById('modal-category-title').textContent = 'Nueva categoría';
    document.getElementById('modal-category-id').value = '';
    document.getElementById('modal-category-name').value = '';
    document.getElementById('modal-category').classList.remove('hidden');
  });

  // Cancelar
  document.getElementById('btn-cancel-category').addEventListener('click', () => {
    document.getElementById('modal-category').classList.add('hidden');
  });

  // Guardar (crear o editar)
  document.getElementById('btn-save-category').addEventListener('click', async () => {
    const name = document.getElementById('modal-category-name').value.trim();
    if (!name) { showToast('Escribí un nombre.', 'warning'); return; }

    const categoryId = document.getElementById('modal-category-id').value;

    try {
      if (categoryId) {
        // Editar
        await updateCategory(categoryId, name);
        showToast(`Categoría "${name}" actualizada.`, 'success');
      } else {
        // Crear nueva (como admin = aprobada directo)
        await createCategory(name, 'admin');
        showToast(`Categoría "${name}" creada y aprobada.`, 'success');
      }

      document.getElementById('modal-category').classList.add('hidden');
      await loadAll();
      await loadPending();
      await loadApproved();
      await refreshPendingBadge();
    } catch (err) {
      console.error(err);
      showToast('Error guardando categoría.', 'error');
    }
  });
}

// ─── Editar categoría ───────────────────────────────────────────
function openEditCategoryModal(categoryId, name) {
  state.editTarget = categoryId;
  document.getElementById('modal-category-title').textContent = 'Editar categoría';
  document.getElementById('modal-category-id').value = categoryId;
  document.getElementById('modal-category-name').value = name;
  document.getElementById('modal-category').classList.remove('hidden');
}

// ─── Eliminar categoría ─────────────────────────────────────────
function openDeleteCategoryModal(categoryId, name) {
  state.deleteTarget = categoryId;
  document.getElementById('delete-category-name').textContent = name;
  document.getElementById('modal-delete-category').classList.remove('hidden');
}

function bindDeleteCategoryModal() {
  document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    document.getElementById('modal-delete-category').classList.add('hidden');
  });

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    const categoryId = state.deleteTarget;
    try {
      await deleteCategory(categoryId);
      document.getElementById(`category-all-${categoryId}`)?.remove();
      state.all = state.all.filter(c => c.id !== categoryId);
      if (!state.all.length) document.getElementById('all-empty').classList.remove('hidden');
      document.getElementById('modal-delete-category').classList.add('hidden');
      showToast('Categoría eliminada.', 'info');
      await loadPending();
      await loadApproved();
      await refreshPendingBadge();
    } catch (err) {
      console.error(err);
      showToast('Error eliminando categoría.', 'error');
    }
  });
}

// ─── Aprobar categoría ──────────────────────────────────────────
async function handleApproveCategory(categoryId, name) {
  await approveCategory(categoryId);
  document.getElementById(`category-pending-${categoryId}`)?.remove();
  document.getElementById(`category-all-${categoryId}`)?.remove();
  state.pending = state.pending.filter(c => c.id !== categoryId);
  state.all = state.all.filter(c => c.id !== categoryId);
  if (!state.pending.length) document.getElementById('pending-empty').classList.remove('hidden');
  if (!state.all.length) document.getElementById('all-empty').classList.remove('hidden');
  showToast(`"${name}" aprobada.`, 'success');
  await loadApproved();
  await refreshPendingBadge();
}

// ─── Rechazar categoría ─────────────────────────────────────────
function openRejectCategoryModal(categoryId, name) {
  state.rejectTarget = categoryId;
  document.getElementById('reject-category-name').textContent = name;
  document.getElementById('reject-category-reason').value = '';
  document.getElementById('modal-reject-category').classList.remove('hidden');
}

function bindRejectCategoryModal() {
  document.getElementById('btn-cancel-reject-category').addEventListener('click', () => {
    document.getElementById('modal-reject-category').classList.add('hidden');
  });

  document.getElementById('btn-confirm-reject-category').addEventListener('click', async () => {
    const reason = document.getElementById('reject-category-reason').value.trim();
    if (!reason) { showToast('Escribí el motivo.', 'warning'); return; }

    const categoryId = state.rejectTarget;
    const category = state.pending.find(c => c.id === categoryId) || state.all.find(c => c.id === categoryId);
    const name = category?.name || 'Categoría';

    await rejectCategory(categoryId, reason);
    document.getElementById(`category-pending-${categoryId}`)?.remove();
    document.getElementById(`category-all-${categoryId}`)?.remove();
    state.pending = state.pending.filter(c => c.id !== categoryId);
    state.all = state.all.filter(c => c.id !== categoryId);
    if (!state.pending.length) document.getElementById('pending-empty').classList.remove('hidden');
    if (!state.all.length) document.getElementById('all-empty').classList.remove('hidden');

    document.getElementById('modal-reject-category').classList.add('hidden');
    showToast(`"${name}" rechazada.`, 'info');
    await refreshPendingBadge();
  });
}

// ─── Init ───────────────────────────────────────────────────────
onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') { window.location.href = '../dashboard-admin/index.html'; return; }

  await initAdminSidebar(session.user, session.userData, 'categories');

  await loadAll();
  await loadPending();
  bindTabs();
  bindCategoryModal();
  bindDeleteCategoryModal();
  bindRejectCategoryModal();
});
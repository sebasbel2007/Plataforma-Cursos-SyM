// File: plataforma cursos SyM/assets/js/admin-users.js

import { onSessionChange, showToast, formatDate, getInitials } from './app.js';
import { initAdminSidebar, refreshPendingBadge } from './admin-utils.js';
import { getAllUsers, suspendUser, reactivateUser, updateUserRole, updateUserData, deleteUser } from './db.js';

const ROLE_LABEL = { student: 'Alumno', teacher: 'Profesor', admin: 'Admin', sub_admin: 'Sub Admin' };
const ROLE_CLASS = { student: 'role-student', teacher: 'role-teacher', admin: 'role-admin', sub_admin: 'role-sub_admin' };
const AVATAR_CLASS = { student: '', teacher: 'teacher', admin: 'admin', sub_admin: 'sub_admin' };

const state = { allUsers: [], filtered: [], suspendTarget: null, editTarget: null, deleteTarget: null, roleTarget: null };

export const ADMIN_UID = '9IztY8OndFQjnCqJEdxlTGzh7u52';

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') { window.location.href = '../dashboard-admin/index.html'; return; }

  await initAdminSidebar(session.user, session.userData, 'users');

  const users = await getAllUsers();
  state.allUsers = users;

  document.getElementById('users-loading').classList.add('hidden');
  document.getElementById('users-table-wrap').classList.remove('hidden');

  applyFilters();
  bindEvents();
  bindSuspendModal();
  bindEditModal();
  bindRoleModal();
  bindDeleteModal();
});

function bindEvents() {
  let timer;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(applyFilters, 200);
  });
  document.getElementById('role-filter').addEventListener('change', applyFilters);
}

function applyFilters() {
  const q    = document.getElementById('search-input').value.trim().toLowerCase();
  const role = document.getElementById('role-filter').value;

  state.filtered = state.allUsers.filter(u => {
    const matchRole  = !role || u.role === role;
    const matchQuery = !q ||
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    return matchRole && matchQuery;
  });

  renderUsers(state.filtered);
}

function renderUsers(users) {
  const countEl = document.getElementById('users-count');
  countEl.textContent = `${users.length} usuario${users.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('users-tbody');
  const emptyEl = document.getElementById('users-empty');
  const emptyMsg = document.getElementById('empty-message');

  if (!users.length) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyMsg.textContent = document.getElementById('search-input').value || document.getElementById('role-filter').value
      ? 'No hay usuarios que coincidan con la búsqueda.'
      : 'No hay usuarios registrados.';
    return;
  }

  emptyEl.classList.add('hidden');

  tbody.innerHTML = users.map(u => {
    const initials = getInitials(u.displayName || u.email);
    const avatarCls = AVATAR_CLASS[u.role] || '';
    const roleCls = ROLE_CLASS[u.role] || '';
    const isAdmin = u.uid === ADMIN_UID;

    return `
    <tr id="user-row-${u.uid}">
      <td style="padding-left:1.25rem;">
        <div class="user-cell">
          <div class="user-avatar-sm ${avatarCls}">${initials}</div>
          <div class="user-info">
            <div class="user-name" title="${u.displayName || '—'}">${u.displayName || '—'}</div>
            <div class="user-email" title="${u.email}">${u.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="role-badge ${roleCls}">${ROLE_LABEL[u.role] || u.role}</span>
        ${u.role === 'teacher' && u.membershipStatus === 'active'
          ? `<span class="membership-active">Membresía activa</span>`
          : ''}
      </td>
      <td style="color:var(--text-muted);white-space:nowrap;">${formatDate(u.createdAt)}</td>
      <td style="text-align:center;">
        ${u.suspended
          ? `<span class="status-badge status-suspended">Suspendido</span>
             ${u.suspendedReason ? `<span class="suspended-reason">${u.suspendedReason}</span>` : ''}`
          : `<span class="status-badge status-active">Activo</span>`
        }
      </td>
      <td class="actions-cell" style="padding-right:1.25rem;">
        <div class="action-btns">
          ${!u.suspended
            ? `<button class="action-btn btn-suspend" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName || u.email)}" title="Suspender usuario">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                 <span>Suspend</span>
               </button>`
            : `<button class="action-btn btn-reactivate" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName || u.email)}" title="Reactivar usuario">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                 <span>Reactivar</span>
               </button>`
          }
          <button class="action-btn btn-edit" data-uid="${u.uid}" title="Editar datos del usuario">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Editar</span>
          </button>
          <button class="action-btn btn-role" data-uid="${u.uid}" data-role="${u.role}" title="Cambiar rol del usuario">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            <span>Rol</span>
          </button>
          ${!isAdmin
            ? `<button class="action-btn btn-delete" data-uid="${u.uid}" data-name="${escapeHtml(u.displayName || u.email)}" title="Eliminar usuario">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                 <span>Eliminar</span>
               </button>`
            : `<button class="action-btn btn-delete" disabled title="No se puede eliminar al admin principal" style="opacity:.4;cursor:not-allowed;">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                 <span>Eliminar</span>
               </button>`
          }
        </div>
      </td>
    </tr>`;
  }).join('');

  bindRowActions();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'");
}

function bindRowActions() {
  document.querySelectorAll('.action-btn.btn-suspend').forEach(btn => {
    btn.addEventListener('click', () => openSuspendModal(btn.dataset.uid, btn.dataset.name));
  });
  document.querySelectorAll('.action-btn.btn-reactivate').forEach(btn => {
    btn.addEventListener('click', () => handleReactivate(btn.dataset.uid, btn.dataset.name));
  });
  document.querySelectorAll('.action-btn.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.uid));
  });
  document.querySelectorAll('.action-btn.btn-role').forEach(btn => {
    btn.addEventListener('click', () => openRoleModal(btn.dataset.uid, btn.dataset.role));
  });
  document.querySelectorAll('.action-btn.btn-delete:not(:disabled)').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.uid, btn.dataset.name));
  });
}

// ─── Suspender ──────────────────────────────────────────────────
function openSuspendModal(uid, name) {
  state.suspendTarget = uid;
  document.getElementById('suspend-user-name').textContent = name;
  document.getElementById('suspend-reason').value = '';
  document.getElementById('modal-suspend').classList.remove('hidden');
}

function bindSuspendModal() {
  document.getElementById('btn-cancel-suspend').addEventListener('click', () => {
    document.getElementById('modal-suspend').classList.add('hidden');
  });

  document.getElementById('btn-confirm-suspend').addEventListener('click', async () => {
    const reason = document.getElementById('suspend-reason').value.trim();
    if (!reason) { showToast('Escribí el motivo.', 'warning'); return; }

    await suspendUser(state.suspendTarget, reason);
    const u = state.allUsers.find(x => x.uid === state.suspendTarget);
    if (u) { u.suspended = true; u.suspendedReason = reason; }

    document.getElementById('modal-suspend').classList.add('hidden');
    applyFilters();
    showToast('Cuenta suspendida.', 'info');
  });
}

async function handleReactivate(uid, name) {
  if (!confirm(`¿Reactivar la cuenta de ${name}?`)) return;
  await reactivateUser(uid);
  const u = state.allUsers.find(x => x.uid === uid);
  if (u) { u.suspended = false; u.suspendedReason = null; }
  applyFilters();
  showToast('Cuenta reactivada.', 'success');
}

// ─── Editar usuario ─────────────────────────────────────────────
function openEditModal(uid) {
  const u = state.allUsers.find(x => x.uid === uid);
  if (!u) return;
  state.editTarget = uid;
  document.getElementById('edit-user-name').value = u.displayName || '';
  document.getElementById('modal-edit-user').classList.remove('hidden');
}

function bindEditModal() {
  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    document.getElementById('modal-edit-user').classList.add('hidden');
  });

  document.getElementById('btn-save-edit').addEventListener('click', async () => {
    const uid = state.editTarget;
    const displayName = document.getElementById('edit-user-name').value.trim();
    if (!displayName) { showToast('Completá el nombre.', 'warning'); return; }

    try {
      await updateUserData(uid, { displayName });
      const u = state.allUsers.find(x => x.uid === uid);
      if (u) { u.displayName = displayName; }
      document.getElementById('modal-edit-user').classList.add('hidden');
      applyFilters();
      showToast('Usuario actualizado.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error actualizando usuario.', 'error');
    }
  });
}

// ─── Cambiar rol ────────────────────────────────────────────────
function openRoleModal(uid, currentRole) {
  state.roleTarget = uid;
  const u = state.allUsers.find(x => x.uid === uid);
  document.getElementById('role-change-user-name').textContent = u?.displayName || u?.email || uid;
  document.getElementById('role-change-select').value = currentRole;
  document.getElementById('modal-change-role').classList.remove('hidden');
}

function bindRoleModal() {
  document.getElementById('btn-cancel-role-change').addEventListener('click', () => {
    document.getElementById('modal-change-role').classList.add('hidden');
  });

  document.getElementById('btn-confirm-role-change').addEventListener('click', async () => {
    const uid = state.roleTarget;
    const newRole = document.getElementById('role-change-select').value;
    if (!newRole) { showToast('Seleccioná un rol.', 'warning'); return; }

    try {
      await updateUserRole(uid, newRole);
      const u = state.allUsers.find(x => x.uid === uid);
      if (u) u.role = newRole;
      document.getElementById('modal-change-role').classList.add('hidden');
      applyFilters();
      showToast('Rol actualizado.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error cambiando rol.', 'error');
    }
  });
}

// ─── Eliminar usuario ───────────────────────────────────────────
function openDeleteModal(uid, name) {
  state.deleteTarget = uid;
  document.getElementById('delete-user-name').textContent = name;
  document.getElementById('modal-delete-user').classList.remove('hidden');
}

function bindDeleteModal() {
  document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    document.getElementById('modal-delete-user').classList.add('hidden');
  });

  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    const uid = state.deleteTarget;
    try {
      await deleteUser(uid);
      state.allUsers = state.allUsers.filter(x => x.uid !== uid);
      document.getElementById('modal-delete-user').classList.add('hidden');
      applyFilters();
      showToast('Usuario eliminado.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Error eliminando usuario.', 'error');
    }
  });
}
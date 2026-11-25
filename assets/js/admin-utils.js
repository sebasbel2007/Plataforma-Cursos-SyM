// File: plataforma cursos SyM/assets/js/admin-utils.js

import { getAllUsers, getAllTransactions, getPendingCourses, getPublishedCourses, getPendingCategories, listenNotifications } from './db.js';
import { initNotifications } from './notifications.js';
import { formatARS, formatDate, getInitials, logout, applyTheme } from './app.js';
import { renderDashboardSidebar } from './chrome.js';

let currentAdmin = null;
let pendingCountCache = 0;

export async function initAdminSidebar(user, userData, active = 'panel') {
  currentAdmin = { ...userData, uid: user.uid };

  renderDashboardSidebar('admin', active);
  _setSidebarUser();
  initNotifications(currentAdmin.uid);
  _bindNotifActivity(currentAdmin.uid);
  await _updatePendingBadge();
  _bindLogout();
  
  return currentAdmin;
}

function _setSidebarUser() {
  const name = document.getElementById('sidebar-name');
  const init = document.getElementById('sidebar-initials');
  const msg  = document.getElementById('welcome-msg');
  if (name) name.textContent = currentAdmin.displayName || currentAdmin.email;
  if (init) init.textContent = getInitials(currentAdmin.displayName || currentAdmin.email);
  if (msg)  msg.textContent  = `Bienvenido, ${currentAdmin.displayName?.split(' ')[0] || 'Admin'}`;
}

async function _updatePendingBadge() {
  try {
    const [pendingCourses, pendingCategories] = await Promise.all([
      getPendingCourses(),
      getPendingCategories()
    ]);
    const total = pendingCourses.length + pendingCategories.length;
    _renderPendingBadge(total);
    return total;
  } catch (err) {
    console.error('Error updating pending badge:', err);
    return 0;
  }
}

function _renderPendingBadge(count) {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  pendingCountCache = count;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

export function getPendingCount() {
  return pendingCountCache;
}

export function refreshPendingBadge() {
  return _updatePendingBadge();
}

function _bindNotifActivity(uid) {
  listenNotifications(uid, (notifs) => {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notifs.length) {
      list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">Sin actividad reciente.</p>`;
      return;
    }
    list.innerHTML = notifs.slice(0, 10).map(n => `
      <div style="padding:.75rem;border-bottom:1px solid var(--border);${!n.read ? 'background:var(--accent-dim);' : ''}">
        <div style="font-weight:600;font-size:.875rem;">${n.title}</div>
        <div style="font-size:.8125rem;color:var(--text-muted);">${n.message}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem;">${formatDate(n.createdAt)}</div>
      </div>`).join('');
  });
}

function _bindLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logout();
    window.location.href = '../../index.html';
  });
}

export function initMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const openBtn  = document.getElementById('sidebar-open');
  const closeBtn = document.getElementById('sidebar-close');
  if (!sidebar) return;

  const open  = () => { sidebar.classList.add('open');    overlay?.classList.add('visible');    document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('visible'); document.body.style.overflow = ''; };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
}

export function initThemeToggle() {
  const saved = localStorage.getItem('sym-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || preferred);

  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });

  document.querySelectorAll('.theme-toggle-option').forEach(opt => {
    opt.addEventListener('click', () => applyTheme(opt.dataset.value));
  });
}

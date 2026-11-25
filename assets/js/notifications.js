// File: plataforma cursos SyM/assets/js/notifications.js

import { listenNotifications, markNotificationRead, markAllNotificationsRead } from './db.js';
import { formatDate } from './app.js';

let _unsubscribe = null;

// ─── Inicializar campanita ────────────────────────────────────
export function initNotifications(userId) {
  if (_unsubscribe) _unsubscribe();

  _unsubscribe = listenNotifications(userId, (notifications) => {
    renderBadge(notifications);
    renderDropdown(notifications);
  });
}

export function destroyNotifications() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

// ─── Badge con contador ───────────────────────────────────────
function renderBadge(notifications) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  const unread = notifications.filter(n => !n.read).length;
  badge.textContent = unread > 9 ? '9+' : unread;
  badge.classList.toggle('hidden', unread === 0);
}

// ─── Dropdown de notificaciones ───────────────────────────────
function renderDropdown(notifications) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem;">
        <p>Sin notificaciones</p>
      </div>`;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <div class="notif-item-title">${escapeHtml(n.title)}</div>
      <div class="notif-item-msg">${escapeHtml(n.message)}</div>
      <div class="notif-item-time">${formatDate(n.createdAt)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      if (item.classList.contains('unread')) {
        await markNotificationRead(id);
        item.classList.remove('unread');
      }
    });
  });
}

// ─── Toggle dropdown ──────────────────────────────────────────
export function bindNotifToggle(userId) {
  const btn      = document.getElementById('notif-btn');
  const dropdown = document.getElementById('notif-dropdown');
  const markAll  = document.getElementById('notif-mark-all');

  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.add('hidden');
    }
  });

  markAll?.addEventListener('click', async () => {
    await markAllNotificationsRead(userId);
  });
}

// ─── Utilidad ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

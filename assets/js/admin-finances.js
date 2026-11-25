// File: plataforma cursos SyM/assets/js/admin-finances.js

import { onSessionChange, showToast, formatARS, formatDate, getInitials, logout } from './app.js';
import { renderDashboardSidebar } from './chrome.js';
import { getAllTransactions, updateTransactionStatus, createNotification } from './db.js';

const TYPE_LABEL  = { course_purchase: 'Compra', membership: 'Membresía', refund: 'Reembolso' };
const STATUS_COLOR = { approved: 'var(--success)', pending: 'var(--warning)', refunded: 'var(--error)', disputed: 'var(--error)' };
const STATUS_LABEL = { approved: 'Aprobado', pending: 'Pendiente', refunded: 'Reembolsado', disputed: 'Disputado' };

const state = { all: [], activeTab: 'all' };

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') { window.location.href = '../dashboard-admin/index.html'; return; }

  renderDashboardSidebar('admin', 'finances');

  const name = session.userData?.displayName || session.user.email;
  document.getElementById('sidebar-initials').textContent = getInitials(name);
  document.getElementById('sidebar-name').textContent     = name;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    window.location.href = '../../index.html';
  });

  const transactions = await getAllTransactions();
  state.all = transactions;

  document.getElementById('tx-loading').classList.add('hidden');

  // Stats
  const approved    = transactions.filter(t => t.status === 'approved');
  const memberships = transactions.filter(t => t.type === 'membership' && t.status === 'approved');
  const refunds     = transactions.filter(t => t.refundRequested || t.type === 'refund');

  document.getElementById('stat-platform').textContent   = formatARS(approved.reduce((a, t) => a + (t.platformFee || 0), 0));
  document.getElementById('stat-teachers').textContent   = formatARS(approved.reduce((a, t) => a + (t.teacherEarnings || 0), 0));
  document.getElementById('stat-memberships').textContent = memberships.length;
  document.getElementById('stat-refunds').textContent    = refunds.length;

  bindTabs();
  renderTable(transactions);
});

function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.style.color       = 'var(--text-muted)';
        b.style.borderBottom = '2px solid transparent';
      });
      btn.style.color       = 'var(--accent)';
      btn.style.borderBottom = '2px solid var(--accent)';
      state.activeTab = btn.dataset.tab;

      const filtered = state.activeTab === 'refund'
        ? state.all.filter(t => t.refundRequested || t.type === 'refund')
        : state.all;
      renderTable(filtered);
    });
  });
}

function renderTable(transactions) {
  const tbody = document.getElementById('tx-tbody');

  if (!transactions.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:2rem;text-align:center;color:var(--text-muted);">Sin transacciones.</td></tr>`;
    return;
  }

  tbody.innerHTML = transactions.slice(0, 100).map(t => `
    <tr style="border-bottom:1px solid var(--border);" id="tx-row-${t.id}">
      <td style="padding:.875rem 1.25rem;">
        <span style="font-size:.8125rem;font-weight:600;">${TYPE_LABEL[t.type] || t.type}</span>
      </td>
      <td style="padding:.875rem 1rem;font-size:.8125rem;color:var(--text-muted);">${t.studentId?.slice(0,8) || '—'}…</td>
      <td style="padding:.875rem 1rem;font-size:.8125rem;color:var(--text-muted);">${formatDate(t.createdAt)}</td>
      <td style="padding:.875rem 1rem;text-align:right;font-weight:600;">${formatARS(t.amount || 0)}</td>
      <td style="padding:.875rem 1rem;text-align:right;font-size:.8125rem;color:var(--text-muted);">${formatARS(t.platformFee || 0)}</td>
      <td style="padding:.875rem 1rem;text-align:right;font-size:.8125rem;color:var(--text-muted);">${formatARS(t.teacherEarnings || 0)}</td>
      <td style="padding:.875rem 1rem;text-align:center;">
        <span style="font-size:.75rem;font-weight:600;color:${STATUS_COLOR[t.status] || 'var(--text-muted)'};">
          ${STATUS_LABEL[t.status] || t.status}
        </span>
      </td>
      <td style="padding:.875rem 1rem;text-align:center;">
        ${t.status === 'approved' && (t.refundRequested || t.type === 'refund')
          ? `<button class="btn btn-error btn-sm btn-process-refund"
               data-id="${t.id}" data-student="${t.studentId}" data-teacher="${t.teacherId || ''}"
               data-course="${t.courseId || ''}">
               Procesar reembolso
             </button>`
          : `<span style="font-size:.75rem;color:var(--text-muted);">—</span>`
        }
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-process-refund').forEach(btn => {
    btn.addEventListener('click', () => handleRefund(btn.dataset.id, btn.dataset.student, btn.dataset.teacher, btn.dataset.course));
  });
}

async function handleRefund(txId, studentId, teacherId, courseId) {
  if (!confirm('¿Confirmar el reembolso? Esta acción no se puede deshacer.')) return;

  await updateTransactionStatus(txId, 'refunded');

  if (studentId) {
    await createNotification(studentId, 'refund', 'Reembolso procesado', 'Tu reembolso fue aprobado y procesado.', courseId || null, txId);
  }
  if (teacherId) {
    await createNotification(teacherId, 'refund', 'Reembolso procesado', 'Se procesó un reembolso en uno de tus cursos.', courseId || null, txId);
  }

  const tx = state.all.find(t => t.id === txId);
  if (tx) tx.status = 'refunded';

  const row = document.getElementById(`tx-row-${txId}`);
  if (row) {
    const actionCell = row.querySelector('td:last-child');
    const statusCell = row.querySelector('td:nth-child(7)');
    if (actionCell) actionCell.innerHTML = `<span style="font-size:.75rem;color:var(--text-muted);">—</span>`;
    if (statusCell) statusCell.innerHTML = `<span style="font-size:.75rem;font-weight:600;color:var(--error);">Reembolsado</span>`;
  }

  showToast('Reembolso procesado y notificaciones enviadas.', 'success');
}

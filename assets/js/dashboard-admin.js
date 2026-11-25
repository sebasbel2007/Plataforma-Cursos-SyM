// File: plataforma cursos SyM/assets/js/dashboard-admin.js

import { requireRole, showToast, formatARS, formatDate, getInitials } from './app.js';
import { initAdminSidebar, refreshPendingBadge } from './admin-utils.js';
import { getAllUsers, getAllTransactions, getPublishedCourses, getPendingCourses, getPendingCategories } from './db.js';

let currentUser = null;

// ─── Init ─────────────────────────────────────────────────────
requireRole('admin').then(async ({ user, userData }) => {
  currentUser = { ...userData, uid: user.uid };
  await initAdminSidebar(user, userData, 'panel');
  await _loadAll();
});

// ─── Load Dashboard Stats ─────────────────────────────────────
async function _loadAll() {
  try {
    const [users, transactions, publishedCourses, pendingCourses, pendingCategories] = await Promise.all([
      getAllUsers(),
      getAllTransactions(),
      getPublishedCourses(),
      getPendingCourses(),
      getPendingCategories()
    ]);

    const students = users.filter(u => u.role === 'student').length;
    const teachers = users.filter(u => u.role === 'teacher').length;
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.platformFee || 0), 0);
    const pendingRefunds = transactions.filter(t => t.status === 'refund_pending' || t.status === 'refund_requested').length;
    const totalPending = pendingCourses.length + pendingCategories.length;

    _setText('stat-users', users.length.toLocaleString());
    _setText('stat-courses', publishedCourses.length.toLocaleString());
    _setText('stat-revenue', formatARS(totalRevenue));
    _setText('stat-pending', totalPending.toString());
    _setText('stat-students', students.toLocaleString());
    _setText('stat-teachers', teachers.toLocaleString());
    _setText('stat-refunds', pendingRefunds.toString());

  } catch (err) {
    console.error('Error loading dashboard stats:', err);
    showToast('Error cargando estadísticas', 'error');
  }
}

// ─── Util ─────────────────────────────────────────────────────
function _setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('skeleton');
  el.style.height = '';
  el.style.width  = '';
}

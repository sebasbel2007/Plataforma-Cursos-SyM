// File: plataforma cursos SyM/assets/js/stats-teacher.js

import { onSessionChange, showToast, formatARS, formatDate, getInitials, logout } from './app.js';
import { renderDashboardSidebar } from './chrome.js';
import { getCoursesByTeacher, getTransactionsByTeacher } from './db.js';

const STATUS_COLOR = { approved: 'var(--success)', pending: 'var(--warning)', refunded: 'var(--error)', disputed: 'var(--error)' };
const STATUS_LABEL = { approved: 'Aprobado', pending: 'Pendiente', refunded: 'Reembolsado', disputed: 'Disputado' };
const COURSE_STATUS_COLOR = { published: 'var(--success)', pending: 'var(--warning)', draft: 'var(--text-muted)', rejected: 'var(--error)' };
const COURSE_STATUS_LABEL = { published: 'Publicado', pending: 'En revisión', draft: 'Borrador', rejected: 'Rechazado' };

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'teacher') {
    window.location.href = '../dashboard-teacher/index.html';
    return;
  }

  renderDashboardSidebar('teacher', 'stats', { mode: 'pages' });

  const name = session.userData?.displayName || session.user.email;
  document.getElementById('sidebar-initials').textContent = getInitials(name);
  document.getElementById('sidebar-name').textContent     = name;

  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    window.location.href = '../../index.html';
  });

  const [courses, transactions] = await Promise.all([
    getCoursesByTeacher(session.user.uid),
    getTransactionsByTeacher(session.user.uid)
  ]);

  const approved = transactions.filter(t => t.status === 'approved' && t.type === 'course_purchase');
  const earnings = approved.reduce((acc, t) => acc + (t.teacherEarnings || 0), 0);
  const students = courses.reduce((acc, c) => acc + (c.totalStudents || 0), 0);
  const published = courses.filter(c => c.status === 'published').length;

  document.getElementById('stat-earnings').textContent  = formatARS(earnings);
  document.getElementById('stat-sales').textContent     = approved.length;
  document.getElementById('stat-students').textContent  = students;
  document.getElementById('stat-published').textContent = published;

  // Tabla cursos
  document.getElementById('courses-loading').classList.add('hidden');
  const tbody = document.getElementById('courses-tbody');

  if (courses.length) {
    tbody.innerHTML = courses.map(c => {
      const courseTx  = approved.filter(t => t.courseId === c.courseId);
      const courseEarnings = courseTx.reduce((acc, t) => acc + (t.teacherEarnings || 0), 0);
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:.875rem 1.25rem;">
            <a href="../course/course-detail.html?id=${c.courseId}"
              style="font-weight:600;color:var(--text-primary);">${c.title}</a>
          </td>
          <td style="padding:.875rem 1rem;text-align:right;color:var(--text-secondary);">${c.totalStudents || 0}</td>
          <td style="padding:.875rem 1rem;text-align:right;font-weight:600;">${formatARS(courseEarnings)}</td>
          <td style="padding:.875rem 1rem;text-align:right;">
            <span style="color:var(--warning);">${'★'.repeat(Math.round(c.rating || 0))}</span>
            <span style="font-size:.8125rem;color:var(--text-muted);"> ${(c.rating || 0).toFixed(1)}</span>
          </td>
          <td style="padding:.875rem 1rem;text-align:center;">
            <span style="font-size:.75rem;font-weight:600;color:${COURSE_STATUS_COLOR[c.status] || 'var(--text-muted)'};">
              ${COURSE_STATUS_LABEL[c.status] || c.status}
            </span>
          </td>
        </tr>`;
    }).join('');
    document.getElementById('courses-table').classList.remove('hidden');
  }

  // Tabla transacciones
  document.getElementById('tx-loading').classList.add('hidden');

  if (!transactions.length) {
    document.getElementById('tx-empty').classList.remove('hidden');
    return;
  }

  const courseMap = {};
  courses.forEach(c => { courseMap[c.courseId] = c.title; });

  document.getElementById('tx-tbody').innerHTML = transactions.slice(0, 50).map(t => `
    <tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.875rem 1.25rem;font-weight:500;">${courseMap[t.courseId] || t.courseId || '—'}</td>
      <td style="padding:.875rem 1rem;color:var(--text-muted);font-size:.8125rem;">${formatDate(t.createdAt)}</td>
      <td style="padding:.875rem 1rem;text-align:right;font-weight:600;">${formatARS(t.amount || 0)}</td>
      <td style="padding:.875rem 1rem;text-align:right;font-weight:600;color:var(--success);">${formatARS(t.teacherEarnings || 0)}</td>
      <td style="padding:.875rem 1rem;text-align:center;">
        <span style="font-size:.75rem;font-weight:600;color:${STATUS_COLOR[t.status] || 'var(--text-muted)'};">
          ${STATUS_LABEL[t.status] || t.status}
        </span>
      </td>
    </tr>`).join('');

  document.getElementById('tx-table').classList.remove('hidden');
});

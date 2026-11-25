// File: plataforma cursos SyM/assets/js/dashboard-student.js

import { requireRole, logout, showToast, formatARS, formatDate, getInitials } from './app.js';
import { renderDashboardSidebar } from './chrome.js';
import {
  getStudentEnrollments, getCourse, saveReview,
  getCourseReviews, requestRefund, listenNotifications,
  updateUserData
} from './db.js';

let currentUser = null;
let enrollments  = [];
let reviewedCourses = new Set();

// ─── Init ─────────────────────────────────────────────────────
requireRole('student').then(async ({ userData }) => {
  currentUser = userData;
  renderDashboardSidebar('student', 'courses');
  _setSidebarUser();
  _bindNotifActivity(userData.uid);
  await _loadAll();
  _bindLogout();
  _bindTabs();
  _renderProfile(userData);
});

// ─── Actividad reciente (notificaciones) ──────────────────────
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

// ─── Sidebar ──────────────────────────────────────────────────
function _setSidebarUser() {
  const name = document.getElementById('sidebar-name');
  const init = document.getElementById('sidebar-initials');
  if (name) name.textContent = currentUser.displayName || currentUser.email;
  if (init) init.textContent = getInitials(currentUser.displayName || currentUser.email);
}

// ─── Carga ────────────────────────────────────────────────────
async function _loadAll() {
  try {
    enrollments = await getStudentEnrollments(currentUser.uid);
    reviewedCourses = await _loadReviewedCourses();
    _renderStats();
    await _renderCourses();
    await _renderHistory();
    await _renderReviews();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar el panel.', 'error');
  }
}

async function _loadReviewedCourses() {
  const completedIds = enrollments.filter(e => e.progressPercent === 100).map(e => e.courseId);
  if (!completedIds.length) return new Set();
  const reviews = (await Promise.all(completedIds.map(id => getCourseReviews(id))))
    .flat().filter(r => r.studentId === currentUser.uid);
  return new Set(reviews.map(r => r.courseId));
}

// ─── Stats ────────────────────────────────────────────────────
function _renderStats() {
  _setText('stat-enrolled',   enrollments.length);
  _setText('stat-completed',  enrollments.filter(e => e.progressPercent === 100).length);
  _setText('stat-certs',      enrollments.filter(e => e.certificateIssued).length);
  _setText('stat-inprogress', enrollments.filter(e => e.progressPercent > 0 && e.progressPercent < 100).length);
}

// ─── Mis cursos ───────────────────────────────────────────────
async function _renderCourses() {
  const loading = document.getElementById('courses-loading');
  const list    = document.getElementById('courses-list');
  const empty   = document.getElementById('courses-empty');

  if (!enrollments.length) {
    loading?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }

  const cards = (await Promise.all(enrollments.map(async (e) => {
    const course = await getCourse(e.courseId);
    if (!course) return '';
    const pct  = e.progressPercent || 0;
    const done = pct === 100;
    return `
      <div class="enrolled-card">
        ${course.thumbnailURL
          ? `<img src="${course.thumbnailURL}" alt="${course.title}" style="width:100%;aspect-ratio:16/9;object-fit:cover;">`
          : `<div style="width:100%;aspect-ratio:16/9;background:var(--bg-secondary);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.875rem;">Sin imagen</div>`}
        <div style="padding:1rem;">
          <p style="font-size:.75rem;color:var(--accent);font-weight:600;margin-bottom:.25rem;">${course.category || ''}</p>
          <h4 style="margin-bottom:.25rem;">${course.title}</h4>
          <p style="font-size:.8125rem;color:var(--text-muted);margin-bottom:.75rem;">por ${course.teacherName}</p>
          <div class="progress-bar-track" style="margin-bottom:.375rem;">
            <div class="progress-bar-fill${done ? ' done' : ''}" style="width:${pct}%;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted);margin-bottom:1rem;">
            <span>${pct}% completado</span>
            <span>${e.completedModules?.length || 0} / ${course.totalModules || 0} módulos</span>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            <a href="../course/course-player.html?id=${course.courseId}" class="btn btn-primary btn-sm">
              ${pct === 0 ? 'Comenzar' : done ? 'Repasar' : 'Continuar'}
            </a>
            ${done && !e.examResult?.passed ? `<a href="../course/course-exam.html?id=${course.courseId}" class="btn btn-secondary btn-sm">Examen final</a>` : ''}
            ${done && e.certificateIssued && course.certificateURL ? `<a href="${course.certificateURL}" target="_blank" class="btn btn-success btn-sm">Certificado</a>` : ''}
            ${done
              ? reviewedCourses.has(course.courseId)
                ? `<span class="badge badge-muted" style="align-self:center;">Reseñado</span>`
                : `<button class="btn btn-secondary btn-sm" onclick="openReviewModal('${course.courseId}','${course.title.replace(/'/g, "\\'")}')">Reseñar</button>`
              : ''}
            ${e.refundEligible && !e.refundRequested ? `<button class="btn btn-danger btn-sm" onclick="openRefundModal('${course.courseId}','${course.title.replace(/'/g, "\\'")}')">Reembolso</button>` : ''}
            ${e.refundRequested ? `<span class="badge badge-warning">Reembolso solicitado</span>` : ''}
          </div>
        </div>
      </div>`;
  }))).filter(Boolean);

  if (list) { list.innerHTML = cards.join(''); list.classList.remove('hidden'); }
  loading?.classList.add('hidden');
}

// ─── Historial ────────────────────────────────────────────────
async function _renderHistory() {
  const loading = document.getElementById('history-loading');
  const wrap    = document.getElementById('history-table-wrap');
  const empty   = document.getElementById('history-empty');
  const tbody   = document.getElementById('history-tbody');

  if (!enrollments.length) {
    loading?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }

  const rows = (await Promise.all(enrollments.map(async (e) => {
    const course = await getCourse(e.courseId);
    const status = e.refundRequested ? 'refunded' : 'approved';
    const badgeMap = { approved: 'badge-success', refunded: 'badge-warning' };
    const labelMap = { approved: 'Aprobado', refunded: 'Reembolso solicitado' };
    return `<tr>
      <td>${course?.title || e.courseId}</td>
      <td>${formatDate(e.enrolledAt)}</td>
      <td style="text-align:right;">${e.pricePaid === 0 ? 'Gratis' : formatARS(e.pricePaid)}</td>
      <td style="text-align:center;"><span class="badge ${badgeMap[status]}">${labelMap[status]}</span></td>
      <td style="text-align:center;">
        ${e.refundEligible && !e.refundRequested
          ? `<button class="btn btn-ghost btn-sm" onclick="openRefundModal('${e.courseId}','${course?.title || ''}')">Solicitar</button>`
          : e.refundRequested
            ? '<span class="badge badge-warning">Solicitado</span>'
            : '<span style="color:var(--text-muted);font-size:.8125rem;">No elegible</span>'}
      </td>
    </tr>`;
  }))).filter(Boolean);

  if (tbody) tbody.innerHTML = rows.join('');
  loading?.classList.add('hidden');
  wrap?.classList.remove('hidden');
}

// ─── Reseñas ──────────────────────────────────────────────────
async function _renderReviews() {
  const loading = document.getElementById('reviews-loading');
  const list    = document.getElementById('reviews-list');
  const empty   = document.getElementById('reviews-empty');

  const completedIds = enrollments.filter(e => e.progressPercent === 100).map(e => e.courseId);
  if (!completedIds.length) {
    loading?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }

  const allReviews = (await Promise.all(completedIds.map(id => getCourseReviews(id))))
    .flat().filter(r => r.studentId === currentUser.uid);

  if (!allReviews.length) {
    loading?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }

  const items = await Promise.all(allReviews.map(async (r) => {
    const course = await getCourse(r.courseId);
    const esc = (s) => (s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n');
    return `<div class="card" style="padding:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem;">
        <div>
          <h4 style="font-size:.9375rem;">${course?.title || r.courseId}</h4>
          <p style="font-size:.8125rem;color:var(--text-muted);">${formatDate(r.createdAt)}</p>
        </div>
        <span style="color:var(--warning);">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
      </div>
      <p style="font-size:.875rem;">${r.comment}</p>
      <div style="margin-top:.75rem;">
        <button class="btn btn-ghost btn-sm"
          onclick="openReviewModal('${course?.courseId || r.courseId}','${esc(course?.title)}',${r.rating},'${esc(r.comment)}')">Editar reseña</button>
      </div>
    </div>`;
  }));

  if (list) { list.innerHTML = items.join(''); list.classList.remove('hidden'); }
  loading?.classList.add('hidden');
}

// ─── Tabs ─────────────────────────────────────────────────────
function _bindTabs() {
  const tabs   = document.querySelectorAll('.tab-btn');
  const panels = { courses: 'panel-courses', history: 'panel-history', reviews: 'panel-reviews', notifications: 'panel-notifications', profile: 'panel-profile' };

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(id => document.getElementById(id)?.classList.add('hidden'));
      document.getElementById(panels[btn.dataset.tab])?.classList.remove('hidden');
    });
  });

  document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector(`.tab-btn[data-tab="${link.dataset.tab}"]`)?.click();
    });
  });
}

// ─── Logout ───────────────────────────────────────────────────
function _bindLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logout();
    window.location.href = '../../index.html';
  });
}

// ─── Modal reseña ─────────────────────────────────────────────
let _reviewCourseId = null;
let _reviewRating   = 0;

window.openReviewModal = (courseId, title, rating = 0, comment = '') => {
  _reviewCourseId = courseId;
  _reviewRating   = rating;
  document.getElementById('review-modal-course').textContent = title;
  document.getElementById('review-comment').value = comment || '';
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.star) <= rating);
  });
  const btn = document.getElementById('btn-submit-review');
  if (btn) btn.textContent = rating ? 'Actualizar reseña' : 'Publicar reseña';
  document.getElementById('modal-review').classList.remove('hidden');
};

document.getElementById('btn-cancel-review')?.addEventListener('click', () => {
  document.getElementById('modal-review').classList.add('hidden');
});

document.getElementById('star-rating')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.star-btn');
  if (!btn) return;
  _reviewRating = parseInt(btn.dataset.star);
  document.querySelectorAll('.star-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.star) <= _reviewRating);
  });
});

document.getElementById('btn-submit-review')?.addEventListener('click', async () => {
  if (!_reviewRating) { showToast('Seleccioná una calificación.', 'error'); return; }
  const comment = document.getElementById('review-comment').value.trim();
  if (!comment)  { showToast('Escribí un comentario.', 'error'); return; }
  const btn = document.getElementById('btn-submit-review');
  btn.disabled = true;
  try {
    const enroll = enrollments.find(e => e.courseId === _reviewCourseId);
    await saveReview(currentUser.uid, _reviewCourseId, enroll?.teacherId || '', _reviewRating, comment);
    showToast('Reseña publicada.', 'success');
    document.getElementById('modal-review').classList.add('hidden');
    reviewedCourses.add(_reviewCourseId);
    await _renderCourses();
    await _renderReviews();
  } catch { showToast('Error al publicar la reseña.', 'error'); }
  finally  { btn.disabled = false; }
});

// ─── Modal reembolso ──────────────────────────────────────────
let _refundCourseId = null;

window.openRefundModal = (courseId, title) => {
  _refundCourseId = courseId;
  document.getElementById('refund-modal-info').textContent = `Curso: ${title}`;
  document.getElementById('modal-refund').classList.remove('hidden');
};

document.getElementById('btn-cancel-refund')?.addEventListener('click', () => {
  document.getElementById('modal-refund').classList.add('hidden');
});

document.getElementById('btn-confirm-refund')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-refund');
  btn.disabled = true;
  try {
    const ok = await requestRefund(currentUser.uid, _refundCourseId);
    if (ok) {
      showToast('Solicitud enviada.', 'success');
      document.getElementById('modal-refund').classList.add('hidden');
      enrollments = await getStudentEnrollments(currentUser.uid);
      await _renderCourses();
      await _renderHistory();
    } else {
      showToast('No sos elegible para reembolso.', 'error');
    }
  } catch { showToast('Error al solicitar el reembolso.', 'error'); }
  finally  { btn.disabled = false; }
});

// ─── Util ─────────────────────────────────────────────────────
function _setText(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  el.classList.remove('skeleton');
  el.style.height = '';
  el.style.width  = '';
}

// --- Perfil ---
function _renderProfile(userData) {
  const name = userData.displayName || userData.email || "";
  const roleMap = { student: "Alumno", teacher: "Profesor", admin: "Administrador" };
  const el = (id) => document.getElementById(id);
  if (el("profile-initials")) el("profile-initials").textContent = getInitials(name);
  if (el("profile-name"))     el("profile-name").textContent     = name;
  if (el("profile-role"))     el("profile-role").textContent     = roleMap[userData.role] || userData.role;
  if (el("profile-email"))    el("profile-email").textContent    = userData.email || "";
  if (userData.country && el("profile-country")) el("profile-country").value = userData.country;
  if (userData.phone   && el("profile-phone"))   el("profile-phone").value   = userData.phone;
  el("btn-save-profile")?.addEventListener("click", async () => {
    const btn = el("btn-save-profile");
    const country = el("profile-country")?.value.trim() || "";
    const phone   = el("profile-phone")?.value.trim()   || "";
    btn.disabled = true;
    try { await updateUserData(currentUser.uid, { country, phone }); showToast("Perfil actualizado.", "success"); }
    catch { showToast("Error al guardar.", "error"); }
    finally { btn.disabled = false; }
  });
}

// File: plataforma cursos SyM/assets/js/admin-courses.js

import { onSessionChange, showToast, formatDate, formatARS } from './app.js';
import { initAdminSidebar } from './admin-utils.js';
import {
  getAllCourses, getModules, approveCourse, rejectCourse,
  archiveCourse, deleteCourse, clearCourseMediaUrls,
  deleteNotification, getAdminNotifications,
  getEnrollmentsByCourse, createNotification,
  getAllReviews, deleteReview
} from './db.js';
import { getCourseThumbnail, deleteCloudinaryFolder } from './storage.js';

const STATUS_LABEL = { draft: 'Borrador', pending: 'En revisión', published: 'Publicado', rejected: 'Rechazado', removed: 'Archivado' };
const STATUS_CLASS = { draft: 'status-draft', pending: 'status-pending', published: 'status-published', rejected: 'status-rejected', removed: 'status-rejected' };

const ICON_EYE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
const ICON_TRASH = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
const ICON_ARCHIVE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>';

const state = {
  courses: [],
  requests: [],
  rePublish: [],
  reviews: [],
  activeTab: 'all',
  search: '',
  rejectTarget: null
};

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') {
    window.location.href = '../dashboard-admin/index.html';
    return;
  }

  await initAdminSidebar(session.user, session.userData, 'courses');
  bindEvents();
  await loadData();
});

async function loadData() {
  try {
    state.courses  = await getAllCourses();
    state.requests = (await getAdminNotifications(100)).filter(n => n.type === 'course_delete_request');
    state.rePublish = (await getAdminNotifications(100)).filter(n => n.type === 'course_re_publish_request');
    state.reviews  = await getAllReviews();
    renderRequestsBadge();
    renderRepublishBadge();
    await render();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar los cursos.', 'error');
  }
}

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;
      if (state.activeTab === 'reviews') renderReviews();
      else render();
    });
  });

  document.getElementById('courses-search').addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById('btn-delete-requests').addEventListener('click', openRequestsModal);
  document.getElementById('btn-close-requests').addEventListener('click', () => {
    document.getElementById('modal-requests').classList.add('hidden');
  });
  document.getElementById('modal-requests').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  document.getElementById('btn-republish-requests').addEventListener('click', openRepublishModal);
  document.getElementById('btn-close-republish').addEventListener('click', () => {
    document.getElementById('modal-republish').classList.add('hidden');
  });
  document.getElementById('modal-republish').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });

  document.getElementById('btn-cancel-reject').addEventListener('click', () => {
    document.getElementById('modal-reject').classList.add('hidden');
  });
  document.getElementById('btn-confirm-reject').addEventListener('click', handleRejectConfirm);
}

function getFiltered() {
  return state.courses.filter(c => {
    const okStatus = state.activeTab === 'all' || c.status === state.activeTab;
    const okSearch = !state.search ||
      (c.title || '').toLowerCase().includes(state.search) ||
      (c.teacherName || '').toLowerCase().includes(state.search);
    return okStatus && okSearch;
  });
}

// ─── Render de la lista ────────────────────────────────────────
async function render() {
  const loading = document.getElementById('courses-loading');
  const list    = document.getElementById('courses-list');
  const empty   = document.getElementById('courses-empty');
  const msg     = document.getElementById('courses-count-msg');
  const reviewsPanel = document.getElementById('reviews-panel');

  loading?.classList.add('hidden');

  if (state.activeTab === 'reviews') {
    list?.classList.add('hidden');
    empty?.classList.add('hidden');
    if (reviewsPanel) reviewsPanel.classList.remove('hidden');
    return;
  }

  if (reviewsPanel) reviewsPanel.classList.add('hidden');

  const filtered = getFiltered();
  const label = state.activeTab === 'all' ? 'todos los cursos' : (STATUS_LABEL[state.activeTab] || '').toLowerCase();
  if (msg) msg.textContent = `${filtered.length} curso${filtered.length !== 1 ? 's' : ''} (${label})`;

  if (!filtered.length) {
    empty?.classList.remove('hidden');
    list?.classList.add('hidden');
    return;
  }
  empty?.classList.add('hidden');

  const modulesPerCourse = await Promise.all(filtered.map(c => getModules(c.courseId)));

  list.innerHTML = filtered.map((course, i) => {
    const modules = modulesPerCourse[i];
    const thumb   = getCourseThumbnail(course) || '';
    const totalLessons = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);

    return `
      <div class="card" style="padding:0;overflow:hidden;" id="admin-course-card-${course.courseId}">
        <div style="display:grid;grid-template-columns:110px 1fr;gap:0;">

          <div style="background:var(--bg-secondary);">
            ${thumb
              ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;min-height:96px;" />`
              : `<div style="width:100%;height:100%;min-height:96px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);">
                   <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                 </div>`}
          </div>

          <div style="padding:1.1rem 1.25rem;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:.625rem;">
              <div style="min-width:0;">
                <h3 style="font-size:1rem;margin-bottom:.25rem;">${course.title || 'Sin título'}</h3>
                <p style="font-size:.8125rem;color:var(--text-muted);">
                  Por <strong style="color:var(--text-secondary);">${course.teacherName || '—'}</strong>
                  · ${formatDate(course.createdAt)}
                </p>
              </div>
              <span class="status-badge ${STATUS_CLASS[course.status] || 'status-draft'}">${STATUS_LABEL[course.status] || course.status}</span>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:1.25rem;font-size:.8125rem;color:var(--text-muted);margin-bottom:.875rem;">
              <span>${modules.length} módulos · ${totalLessons} clases</span>
              <span>${course.category || 'Sin categoría'}</span>
              <span>${course.isFree ? 'Gratis' : formatARS(course.price || 0)}</span>
              <span style="color:var(--text-secondary);">${course.totalStudents || 0} alumnos</span>
            </div>

            ${course.status === 'rejected' && course.rejectionReason
              ? `<div style="font-size:.8125rem;color:var(--error);margin-bottom:.75rem;">Motivo: ${course.rejectionReason}</div>`
              : ''}

            <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
              <a href="course-review.html?id=${course.courseId}" class="btn btn-ghost btn-sm" title="Revisar todo el contenido del curso">${ICON_EYE} <span style="margin-left:.375rem;">Ver ficha</span></a>

              ${course.status === 'pending'
                ? `<button class="btn btn-success btn-sm" data-action="approve" data-id="${course.courseId}" data-title="${course.title}">Aprobar</button>
                   <button class="btn btn-error btn-sm" data-action="reject" data-id="${course.courseId}">Rechazar</button>`
                : ''}

              ${course.status === 'draft' || course.status === 'rejected'
                ? `<button class="btn btn-ghost btn-sm" data-action="delete" data-id="${course.courseId}" style="color:var(--error);">${ICON_TRASH} <span style="margin-left:.375rem;">Eliminar</span></button>`
                : ''}

              ${course.status === 'published'
                ? `<button class="btn btn-ghost btn-sm" data-action="archive" data-id="${course.courseId}" title="Archivar (los alumnos conservan el acceso)">${ICON_ARCHIVE} <span style="margin-left:.375rem;">Archivar</span></button>`
                : ''}
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  list.classList.remove('hidden');

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.id));
  });
}

// ─── Reseñas (moderación) ─────────────────────────────────────
async function renderReviews() {
  const panel = document.getElementById('reviews-panel');
  if (!panel) return;
  const listEl = document.getElementById('reviews-list');
  const empty  = document.getElementById('reviews-empty');

  const byCourse = new Map(state.courses.map(c => [c.courseId, c]));
  const items = state.reviews
    .map(r => ({ ...r, courseTitle: byCourse.get(r.courseId)?.title || '(curso eliminado)' }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  if (!items.length) {
    listEl?.classList.add('hidden');
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  listEl.innerHTML = items.map(r => `
    <div class="card" style="padding:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap;">
        <div>
          <h4 style="font-size:.9375rem;margin-bottom:.25rem;">${r.courseTitle}</h4>
          <p style="font-size:.8125rem;color:var(--text-muted);">${formatDate(r.createdAt)}</p>
        </div>
        <div style="display:flex;align-items:center;gap:1rem;">
          <span style="color:var(--warning);">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <button class="btn btn-error btn-sm" data-del-review="${r.id}" data-course="${r.courseId}">${ICON_TRASH} <span style="margin-left:.375rem;">Borrar</span></button>
        </div>
      </div>
      <p style="font-size:.875rem;">${r.comment}</p>
    </div>`).join('');

  listEl.classList.remove('hidden');

  listEl.querySelectorAll('[data-del-review]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteReview(btn.dataset.delReview, btn.dataset.course));
  });
}

async function handleDeleteReview(reviewId, courseId) {
  if (!confirm('¿Eliminar esta reseña? Se recalculará el rating del curso.')) return;
  try {
    await deleteReview(reviewId, courseId);
    state.reviews = await getAllReviews();
    renderReviews();
    showToast('Reseña eliminada.', 'success');
  } catch {
    showToast('Error al eliminar la reseña.', 'error');
  }
}

// ─── Acciones principales ──────────────────────────────────────
async function handleAction(action, courseId) {
  const course = state.courses.find(c => c.courseId === courseId);
  if (!course) return;

  if (action === 'approve') {
    if (!confirm(`¿Aprobar y publicar "${course.title}"?`)) return;
    try {
      await approveCourse(courseId);
      await createNotification(
        course.teacherId, 'course_approved',
        '¡Tu curso fue aprobado!',
        `"${course.title}" ya está publicado en el catálogo.`,
        courseId
      );
      await notifyStudents(course, `El curso "${course.title}" se actualizó y volvió a publicarse. Seguí disfrutando de tus clases.`, 'course_updated');
      showToast('Curso aprobado y publicado.', 'success');
      await loadData();
    } catch (err) { console.error(err); showToast('Error al aprobar.', 'error'); }
  }

  else if (action === 'reject') {
    state.rejectTarget = course;
    document.getElementById('reject-course-name').textContent = course.title;
    document.getElementById('reject-reason').value = '';
    document.getElementById('modal-reject').classList.remove('hidden');
  }

  else if (action === 'delete') {
    await handleDelete(course);
  }

  else if (action === 'archive') {
    await handleArchive(course);
  }
}

async function handleDelete(course) {
  const students = course.totalStudents || 0;
  if (students > 0) {
    showToast('Este curso tiene alumnos comprados. Usá "Archivar" para que conserven el acceso.', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar definitivamente "${course.title}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteCourse(course.courseId);
    try { await deleteCloudinaryFolder(`cursos-sym/${course.teacherId}/${course.courseId}`); } catch (e) { console.warn('Cloudinary:', e); }
    showToast('Curso eliminado.', 'success');
    await loadData();
  } catch (err) { console.error(err); showToast('Error al eliminar.', 'error'); }
}

async function handleArchive(course) {
  if (!confirm(`¿Archivar "${course.title}"?\n\nSaldrá del catálogo y la moderación, pero los ${course.totalStudents || 0} alumnos comprados seguirán accediendo.`)) return;
  try {
    await archiveCourse(course.courseId);
    await createNotification(
      course.teacherId, 'course_archived',
      'Tu curso fue archivado',
      `"${course.title}" ya no está disponible para nuevos compradores.`,
      course.courseId
    );
    await notifyStudents(course, `El curso "${course.title}" fue archivado. Seguís teniendo acceso a tus clases.`);
    showToast('Curso archivado.', 'success');
    await loadData();
  } catch (err) { console.error(err); showToast('Error al archivar.', 'error'); }
}

async function notifyStudents(course, message, type = 'course_removed') {
  try {
    const enrolls = await getEnrollmentsByCourse(course.courseId);
    for (const e of enrolls) {
      await createNotification(e.studentId, type, 'Actualización de tu curso', message, course.courseId);
    }
  } catch (err) {
    console.warn('No se pudo notificar a los alumnos:', err);
  }
}

// ─── Rechazo (con limpieza) ────────────────────────────────────
async function handleRejectConfirm() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { showToast('Escribí el motivo del rechazo.', 'warning'); return; }

  const course = state.rejectTarget;
  const btn = document.getElementById('btn-confirm-reject');
  btn.disabled = true;
  btn.textContent = 'Rechazando...';

  try {
    await rejectCourse(course.courseId, reason);
    await clearCourseMediaUrls(course.courseId);
    try { await deleteCloudinaryFolder(`cursos-sym/${course.teacherId}/${course.courseId}`); } catch (e) { console.warn('Cloudinary:', e); }
    await createNotification(
      course.teacherId, 'course_rejected',
      'Tu curso fue rechazado',
      `"${course.title}" fue rechazado. Motivo: ${reason}`,
      course.courseId
    );
    document.getElementById('modal-reject').classList.add('hidden');
    showToast('Curso rechazado.', 'info');
    await loadData();
  } catch (err) {
    console.error(err);
    showToast('Error al rechazar el curso.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar rechazo';
  }
}

// ─── Solicitudes de eliminación ────────────────────────────────
function openRequestsModal() {
  renderRequests();
  document.getElementById('modal-requests').classList.remove('hidden');
}

function renderRequests() {
  const list = document.getElementById('requests-list');
  if (!list) return;

  if (!state.requests.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">No hay solicitudes pendientes.</p>`;
    return;
  }

  list.innerHTML = state.requests.map(r => {
    const course = state.courses.find(c => c.courseId === r.relatedCourseId);
    const students = course?.totalStudents || 0;
    const teacher  = course?.teacherName || '—';
    const title    = course?.title || 'Curso (eliminado)';
    return `
      <div class="card" style="padding:1rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <div style="font-weight:600;font-size:.9375rem;">${title}</div>
            <div style="font-size:.8125rem;color:var(--text-muted);">Profesor: ${teacher}</div>
            <div style="font-size:.8125rem;color:var(--text-muted);margin-top:.375rem;">
              ${students > 0
                ? `<span style="color:var(--warning);">${students} alumnos comprados</span> → se archivará (conservan acceso)`
                : '<span style="color:var(--success);">Sin alumnos</span> → se eliminará definitivamente'}
            </div>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-req-action="${students > 0 ? 'archive' : 'delete'}" data-id="${r.id}" data-course="${r.relatedCourseId}">
              ${students > 0 ? 'Archivar' : 'Eliminar definitivamente'}
            </button>
            <button class="btn btn-ghost btn-sm" data-req-action="dismiss" data-id="${r.id}">Descartar</button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-req-action]').forEach(btn => {
    btn.addEventListener('click', () => handleRequestAction(btn.dataset.reqAction, btn.dataset.id, btn.dataset.course));
  });
}

async function handleRequestAction(action, notifId, courseId) {
  const course = state.courses.find(c => c.courseId === courseId);

  try {
    if (action === 'dismiss') {
      await deleteNotification(notifId);
      showToast('Solicitud descartada.', 'info');
    } else if (action === 'archive' && course) {
      if (!confirm(`¿Archivar "${course.title}"?`)) return;
      await archiveCourse(courseId);
      await createNotification(course.teacherId, 'course_archived', 'Tu curso fue archivado', `"${course.title}" ya no está disponible para nuevos compradores.`, courseId);
      await notifyStudents(course, `El curso "${course.title}" fue archivado. Seguís teniendo acceso a tus clases.`);
      await deleteNotification(notifId);
      showToast('Curso archivado.', 'success');
    } else if (action === 'delete' && course) {
      if (!confirm(`¿Eliminar definitivamente "${course.title}"?`)) return;
      await deleteCourse(courseId);
      try { await deleteCloudinaryFolder(`cursos-sym/${course.teacherId}/${courseId}`); } catch (e) { console.warn('Cloudinary:', e); }
      await createNotification(course.teacherId, 'course_deleted', 'Tu curso fue eliminado', `"${course.title}" fue eliminado definitivamente.`, courseId);
      await deleteNotification(notifId);
      showToast('Curso eliminado.', 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('Error al procesar la solicitud.', 'error');
  }

  await loadData();
  renderRequests();
}

function renderRequestsBadge() {
  const badge = document.getElementById('requests-badge');
  if (!badge) return;
  if (state.requests.length) {
    badge.textContent = state.requests.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ─── Solicitudes de republicación ─────────────────────────────
function openRepublishModal() {
  renderRepublish();
  document.getElementById('modal-republish').classList.remove('hidden');
}

function renderRepublish() {
  const list = document.getElementById('republish-list');
  if (!list) return;

  if (!state.rePublish.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">No hay solicitudes pendientes.</p>`;
    return;
  }

  list.innerHTML = state.rePublish.map(r => {
    const course = state.courses.find(c => c.courseId === r.relatedCourseId);
    const teacher  = course?.teacherName || '—';
    const title    = course?.title || 'Curso (eliminado)';
    return `
      <div class="card" style="padding:1rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <div style="font-weight:600;font-size:.9375rem;">${title}</div>
            <div style="font-size:.8125rem;color:var(--text-muted);">Profesor: ${teacher}</div>
            <div style="font-size:.8125rem;color:var(--text-muted);margin-top:.375rem;">
              Curso archivado → volverá al catálogo y recibirá nuevos compradores.
            </div>
          </div>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-repub-action="approve" data-id="${r.id}" data-course="${r.relatedCourseId}">
              Aprobar (publicar)
            </button>
            <button class="btn btn-ghost btn-sm" data-repub-action="dismiss" data-id="${r.id}">Descartar</button>
          </div>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-repub-action]').forEach(btn => {
    btn.addEventListener('click', () => handleRepublishAction(btn.dataset.repubAction, btn.dataset.id, btn.dataset.course));
  });
}

async function handleRepublishAction(action, notifId, courseId) {
  const course = state.courses.find(c => c.courseId === courseId);

  try {
    if (action === 'dismiss') {
      await deleteNotification(notifId);
      showToast('Solicitud descartada.', 'info');
    } else if (action === 'approve' && course) {
      if (!confirm(`¿Volver a publicar "${course.title}"?\n\nVolverá a estar disponible en el catálogo para nuevos compradores.`)) return;
      await approveCourse(courseId);
      await createNotification(course.teacherId, 'course_republished', 'Tu curso volvió a publicarse', `"${course.title}" está nuevamente disponible en el catálogo.`, courseId);
      await notifyStudents(course, `El curso "${course.title}" volvió a estar disponible en el catálogo.`);
      await deleteNotification(notifId);
      showToast('Curso republicado.', 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('Error al procesar la solicitud.', 'error');
  }

  await loadData();
  renderRepublish();
}

function renderRepublishBadge() {
  const badge = document.getElementById('republish-badge');
  if (!badge) return;
  if (state.rePublish.length) {
    badge.textContent = state.rePublish.length;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

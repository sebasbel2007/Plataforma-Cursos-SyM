// File: plataforma cursos SyM/assets/js/dashboard-teacher.js

import { requireRole, logout, showToast, formatARS, formatDate, getInitials } from './app.js';
import { renderDashboardSidebar } from './chrome.js';
import {
  getCoursesByTeacher, submitCourseForReview, deleteCourse, createNotification,
  getTransactionsByTeacher, listenNotifications, getCourseReviews,
  createCategory, getCategories
} from './db.js';
import { initNotifications } from './notifications.js';
import { deleteCloudinaryFolder } from './storage.js';

let currentUser = null;
let courses      = [];

let _courseFilter = 'all';
let _courseSearch  = '';

// ─── Init ─────────────────────────────────────────────────────
requireRole('teacher').then(async ({ user, userData }) => {
  currentUser = { ...userData, uid: user.uid };
  renderDashboardSidebar('teacher', 'panel');
  _setSidebarUser();
  initNotifications(user.uid);
  _bindNotifActivity(user.uid);
  _bindViews();
  await _loadAll();
  await _renderReviews();
  _bindLogout();
});

// ─── Vistas (secciones del sidebar) ────────────────────────────
function _setView(view) {
  ['panel', 'courses', 'reviews', 'activity'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== view);
  });
  document.querySelectorAll('.sidebar-link[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  if (view === 'courses') _renderCourses();
  if (view === 'reviews') _renderReviews();
}

function _bindViews() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      _setView(el.dataset.view);
    });
  });

  document.querySelectorAll('[data-course-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-course-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _courseFilter = btn.dataset.courseTab;
      _renderCourses();
    });
  });

  const search = document.getElementById('courses-search');
  search?.addEventListener('input', (e) => {
    _courseSearch = e.target.value.trim().toLowerCase();
    _renderCourses();
  });
}

// ─── Sidebar ──────────────────────────────────────────────────
function _setSidebarUser() {
  const name = document.getElementById('sidebar-name');
  const init = document.getElementById('sidebar-initials');
  const msg  = document.getElementById('welcome-msg');
  if (name) name.textContent = currentUser.displayName || currentUser.email;
  if (init) init.textContent = getInitials(currentUser.displayName || currentUser.email);
  if (msg)  msg.textContent  = `Bienvenido, ${currentUser.displayName?.split(' ')[0] || 'Profesor'}`;
}

// ─── Carga principal ──────────────────────────────────────────
async function _loadAll() {
  try {
    [courses] = await Promise.all([
      getCoursesByTeacher(currentUser.uid)
    ]);
    const transactions = await getTransactionsByTeacher(currentUser.uid);
    _renderStats(transactions);
    _renderCourses();
  } catch (err) {
    console.error(err);
    showToast('Error al cargar el panel.', 'error');
  }
}

// ─── Stats ────────────────────────────────────────────────────
function _renderStats(transactions) {
  const published  = courses.filter(c => c.status === 'published');
  const students   = published.reduce((acc, c) => acc + (c.totalStudents || 0), 0);
  const earnings   = transactions
    .filter(t => t.status === 'completed' && t.type === 'course_purchase')
    .reduce((acc, t) => acc + (t.teacherAmount || 0), 0);

  _setText('stat-total',     courses.length);
  _setText('stat-published', published.length);
  _setText('stat-students',  students);
  _setText('stat-earnings',  formatARS(earnings));
}

// ─── Lista de cursos ──────────────────────────────────────────
function _renderCourses() {
  const loading = document.getElementById('courses-loading');
  const list    = document.getElementById('courses-list');
  const empty   = document.getElementById('courses-empty');
  const filterEmpty = document.getElementById('courses-filter-empty');
  const count   = document.getElementById('courses-count');

  loading?.classList.add('hidden');
  empty?.classList.add('hidden');
  filterEmpty?.classList.add('hidden');
  list?.classList.add('hidden');

  if (!courses.length) {
    empty?.classList.remove('hidden');
    return;
  }

  const filtered = courses.filter(c => {
    const okStatus = _courseFilter === 'all' || c.status === _courseFilter;
    const okSearch = !_courseSearch || (c.title || '').toLowerCase().includes(_courseSearch);
    return okStatus && okSearch;
  });

  if (count) count.textContent = `${filtered.length} de ${courses.length} curso${courses.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    filterEmpty?.classList.remove('hidden');
    return;
  }

  const statusLabel = { draft: 'Borrador', pending: 'En revisión', published: 'Publicado', rejected: 'Rechazado', removed: 'Archivado' };
  const statusClass = { draft: 'status-draft', pending: 'status-pending', published: 'status-published', rejected: 'status-rejected', removed: 'status-rejected' };

  list.innerHTML = filtered.map(c => {
    const canSubmit = c.status === 'draft' || c.status === 'rejected';
    const canDelete = c.status === 'draft' || c.status === 'rejected';
    const canRequestDelete = c.status === 'published';
    const canRequestRePublish = c.status === 'removed';
    return `
      <div class="course-row">
        <div style="width:56px;height:40px;border-radius:var(--radius-sm);overflow:hidden;background:var(--bg-secondary);flex-shrink:0;">
          ${c.thumbnailURL
            ? `<img src="${c.thumbnailURL}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.625rem;">Sin img</div>`}
        </div>
        <div style="overflow:hidden;">
          <div style="font-weight:600;font-size:.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.title}</div>
          <div style="font-size:.75rem;color:var(--text-muted);">${c.category || 'Sin categoría'} · ${c.totalStudents || 0} alumnos</div>
          ${c.status === 'rejected' && c.rejectionReason
            ? `<div style="font-size:.75rem;color:var(--error);margin-top:.25rem;">Motivo: ${c.rejectionReason}</div>`
            : ''}
          ${c.status === 'removed'
            ? `<div style="font-size:.75rem;color:var(--warning);margin-top:.25rem;">Archivado — ya no recibe nuevos compradores; tus alumnos conservan el acceso.</div>`
            : ''}
        </div>
        <span class="status-badge ${statusClass[c.status] || 'status-draft'}">${statusLabel[c.status] || c.status}</span>
        <span style="font-size:.8125rem;color:var(--text-muted);">${c.isFree ? 'Gratis' : formatARS(c.price || 0)}</span>
        <div style="display:flex;gap:.5rem;">
          <a href="course-editor.html?id=${c.courseId}" class="btn btn-secondary btn-sm">Editar</a>
          ${canSubmit
            ? `<button class="btn btn-primary btn-sm" onclick="submitForReview('${c.courseId}')">Enviar a revisión</button>`
            : ''}
          ${canDelete
            ? `<button class="btn btn-ghost btn-sm" onclick="deleteCourseAction('${c.courseId}')" style="color:var(--error);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Eliminar</button>`
            : ''}
          ${canRequestDelete
            ? `<button class="btn btn-ghost btn-sm" onclick="requestCourseDeletion('${c.courseId}')" style="color:var(--warning);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg> Solicitar eliminar</button>`
            : ''}
          ${canRequestRePublish
            ? `<button class="btn btn-ghost btn-sm" onclick="requestRePublish('${c.courseId}')" style="color:var(--success);"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"/></svg> Solicitar republicación</button>`
            : ''}
        </div>
      </div>`;
  }).join('');

  list?.classList.remove('hidden');
}

// ─── Solicitar eliminar curso publicado ───────────────────────
window.requestCourseDeletion = async (courseId) => {
  const course = courses.find(c => c.courseId === courseId);
  if (!course) return;
  if (!confirm(
    `¿Solicitar eliminar "${course.title}"?\n\nEl admin lo revisará: si hay alumnos comprados, el curso se archivará (ellos conservan el acceso); si no, se eliminará definitivamente.`
  )) return;

  try {
    await createNotification(
      'admin', 'course_delete_request',
      'Solicitud de eliminación de curso',
      `El profesor ${currentUser.displayName || ''} pidió eliminar "${course.title}".`,
      courseId
    );
    showToast('Solicitud enviada al admin.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al enviar la solicitud.', 'error');
  }
};

// ─── Solicitar republicación de curso archivado ───────────────
window.requestRePublish = async (courseId) => {
  const course = courses.find(c => c.courseId === courseId);
  if (!course) return;
  if (!confirm(
    `¿Solicitar volver a publicar "${course.title}"?\n\nEl admin lo revisará y, si lo aprueba, el curso volverá a estar disponible en el catálogo.`
  )) return;

  try {
    await createNotification(
      'admin', 'course_re_publish_request',
      'Solicitud de republicación',
      `El profesor ${currentUser.displayName || ''} pidió volver a publicar "${course.title}".`,
      courseId
    );
    showToast('Solicitud enviada al admin.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Error al enviar la solicitud.', 'error');
  }
};

// ─── Eliminar borrador / curso rechazado ──────────────────────
window.deleteCourseAction = async (courseId) => {
  const course = courses.find(c => c.courseId === courseId);
  if (!course) return;
  if (!confirm(`¿Eliminar definitivamente el borrador "${course.title}"? Esta acción no se puede deshacer.`)) return;

  try {
    // 1) Borrar de Firestore (doc + subcolecciones)
    await deleteCourse(courseId);
    // 2) Borrar la carpeta multimedia en Cloudinary (best-effort)
    try {
      await deleteCloudinaryFolder(`cursos-sym/${currentUser.uid}/${courseId}`);
    } catch (delErr) {
      console.warn('No se pudo borrar la carpeta en Cloudinary:', delErr);
    }
    showToast('Borrador eliminado.', 'success');
    courses = await getCoursesByTeacher(currentUser.uid);
    _renderCourses();
  } catch (err) {
    console.error(err);
    showToast('Error al eliminar el borrador.', 'error');
  }
};

// ─── Enviar a moderación ──────────────────────────────────────
window.submitForReview = async (courseId) => {
  try {
    await submitCourseForReview(courseId);
    showToast('Curso enviado a revisión.', 'success');
    courses = await getCoursesByTeacher(currentUser.uid);
    _renderCourses();
  } catch {
    showToast('Error al enviar el curso.', 'error');
  }
};

// ─── Reseñas de mis cursos ────────────────────────────────────
async function _renderReviews() {
  const container = document.getElementById('teacher-reviews-list');
  const countEl   = document.getElementById('reviews-count');
  if (!container) return;
  try {
    const shown = courses.filter(c => c.status === 'published' || c.status === 'removed');
    const perCourse = await Promise.all(shown.map(async (c) => ({
      course: c, reviews: await getCourseReviews(c.courseId)
    })));

    const all = perCourse
      .flatMap(x => x.reviews.map(r => ({ ...r, courseTitle: x.course.title })))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    if (countEl) countEl.textContent = `${all.length} reseña${all.length === 1 ? '' : 's'}`;

    if (!all.length) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">Todavía no tenés reseñas.</p>`;
      return;
    }

    container.innerHTML = all.slice(0, 20).map(r => `
      <div style="padding:.75rem 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:.25rem;">
          <span style="font-weight:600;font-size:.875rem;">${r.courseTitle}</span>
          <span style="color:var(--warning);font-size:.8125rem;white-space:nowrap;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        </div>
        <p style="font-size:.8125rem;">${r.comment}</p>
        <p style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem;">${formatDate(r.createdAt)}</p>
      </div>`).join('');
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;text-align:center;padding:1rem 0;">No se pudieron cargar las reseñas.</p>`;
  }
}

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

// ─── Logout ───────────────────────────────────────────────────
function _bindLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logout();
    window.location.href = '../../index.html';
  });
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

// ─── TEMPORAL: Seed categorías ───────────────────────────────
const SEED_CATS = [
  { name: 'Programación y Tecnología', slug: 'programacion-tecnologia' },
  { name: 'Diseño y Creatividad',      slug: 'diseno-creatividad' },
  { name: 'Marketing y Negocios',      slug: 'marketing-negocios' },
  { name: 'Finanzas e Inversiones',    slug: 'finanzas-inversiones' },
  { name: 'Fotografía y Video',        slug: 'fotografia-video' },
  { name: 'Música y Audio',            slug: 'musica-audio' },
  { name: 'Cine y Producción',         slug: 'cine-produccion' },
  { name: 'Salud y Bienestar',         slug: 'salud-bienestar' },
  { name: 'Idiomas',                   slug: 'idiomas' },
  { name: 'Educación y Pedagogía',     slug: 'educacion-pedagogia' },
  { name: 'Arte y Manualidades',       slug: 'arte-manualidades' },
  { name: 'Desarrollo Personal',       slug: 'desarrollo-personal' },
];


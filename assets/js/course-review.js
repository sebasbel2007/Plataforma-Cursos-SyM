// File: plataforma cursos SyM/assets/js/course-review.js
// Revisión integral de cursos para moderadores (admin / sub_admin).
// Muestra TODO el contenido: clases con video y notas, quizzes por módulo
// (con respuestas correctas reveladas), examen final y certificado, más un
// checklist automático de publicación y acciones de aprobar/rechazar.

import { onSessionChange, showToast, formatDate, formatARS } from './app.js';
import { initAdminSidebar } from './admin-utils.js';
import {
  getCourse, getModules, getQuiz, getFinalExam,
  approveCourse, rejectCourse, clearCourseMediaUrls, createNotification, getEnrollmentsByCourse
} from './db.js';
import { deleteCloudinaryFolder } from './storage.js';

const STATUS_LABEL = { draft: 'Borrador', pending: 'En revisión', published: 'Publicado', rejected: 'Rechazado', removed: 'Archivado' };
const STATUS_CLASS = { draft: 'status-draft', pending: 'status-pending', published: 'status-published', rejected: 'status-rejected', removed: 'status-rejected' };

const OPTS = ['a', 'b', 'c', 'd'];

const ICON_CHECK  = '<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--success);"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
const ICON_WARN   = '<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--warning);"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
const ICON_BAD    = '<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--error);"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
const ICON_PLAY   = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);flex-shrink:0;"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const ICON_CHEVRON = '<svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;transition:transform .2s ease;color:var(--text-muted);"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

const state = {
  course: null,
  modules: [],
  exam: null,
  rejectTarget: null
};

onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'admin' && session.userData?.role !== 'sub_admin') {
    window.location.href = '../dashboard-admin/index.html';
    return;
  }

  await initAdminSidebar(session.user, session.userData, 'courses');

  const params   = new URLSearchParams(window.location.search);
  const courseId = params.get('id');

  if (!courseId) return showError();

  bindEvents();
  await load(courseId);
});

function bindEvents() {
  document.getElementById('btn-cancel-reject').addEventListener('click', () => {
    document.getElementById('modal-reject').classList.add('hidden');
  });
  document.getElementById('modal-reject').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
  document.getElementById('btn-confirm-reject').addEventListener('click', handleRejectConfirm);
  document.getElementById('btn-approve').addEventListener('click', handleApprove);
  document.getElementById('btn-reject').addEventListener('click', openRejectModal);
}

// ─── Sub-navegación sticky ─────────────────────────────────────
function initSubnav() {
  const btns    = document.querySelectorAll('.subnav-btn');
  const section = id => document.getElementById(id);

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = section(btn.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      let active = btns[0]?.dataset.target || null;
      btns.forEach(b => {
        const el = section(b.dataset.target);
        if (el && el.getBoundingClientRect().top <= 92) active = b.dataset.target;
      });
      btns.forEach(b => b.classList.toggle('active', b.dataset.target === active));
    });
  }, { passive: true });
}

// ─── Carga de datos ────────────────────────────────────────────
async function load(courseId) {
  const loading = document.getElementById('review-loading');

  try {
    const course = await getCourse(courseId);
    if (!course) return showError();

    state.course = course;

    const modules = await getModules(courseId);
    state.modules = await Promise.all(modules.map(async m => {
      const quiz = await getQuiz(courseId, m.moduleId);
      return { ...m, quiz: quiz || null };
    }));
    state.exam = await getFinalExam(courseId);

    loading.classList.add('hidden');
    document.getElementById('review-content').classList.remove('hidden');

    initSubnav();
    renderHeader();
    renderChecklist();
    renderWarnings();
    renderModules();
    renderExam();
    renderCertificate();
  } catch (err) {
    console.error(err);
    loading.classList.add('hidden');
    showError();
  }
}

function showError() {
  document.getElementById('review-loading').classList.add('hidden');
  document.getElementById('review-error').classList.remove('hidden');
}

// ─── Cabecera ──────────────────────────────────────────────────
function renderHeader() {
  const c = state.course;

  document.getElementById('review-title').textContent = c.title || 'Sin título';

  const badge = document.getElementById('review-status-badge');
  badge.textContent = STATUS_LABEL[c.status] || c.status;
  badge.className = `status-badge ${STATUS_CLASS[c.status] || 'status-draft'}`;
  badge.classList.remove('hidden');

  document.getElementById('review-meta').innerHTML = `
    Por <strong style="color:var(--text-secondary);">${escHtml(c.teacherName || '—')}</strong>
    · ${escHtml(c.category || 'Sin categoría')}
    · ${c.isFree ? 'Gratis' : formatARS(c.price || 0)}
    · Creado ${formatDate(c.createdAt)}
  `;

  const totalLessons = state.modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
  const quizCount    = state.modules.filter(m => m.quiz?.questions?.length).length;
  const examCount    = state.exam?.questions?.length || 0;
  document.getElementById('review-stats').innerHTML = `
    <span>${state.modules.length} módulos</span> ·
    <span>${totalLessons} clases</span> ·
    <span>${quizCount}/${state.modules.length} módulos con quiz</span> ·
    <span>${examCount} preguntas de examen</span> ·
    <span>${c.totalStudents || 0} alumnos</span>
  `;

  document.getElementById('btn-preview').href = `../course/course-detail.html?id=${c.courseId}&preview=1`;

  const rejection = document.getElementById('review-rejection');
  if (c.status === 'rejected' && c.rejectionReason) {
    rejection.textContent = `Motivo del rechazo: ${c.rejectionReason}`;
    rejection.classList.remove('hidden');
  }

  if (c.status === 'pending') {
    document.getElementById('review-actions').classList.remove('hidden');
  }
}

// ─── Validez de quizzes / examen ───────────────────────────────
function isValidQuestion(q) {
  return !!(q && q.text && q.options &&
    OPTS.every(k => typeof q.options[k] === 'string' && q.options[k].trim()) &&
    OPTS.includes(q.correctOption));
}

function isQuizValid(quiz) {
  return !!(quiz && quiz.questions && quiz.questions.length > 0 && quiz.questions.every(isValidQuestion));
}

// ─── Checklist automático ──────────────────────────────────────
function buildChecklist() {
  const c        = state.course;
  const modules  = state.modules;
  const lessons  = modules.flatMap(m => m.lessons || []);
  const noVideo  = lessons.filter(l => !l.videoURL);
  const descLen  = (c.description || '').trim().length;
  const exam     = state.exam;

  const items = [];

  items.push({
    label: 'Portada (thumbnail)',
    status: c.thumbnailURL ? 'ok' : 'warn',
    hint: c.thumbnailURL ? 'Imagen de portada cargada' : 'El curso no tiene portada'
  });

  items.push({
    label: 'Video promocional',
    status: c.promoVideoURL ? 'ok' : 'warn',
    hint: c.promoVideoURL ? 'Video promocional cargado' : 'El curso no tiene video promocional'
  });

  items.push({
    label: 'Descripción',
    status: descLen >= 100 ? 'ok' : (descLen > 0 ? 'warn' : 'bad'),
    hint: descLen >= 100 ? `${descLen} caracteres` : (descLen > 0 ? `Muy corta (${descLen} caracteres)` : 'Sin descripción')
  });

  items.push({
    label: 'Categoría asignada',
    status: c.category ? 'ok' : 'warn',
    hint: c.category || 'Sin categoría'
  });

  items.push({
    label: 'Módulos cargados',
    status: modules.length >= 1 ? 'ok' : 'bad',
    hint: modules.length >= 1 ? `${modules.length} módulos` : 'El curso no tiene módulos'
  });

  if (modules.length > 0) {
    items.push({
      label: 'Clases con video',
      status: noVideo.length === 0 ? 'ok' : 'warn',
      hint: noVideo.length === 0
        ? `${lessons.length} clases con video`
        : `${noVideo.length} de ${lessons.length} clases sin video`
    });

    const missingQuiz = modules.filter(m => !m.quiz?.questions?.length);
    const badQuiz     = modules.filter(m => m.quiz?.questions?.length && !isQuizValid(m.quiz));
    items.push({
      label: 'Quizzes por módulo',
      status: missingQuiz.length === 0 && badQuiz.length === 0 ? 'ok' : (missingQuiz.length ? 'bad' : 'warn'),
      hint: missingQuiz.length === 0 && badQuiz.length === 0
        ? 'Todos los módulos tienen quiz válido'
        : `${missingQuiz.length} módulos sin quiz${badQuiz.length ? `, ${badQuiz.length} con quiz incompleto` : ''}`
    });
  }

  const examValid = isQuizValid(exam);
  if (!exam) {
    items.push({
      label: 'Examen final',
      status: c.certificateURL ? 'bad' : 'warn',
      hint: 'El examen final no está configurado'
    });
  } else {
    items.push({
      label: 'Examen final',
      status: examValid ? 'ok' : 'warn',
      hint: examValid ? `${exam.questions.length} preguntas · mínimo ${exam.passingScore || 70}%` : 'Examen incompleto (revisar preguntas)'
    });
  }

  items.push({
    label: 'Certificado',
    status: c.certificateURL ? 'ok' : 'warn',
    hint: c.certificateURL ? 'Certificado configurado' : 'No se configuró certificado (los alumnos verán "disponible próximamente")'
  });

  return items;
}

function renderChecklist() {
  const el = document.getElementById('review-checklist');
  const items = buildChecklist();
  el.innerHTML = items.map(it => `
    <div class="check-item">
      ${it.status === 'ok' ? ICON_CHECK : (it.status === 'warn' ? ICON_WARN : ICON_BAD)}
      <div style="flex:1;">
        <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);">${it.label}</div>
        <div style="font-size:.8125rem;color:var(--text-muted);">${escHtml(it.hint)}</div>
      </div>
      <span style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.03em;flex-shrink:0;align-self:center;
        ${it.status === 'ok' ? 'color:var(--success);' : (it.status === 'warn' ? 'color:var(--warning);' : 'color:var(--error);')}">
        ${it.status === 'ok' ? 'OK' : (it.status === 'warn' ? 'Aviso' : 'Falta')}
      </span>
    </div>`).join('');
}

// ─── Advertencias destacadas ───────────────────────────────────
function renderWarnings() {
  const c       = state.course;
  const lessons = state.modules.flatMap(m => m.lessons || []);
  const banners = [];

  const noVideo = lessons.filter(l => !l.videoURL);
  if (noVideo.length) {
    banners.push({
      level: 'warn',
      text: `<strong>${noVideo.length} clase${noVideo.length !== 1 ? 's' : ''} sin video:</strong> ${noVideo.map(l => escHtml(l.title)).slice(0, 5).join(', ')}${noVideo.length > 5 ? ` y ${noVideo.length - 5} más.` : '.'}`
    });
  }

  state.modules.forEach(m => {
    if (!m.quiz?.questions?.length) {
      banners.push({ level: 'warn', text: `<strong>Sin quiz en el módulo "${escHtml(m.title)}".</strong>` });
    }
  });

  const allQuestions = [
    ...state.modules.flatMap(m => (m.quiz?.questions || []).map(q => ({ where: `quiz de "${m.title}"`, ...q }))),
    ...(state.exam?.questions || []).map(q => ({ where: 'examen final', ...q }))
  ];
  const invalid = allQuestions.filter(q => !isValidQuestion(q));
  if (invalid.length) {
    banners.push({
      level: 'bad',
      text: `<strong>${invalid.length} pregunta${invalid.length !== 1 ? 's' : ''} incompleta${invalid.length !== 1 ? 's' : ''} (sin opciones o sin respuesta correcta):</strong> ${invalid.slice(0, 4).map(q => `${escHtml(q.text || 'sin texto')} (${q.where})`).join('; ')}${invalid.length > 4 ? '...' : '.'}`
    });
  }

  if (!state.exam?.questions?.length) {
    banners.push({ level: 'warn', text: '<strong>El examen final no está configurado.</strong> Los alumnos no podrán obtener certificado.' });
  }

  if (c.certificateURL && !state.exam?.questions?.length) {
    banners.push({ level: 'bad', text: '<strong>Se promete certificado pero no hay examen final.</strong>' });
  }

  if (c.status === 'pending' && banners.length === 0) {
    banners.push({ level: 'ok', text: '<strong>Sin advertencias.</strong> El curso está completo para revisión.' });
  }

  const wrap = document.getElementById('review-warnings');
  wrap.innerHTML = banners.map(b => {
    const color = b.level === 'ok' ? 'var(--success)' : (b.level === 'warn' ? 'var(--warning)' : 'var(--error)');
    const dim   = b.level === 'ok' ? 'var(--success-dim)' : (b.level === 'warn' ? 'var(--warning-dim)' : 'var(--error-dim)');
    return `
      <div style="background:${dim};border:1px solid ${color};border-radius:var(--radius-md);padding:.875rem 1.1rem;margin-bottom:.75rem;font-size:.875rem;color:var(--text-primary);line-height:1.6;display:flex;gap:.625rem;align-items:flex-start;">
        ${b.level === 'ok' ? ICON_CHECK : (b.level === 'warn' ? ICON_WARN : ICON_BAD)}
        <div>${b.text}</div>
      </div>`;
  }).join('');
}

// ─── Contenido (módulos, clases, quizzes) ──────────────────────
function renderModules() {
  const el = document.getElementById('review-modules');

  if (!state.modules.length) {
    el.innerHTML = `
      <div class="card" style="padding:2rem;text-align:center;color:var(--text-muted);font-size:.875rem;">
        Este curso no tiene módulos cargados.
      </div>`;
    return;
  }

  el.innerHTML = state.modules.map((mod, i) => {
    const lessons = mod.lessons || [];
    const quizOk  = isQuizValid(mod.quiz);
    const hasQuiz = !!(mod.quiz?.questions?.length);

    const quizBadge = !hasQuiz
      ? '<span style="font-size:.6875rem;font-weight:700;padding:.25rem .625rem;border-radius:999px;background:var(--warning-dim);color:var(--warning);text-transform:uppercase;">Sin quiz</span>'
      : quizOk
        ? '<span style="font-size:.6875rem;font-weight:700;padding:.25rem .625rem;border-radius:999px;background:var(--success-dim);color:var(--success);text-transform:uppercase;">Quiz OK</span>'
        : '<span style="font-size:.6875rem;font-weight:700;padding:.25rem .625rem;border-radius:999px;background:var(--error-dim);color:var(--error);text-transform:uppercase;">Quiz incompleto</span>';

    return `
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:1rem;">
        <button class="mod-toggle" onclick="this.nextElementSibling.classList.toggle('hidden');this.querySelector('.chevron').style.transform=this.nextElementSibling.classList.contains('hidden')?'rotate(0deg)':'rotate(180deg)';">
          <span style="display:flex;align-items:center;gap:.625rem;min-width:0;">
            <span style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;">${i + 1}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(mod.title || 'Sin título')}</span>
          </span>
          <span style="display:flex;align-items:center;gap:.625rem;flex-shrink:0;">
            <span style="font-size:.75rem;color:var(--text-muted);font-weight:500;">${lessons.length} clases</span>
            ${quizBadge}
            ${ICON_CHEVRON}
          </span>
        </button>

        <div class="hidden">
          ${lessons.map((l, li) => `
            <div style="padding:1rem 1.25rem;border-top:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:.625rem;">
                ${ICON_PLAY}
                <span style="font-size:.875rem;font-weight:600;color:var(--text-primary);flex:1;min-width:0;">${escHtml(l.title || `Clase ${li + 1}`)}</span>
                ${l.videoURL
                  ? '<span style="font-size:.6875rem;font-weight:700;padding:.25rem .625rem;border-radius:999px;background:var(--success-dim);color:var(--success);text-transform:uppercase;flex-shrink:0;">Con video</span>'
                  : '<span style="font-size:.6875rem;font-weight:700;padding:.25rem .625rem;border-radius:999px;background:var(--error-dim);color:var(--error);text-transform:uppercase;flex-shrink:0;">Sin video</span>'}
              </div>
              ${l.videoURL ? `
                <div style="margin-top:.75rem;">
                  <video src="${l.videoURL}" controls controlsList="nodownload" preload="metadata"
                    style="width:100%;aspect-ratio:16/9;background:#000;border-radius:var(--radius-md);display:block;"
                    poster="${state.course.thumbnailURL || ''}"></video>
                </div>` : ''}
              ${l.content && l.content.trim() ? `
                <div class="lesson-notes">${escHtml(l.content)}</div>` : ''}
            </div>`).join('')}

          ${renderQuizBlock(mod, i)}
        </div>
      </div>`;
  }).join('');
}

function renderQuizBlock(mod, modIdx) {
  const quiz = mod.quiz;

  if (!quiz || !quiz.questions?.length) {
    return `
      <div style="padding:1rem 1.25rem;border-top:1px solid var(--border);background:var(--warning-dim);">
        <span style="font-size:.8125rem;color:var(--warning);font-weight:600;">No hay quiz configurado para este módulo.</span>
      </div>`;
  }

  return `
    <div style="border-top:1px solid var(--border);background:var(--bg-secondary);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:.875rem 1.25rem;">
        <span style="font-size:.8125rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.03em;">Quiz del módulo ${modIdx + 1}</span>
        <span style="font-size:.75rem;color:var(--text-muted);">${quiz.questions.length} preguntas · Mínimo para aprobar: ${quiz.passingScore || 70}%</span>
      </div>
      ${quiz.questions.map((q, qi) => `
        <div style="padding:1rem 1.25rem;border-top:1px solid var(--border);">
          <p style="font-weight:600;margin-bottom:.75rem;font-size:.875rem;line-height:1.5;">${qi + 1}. ${escHtml(q.text)}</p>
          <div style="display:flex;flex-direction:column;gap:.5rem;">
            ${OPTS.map(opt => {
              const correct = opt === q.correctOption;
              const label   = q.options && q.options[opt];
              return `
                <div style="display:flex;align-items:center;gap:.625rem;padding:.625rem .875rem;border-radius:var(--radius-md);font-size:.8125rem;
                  ${correct
                    ? 'background:var(--success-dim);border:1px solid var(--success);color:var(--text-primary);'
                    : 'background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);'}">
                  <span style="font-weight:700;flex-shrink:0;${correct ? 'color:var(--success);' : 'color:var(--text-muted);'}">${opt.toUpperCase()}.</span>
                  <span style="flex:1;">${escHtml(label || '—')}</span>
                  ${correct
                    ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--success);flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
                    : ''}
                </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

// ─── Examen final ──────────────────────────────────────────────
function renderExam() {
  const el = document.getElementById('review-exam');
  const exam = state.exam;

  if (!exam || !exam.questions?.length) {
    el.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:.875rem;display:flex;align-items:center;justify-content:center;gap:.625rem;">
        ${ICON_WARN}
        <span>No hay examen final configurado.</span>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);">
      <span style="font-size:.8125rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.03em;">Examen final</span>
      <span style="font-size:.75rem;color:var(--text-muted);">${exam.questions.length} preguntas · Mínimo para aprobar: ${exam.passingScore || 70}%</span>
    </div>
    ${exam.questions.map((q, qi) => `
      <div style="padding:1.25rem;border-top:1px solid var(--border);">
        <p style="font-weight:600;margin-bottom:1rem;font-size:.9375rem;line-height:1.5;">${qi + 1}. ${escHtml(q.text)}</p>
        <div style="display:flex;flex-direction:column;gap:.5rem;">
          ${OPTS.map(opt => {
            const correct = opt === q.correctOption;
            const label   = q.options && q.options[opt];
            return `
              <div style="display:flex;align-items:center;gap:.625rem;padding:.625rem .875rem;border-radius:var(--radius-md);font-size:.875rem;
                ${correct
                  ? 'background:var(--success-dim);border:1px solid var(--success);color:var(--text-primary);'
                  : 'background:var(--bg-card);border:1px solid var(--border);color:var(--text-secondary);'}">
                <span style="font-weight:700;flex-shrink:0;${correct ? 'color:var(--success);' : 'color:var(--text-muted);'}">${opt.toUpperCase()}.</span>
                <span style="flex:1;">${escHtml(label || '—')}</span>
                ${correct
                  ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="color:var(--success);flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
                  : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`).join('')}`;
}

// ─── Certificado ───────────────────────────────────────────────
function renderCertificate() {
  const el = document.getElementById('review-certificate');
  const c  = state.course;

  if (c.certificateURL) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding:1.25rem;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          ${ICON_CHECK}
          <div>
            <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);">Certificado configurado</div>
            <div style="font-size:.8125rem;color:var(--text-muted);">Los alumnos podrán descargarlo tras aprobar el examen final.</div>
          </div>
        </div>
        <a href="${c.certificateURL}" target="_blank" class="btn btn-ghost btn-sm" style="text-decoration:none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="margin-right:.375rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Ver certificado
        </a>
      </div>`;
  } else {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;padding:1.25rem;">
        ${ICON_WARN}
        <div>
          <div style="font-size:.875rem;font-weight:600;color:var(--warning);">No se configuró certificado</div>
          <div style="font-size:.8125rem;color:var(--text-muted);">Los alumnos verán "El certificado estará disponible próximamente" al aprobar el examen.</div>
        </div>
      </div>`;
  }
}

// ─── Aprobar / Rechazar ────────────────────────────────────────
async function notifyEnrolledStudents(course) {
  try {
    const enrolls = await getEnrollmentsByCourse(course.courseId);
    if (!enrolls.length) return;
    await Promise.all(enrolls.map(e => createNotification(
      e.studentId, 'course_updated',
      'Tu curso fue actualizado',
      `"${course.title}" se actualizó y volvió a publicarse. Seguí disfrutando de tus clases.`,
      course.courseId
    )));
  } catch (err) {
    console.warn('notifyEnrolledStudents:', err);
  }
}

async function handleApprove() {
  const c = state.course;
  if (!confirm(`¿Aprobar y publicar "${c.title}"?`)) return;

  const btn = document.getElementById('btn-approve');
  btn.disabled = true;
  btn.textContent = 'Aprobando...';

  try {
    await approveCourse(c.courseId);
    await createNotification(
      c.teacherId, 'course_approved',
      '¡Tu curso fue aprobado!',
      `"${c.title}" ya está publicado en el catálogo.`,
      c.courseId
    );
    await notifyEnrolledStudents(c);
    showToast('Curso aprobado y publicado.', 'success');
    setTimeout(() => { window.location.href = 'courses.html'; }, 900);
  } catch (err) {
    console.error(err);
    showToast('Error al aprobar el curso.', 'error');
    btn.disabled = false;
    btn.textContent = 'Aprobar y publicar';
  }
}

function openRejectModal() {
  state.rejectTarget = state.course;
  document.getElementById('reject-course-name').textContent = state.course.title;
  document.getElementById('reject-reason').value = '';
  document.getElementById('modal-reject').classList.remove('hidden');
}

async function handleRejectConfirm() {
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) { showToast('Escribí el motivo del rechazo.', 'warning'); return; }

  const c = state.course;
  const btn = document.getElementById('btn-confirm-reject');
  btn.disabled = true;
  btn.textContent = 'Rechazando...';

  try {
    await rejectCourse(c.courseId, reason);
    await clearCourseMediaUrls(c.courseId);
    try { await deleteCloudinaryFolder(`cursos-sym/${c.teacherId}/${c.courseId}`); } catch (e) { console.warn('Cloudinary:', e); }
    await createNotification(
      c.teacherId, 'course_rejected',
      'Tu curso fue rechazado',
      `"${c.title}" fue rechazado. Motivo: ${reason}`,
      c.courseId
    );
    document.getElementById('modal-reject').classList.add('hidden');
    showToast('Curso rechazado.', 'info');
    setTimeout(() => { window.location.href = 'courses.html'; }, 900);
  } catch (err) {
    console.error(err);
    showToast('Error al rechazar el curso.', 'error');
    btn.disabled = false;
    btn.textContent = 'Confirmar rechazo';
  }
}

// ─── Utilidad ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

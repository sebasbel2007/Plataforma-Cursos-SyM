// File: plataforma cursos SyM/assets/js/course-player.js
// Parte 2 — Guard, carga, índice, navegación

import { onSessionChange, showToast, getInitials, logout } from './app.js';
import {
  getCourse, getModules, getQuiz,
  getEnrollment, completeLesson, completeModule,
  saveQuizResult, addComment, listenComments,
  addForumPost, addForumReply, getForumPosts
} from './db.js';
import { renderCloudinaryVideo } from './storage.js';

// ─── Estado global del player ─────────────────────────────────
const state = {
  courseId: null,
  course: null,
  modules: [],
  enrollment: null,
  currentModuleIndex: 0,
  currentLessonIndex: 0,
  currentUser: null,
  currentUserData: null,
  unsubComments: null,
  quizAnswers: {}
};

// ─── Init ─────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
state.courseId = params.get('id') || params.get('courseId');

onSessionChange(async (session) => {
  if (!session) {
    window.location.href = `../auth/login.html?redirect=../course/course-player.html?id=${state.courseId}`;
    return;
  }

  state.currentUser     = session.user;
  state.currentUserData = session.userData;

  document.getElementById('nav-initials').textContent = getInitials(session.userData?.displayName || session.user.email);
  document.getElementById('comment-avatar-initials').textContent = getInitials(session.userData?.displayName || session.user.email);

  document.getElementById('nav-avatar').addEventListener('click', async () => {
    if (confirm('¿Querés cerrar sesión?')) {
      await logout();
      window.location.href = '../../index.html';
    }
  });

  if (!state.courseId) return showError('ID de curso inválido.');

  const [course, enrollment] = await Promise.all([
    getCourse(state.courseId),
    getEnrollment(session.user.uid, state.courseId)
  ]);

  if (!course) return showError('Curso no encontrado.');
  if (!enrollment) return showError('No tenés acceso a este curso. <a href="../course/course-detail.html?id=' + state.courseId + '" class="btn btn-primary btn-sm" style="margin-top:.75rem;">Ver curso</a>');

  state.course     = course;
  state.enrollment = enrollment;
  state.modules    = await getModules(state.courseId);

  document.getElementById('nav-course-title').textContent = course.title;
  document.getElementById('btn-go-exam').href = `../course/course-exam.html?id=${state.courseId}`;

  renderIndex();
  updateProgressBar();

  // Retomar desde la última clase no completada
  const { modIdx, lesIdx } = findResumePoint();
  loadLesson(modIdx, lesIdx);

  document.getElementById('player-loading').classList.add('hidden');
  document.getElementById('player-content').classList.remove('hidden');
});

// ─── Mostrar error ────────────────────────────────────────────
function showError(msg) {
  document.getElementById('player-loading').classList.add('hidden');
  const errEl = document.getElementById('player-error');
  document.getElementById('player-error-msg').innerHTML = msg;
  errEl.classList.remove('hidden');
}

// ─── Encontrar punto de reanudación ──────────────────────────
function findResumePoint() {
  const { completedLessons } = state.enrollment;
  for (let mi = 0; mi < state.modules.length; mi++) {
    const lessons = state.modules[mi].lessons || [];
    for (let li = 0; li < lessons.length; li++) {
      if (!completedLessons.includes(lessons[li].lessonId)) {
        return { modIdx: mi, lesIdx: li };
      }
    }
  }
  return { modIdx: 0, lesIdx: 0 };
}

// ─── Render índice lateral ────────────────────────────────────
function renderIndex() {
  const container = document.getElementById('course-index');
  const { completedModules, completedLessons, quizResults } = state.enrollment;

  container.innerHTML = state.modules.map((mod, mi) => {
    const modCompleted = completedModules.includes(mod.moduleId);
    const modLocked    = mi > 0 && !completedModules.includes(state.modules[mi - 1].moduleId);
    const quizPassed   = quizResults?.[mod.moduleId]?.passed;

    const lessons = (mod.lessons || []).map((les, li) => {
      const lesCompleted = completedLessons.includes(les.lessonId);
      const lesLocked    = modLocked;
      const isActive     = mi === state.currentModuleIndex && li === state.currentLessonIndex;

      let icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
      let cls  = '';
      if (lesLocked) {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';
        cls = 'locked';
      }
      else if (lesCompleted) {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        cls = 'completed';
      }
      if (isActive)     cls += ' active';

      return `<button class="lesson-item ${cls}"
        data-mi="${mi}" data-li="${li}"
        ${lesLocked ? 'disabled' : ''}>
        <span style="font-size:.7rem;flex-shrink:0;display:inline-flex;">${icon}</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${les.title}</span>
      </button>`;
    }).join('');

    const quizRow = !modLocked ? `
      <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 1rem .5rem 1.75rem;font-size:.75rem;color:${quizPassed ? 'var(--success)' : 'var(--accent)'};">
        <span style="display:inline-flex;">${quizPassed
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>'}</span>
        <span>Quiz del módulo${quizPassed ? ' (aprobado)' : ''}</span>
      </div>` : '';

    return `
      <div class="module-item">
        <button class="module-header" data-mi="${mi}">
          <span style="display:flex;align-items:center;gap:.5rem;">
            <span style="font-size:.7rem;color:${modCompleted ? 'var(--success)' : 'var(--text-muted)'};display:inline-flex;">${modCompleted
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
              : (mi + 1)}</span>
            <span>${mod.title}</span>
          </span>
          <svg class="chevron-${mi}" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;transition:transform .2s;color:var(--text-muted);">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="mod-lessons-${mi}" style="${mi === state.currentModuleIndex ? '' : 'display:none;'}">
          ${lessons}
          ${quizRow}
        </div>
      </div>`;
  }).join('');

  // Eventos del índice
  container.querySelectorAll('.module-header').forEach(btn => {
    btn.addEventListener('click', () => {
      const mi   = parseInt(btn.dataset.mi);
      const body = document.getElementById(`mod-lessons-${mi}`);
      const chev = container.querySelector(`.chevron-${mi}`);
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
    });
  });

  container.querySelectorAll('.lesson-item:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      loadLesson(parseInt(btn.dataset.mi), parseInt(btn.dataset.li));
    });
  });
}

// ─── Cargar clase ─────────────────────────────────────────────
async function loadLesson(modIdx, lesIdx) {
  // Ocultar quiz si estaba visible
  document.getElementById('quiz-section').classList.add('hidden');
  document.getElementById('quiz-result').classList.add('hidden');
  document.getElementById('btn-quiz-retry').classList.add('hidden');
  state.quizAnswers = {};

  state.currentModuleIndex = modIdx;
  state.currentLessonIndex = lesIdx;

  const mod    = state.modules[modIdx];
  const lesson = (mod.lessons || [])[lesIdx];
  if (!lesson) return;

  // Topbar
  document.getElementById('lesson-module-label').textContent = `Módulo ${modIdx + 1}: ${mod.title}`;
  document.getElementById('lesson-title').textContent        = lesson.title;
  document.getElementById('lesson-content-text').textContent = lesson.content || '';

  // Video
  const videoContainer = document.getElementById('video-container');
  if (lesson.videoURL) {
    renderCloudinaryVideo('video-container', lesson.videoURL);
  } else {
    videoContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:#555;font-size:.875rem;">Sin video disponible</div>`;
  }

  // Botón marcar como vista
  const btnComplete = document.getElementById('btn-complete-lesson');
  const btnLabel    = document.getElementById('btn-complete-label');
  const alreadyDone = state.enrollment.completedLessons.includes(lesson.lessonId);
  btnLabel.textContent = alreadyDone ? 'Vista' : 'Marcar como vista';
  btnComplete.disabled = alreadyDone;
  btnComplete.style.opacity = alreadyDone ? '.5' : '1';
  btnComplete.onclick      = () => handleCompleteLesson(modIdx, lesIdx);

  // Comentarios
  if (state.unsubComments) state.unsubComments();
  state.unsubComments = listenComments(state.courseId, lesson.lessonId, renderComments);

  // Re-render índice para actualizar activo
  renderIndex();

  // Scroll al top
  document.querySelector('.player-main').scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Marcar clase como vista ──────────────────────────────────
async function handleCompleteLesson(modIdx, lesIdx) {
  const mod    = state.modules[modIdx];
  const lesson = (mod.lessons || [])[lesIdx];

  await completeLesson(state.currentUser.uid, state.courseId, lesson.lessonId);

  // Actualizar estado local
  if (!state.enrollment.completedLessons.includes(lesson.lessonId)) {
    state.enrollment.completedLessons.push(lesson.lessonId);
  }

  const btnComplete = document.getElementById('btn-complete-lesson');
  document.getElementById('btn-complete-label').textContent = 'Vista';
  btnComplete.disabled    = true;
  btnComplete.style.opacity = '.5';

  updateProgressBar();
  renderIndex();

  // Verificar si todas las clases del módulo están completas → mostrar quiz
  const allLessons   = mod.lessons || [];
  const allCompleted = allLessons.every(l => state.enrollment.completedLessons.includes(l.lessonId));

  if (allCompleted && !state.enrollment.quizResults?.[mod.moduleId]?.passed) {
    await loadQuiz(modIdx);
  } else if (allCompleted && state.enrollment.quizResults?.[mod.moduleId]?.passed) {
    // Avanzar a siguiente módulo/clase
    advanceToNext(modIdx, lesIdx);
  } else {
    // Avanzar a siguiente clase del mismo módulo
    advanceToNext(modIdx, lesIdx);
  }
}

// ─── Avanzar a siguiente clase ────────────────────────────────
function advanceToNext(modIdx, lesIdx) {
  const mod     = state.modules[modIdx];
  const lessons = mod.lessons || [];

  if (lesIdx + 1 < lessons.length) {
    loadLesson(modIdx, lesIdx + 1);
  } else if (modIdx + 1 < state.modules.length) {
    const nextModLocked = !state.enrollment.completedModules.includes(mod.moduleId);
    if (!nextModLocked) loadLesson(modIdx + 1, 0);
  }
}

// ─── Barra de progreso ────────────────────────────────────────
function updateProgressBar() {
  const total    = state.course?.totalModules || state.modules.length;
  const done     = state.enrollment.completedModules.length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('nav-progress-text').textContent = `${pct}%`;
  document.getElementById('nav-progress-bar').style.width  = `${pct}%`;

  if (done >= total && total > 0) {
    document.getElementById('exam-banner').classList.remove('hidden');
  }
}

// ─── Cargar quiz ──────────────────────────────────────────────
async function loadQuiz(modIdx) {
  const mod  = state.modules[modIdx];
  const quiz = await getQuiz(state.courseId, mod.moduleId);

  if (!quiz || !quiz.questions?.length) {
    // Sin quiz → completar módulo directamente
    await handleModuleComplete(modIdx);
    return;
  }

  state.quizAnswers = {};
  const section = document.getElementById('quiz-section');
  document.getElementById('quiz-title').textContent = `Quiz — ${mod.title}`;

  document.getElementById('quiz-questions').innerHTML = quiz.questions.map((q, qi) => `
    <div data-qi="${qi}">
      <p style="font-weight:600;margin-bottom:.875rem;font-size:.9375rem;">${qi + 1}. ${q.text}</p>
      <div style="display:flex;flex-direction:column;gap:.5rem;">
        ${['a','b','c','d'].map(opt => `
          <div class="quiz-option" data-qi="${qi}" data-opt="${opt}">
            <span style="font-weight:700;color:var(--accent);flex-shrink:0;">${opt.toUpperCase()}.</span>
            <span>${q.options[opt]}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Eventos de selección
  section.querySelectorAll('.quiz-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const qi = opt.dataset.qi;
      state.quizAnswers[qi] = opt.dataset.opt;
      section.querySelectorAll(`.quiz-option[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.getElementById('btn-quiz-submit').onclick = () => submitQuiz(quiz, modIdx);
  document.getElementById('btn-quiz-retry').onclick  = () => loadQuiz(modIdx);

  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Enviar quiz ──────────────────────────────────────────────
async function submitQuiz(quiz, modIdx) {
  const total    = quiz.questions.length;
  const answered = Object.keys(state.quizAnswers).length;

  if (answered < total) {
    showToast('Respondé todas las preguntas antes de enviar.', 'warning');
    return;
  }

  let correct = 0;
  quiz.questions.forEach((q, qi) => {
    const optEls = document.querySelectorAll(`.quiz-option[data-qi="${qi}"]`);
    optEls.forEach(el => {
      if (el.dataset.opt === q.correctOption) el.classList.add('correct');
      else if (el.dataset.opt === state.quizAnswers[qi] && state.quizAnswers[qi] !== q.correctOption) el.classList.add('wrong');
      el.style.pointerEvents = 'none';
    });
    if (state.quizAnswers[qi] === q.correctOption) correct++;
  });

  const score   = Math.round((correct / total) * 100);
  const passed  = score >= (quiz.passingScore || 70);

  await saveQuizResult(state.currentUser.uid, state.courseId, state.modules[modIdx].moduleId, passed, score);

  if (!state.enrollment.quizResults) state.enrollment.quizResults = {};
  state.enrollment.quizResults[state.modules[modIdx].moduleId] = { passed, score, attempts: 1 };

  const resultEl = document.getElementById('quiz-result');
  resultEl.classList.remove('hidden');
  resultEl.style.background = passed ? 'var(--success-dim)' : 'var(--error-dim)';
  resultEl.style.border     = `1px solid ${passed ? 'var(--success)' : 'var(--error)'}`;
  resultEl.innerHTML = `
    <p style="font-weight:700;font-size:1.1rem;color:${passed ? 'var(--success)' : 'var(--error)'};">
      ${passed ? '¡Aprobaste!' : 'No aprobaste'} — ${score}%
    </p>
    <p style="font-size:.875rem;margin-top:.25rem;color:var(--text-secondary);">
      ${correct} de ${total} respuestas correctas. Mínimo requerido: ${quiz.passingScore || 70}%
    </p>`;

  document.getElementById('btn-quiz-submit').classList.add('hidden');

  if (passed) {
    await handleModuleComplete(modIdx);
  } else {
    document.getElementById('btn-quiz-retry').classList.remove('hidden');
  }
}

// ─── Completar módulo ─────────────────────────────────────────
async function handleModuleComplete(modIdx) {
  const mod = state.modules[modIdx];
  await completeModule(state.currentUser.uid, state.courseId, mod.moduleId, state.course.totalModules || state.modules.length);

  if (!state.enrollment.completedModules.includes(mod.moduleId)) {
    state.enrollment.completedModules.push(mod.moduleId);
  }

  const total = state.course?.totalModules || state.modules.length;
  state.enrollment.progressPercent = Math.round((state.enrollment.completedModules.length / total) * 100);
  state.enrollment.refundEligible  = state.enrollment.progressPercent < 50;

  updateProgressBar();
  renderIndex();
  showToast(`Módulo "${mod.title}" completado.`, 'success');

  if (modIdx + 1 < state.modules.length) {
    setTimeout(() => loadLesson(modIdx + 1, 0), 800);
  }
}

// ─── Render comentarios ───────────────────────────────────────
function renderComments(comments) {
  const list = document.getElementById('comments-list');
  if (!comments.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;">Sé el primero en comentar esta clase.</p>`;
    return;
  }

  const roots   = comments.filter(c => !c.parentId);
  const replies = comments.filter(c => c.parentId);

  list.innerHTML = roots.map(c => {
    const childReplies = replies.filter(r => r.parentId === c.id);
    return `
      <div class="comment-item">
        <div style="display:flex;align-items:flex-start;gap:.625rem;">
          <div class="user-avatar" style="width:30px;height:30px;font-size:.7rem;flex-shrink:0;">
            <span>${getInitials(c.authorName)}</span>
          </div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">
              <span style="font-size:.8125rem;font-weight:600;">${c.authorName}</span>
              ${c.authorRole === 'teacher' ? '<span class="badge badge-accent" style="font-size:.65rem;">Profesor</span>' : ''}
            </div>
            <p style="font-size:.875rem;color:var(--text-secondary);">${c.text}</p>
            <button class="btn-reply-toggle" data-id="${c.id}"
              style="font-size:.75rem;color:var(--accent);background:none;border:none;cursor:pointer;margin-top:.375rem;padding:0;">
              Responder
            </button>
          </div>
        </div>
        ${childReplies.map(r => `
          <div class="comment-reply">
            <div style="display:flex;align-items:flex-start;gap:.625rem;">
              <div class="user-avatar" style="width:26px;height:26px;font-size:.65rem;flex-shrink:0;">
                <span>${getInitials(r.authorName)}</span>
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem;">
                  <span style="font-size:.75rem;font-weight:600;">${r.authorName}</span>
                  ${r.authorRole === 'teacher' ? '<span class="badge badge-accent" style="font-size:.6rem;">Profesor</span>' : ''}
                </div>
                <p style="font-size:.8125rem;color:var(--text-secondary);">${r.text}</p>
              </div>
            </div>
          </div>`).join('')}
        <div id="reply-form-${c.id}" class="hidden" style="margin-top:.5rem;margin-left:2.5rem;display:flex;gap:.5rem;">
          <input class="form-input" placeholder="Tu respuesta..." style="flex:1;font-size:.8125rem;" data-reply-to="${c.id}" />
          <button class="btn btn-primary btn-sm btn-send-reply" data-reply-to="${c.id}">Enviar</button>
        </div>
      </div>`;
  }).join('');

  // Toggle reply forms
  list.querySelectorAll('.btn-reply-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById(`reply-form-${btn.dataset.id}`);
      form.classList.toggle('hidden');
      form.style.display = form.classList.contains('hidden') ? 'none' : 'flex';
    });
  });

  // Enviar respuesta
  list.querySelectorAll('.btn-send-reply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = list.querySelector(`input[data-reply-to="${btn.dataset.replyTo}"]`);
      const text  = input?.value.trim();
      if (!text) return;
      const mod    = state.modules[state.currentModuleIndex];
      const lesson = (mod.lessons || [])[state.currentLessonIndex];
      await addComment(
        state.courseId, lesson.lessonId,
        state.currentUser.uid,
        state.currentUserData?.displayName || state.currentUser.email,
        state.currentUserData?.role || 'student',
        text,
        btn.dataset.replyTo
      );
      input.value = '';
    });
  });
}

// ─── Enviar comentario ────────────────────────────────────────
document.getElementById('btn-send-comment').addEventListener('click', async () => {
  const input = document.getElementById('comment-input');
  const text  = input.value.trim();
  if (!text) return;

  const mod    = state.modules[state.currentModuleIndex];
  const lesson = (mod.lessons || [])[state.currentLessonIndex];

  await addComment(
    state.courseId, lesson.lessonId,
    state.currentUser.uid,
    state.currentUserData?.displayName || state.currentUser.email,
    state.currentUserData?.role || 'student',
    text
  );
  input.value = '';
});

// ─── Tabs ─────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-comments').classList.toggle('hidden', tab !== 'comments');
    document.getElementById('tab-forum').classList.toggle('hidden', tab !== 'forum');
    if (tab === 'forum') loadForum();
  });
});

// ─── Foro ─────────────────────────────────────────────────────
async function loadForum() {
  const posts = await getForumPosts(state.courseId);
  renderForum(posts);
}

function renderForum(posts) {
  const list = document.getElementById('forum-list');
  if (!posts.length) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem;">No hay preguntas en el foro todavía.</p>`;
    return;
  }
  list.innerHTML = posts.map(p => `
    <div class="card" style="padding:1.25rem;margin-bottom:.875rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.75rem;">
        <div>
          <h4 style="font-size:.9375rem;margin-bottom:.25rem;">${p.title}</h4>
          <p style="font-size:.8125rem;">${p.text}</p>
        </div>
        <span style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;">${p.authorName}</span>
      </div>
      ${(p.replies || []).map(r => `
        <div style="margin-left:1.5rem;padding:.625rem 0;border-top:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem;">
            <span style="font-size:.75rem;font-weight:600;">${r.authorName}</span>
          </div>
          <p style="font-size:.8125rem;">${r.text}</p>
        </div>`).join('')}
      <div style="margin-top:.75rem;display:flex;gap:.5rem;">
        <input class="form-input forum-reply-input" data-post-id="${p.id}"
          placeholder="Responder..." style="flex:1;font-size:.8125rem;" />
        <button class="btn btn-ghost btn-sm btn-forum-reply" data-post-id="${p.id}">Enviar</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.btn-forum-reply').forEach(btn => {
    btn.addEventListener('click', async () => {
      const input = list.querySelector(`.forum-reply-input[data-post-id="${btn.dataset.postId}"]`);
      const text  = input?.value.trim();
      if (!text) return;
      await addForumReply(
        state.courseId, btn.dataset.postId,
        state.currentUser.uid,
        state.currentUserData?.displayName || state.currentUser.email,
        text
      );
      input.value = '';
      await loadForum();
    });
  });
}

// Nuevo post
document.getElementById('btn-new-post').addEventListener('click', () => {
  document.getElementById('forum-new-post').classList.remove('hidden');
});
document.getElementById('btn-cancel-post').addEventListener('click', () => {
  document.getElementById('forum-new-post').classList.add('hidden');
});
document.getElementById('btn-submit-post').addEventListener('click', async () => {
  const title = document.getElementById('forum-post-title').value.trim();
  const text  = document.getElementById('forum-post-text').value.trim();
  if (!title || !text) { showToast('Completá título y descripción.', 'warning'); return; }

  await addForumPost(
    state.courseId,
    state.currentUser.uid,
    state.currentUserData?.displayName || state.currentUser.email,
    state.currentUserData?.role || 'student',
    title, text
  );
  document.getElementById('forum-post-title').value = '';
  document.getElementById('forum-post-text').value  = '';
  document.getElementById('forum-new-post').classList.add('hidden');
  await loadForum();
  showToast('Pregunta publicada.', 'success');
});

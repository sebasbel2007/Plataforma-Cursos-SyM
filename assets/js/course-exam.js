// File: plataforma cursos SyM/assets/js/course-exam.js

import { onSessionChange, showToast, getInitials, logout } from './app.js';
import { getCourse, getEnrollment, getFinalExam, saveExamResult } from './db.js';

const state = {
  courseId:    null,
  course:      null,
  exam:        null,
  enrollment:  null,
  currentUser: null,
  answers:     {},
  submitted:   false
};

const params = new URLSearchParams(window.location.search);
state.courseId = params.get('id') || params.get('courseId');

onSessionChange(async (session) => {
  if (!session) {
    window.location.href = `../auth/login.html?redirect=../course/course-exam.html?id=${state.courseId}`;
    return;
  }

  state.currentUser = session.user;

  document.getElementById('nav-initials').textContent = getInitials(session.userData?.displayName || session.user.email);
  document.getElementById('nav-avatar').addEventListener('click', async () => {
    if (confirm('¿Querés cerrar sesión?')) {
      await logout();
      window.location.href = '../../index.html';
    }
  });

  if (!state.courseId) return showError('ID de curso inválido.', '#');

  const [course, enrollment] = await Promise.all([
    getCourse(state.courseId),
    getEnrollment(session.user.uid, state.courseId)
  ]);

  const playerUrl = `../course/course-player.html?id=${state.courseId}`;

  if (!course)      return showError('Curso no encontrado.', playerUrl);
  if (!enrollment)  return showError('No tenés acceso a este curso.', playerUrl);

  const totalModules    = course.totalModules || 0;
  const completedCount  = enrollment.completedModules?.length || 0;

  if (completedCount < totalModules) {
    return showError(
      `Debés completar todos los módulos antes de rendir el examen. (${completedCount}/${totalModules} completados)`,
      playerUrl
    );
  }

  state.course     = course;
  state.enrollment = enrollment;

  document.getElementById('nav-course-title').textContent = course.title;
  document.getElementById('exam-error-link').href         = playerUrl;
  document.getElementById('btn-back-course').href         = playerUrl;
  document.getElementById('btn-back-player').href         = playerUrl;

  // Si ya aprobó → mostrar certificado directamente
  if (enrollment.examResult?.passed) {
    document.getElementById('exam-loading').classList.add('hidden');
    showPassResult(enrollment.examResult.score, course);
    return;
  }

  const exam = await getFinalExam(state.courseId);
  if (!exam || !exam.questions?.length) {
    return showError('Este curso no tiene examen final configurado.', playerUrl);
  }

  state.exam = exam;

  document.getElementById('exam-subtitle').textContent =
    `${exam.questions.length} preguntas · Mínimo para aprobar: ${exam.passingScore || 70}%`;

  renderExam(exam);

  document.getElementById('exam-loading').classList.add('hidden');
  document.getElementById('exam-content').classList.remove('hidden');
});

// ─── Render preguntas ─────────────────────────────────────────
function renderExam(exam) {
  const container = document.getElementById('exam-questions');
  container.innerHTML = exam.questions.map((q, qi) => `
    <div data-qi="${qi}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;">
      <p style="font-weight:600;font-size:1rem;margin-bottom:1.25rem;line-height:1.5;">
        <span style="color:var(--accent);margin-right:.5rem;">${qi + 1}.</span>${q.text}
      </p>
      <div style="display:flex;flex-direction:column;gap:.625rem;">
        ${['a','b','c','d'].map(opt => `
          <div class="exam-option" data-qi="${qi}" data-opt="${opt}">
            <span style="font-weight:700;color:var(--accent);flex-shrink:0;min-width:1.25rem;">${opt.toUpperCase()}.</span>
            <span>${q.options[opt]}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');

  container.querySelectorAll('.exam-option').forEach(opt => {
    opt.addEventListener('click', () => {
      if (state.submitted) return;
      const qi = opt.dataset.qi;
      state.answers[qi] = opt.dataset.opt;
      container.querySelectorAll(`.exam-option[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.getElementById('btn-exam-submit').addEventListener('click', handleSubmit);
}

// ─── Enviar examen ────────────────────────────────────────────
async function handleSubmit() {
  const total    = state.exam.questions.length;
  const answered = Object.keys(state.answers).length;

  if (answered < total) {
    showToast(`Respondé todas las preguntas. (${answered}/${total})`, 'warning');
    return;
  }

  state.submitted = true;
  document.getElementById('btn-exam-submit').disabled = true;
  document.getElementById('btn-exam-submit').textContent = 'Enviando...';

  let correct = 0;
  state.exam.questions.forEach((q, qi) => {
    if (state.answers[qi] === q.correctOption) correct++;
  });

  const score  = Math.round((correct / total) * 100);
  const passed = score >= (state.exam.passingScore || 70);

  await saveExamResult(state.currentUser.uid, state.courseId, passed, score);

  document.getElementById('exam-content').classList.add('hidden');
  document.getElementById('exam-result').classList.remove('hidden');

  if (passed) {
    showPassResult(score, state.course);
  } else {
    document.getElementById('result-fail').classList.remove('hidden');
    document.getElementById('result-score-fail').textContent =
      `Obtuviste ${score}% — ${correct} de ${total} correctas. Mínimo: ${state.exam.passingScore || 70}%`;
    document.getElementById('btn-retry-exam').addEventListener('click', () => location.reload());
  }

  renderReview();
}

// ─── Mostrar resultado aprobado ───────────────────────────────
function showPassResult(score, course) {
  document.getElementById('exam-result').classList.remove('hidden');
  document.getElementById('result-pass').classList.remove('hidden');

  const total = state.exam?.questions?.length || '—';
  document.getElementById('result-score-pass').textContent =
    typeof score === 'number'
      ? `Obtuviste ${score}%${total !== '—' ? ` — ${Math.round(score * total / 100)} de ${total} correctas` : ''}`
      : '';

  document.getElementById('certificate-course-name').textContent = course.title;

  if (course.certificateURL) {
    document.getElementById('btn-download-cert').href = course.certificateURL;
  } else {
    document.getElementById('certificate-block').innerHTML = `
      <p style="color:var(--text-muted);font-size:.875rem;text-align:center;">
        El certificado estará disponible próximamente.
      </p>`;
  }
}

// ─── Revisión de respuestas ───────────────────────────────────
function renderReview() {
  if (!state.exam) return;
  const container = document.getElementById('review-questions');

  container.innerHTML = state.exam.questions.map((q, qi) => {
    const userAns    = state.answers[qi];
    const correctAns = q.correctOption;

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;">
        <p style="font-weight:600;font-size:.9375rem;margin-bottom:1.25rem;line-height:1.5;">
          <span style="color:var(--accent);margin-right:.5rem;">${qi + 1}.</span>${q.text}
        </p>
        <div style="display:flex;flex-direction:column;gap:.625rem;">
          ${['a','b','c','d'].map(opt => {
            let cls = 'exam-option locked';
            if (opt === correctAns)                        cls += ' correct';
            else if (opt === userAns && opt !== correctAns) cls += ' wrong';
            return `
              <div class="${cls}">
                <span style="font-weight:700;flex-shrink:0;min-width:1.25rem;">${opt.toUpperCase()}.</span>
                <span>${q.options[opt]}</span>
                ${opt === correctAns ? '<span style="margin-left:auto;font-size:.75rem;color:var(--success);font-weight:600;display:inline-flex;align-items:center;gap:.25rem;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Correcta</span>' : ''}
                ${opt === userAns && opt !== correctAns ? '<span style="margin-left:auto;font-size:.75rem;color:var(--error);font-weight:600;display:inline-flex;align-items:center;gap:.25rem;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Tu respuesta</span>' : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

// ─── Mostrar error ────────────────────────────────────────────
function showError(msg, backUrl = '../../index.html') {
  document.getElementById('exam-loading').classList.add('hidden');
  document.getElementById('exam-error-msg').textContent = msg;
  document.getElementById('exam-error-link').href       = backUrl;
  document.getElementById('exam-error').classList.remove('hidden');
}

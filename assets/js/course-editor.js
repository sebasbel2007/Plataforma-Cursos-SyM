// File: plataforma cursos SyM/assets/js/course-editor.js

import { onSessionChange, showToast, formatARS } from './app.js';
import {
  getCourse, createCourse, updateCourse, submitCourseForReview,
  getCoursesByTeacher, deleteCourse,
  getModules, saveModule, updateModule, deleteModule,
  getQuiz, saveQuiz, getFinalExam, saveFinalExam,
  getCategories, createCategory, createNotification
} from './db.js';
import {
  uploadLessonVideo, uploadCourseThumbnail, uploadPromoVideo,
  renderUploadInput
} from './storage.js';

const params   = new URLSearchParams(window.location.search);
const courseId = params.get('id');

const state = {
  uid:         null,
  userData:    null,
  courseId:    courseId || null,
  courseData:  null,
  modules:     [],   // [{ moduleId, title, lessons:[], quiz:{} }]
  examQuestions: [],
  examPassingScore: 70,
  saving: false
};

// ─── Guard ────────────────────────────────────────────────────
onSessionChange(async (session) => {
  if (!session) { window.location.href = '../auth/login.html'; return; }
  if (session.userData?.role !== 'teacher') {
    window.location.href = '../dashboard-teacher/index.html';
    return;
  }

  state.uid      = session.user.uid;
  state.userData = session.userData;

  await loadCategories();

  if (state.courseId) {
    await loadExistingCourse();
  } else {
    // Auto-crear el borrador en Firestore para tener courseId antes de subir multimedia
    // (así las subidas van a la carpeta correcta cursos-sym/{uid}/{courseId}/...)
    try {
      state.courseId = await createDraftCourse();
    } catch (err) {
      console.error(err);
      showToast('No se pudo crear el borrador. Intentá de nuevo.', 'error');
      window.location.href = '../dashboard-teacher/index.html';
      return;
    }
    window.history.replaceState({}, '', `?id=${state.courseId}`);
    initMediaUploads();
    renderModules();
    renderExamQuestions();
    updateSummary();
  }

  bindEvents();
  initSidenav();
  initAutosave();
});

// ─── Cargar categorías ────────────────────────────────────────
async function loadCategories() {
  const cats = await getCategories('approved');
  const sel  = document.getElementById('field-category');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.name;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

// ─── Auto-crear borrador (curso nuevo) ─────────────────────────
// Crea el doc en Firestore de inmediato para tener courseId real
// antes de subir cualquier multimedia.
async function createDraftCourse() {
  // Limpiar borradores vacíos previos del profesor (abiertos y abandonados
  // sin contenido). Así no se acumulan "Nuevo curso" en el panel.
  try {
    const mine = await getCoursesByTeacher(state.uid);
    const emptyDrafts = mine.filter(c =>
      c.status === 'draft' &&
      !c.thumbnailURL && !c.promoVideoURL &&
      !c.totalModules &&
      (c.title === 'Nuevo curso' || !c.title)
    );
    for (const d of emptyDrafts) {
      await deleteCourse(d.courseId);
    }
  } catch (e) {
    console.warn('No se pudieron limpiar borradores vacíos:', e);
  }

  const id = await createCourse(state.uid, state.userData?.displayName || '', {
    title:        'Nuevo curso',
    subtitle:     '',
    description:  '',
    category:     '',
    price:        0,
    isFree:       true,
    tags:         [],
    thumbnailURL:  '',
    promoVideoURL: '',
    certificateURL: '',
    outcomes:     [],
    requirements: [],
    totalModules: 0
  });
  return id;
}

// ─── Cargar curso existente ───────────────────────────────────
async function loadExistingCourse() {
  const [course, modules, exam] = await Promise.all([
    getCourse(state.courseId),
    getModules(state.courseId),
    getFinalExam(state.courseId)
  ]);

  if (!course || course.teacherId !== state.uid) {
    showToast('No tenés permiso para editar este curso.', 'error');
    window.location.href = '../dashboard-teacher/index.html';
    return;
  }

  state.courseData = course;
  document.getElementById('editor-title-nav').textContent = course.title || 'Editar curso';

  // Llenar campos
  document.getElementById('field-title').value        = course.title        || '';
  document.getElementById('field-subtitle').value     = course.subtitle     || '';
  document.getElementById('field-description').value  = course.description  || '';
  document.getElementById('field-category').value     = course.category     || '';
  document.getElementById('field-price').value        = course.price        ?? '';
  document.getElementById('field-tags').value         = (course.tags || []).join(', ');
  document.getElementById('field-certificate').value  = course.certificateURL || '';
  document.getElementById('field-outcomes').value     = (course.outcomes     || []).join('\n');
  document.getElementById('field-requirements').value = (course.requirements || []).join('\n');

  updateStatusBadge(course.status);

  // Inicializar uploads con URLs existentes
  initMediaUploads(course.thumbnailURL, course.promoVideoURL);

  // Módulos
  const modulesWithQuiz = await Promise.all(modules.map(async mod => {
    const quiz = await getQuiz(state.courseId, mod.moduleId);
    return { ...mod, quiz: quiz || { questions: [], passingScore: 70 } };
  }));
  state.modules = modulesWithQuiz;

  // Examen
  if (exam) {
    state.examQuestions   = exam.questions || [];
    state.examPassingScore = exam.passingScore || 70;
    document.getElementById('exam-passing-score').value = state.examPassingScore;
  }

  renderModules();
  renderExamQuestions();
  updateSummary();
}

// ─── Uploads de multimedia ────────────────────────────────────
function initMediaUploads(currentThumb = null, currentPromo = null) {
  // Solo inicializar si el courseId ya existe (para tener folder correcto)
  // Si es curso nuevo, se inicializan después de crear el borrador
  renderUploadInput({
    containerId: 'upload-thumbnail',
    accept:      'image/*',
    label:       'Subir miniatura del curso (JPG, PNG, WebP)',
    uploadFn:    (file, onProgress) => uploadCourseThumbnail(
      file,
      state.uid,
      state.courseId || 'new',
      onProgress
    ),
    onUploaded:  (url) => { state.thumbnailURL = url; updateSummary(); triggerAutosave(); },
    currentUrl:  currentThumb
  });

  renderUploadInput({
    containerId: 'upload-promo',
    accept:      'video/*',
    label:       'Subir video promocional del curso (MP4, MOV, AVI)',
    uploadFn:    (file, onProgress) => uploadPromoVideo(
      file,
      state.uid,
      state.courseId || 'new',
      onProgress
    ),
    onUploaded:  (url) => { state.promoVideoURL = url; updateSummary(); triggerAutosave(); },
    currentUrl:  currentPromo
  });
}

// ─── Bind eventos globales ────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-add-module').addEventListener('click', addModule);
  document.getElementById('btn-add-exam-question').addEventListener('click', addExamQuestion);
  document.getElementById('btn-save-draft').addEventListener('click', () => saveCourse(false));
  document.getElementById('btn-submit-review').addEventListener('click', () => saveCourse(true));

  document.getElementById('exam-passing-score').addEventListener('input', (e) => {
    state.examPassingScore = parseInt(e.target.value) || 70;
  });

  // Actualizar summary en tiempo real
  ['field-title','field-price'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateSummary);
  });

  // Modal proponer categoría
  document.getElementById('btn-propose-category').addEventListener('click', () => {
    document.getElementById('modal-category').classList.remove('hidden');
    document.getElementById('new-category-input').focus();
  });
  document.getElementById('btn-cancel-category').addEventListener('click', () => {
    document.getElementById('modal-category').classList.add('hidden');
    document.getElementById('new-category-input').value = '';
  });
  document.getElementById('btn-confirm-category').addEventListener('click', proposeCategory);
  document.getElementById('modal-category').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add('hidden');
      document.getElementById('new-category-input').value = '';
    }
  });
}

// ─── Proponer nueva categoría ────────────────────────────────
async function proposeCategory() {
  const name = document.getElementById('new-category-input').value.trim();
  if (!name) { showToast('Escribí el nombre de la categoría.', 'warning'); return; }

  const btn = document.getElementById('btn-confirm-category');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    await createCategory(name, state.userData?.displayName || state.uid);

    // Notificar al admin
    await createNotification(
      'admin', 'moderation',
      'Nueva categoría propuesta',
      `El profesor ${state.userData?.displayName || ''} propuso la categoría "${name}".`
    );

    // Agregar al select inmediatamente
    const sel = document.getElementById('field-category');
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
    sel.value = name;

    document.getElementById('modal-category').classList.add('hidden');
    document.getElementById('new-category-input').value = '';
    showToast(`Categoría "${name}" creada y notificada al admin.`, 'success');
    updateSummary();
  } catch (err) {
    console.error(err);
    showToast('Error al crear la categoría.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Proponer';
}

// ─── Módulos ──────────────────────────────────────────────────
function addModule() {
  if (state.modules.length >= 15) {
    showToast('Máximo 15 módulos por curso.', 'warning');
    return;
  }
  state.modules.push({
    moduleId: `mod_${Date.now()}`,
    title:    '',
    order:    state.modules.length + 1,
    lessons:  [],
    quiz:     { questions: [], passingScore: 70 }
  });
  renderModules();
  updateSummary();
}

function removeModule(idx) {
  if (!confirm('¿Eliminar este módulo y todo su contenido?')) return;
  state.modules.splice(idx, 1);
  state.modules.forEach((m, i) => m.order = i + 1);
  renderModules();
  updateSummary();
}

function renderModules() {
  const container = document.getElementById('modules-container');
  document.getElementById('modules-count-label').textContent = `${state.modules.length} / 15`;

  container.innerHTML = state.modules.map((mod, mi) => `
    <div class="module-block" id="module-block-${mi}">
      <div class="module-header-editor" onclick="toggleModuleBody(${mi})">
        <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:0;">
          <span style="font-size:.75rem;color:var(--text-muted);font-weight:700;flex-shrink:0;">M${mi + 1}</span>
          <input
            class="form-input module-title-input"
            data-mi="${mi}"
            value="${escHtml(mod.title)}"
            placeholder="Título del módulo"
            onclick="event.stopPropagation()"
            style="flex:1;font-size:.875rem;font-weight:600;background:transparent;border-color:transparent;padding:.375rem .5rem;"
          />
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0;" onclick="event.stopPropagation()">
          <span style="font-size:.75rem;color:var(--text-muted);">${mod.lessons.length} clases</span>
          <button class="btn btn-ghost btn-sm" onclick="removeModule(${mi})" style="color:var(--error);padding:.25rem .5rem;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      </div>

      <div id="module-body-${mi}" style="padding:1rem;border-top:1px solid var(--border);">

        <!-- Clases -->
        <div style="margin-bottom:1rem;">
          <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem;">Clases</div>
          <div id="lessons-container-${mi}">
            ${mod.lessons.map((les, li) => renderLessonBlock(mi, li, les)).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="addLesson(${mi})" style="width:100%;">+ Agregar clase</button>
        </div>

        <!-- Quiz -->
        <div style="border-top:1px solid var(--border);padding-top:1rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
            <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Quiz del módulo</div>
            <div style="display:flex;align-items:center;gap:.5rem;">
              <label style="font-size:.75rem;color:var(--text-muted);">Mínimo %</label>
              <input type="number" min="1" max="100"
                class="form-input quiz-passing-input"
                data-mi="${mi}"
                value="${mod.quiz.passingScore || 70}"
                style="width:64px;padding:.25rem .5rem;font-size:.8125rem;"
                onclick="event.stopPropagation()"
              />
            </div>
          </div>
          <div id="quiz-container-${mi}">
            ${(mod.quiz.questions || []).map((q, qi) => renderQuizQuestion(mi, qi, q)).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="addQuizQuestion(${mi})" style="width:100%;">+ Agregar pregunta al quiz</button>
        </div>

      </div>
    </div>`).join('');

  // Bind inputs de título de módulo
  container.querySelectorAll('.module-title-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const mi = parseInt(e.target.dataset.mi);
      state.modules[mi].title = e.target.value;
      updateSummary();
    });
  });

  // Bind inputs de passing score del quiz
  container.querySelectorAll('.quiz-passing-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const mi = parseInt(e.target.dataset.mi);
      state.modules[mi].quiz.passingScore = parseInt(e.target.value) || 70;
    });
  });

  bindLessonInputs();
  bindQuizInputs();

  // Inicializar uploads de video por cada clase
  state.modules.forEach((mod, mi) => {
    mod.lessons.forEach((les, li) => initLessonVideoUpload(mi, li));
  });
}

function renderLessonBlock(mi, li, les) {
  const uploadId = `upload-lesson-${mi}-${li}`;
  return `
    <div class="lesson-block" id="lesson-${mi}-${li}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
        <span style="font-size:.75rem;color:var(--text-muted);font-weight:600;">Clase ${li + 1}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeLesson(${mi},${li})" style="color:var(--error);padding:.2rem .4rem;font-size:.75rem;display:inline-flex;align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <input class="form-input lesson-title" data-mi="${mi}" data-li="${li}"
        value="${escHtml(les.title || '')}" placeholder="Título de la clase"
        style="margin-bottom:.625rem;font-size:.875rem;" />
      <div id="${uploadId}" style="margin-bottom:.625rem;"></div>
      <textarea class="form-input lesson-content" data-mi="${mi}" data-li="${li}"
        placeholder="Texto de apoyo (opcional)" rows="2"
        style="resize:vertical;font-size:.875rem;">${escHtml(les.content || '')}</textarea>
    </div>`;
}

function initLessonVideoUpload(mi, li) {
  const mod    = state.modules[mi];
  const les    = mod.lessons[li];
  const uploadId = `upload-lesson-${mi}-${li}`;
  if (!document.getElementById(uploadId)) return;

  renderUploadInput({
    containerId: uploadId,
    accept:      'video/*',
    label:       'Subir video de la clase (MP4, MOV, AVI)',
    uploadFn:    (file, onProgress) => uploadLessonVideo(
      file,
      state.uid,
      state.courseId || 'new',
      mod.moduleId,
      les.lessonId,
      onProgress
    ),
    onUploaded: (url) => {
      state.modules[mi].lessons[li].videoURL = url;
      triggerAutosave();
    },
    currentUrl: les.videoURL || null
  });
}

function renderQuizQuestion(mi, qi, q) {
  return `
    <div class="quiz-question-block" id="quiz-q-${mi}-${qi}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem;">
        <span style="font-size:.75rem;color:var(--text-muted);font-weight:600;">Pregunta ${qi + 1}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeQuizQuestion(${mi},${qi})" style="color:var(--error);padding:.2rem .4rem;font-size:.75rem;display:inline-flex;align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <input class="form-input quiz-q-text" data-mi="${mi}" data-qi="${qi}"
        value="${escHtml(q.text || '')}" placeholder="Texto de la pregunta"
        style="margin-bottom:.625rem;font-size:.875rem;" />
      ${['a','b','c','d'].map(opt => `
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.375rem;">
          <input type="radio" name="correct-${mi}-${qi}" value="${opt}"
            class="quiz-correct-radio" data-mi="${mi}" data-qi="${qi}"
            ${(q.correctOption === opt) ? 'checked' : ''}
            style="accent-color:var(--success);flex-shrink:0;" />
          <input class="form-input quiz-opt" data-mi="${mi}" data-qi="${qi}" data-opt="${opt}"
            value="${escHtml(q.options?.[opt] || '')}"
            placeholder="Opción ${opt.toUpperCase()}"
            style="flex:1;font-size:.8125rem;" />
        </div>`).join('')}
      <p style="font-size:.7rem;color:var(--text-muted);margin-top:.25rem;">● Marcá el radio de la opción correcta</p>
    </div>`;
}

// ─── Clases ───────────────────────────────────────────────────
function addLesson(mi) {
  state.modules[mi].lessons.push({
    lessonId: `les_${Date.now()}`,
    title: '', videoURL: '', content: '',
    order: state.modules[mi].lessons.length + 1
  });
  renderModules();
  // Inicializar upload del nuevo video
  const li = state.modules[mi].lessons.length - 1;
  initLessonVideoUpload(mi, li);
  updateSummary();
}

function removeLesson(mi, li) {
  state.modules[mi].lessons.splice(li, 1);
  renderModules();
  updateSummary();
}

function bindLessonInputs() {
  document.querySelectorAll('.lesson-title').forEach(el => {
    el.addEventListener('input', e => {
      state.modules[e.target.dataset.mi].lessons[e.target.dataset.li].title = e.target.value;
      updateSummary();
    });
  });
  document.querySelectorAll('.lesson-content').forEach(el => {
    el.addEventListener('input', e => {
      state.modules[e.target.dataset.mi].lessons[e.target.dataset.li].content = e.target.value;
    });
  });
}

// ─── Quiz ─────────────────────────────────────────────────────
function addQuizQuestion(mi) {
  state.modules[mi].quiz.questions.push({
    questionId: `q_${Date.now()}`,
    text: '', options: { a:'', b:'', c:'', d:'' }, correctOption: 'a'
  });
  renderModules();
}

function removeQuizQuestion(mi, qi) {
  state.modules[mi].quiz.questions.splice(qi, 1);
  renderModules();
}

function bindQuizInputs() {
  document.querySelectorAll('.quiz-q-text').forEach(el => {
    el.addEventListener('input', e => {
      state.modules[e.target.dataset.mi].quiz.questions[e.target.dataset.qi].text = e.target.value;
    });
  });
  document.querySelectorAll('.quiz-opt').forEach(el => {
    el.addEventListener('input', e => {
      const { mi, qi, opt } = e.target.dataset;
      state.modules[mi].quiz.questions[qi].options[opt] = e.target.value;
    });
  });
  document.querySelectorAll('.quiz-correct-radio').forEach(el => {
    el.addEventListener('change', e => {
      const { mi, qi } = e.target.dataset;
      state.modules[mi].quiz.questions[qi].correctOption = e.target.value;
    });
  });
}

// ─── Examen final ─────────────────────────────────────────────
function addExamQuestion() {
  state.examQuestions.push({
    questionId: `eq_${Date.now()}`,
    text: '', options: { a:'', b:'', c:'', d:'' }, correctOption: 'a'
  });
  renderExamQuestions();
  updateSummary();
}

function removeExamQuestion(qi) {
  state.examQuestions.splice(qi, 1);
  renderExamQuestions();
  updateSummary();
}

function renderExamQuestions() {
  const container = document.getElementById('exam-questions-container');
  container.innerHTML = state.examQuestions.map((q, qi) => `
    <div class="quiz-question-block">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.625rem;">
        <span style="font-size:.75rem;color:var(--text-muted);font-weight:600;">Pregunta ${qi + 1}</span>
        <button class="btn btn-ghost btn-sm" onclick="removeExamQuestion(${qi})" style="color:var(--error);padding:.2rem .4rem;font-size:.75rem;display:inline-flex;align-items:center;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>
      <input class="form-input exam-q-text" data-qi="${qi}"
        value="${escHtml(q.text || '')}" placeholder="Texto de la pregunta"
        style="margin-bottom:.625rem;font-size:.875rem;" />
      ${['a','b','c','d'].map(opt => `
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.375rem;">
          <input type="radio" name="exam-correct-${qi}" value="${opt}"
            class="exam-correct-radio" data-qi="${qi}"
            ${q.correctOption === opt ? 'checked' : ''}
            style="accent-color:var(--success);flex-shrink:0;" />
          <input class="form-input exam-opt" data-qi="${qi}" data-opt="${opt}"
            value="${escHtml(q.options?.[opt] || '')}"
            placeholder="Opción ${opt.toUpperCase()}"
            style="flex:1;font-size:.8125rem;" />
        </div>`).join('')}
    </div>`).join('');

  container.querySelectorAll('.exam-q-text').forEach(el => {
    el.addEventListener('input', e => { state.examQuestions[e.target.dataset.qi].text = e.target.value; updateSummary(); });
  });
  container.querySelectorAll('.exam-opt').forEach(el => {
    el.addEventListener('input', e => {
      state.examQuestions[e.target.dataset.qi].options[e.target.dataset.opt] = e.target.value;
    });
  });
  container.querySelectorAll('.exam-correct-radio').forEach(el => {
    el.addEventListener('change', e => {
      state.examQuestions[e.target.dataset.qi].correctOption = e.target.value;
    });
  });
}

// ─── Toggle cuerpo de módulo ───────────────────────────────────────
window.toggleModuleBody = function(mi) {
  const body = document.getElementById(`module-body-${mi}`);
  body.style.display = body.style.display === 'none' ? '' : 'none';
};
window.addLesson           = addLesson;
window.removeLesson        = removeLesson;
window.removeModule        = removeModule;
window.addQuizQuestion     = addQuizQuestion;
window.removeQuizQuestion  = removeQuizQuestion;
window.removeExamQuestion  = removeExamQuestion;

// ─── Sidenav: scroll-spy + click ────────────────────────────────
function initSidenav() {
  const items = document.querySelectorAll('.sidenav-item[data-section]');

  // Click → scroll suave
  items.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      items.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Scroll-spy con IntersectionObserver
  const sections = [...items].map(b => document.getElementById(b.dataset.section)).filter(Boolean);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        items.forEach(b => {
          b.classList.toggle('active', b.dataset.section === id);
        });
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px', threshold: 0 });

  sections.forEach(s => observer.observe(s));
}

// ─── Autosave con localStorage ──────────────────────────────────
const AUTOSAVE_KEY = `course-editor-draft-${courseId || 'new'}`;
let autosaveTimer  = null;

function getFormSnapshot() {
  return {
    title:        document.getElementById('field-title')?.value       || '',
    subtitle:     document.getElementById('field-subtitle')?.value    || '',
    description:  document.getElementById('field-description')?.value || '',
    category:     document.getElementById('field-category')?.value    || '',
    price:        document.getElementById('field-price')?.value       || '',
    tags:         document.getElementById('field-tags')?.value        || '',
    certificate:  document.getElementById('field-certificate')?.value || '',
    outcomes:     document.getElementById('field-outcomes')?.value    || '',
    requirements: document.getElementById('field-requirements')?.value || '',
    thumbnailURL:  state.thumbnailURL  || '',
    promoVideoURL: state.promoVideoURL || '',
    modules:      JSON.parse(JSON.stringify(state.modules)),
    examQuestions: JSON.parse(JSON.stringify(state.examQuestions)),
    examPassingScore: state.examPassingScore,
    savedAt: new Date().toISOString()
  };
}

function applySnapshot(snap) {
  if (snap.title)        document.getElementById('field-title').value        = snap.title;
  if (snap.subtitle)     document.getElementById('field-subtitle').value     = snap.subtitle;
  if (snap.description)  document.getElementById('field-description').value  = snap.description;
  if (snap.category)     document.getElementById('field-category').value     = snap.category;
  if (snap.price)        document.getElementById('field-price').value        = snap.price;
  if (snap.tags)         document.getElementById('field-tags').value         = snap.tags;
  if (snap.certificate)  document.getElementById('field-certificate').value  = snap.certificate;
  if (snap.outcomes)     document.getElementById('field-outcomes').value     = snap.outcomes;
  if (snap.requirements) document.getElementById('field-requirements').value = snap.requirements;

  if (snap.modules?.length) {
    state.modules = snap.modules;
    renderModules();
  }
  if (snap.examQuestions?.length) {
    state.examQuestions    = snap.examQuestions;
    state.examPassingScore = snap.examPassingScore || 70;
    document.getElementById('exam-passing-score').value = state.examPassingScore;
    renderExamQuestions();
  }

  // Restaurar multimedia (mini y promo) para no perder las URLs del borrador local
  if (snap.thumbnailURL || snap.promoVideoURL) {
    state.thumbnailURL  = snap.thumbnailURL  || '';
    state.promoVideoURL = snap.promoVideoURL || '';
    initMediaUploads(state.thumbnailURL, state.promoVideoURL);
  }

  updateSummary();
}

function triggerAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getFormSnapshot()));
    } catch (e) { /* cuota excedida, ignorar */ }
  }, 30_000); // 30 segundos sin actividad
}

function initAutosave() {
  // Si es curso nuevo, verificar si hay borrador local
  if (!courseId) {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      try {
        const snap = JSON.parse(raw);
        const date = new Date(snap.savedAt).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
        const banner = document.getElementById('autosave-banner');
        document.getElementById('autosave-msg').textContent = `Borrador local guardado a las ${date}. ¿Restaurár?`;
        banner.classList.remove('hidden');

        // Clic en el banner (fuera del botón) → restaurar
        banner.addEventListener('click', (e) => {
          if (e.target.id === 'btn-discard-draft') return;
          applySnapshot(snap);
          localStorage.removeItem(AUTOSAVE_KEY);
          banner.classList.add('hidden');
          showToast('Borrador local restaurado.', 'success');
        });

        document.getElementById('btn-discard-draft').addEventListener('click', () => {
          localStorage.removeItem(AUTOSAVE_KEY);
          banner.classList.add('hidden');
        });
      } catch (e) {
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    }
  }

  // Escuchar cambios del formulario para activar el timer
  const watchIds = ['field-title','field-subtitle','field-description','field-category',
                    'field-price','field-tags','field-certificate','field-outcomes','field-requirements'];
  watchIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', triggerAutosave);
  });

  // Guardar al cerrar/recargar
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(getFormSnapshot())); } catch (e) {}
  });
}

// ─── Guardar curso ────────────────────────────────────────────
async function saveCourse(submitForReview = false) {
  if (state.saving) return;

  const title       = document.getElementById('field-title').value.trim();
  const description = document.getElementById('field-description').value.trim();
  const category    = document.getElementById('field-category').value;
  const priceRaw    = document.getElementById('field-price').value;

  if (!title)       { showToast('El título es obligatorio.', 'warning'); return; }
  if (!description) { showToast('La descripción es obligatoria.', 'warning'); return; }
  if (!category)    { showToast('Seleccioná una categoría.', 'warning'); return; }

  if (submitForReview) {
    if (state.modules.length === 0) { showToast('Agregá al menos un módulo.', 'warning'); return; }
    if (state.examQuestions.length < 5) { showToast('El examen final necesita al menos 5 preguntas.', 'warning'); return; }
    const hasEmptyModule = state.modules.some(m => !m.title.trim() || m.lessons.length === 0);
    if (hasEmptyModule) { showToast('Todos los módulos deben tener título y al menos una clase.', 'warning'); return; }
  }

  state.saving = true;
  setSaveStatus('Guardando...');

  const price = parseFloat(priceRaw) || 0;
  const coursePayload = {
    title,
    subtitle:       document.getElementById('field-subtitle').value.trim(),
    description,
    category,
    price,
    isFree:         price === 0,
    tags:           document.getElementById('field-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    thumbnailURL:   state.thumbnailURL  || state.courseData?.thumbnailURL  || '',
    promoVideoURL:  state.promoVideoURL || state.courseData?.promoVideoURL || '',
    certificateURL: document.getElementById('field-certificate').value.trim(),
    outcomes:       document.getElementById('field-outcomes').value.split('\n').map(l => l.trim()).filter(Boolean),
    requirements:   document.getElementById('field-requirements').value.split('\n').map(l => l.trim()).filter(Boolean),
    totalModules:   state.modules.length
  };

  try {
    if (!state.courseId) {
      state.courseId = await createCourse(state.uid, state.userData?.displayName || '', coursePayload);
    } else {
      await updateCourse(state.courseId, coursePayload);
    }

    // Guardar módulos
    for (let i = 0; i < state.modules.length; i++) {
      const mod = state.modules[i];
      const modPayload = { title: mod.title, order: i + 1, lessons: mod.lessons };

      if (mod.moduleId.startsWith('mod_')) {
        const newId = await saveModule(state.courseId, modPayload);
        state.modules[i].moduleId = newId;
      } else {
        await updateModule(state.courseId, mod.moduleId, modPayload);
      }

      if (mod.quiz.questions.length > 0) {
        await saveQuiz(state.courseId, state.modules[i].moduleId, {
          questions:    mod.quiz.questions,
          passingScore: mod.quiz.passingScore || 70
        });
      }
    }

    // Guardar examen final
    if (state.examQuestions.length > 0) {
      await saveFinalExam(state.courseId, {
        questions:    state.examQuestions,
        passingScore: state.examPassingScore
      });
    }

    if (submitForReview) {
      await submitCourseForReview(state.courseId);
      await createNotification(
        'admin', 'moderation',
        'Nuevo curso para revisar',
        `El profesor ${state.userData?.displayName || ''} envió "${title}" a moderación.`,
        state.courseId
      );
      updateStatusBadge('pending');
      showToast('Curso enviado a revisión. El admin lo revisará pronto.', 'success');
    } else {
      updateStatusBadge('draft');
      showToast('Borrador guardado.', 'success');
    }

    setSaveStatus('Guardado');
    window.history.replaceState({}, '', `?id=${state.courseId}`);
    document.getElementById('editor-title-nav').textContent = title;
    updateSummary();

  } catch (err) {
    console.error(err);
    showToast('Error al guardar. Intentá de nuevo.', 'error');
    setSaveStatus('Error al guardar');
  }

  state.saving = false;
}

// ─── Helpers UI ───────────────────────────────────────────────
function setSaveStatus(msg) {
  document.getElementById('save-status').textContent = msg;
  if (msg === 'Guardado') setTimeout(() => { document.getElementById('save-status').textContent = ''; }, 3000);
}

function updateStatusBadge(status) {
  const el  = document.getElementById('status-badge-sidebar');
  const map = { draft: ['status-draft','Borrador'], pending: ['status-pending','En revisión'], published: ['status-published','Publicado'], rejected: ['status-rejected','Rechazado'] };
  el.className   = `status-badge ${map[status]?.[0] || 'status-draft'}`;
  el.textContent = map[status]?.[1] || status;
}

function updateSummary() {
  const totalLessons = state.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const price        = parseFloat(document.getElementById('field-price').value) || 0;

  document.getElementById('summary-modules').textContent  = state.modules.length;
  document.getElementById('summary-lessons').textContent  = totalLessons;
  document.getElementById('summary-exam-q').textContent   = state.examQuestions.length;
  document.getElementById('summary-price').textContent    = price === 0 ? 'Gratis' : formatARS(price);

  // Checklist
  const checks = [
    { label: 'Título',       ok: !!document.getElementById('field-title').value.trim() },
    { label: 'Descripción',  ok: !!document.getElementById('field-description').value.trim() },
    { label: 'Categoría',    ok: !!document.getElementById('field-category').value },
    { label: 'Al menos 1 módulo', ok: state.modules.length > 0 },
    { label: 'Clases en todos los módulos', ok: state.modules.length > 0 && state.modules.every(m => m.lessons.length > 0) },
    { label: 'Examen final (mín. 5 preguntas)', ok: state.examQuestions.length >= 5 },
    { label: 'Certificado PDF', ok: !!document.getElementById('field-certificate').value.trim() }
  ];

  document.getElementById('checklist').innerHTML = checks.map(c => `
    <div style="display:flex;align-items:center;gap:.5rem;color:${c.ok ? 'var(--success)' : 'var(--text-muted)'};">
      <span style="display:inline-flex;">${c.ok
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'}</span>
      <span>${c.label}</span>
    </div>`).join('');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

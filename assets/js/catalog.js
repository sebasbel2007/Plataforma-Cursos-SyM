// File: plataforma cursos SyM/assets/js/catalog.js

import { onSessionChange, formatARS } from './app.js';
import { renderSidebar } from './sidebar.js';
import { getPublishedCourses, getCategories, getTags } from './db.js';

const state = {
  allCourses:       [],
  filteredCourses:  [],
  activeCategory:   '',
  activePrice:      'all',
  activeTag:        '',
  sortBy:           'newest',
  searchQuery:      ''
};

// ─── Init sesión ──────────────────────────────────────────────
onSessionChange((session) => {
  renderSidebar(session, 'catalog');
});

// ─── Carga inicial ────────────────────────────────────────────
async function init() {
  // Leer query params
  const params = new URLSearchParams(window.location.search);
  if (params.get('category')) state.activeCategory = params.get('category');
  if (params.get('q'))        state.searchQuery    = params.get('q');

  const [courses, categories, tags] = await Promise.all([
    getPublishedCourses(),
    getCategories(),
    getTags()
  ]);

  state.allCourses = courses;

  renderCategoryFilters(categories);
  renderTagFilters(tags);
  bindEvents();

  if (state.searchQuery) {
    document.getElementById('search-input').value = state.searchQuery;
  }

  applyFilters();

  document.getElementById('catalog-loading').classList.add('hidden');
  document.getElementById('courses-grid').classList.remove('hidden');
}

// ─── Render filtros de categoría ──────────────────────────────
function renderCategoryFilters(categories) {
  const container = document.getElementById('category-filters');
  container.innerHTML = `<button class="filter-chip ${!state.activeCategory ? 'active' : ''}" data-category="">Todas</button>`;
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = `filter-chip${state.activeCategory === cat.name ? ' active' : ''}`;
    btn.dataset.category = cat.name;
    btn.textContent = cat.name;
    container.appendChild(btn);
  });

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
}

// ─── Render filtros de tags ───────────────────────────────────
function renderTagFilters(tags) {
  const container = document.getElementById('tag-filters');
  if (!tags.length) return;
  tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className   = 'filter-chip';
    btn.dataset.tag = tag.name;
    btn.textContent = tag.name;
    container.appendChild(btn);
  });

  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('active');
      container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      state.activeTag = isActive ? '' : btn.dataset.tag;
      if (!isActive) btn.classList.add('active');
      applyFilters();
    });
  });
}

// ─── Bind eventos ─────────────────────────────────────────────
function bindEvents() {
  // Búsqueda
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      applyFilters();
    }, 300);
  });

  // Precio
  document.querySelectorAll('input[name="price"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.activePrice = radio.value;
      applyFilters();
    });
  });

  // Ordenar
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    applyFilters();
  });

  // Precio (select nuevo)
  document.getElementById('price-select')?.addEventListener('change', (e) => {
    state.activePrice = e.target.value;
    applyFilters();
  });

  // Limpiar filtros
  document.getElementById('btn-clear-filters').addEventListener('click', clearFilters);
  document.getElementById('btn-reset-empty').addEventListener('click', clearFilters);
}

// ─── Aplicar filtros ──────────────────────────────────────────
function applyFilters() {
  let result = [...state.allCourses];

  if (state.activeCategory) {
    result = result.filter(c => c.category === state.activeCategory);
  }

  if (state.activePrice === 'free') {
    result = result.filter(c => c.isFree || c.price === 0);
  } else if (state.activePrice === 'paid') {
    result = result.filter(c => !c.isFree && c.price > 0);
  }

  if (state.activeTag) {
    result = result.filter(c => c.tags?.includes(state.activeTag));
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    result = result.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.subtitle?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.teacherName?.toLowerCase().includes(q) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
  }

  // Ordenar
  result = sortCourses(result, state.sortBy);

  state.filteredCourses = result;
  renderCourses(result);
  renderActiveFilters();
  document.getElementById('results-count').textContent =
    `${result.length} curso${result.length !== 1 ? 's' : ''} encontrado${result.length !== 1 ? 's' : ''}`;
}

// ─── Ordenar ──────────────────────────────────────────────────
function sortCourses(courses, sortBy) {
  return [...courses].sort((a, b) => {
    switch (sortBy) {
      case 'rating':     return (b.rating || 0) - (a.rating || 0);
      case 'students':   return (b.totalStudents || 0) - (a.totalStudents || 0);
      case 'price-asc':  return (a.price || 0) - (b.price || 0);
      case 'price-desc': return (b.price || 0) - (a.price || 0);
      default:           return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    }
  });
}

// ─── Render tarjetas ──────────────────────────────────────────
function renderCourses(courses) {
  const grid     = document.getElementById('courses-grid');
  const noResult = document.getElementById('no-results');

  if (!courses.length) {
    grid.classList.add('hidden');
    noResult.classList.remove('hidden');
    return;
  }

  noResult.classList.add('hidden');
  grid.classList.remove('hidden');

  grid.innerHTML = courses.map(course => {
    const thumb = course.thumbnailURL || '';
    const isFree = course.isFree || course.price === 0;
    const price = isFree
      ? `<span class="course-card-price free">Gratis</span>`
      : `<span class="course-card-price">${formatARS(course.price)}</span>`;
    const stars = '\u2605'.repeat(Math.round(course.rating || 0)) + '\u2606'.repeat(5 - Math.round(course.rating || 0));

    return `
      <a href="../course/course-detail.html?id=${course.courseId}" class="course-card">
        ${thumb
          ? `<img class="course-card-thumb" src="${thumb}" alt="${course.title}" loading="lazy" />`
          : `<div class="course-card-thumb-placeholder">
               <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                 <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
               </svg>
             </div>`
        }
        <div class="course-card-body">
          ${course.category ? `<span class="course-card-cat">${course.category}</span>` : ''}
          <div class="course-card-title">${course.title}</div>
          <div class="course-card-teacher">${course.teacherName}</div>
          <div class="course-card-footer">
            ${price}
            <span class="course-card-stars">${stars}</span>
          </div>
        </div>
      </a>`;
  }).join('');
}

// ─── Chips de filtros activos ─────────────────────────────────
function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  const chips = [];

  if (state.activeCategory) chips.push({ label: state.activeCategory, clear: () => { state.activeCategory = ''; document.querySelector('.filter-chip[data-category=""]').click(); } });
  if (state.activeTag)      chips.push({ label: `#${state.activeTag}`, clear: () => { state.activeTag = ''; document.querySelector(`.filter-chip[data-tag="${state.activeTag}"]`)?.classList.remove('active'); applyFilters(); } });
  if (state.activePrice !== 'all') chips.push({ label: state.activePrice === 'free' ? 'Gratis' : 'De pago', clear: () => { state.activePrice = 'all'; document.querySelector('input[name="price"][value="all"]').checked = true; applyFilters(); } });
  if (state.searchQuery)    chips.push({ label: `"${state.searchQuery}"`, clear: () => { state.searchQuery = ''; document.getElementById('search-input').value = ''; applyFilters(); } });

  container.innerHTML = chips.map((c, i) => `
    <span class="filter-chip active" style="gap:.375rem;" data-chip="${i}">
      ${c.label}
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </span>`).join('');

  container.querySelectorAll('[data-chip]').forEach(el => {
    el.addEventListener('click', () => chips[parseInt(el.dataset.chip)].clear());
  });
}

// ─── Limpiar todos los filtros ────────────────────────────────
function clearFilters() {
  state.activeCategory = '';
  state.activePrice    = 'all';
  state.activeTag      = '';
  state.searchQuery    = '';
  state.sortBy         = 'newest';

  document.getElementById('search-input').value = '';
  document.querySelector('input[name="price"][value="all"]').checked = true;
  document.getElementById('sort-select').value = 'newest';
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-chip[data-category=""]')?.classList.add('active');

  applyFilters();
}

init();

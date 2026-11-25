/* File: plataforma cursos SyM/assets/js/spa.js
 * Router SPA del sitio (storefront + dashboards).
 *
 * Objetivo: al navegar, NO se recarga el documento. Solo cambia el contenido,
 * el "chrome" se mantiene en el DOM y el tema/estilos globales persisten.
 *
 * Dos modos de intercambio:
 *  - storefront ↔ storefront: solo se reemplaza el contenido de .main-content
 *    (la topbar y el sidebar quedan quietos). Es el modo más fluido.
 *  - cualquier transición con dashboards: se reemplaza todo el body salvo los
 *    elementos persistentes (#app-loader, #cookie-banner, #toast-container),
 *    porque las páginas de dashboard traen modales y sidebar propios.
 *
 * Los scripts de la página destino se re-ejecutan así:
 *  - Módulos con `src`: vía import() con cache-bust (los ES modules se cachean
 *    por URL, así que re-insertarlos NO los vuelve a ejecutar).
 *  - Inline / clásicos: re-insertando el elemento <script>.
 */

import { initAppShell, resetSessionListeners } from './app.js';

const SPA_ROUTES = [
  // Storefront
  '/pages/catalog/catalog.html',
  '/pages/course/course-detail.html',
  '/pages/checkout/checkout.html',
  // Dashboards
  '/pages/dashboard-student/index.html',
  '/pages/dashboard-teacher/index.html',
  '/pages/dashboard-teacher/stats.html',
  '/pages/dashboard-admin/index.html',
  '/pages/dashboard-admin/courses.html',
  '/pages/dashboard-admin/categories.html',
  '/pages/dashboard-admin/users.html',
  '/pages/dashboard-admin/finances.html',
  '/pages/dashboard-admin/moderation.html',
  '/pages/dashboard-admin/course-review.html'
];

const PERSISTENT = ['#app-loader', '#cookie-banner', '#toast-container'];

function matchRoute(url, allowCurrent = false) {
  try {
    const u = new URL(url, window.location.href);
    const path = u.pathname.replace(/\/+/g, '/');
    const route = SPA_ROUTES.find(r => path.endsWith(r));
    if (!route) return null;
    // En popstate el href actual ES el destino, así que se permite el match.
    if (!allowCurrent && u.href === window.location.href) return null;
    return { url: u.href, path };
  } catch {
    return null;
  }
}

// Marca los estilos inline de la página actual para descartarlos en el swap.
function tagCurrentStyles() {
  document.querySelectorAll('style:not([data-spa-css]):not(#spa-transition)')
    .forEach(s => s.setAttribute('data-spa-css', ''));
}

// ─── Re-ejecutar los scripts de la página destino ─────────────
function rerunScripts(doc, targetUrl) {
  const tasks = [];
  for (const s of [...doc.scripts]) {
    const src = (s.src || '').split('/').pop();
    if (src === 'spa.js' || src === 'app.js') continue;

    if (s.src && s.type === 'module') {
      const url = new URL(s.getAttribute('src'), targetUrl).href;
      const bust = (url.includes('?') ? '&' : '?') + '_spa=' + Date.now() + Math.floor(Math.random() * 1e4);
      tasks.push(import(url + bust).catch(err => console.error('SPA: módulo no re-ejecutado', url, err)));
    } else {
      const el = document.createElement('script');
      if (s.src) el.src = s.src;
      if (s.type) el.type = s.type;
      if (s.async) el.async = true;
      if (s.defer) el.defer = true;
      if (s.text) el.text = s.text;
      document.body.appendChild(el);
    }
  }
  return Promise.all(tasks);
}

// ─── Modo storefront: solo el contenido de .main-content ──────
function swapContentOnly(doc) {
  const currentMC = document.querySelector('.main-content');
  const newMC = doc.querySelector('.main-content');
  const currentTopbar = currentMC.querySelector('.topbar');
  [...currentMC.children].forEach(c => { if (c !== currentTopbar) c.remove(); });
  [...newMC.children].forEach(c => {
    if (c.classList && c.classList.contains('topbar')) return;
    currentMC.appendChild(c);
  });
}

// ─── Modo general: todo el body salvo elementos persistentes ──
function swapFullBody(doc) {
  const keepEls = PERSISTENT.map(sel => document.querySelector(sel)).filter(Boolean);

  const bodyClone = doc.body.cloneNode(true);
  bodyClone.querySelectorAll('script').forEach(s => s.remove());
  const newChildren = [...bodyClone.children].filter(c => !(c.matches && PERSISTENT.some(sel => c.matches(sel))));

  [...document.body.children].forEach(c => { if (!keepEls.includes(c)) c.remove(); });
  newChildren.forEach(c => document.body.appendChild(c));
}

function swapPageStyles(doc) {
  document.querySelectorAll('style[data-spa-css]').forEach(s => s.remove());
  doc.querySelectorAll('style').forEach(s => {
    const clone = s.cloneNode(true);
    clone.setAttribute('data-spa-css', '');
    document.head.appendChild(clone);
  });
}

// ─── Cross-fade entre páginas ──────────────────────────────────
function captureOverlay() {
  document.getElementById('spa-fade-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'spa-fade-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;overflow:hidden;' +
    'pointer-events:none;background:var(--bg-primary,#0d0d0f);';
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script').forEach(s => s.remove());
  overlay.appendChild(clone);
  return overlay;
}

function releaseOverlay(overlay) {
  document.body.appendChild(overlay);
  overlay.scrollTop = window.scrollY;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.style.transition = 'opacity .18s ease';
      overlay.style.opacity = '0';
    });
  });
  setTimeout(() => overlay.remove(), 400);
}

async function loadPage(target, push) {
  const currentIsDashboard = !!document.querySelector('.app-layout');

  try {
    const res = await fetch(target.url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const targetIsDashboard = !!doc.querySelector('.app-layout');
    const hasContent = targetIsDashboard
      ? doc.querySelector('.app-layout .main-content')
      : doc.querySelector('.main-content');
    if (!hasContent) { window.location.href = target.url; return; }

    const overlay = captureOverlay();

    const fullSwap = targetIsDashboard || currentIsDashboard;
    if (fullSwap) swapFullBody(doc);
    else swapContentOnly(doc);

    swapPageStyles(doc);

    const t = doc.querySelector('title');
    if (t) document.title = t.textContent;

    if (push) window.history.pushState({ spa: target.url }, '', target.url);

    // Los callbacks de sesión de la página anterior ya no deben correr.
    resetSessionListeners();

    // Si el chrome cambió (swap completo), hay que re-inicializarlo.
    if (fullSwap) initAppShell();

    releaseOverlay(overlay);

    await rerunScripts(doc, target.url);

    window.scrollTo(0, 0);
  } catch (err) {
    console.error('SPA: falló la navegación fluida, voy a carga normal:', err);
    window.location.href = target.url;
    return;
  }
}

function injectTransitionStyle() {
  const style = document.createElement('style');
  style.id = 'spa-transition';
  style.textContent =
    '.spa-loading { opacity:.35; transition:opacity .15s ease; }' +
    'body { transition:opacity .15s ease; }';
  document.head.appendChild(style);
}

function init() {
  injectTransitionStyle();
  tagCurrentStyles();

  // Navegación por clic
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    const target = matchRoute(href);
    if (!target) return;
    e.preventDefault();
    loadPage(target, true);
  });

  // Retroceder / avanzar en el historial
  window.addEventListener('popstate', () => {
    const target = matchRoute(window.location.href, true);
    if (target) loadPage(target, false);
  });
}

init();

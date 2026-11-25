// File: plataforma cursos SyM/assets/js/storage.js

import { auth } from '../../firebase/firebase-config.js';

const CLOUD_NAME    = 'lp0mpzzi';
const UPLOAD_PRESET = 'curso-sym';
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

// ─── Borrado seguro en Cloudinary (vía server) ───────────────
// El server valida el token de Firebase y el rol antes de borrar.
export async function deleteCloudinaryFolder(folder) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  if (!token) throw new Error('No hay sesión activa.');

  const res = await fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ folder })
  });

  if (!res.ok) {
    let msg = 'No se pudo borrar la carpeta en Cloudinary.';
    try { const data = await res.json(); msg = data.error || msg; } catch (e) { /* ignorar */ }
    throw new Error(msg);
  }
  return res.json();
}

// ─── Subida genérica a Cloudinary ────────────────────────────
// folder:      carpeta destino en Cloudinary
// publicId:    nombre del archivo sin extensión
// file:        File object del input
// onProgress:  callback(percent) opcional
async function uploadToCloudinary(file, folder, publicId, onProgress = null) {
  // Agregamos timestamp para evitar conflictos con el overwrite:false del preset
  const uniqueId = `${publicId}_${Date.now()}`;
  const formData = new FormData();
  formData.append('file',           file);
  formData.append('upload_preset',  UPLOAD_PRESET);
  formData.append('folder',         folder);
  formData.append('public_id',      uniqueId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Cloudinary error: ${xhr.status} — ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al subir archivo.'));
    xhr.send(formData);
  });
}

// ─── Video de clase ───────────────────────────────────────────
// Sube a: cursos-sym/{teacherId}/{courseId}/videos/{moduleId}_{lessonId}
export async function uploadLessonVideo(file, teacherId, courseId, moduleId, lessonId, onProgress = null) {
  const folder   = `cursos-sym/${teacherId}/${courseId}/videos`;
  const publicId = `${moduleId}_${lessonId}`;
  const result   = await uploadToCloudinary(file, folder, publicId, onProgress);
  return result.secure_url;
}

// ─── Thumbnail del curso ──────────────────────────────────────
// Sube a: cursos-sym/{teacherId}/{courseId}/thumbnails/thumbnail
export async function uploadCourseThumbnail(file, teacherId, courseId, onProgress = null) {
  const folder   = `cursos-sym/${teacherId}/${courseId}/thumbnails`;
  const publicId = 'thumbnail';
  const result   = await uploadToCloudinary(file, folder, publicId, onProgress);
  return result.secure_url;
}

// ─── Video promocional del curso ──────────────────────────────
// Sube a: cursos-sym/{teacherId}/{courseId}/promo/promo
export async function uploadPromoVideo(file, teacherId, courseId, onProgress = null) {
  const folder   = `cursos-sym/${teacherId}/${courseId}/promo`;
  const publicId = 'promo';
  const result   = await uploadToCloudinary(file, folder, publicId, onProgress);
  return result.secure_url;
}

// ─── Render de video Cloudinary ───────────────────────────────
export function renderCloudinaryVideo(containerId, videoUrl) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!videoUrl) {
    container.innerHTML = `
      <div style="aspect-ratio:16/9;background:var(--bg-secondary);display:flex;
        align-items:center;justify-content:center;border-radius:var(--radius-md);
        color:var(--text-muted);font-size:.875rem;">
        Sin video disponible
      </div>`;
    return;
  }

  container.innerHTML = `
    <video
      src="${videoUrl}"
      controls
      controlsList="nodownload"
      style="width:100%;aspect-ratio:16/9;border-radius:var(--radius-md);background:#000;display:block;"
      preload="metadata"
    >
      Tu navegador no soporta la reproducción de video.
    </video>`;
}

// ─── Componente de subida con progreso ────────────────────────
// Renderiza un input de archivo con barra de progreso dentro de un contenedor
// onUploaded(url) se llama cuando termina la subida
export function renderUploadInput({
  containerId,
  accept,
  label,
  uploadFn,       // función async que recibe (file) y devuelve url
  onUploaded,
  currentUrl = null
}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const hasFile = !!currentUrl;

  container.innerHTML = `
    <div class="upload-box" id="upload-box-${containerId}">
      ${hasFile ? renderFilePreview(currentUrl, accept) : ''}
      <label
        id="upload-label-${containerId}"
        style="
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:.75rem;padding:1.5rem;border:2px dashed var(--border);
          border-radius:var(--radius-md);cursor:pointer;
          transition:border-color .2s,background .2s;
          background:var(--bg-primary);
          ${hasFile ? 'margin-top:.75rem;' : ''}
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted);pointer-events:none;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
        </svg>
        <span id="upload-label-text-${containerId}" style="font-size:.875rem;color:var(--text-muted);pointer-events:none;text-align:center;">${label}<br><span style="font-size:.75rem;opacity:.6;">Clic o arrastrá el archivo acá</span></span>
        <input type="file" accept="${accept}" style="display:none;" id="file-input-${containerId}" />
      </label>

      <!-- Barra de progreso -->
      <div id="progress-wrap-${containerId}" class="hidden" style="margin-top:.75rem;">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted);margin-bottom:.375rem;">
          <span id="progress-filename-${containerId}"></span>
          <span id="progress-pct-${containerId}">0%</span>
        </div>
        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${containerId}" style="height:100%;background:var(--accent);border-radius:3px;width:0%;transition:width .2s;"></div>
        </div>
      </div>

      <!-- Error -->
      <p id="upload-error-${containerId}" class="hidden" style="font-size:.8125rem;color:var(--error);margin-top:.5rem;"></p>
    </div>`;

  const labelEl   = document.getElementById(`upload-label-${containerId}`);
  const fileInput = document.getElementById(`file-input-${containerId}`);

  // ─── Función central de subida ────────────────────────────────
  async function handleFile(file) {
    if (!file) return;

    const progressWrap = document.getElementById(`progress-wrap-${containerId}`);
    const progressBar  = document.getElementById(`progress-bar-${containerId}`);
    const progressPct  = document.getElementById(`progress-pct-${containerId}`);
    const progressName = document.getElementById(`progress-filename-${containerId}`);
    const errorEl      = document.getElementById(`upload-error-${containerId}`);

    // Resetear estado visual
    progressBar.style.background = 'var(--accent)';
    progressBar.style.width      = '0%';
    progressPct.textContent      = '0%';
    errorEl.classList.add('hidden');
    progressWrap.classList.remove('hidden');
    progressName.textContent = file.name.length > 30 ? file.name.slice(0, 30) + '…' : file.name;

    try {
      const url = await uploadFn(file, (pct) => {
        progressBar.style.width = `${pct}%`;
        progressPct.textContent = `${pct}%`;
      });

      progressBar.style.width      = '100%';
      progressPct.textContent      = '100%';
      progressBar.style.background = 'var(--success)';

      // Actualizar preview
      const box = document.getElementById(`upload-box-${containerId}`);
      const existingPreview = box.querySelector('.file-preview');
      if (existingPreview) existingPreview.remove();
      box.insertAdjacentHTML('afterbegin', renderFilePreview(url, accept));

      setTimeout(() => progressWrap.classList.add('hidden'), 1500);

      // Resetear el input para permitir volver a seleccionar el mismo archivo
      fileInput.value = '';

      onUploaded(url);
    } catch (err) {
      progressWrap.classList.add('hidden');
      errorEl.textContent = 'Error al subir el archivo. Intentá de nuevo.';
      errorEl.classList.remove('hidden');
      console.error('Upload error:', err);
    }
  }

  // ─── Evento: selección por clic ───────────────────────────────
  fileInput.addEventListener('change', (e) => {
    handleFile(e.target.files[0]);
  });

  // ─── Eventos: drag & drop ────────────────────────────────────
  labelEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    labelEl.style.borderColor = 'var(--accent)';
    labelEl.style.background  = 'var(--accent-dim)';
  });

  labelEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    labelEl.style.borderColor = 'var(--border)';
    labelEl.style.background  = 'var(--bg-primary)';
  });

  labelEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    labelEl.style.borderColor = 'var(--border)';
    labelEl.style.background  = 'var(--bg-primary)';
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ─── Hover con mouse ─────────────────────────────────────────
  labelEl.addEventListener('mouseenter', () => {
    labelEl.style.borderColor = 'var(--accent)';
    labelEl.style.background  = 'var(--accent-dim)';
  });
  labelEl.addEventListener('mouseleave', () => {
    labelEl.style.borderColor = 'var(--border)';
    labelEl.style.background  = 'var(--bg-primary)';
  });
}

function renderFilePreview(url, accept) {
  if (accept.includes('video')) {
    return `
      <div class="file-preview" style="margin-bottom:.75rem;border-radius:var(--radius-md);overflow:hidden;background:#000;">
        <video src="${url}" controls controlsList="nodownload"
          style="width:100%;max-height:200px;display:block;" preload="metadata"></video>
      </div>`;
  }
  if (accept.includes('image')) {
    return `
      <div class="file-preview" style="margin-bottom:.75rem;border-radius:var(--radius-md);overflow:hidden;">
        <img src="${url}" alt="Preview" style="width:100%;max-height:180px;object-fit:cover;display:block;" />
      </div>`;
  }
  return `
    <div class="file-preview" style="margin-bottom:.75rem;padding:.75rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);font-size:.8125rem;color:var(--text-secondary);display:flex;align-items:center;gap:.375rem;">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color:var(--success);flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      Archivo subido: <a href="${url}" target="_blank" style="color:var(--accent);">ver archivo</a>
    </div>`;
}

// ─── Thumbnail helper (Cloudinary o fallback) ───────────────
export function getCourseThumbnail(course) {
  return course?.thumbnailURL || null;
}

// ─── Google Drive (solo certificados PDF) ────────────────────
export function getDrivePreviewLink(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return url;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
}

export function isValidDriveUrl(url) {
  return url?.includes('drive.google.com') ?? false;
}

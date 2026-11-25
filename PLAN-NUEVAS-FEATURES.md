# PLAN: Moderación, borradores, Cloudinary y gestión de cursos

## ⚠️ LECTURA OBLIGATORIA PARA SESIÓN NUEVA

Este archivo es el **único contexto autorizado** para continuar el proyecto. Antes de tocar código:

1. Leé TODO este archivo.
2. **NO empeces a programar todavía.** Primero mostrale al usuario la sección **8) CREDENCIALES Y CONFIGURACIÓN FALTANTE** y pedile **todas las keys necesarias + su OK**.
3. Recién cuando el usuario confirme que ya cargó las credenciales (o las pase él), arrancá con el **orden de trabajo** de la sección 7, pidiendo OK al final de cada hito.

Si falta cualquier credencial/config y el código no puede funcionar, **NO improvises**: pedí los datos faltantes.

---

## 0) DATOS DEL PROYECTO

- Ruta: `C:\Users\sebas\Desktop\proyecto plataforma de cursos\plataforma cursos SyM\`
- Levantar: `npm start` (Express en :4000), `ngrok http 4000`.
- Admin principal UID: `9IztY8OndFQjnCqJEdxlTGzh7u52` (no se puede eliminar).
- Rol `sub_admin` permitido en todas las páginas admin junto con `admin`.

---

## 1) BUGS ENCONTRADOS (arreglarlos como parte del plan)

1. **"Ver ficha del curso" en moderación no muestra nada**
   - Botón en `assets/js/moderation.js` (link a `course-detail.html?id=...`).
   - Causa: `pages/course/course-detail.html` línea ~288: `if (!course || course.status !== 'published')` → muestra error. Los cursos en moderación están `pending`.
   - Fix: permitir preview a admin/sub_admin de cursos en cualquier estado con `?preview=1`.

2. **Draft no guarda imágenes/miniaturas** (`assets/js/course-editor.js`)
   - Bug 1: `initMediaUploads` se llama 2 veces al editar curso existente (línea 99 con URLs y línea 50 sin URLs) → la segunda pisa el preview.
   - Bug 2: `getFormSnapshot()` (autosave a localStorage) NO incluye `thumbnailURL` ni `promoVideoURL` → al restaurar borrador local se pierde la imagen.
   - Bug 3: en curso nuevo las subidas van a carpeta `cursos-sym/{teacherId}/new/...` porque no existe courseId → archivos huérfanos. Se soluciona con el punto 4B (auto-crear borrador al abrir el editor).

---

## 2) LO QUE YA EXISTE EN LA APP

- Subida a Cloudinary (preset unsigned) para: thumbnail, video promo, videos de clase → `assets/js/storage.js`.
  - Folders: `cursos-sym/{teacherId}/{courseId}/thumbnails`, `/promo`, `/videos`.
  - NO existe función de borrado en Cloudinary.
- CRUD de cursos en `assets/js/db.js`:
  - `createCourse` (status `draft`), `updateCourse`, `submitCourseForReview` (→ `pending`), `approveCourse` (→ `published`), `rejectCourse` (→ `rejected` + `rejectionReason`).
  - `getCoursesByTeacher`, `getPendingCourses`, `getPublishedCourses`.
  - NO existe `deleteCourse` ni `getAllCourses`.
- Sistema de notificaciones (`createNotification`, campanita) → sirve para avisar a admin/profe/alumnos.
- `server.js` solo tiene Mercado Pago. NO tiene Cloudinary ni Firebase Admin.
- Admin: secciones Panel, Moderación (solo pendientes), Categorías, Usuarios, Finanzas. NO hay gestión de todos los cursos.

---

## 3) DECISIONES CONFIRMADAS POR EL USUARIO

1. **Auto-crear borrador al abrir el editor nuevo** → así existe `courseId` antes de subir multimedia (todo sube a la carpeta correcta). Ya hay medidas anti-cierre, esto es para los folders.
2. **Eliminar curso publicado con alumnos = "archivado"** → queda en historial, los alumnos no pierden su dinero ni el acceso.
3. **Seguridad endpoint de borrado Cloudinary: OPCIÓN B (ROBUSTA)** — validar token de Firebase con `firebase-admin`. El server verifica identidad y rol (admin/sub_admin, o el teacher dueño del curso) antes de borrar. El usuario se encarga de pasar todas las keys necesarias.
4. **Admin/sub_admin debe ver TODO** (clases, videos, módulos) en el preview → por eso todo tiene que estar en Cloudinary.
5. **Las solicitudes de eliminación van al panel admin** (en moderación o en la nueva página "Cursos") y se notifica a alumnos y profesor.

---

## 4) PLAN DE IMPLEMENTACIÓN

### A. Backend: borrado seguro en Cloudinary (OPCIÓN B)
- Instalar en server.js: `cloudinary` y `firebase-admin`.
- `.env` (ver sección 8 para la lista completa de keys).
- Endpoint `POST /api/cloudinary/delete`:
  1. Recibe `Authorization: Bearer <token>` (ID token de Firebase del usuario) + `{ folder }`.
  2. Verifica el token con `firebase-admin` (`verifyIdToken`).
  3. Valida rol: admin/sub_admin, o teacher dueño del curso (verifica que `folder` contenga su `teacherId`).
  4. `cloudinary.v2.api.delete_resources_by_prefix(folder)` para borrar la carpeta del curso.
  5. Devuelve error 401/403 si no está autorizado.
- NOTA: para "archivado con compradores" NO se borran assets (los alumnos siguen consumiendo).

### B. Editor de curso (`course-editor.js`)
- Al abrir editor SIN `?id=`: crear el doc borrador en Firestore de inmediato (status `draft`, título temporal "Nuevo curso") → obtener `courseId` → subidas usan carpeta real.
- Arreglar doble llamada a `initMediaUploads`.
- Agregar `thumbnailURL`/`promoVideoURL` a `getFormSnapshot()`.

### C. Rechazo (moderación)
- `rejectCourse` (db.js) ya existe: pone `rejected` + motivo.
- Se AGREGA: llamar al endpoint `/api/cloudinary/delete` con la carpeta del curso → borra solo multimedia.
- El curso queda en el borrador del profesor; el profe solo re-sube multimedia y reenvía (no lo recrea).

### D. Aprobación
- Nada se borra. Todo normal.

### E. Eliminar borrador (profesor)
- Botón nuevo en la lista de cursos del panel teacher (`dashboard-teacher.js`) para status `draft`/`rejected`.
- Acción: borrar Firestore (doc + subcolecciones módulos/quiz/examen) + carpeta Cloudinary.

### F. Solicitar eliminar curso publicado (con o sin compradores)
- Botón "Solicitar eliminar" en el panel teacher para cursos `published`.
- Crea notificación tipo `course_delete_request` hacia admin.
- Admin decide desde su panel (moderación o nueva página "Cursos").
- Si aprueba:
  - **Con alumnos comprados:** status → `removed` (archivado). Oculto del catálogo y moderación, PERO los alumnos siguen accediendo al curso (course-player valida inscripción, no status). NO se borran assets. Se notifica a alumnos + profesor.
  - **Sin alumnos:** borrado total (Firestore + Cloudinary).

### G. Nueva página admin "Cursos" (`dashboard-admin/courses.html` + `admin-courses.js`)
- Tabs por estado: Todos / Borradores / En revisión / Publicados / Rechazados / Archivados.
- Buscador, acciones: ver preview, aprobar, rechazar, eliminar, archivar, gestionar solicitudes de eliminación.
- Agregar link en sidebar de todas las páginas admin.
- Nueva función `getAllCourses()` en db.js.

### H. Preview para admin
- `course-detail.html`: permitir ver cualquier estado si rol admin/sub_admin y `?preview=1`.
- Debe mostrar todo: descripción, módulos, clases, videos (reproducibles), promo, thumbnail.

### I. Gestión de reseñas (alumno / profesor / admin)
- **Alumno — editar su reseña:** el doc `reviews/{studentId}_{courseId}` ya se sobrescribe con `saveReview`, así que editar es re-abrir el modal precargado (estrellas + comentario) y guardar. Se actualiza el rating promedio automáticamente.
- **Profesor — ver reseñas:** listado de reseñas de sus cursos (stats o panel), con autor, estrellas, comentario y fecha. Solo lectura.
- **Admin — moderación:** página/panel con TODAS las reseñas (buscador por curso/profesor), acción borrar (con confirmación) → nueva `deleteReview` en db.js que borra el doc y recalcula `rating`/`totalRatings` del curso.

### J. Contra petición de republicación (curso archivado)
- **Profesor:** un curso `removed` (archivado por su solicitud) muestra "Solicitar republicación" en su panel → crea notificación tipo `course_re_publish_request` al admin.
- **Admin:** desde la página "Cursos" gestiona estas peticiones (modal similar al de solicitudes de eliminación):
  - **Aprobar:** status `removed` → `published` (vuelve al catálogo), se notifica al profesor.
  - **Rechazar:** se notifica al profesor.
- No se tocan enrollments ni assets (nunca se borraron en el archivado).

### K. Dashboard de profesor con secciones (varios cursos)
- Problema: con muchos cursos, toda la info (stats, lista, reseñas, actividad) se mezcla en pantalla y el sidebar tiene pocas secciones.
- **Sidebar con más secciones:** Panel principal · Mis cursos · Nuevo curso · Reseñas · Actividad · Estadísticas · Ver catálogo.
- **"Mis cursos" como vista propia:** filtros por estado (Todos / Publicados / En revisión / Borradores / Rechazados / Archivados) + buscador por título.
- **Reseñas y Actividad en vistas propias** (ya no todo apilado en el panel).
- Referencia visual: mismo patrón de tabs/paneles del dashboard de alumno y de la página admin "Cursos".

### L. Navegación SPA (sin recarga) en el sidebar
- Problema: cada clic en el sidebar recarga la página entera (parpadeo blanco, se pierde header/barra, se re-inicializa todo).
- **Objetivo:** que al navegar con el sidebar solo cambie el contenido (`main-content`), sin recargar toda la app, con actualización de URL (history API) y estado activo del link.
- Alcance: storefront (catalog / course-detail / checkout) y dashboards (student / teacher / admin).
- Implementación: router ligero (`assets/js/spa.js`) que hace `fetch()` del HTML destino, intercambia **solo** el contenido de `.main-content` (el "chrome" — sidebar, topbar, tema — se mantiene en el DOM y nunca se re-renderiza), intercambia los estilos propios de la página (`data-spa-css`), actualiza `<title>` y re-ejecuta los scripts del destino (excepto `app.js`/`spa.js`). Usa `history.pushState` + `popstate`.
- **Decisión de arquitectura:** `onSessionChange` en `app.js` es ahora un singleton (una sola suscripción `onAuthStateChanged`) con **replay** de la última sesión (`resetSessionListeners()` limpia los callbacks de la página anterior al navegar). `requireRole` cachea la sesión por rol para resolver al instante al re-ejecutar un dashboard. `listenNotifications` de `db.js` ya devuelve unsubscribe (latest-wins).
- El markup de las barras sigue estando en cada `.html`, pero el SPA lo descarta (usa el chrome del DOM persistente), así que la duplicación no afecta al runtime. Opcional futuro: inyectar las barras una sola vez desde JS.

---

## 5) ARCHIVOS CLAVE

- `assets/js/moderation.js` — moderación de cursos (botón "Ver ficha").
- `assets/js/course-editor.js` — editor/draft (bugs de imágenes, auto-crear borrador).
- `assets/js/storage.js` — subidas Cloudinary (sin delete).
- `assets/js/db.js` — CRUD cursos (falta deleteCourse/getAllCourses).
- `assets/js/dashboard-teacher.js` — lista de cursos del profe (faltan botones eliminar/solicitar).
- `pages/course/course-detail.html` — preview (bloqueado a published).
- `server.js` — falta Cloudinary + Firebase Admin + endpoint delete.
- `pages/dashboard-admin/` — falta courses.html.
- `.env` — faltan variables Cloudinary y Firebase.
- `package.json` — falta instalar `cloudinary` y `firebase-admin`.

---

## 6) REGLAS DE TRABAJO

- Hablar en español, mínimo, orientado a resultados.
- **Antes de programar, pedir al usuario las credenciales de la sección 8 y su OK.**
- El usuario aprueba por hitos: mostrar avances y pedir OK al final de cada uno.
- **No inventar credenciales ni valores de configuración.** Si falta algo, preguntar.
- Iconos: estilo profesional SVG (Heroicons, `stroke="currentColor"`), sin emojis.
- No tocar `node_modules`.
- Verificar con `node --check` los JS modificados al terminar cada hito.

---

## 7) ORDEN DE TRABAJO (por hitos, pedir OK entre cada uno)

- **Hito 1 — Base backend:** instalar `cloudinary` + `firebase-admin`, cargar `.env` con las keys del usuario, endpoint `POST /api/cloudinary/delete` con validación de token Firebase. Probar borrado manual de una carpeta de prueba.
- **Hito 2 — Editor de curso:** auto-crear borrador al abrir editor nuevo, arreglar doble `initMediaUploads`, agregar URLs al `getFormSnapshot`.
- **Hito 3 — Rechazo con limpieza:** en moderación, al rechazar → borrar carpeta Cloudinary + dejar curso `rejected`. El profe re-subé multimedia y reenvía.
- **Hito 4 — Eliminar borrador (profe):** botón eliminar borrador/rechazado en panel teacher → Firestore + Cloudinary.
- **Hito 5 — Solicitar eliminar publicado:** botón en panel teacher + notificación `course_delete_request` al admin.
- **Hito 6 — Página admin "Cursos":** gestión completa de todos los cursos + gestión de solicitudes de eliminación + links en sidebar.
- **Hito 7 — Preview admin:** `course-detail.html` con `?preview=1` para admin/sub_admin (todo visible, videos reproducibles) + arreglar botón "Ver ficha" en moderación.
- **Hito 8 — Archivado con compradores:** flujo completo: status `removed`, oculto del catálogo, alumnos siguen accediendo, notificación a alumnos + profesor.
- **Hito 9 — Gestión de reseñas:** editar reseña del alumno (modal precargado), profesor ve reseñas de sus cursos, admin modera (ver todas + borrar con `deleteReview`).
- **Hito 10 — Contra petición de republicación:** profesor pide republicar un curso `removed` (`course_re_publish_request`), admin aprueba (→ `published`) o rechaza desde "Cursos", con notificaciones.
- **Hito 11 — Dashboard de profesor con secciones:** sidebar con más secciones, "Mis cursos" con filtros por estado + buscador, reseñas y actividad en vistas propias.
- **Hito 12 — Navegación SPA:** router ligero (`spa.js`) que cambia el contenido sin recargar la app. Storefront: swap de solo `.main-content` (topbar/sidebar quietos). Dashboards (student/teacher/admin): swap completo de body (los modales viven fuera de `.app-layout`), `initAppShell()` reinicializa el chrome nuevo. Módulos de página se re-ejecutan vía `import()` con cache-bust (los ES modules se cachean por URL; re-insertar no re-ejecuta). Sesión singleton en `app.js` (`onSessionChange` con replay + `resetSessionListeners`, `requireRole` con caché, `logout` limpia caché). `listenNotifications` latest-wins en `db.js`. Incluye `spa.js` en todas las páginas de dashboard.

---

## 8) CREDENCIALES Y CONFIGURACIÓN FALTANTE (pedir al usuario ANTES de programar)

⚠️ **Si algo de esto falta, el código de los hitos 1-8 no va a funcionar. Pedir TODO esto al usuario y su OK antes de empezar.**

1. **Cloudinary (para el borrado de archivos):**
   - `CLOUDINARY_CLOUD_NAME` (ya hay un `lp0mpzzi` hardcodeado en `storage.js`, confirmar que es el correcto).
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - OJO: las subidas actuales usan un preset unsigned (`curso-sym`). Para borrar se usa la API con Key+Secret. El usuario debe generarlas y pasarlas.

2. **Firebase Admin (para validar tokens en el server):**
   - Archivo de service account (JSON) del proyecto Firebase → típicamente `firebase-adminsdk.json` (colocar en la raíz del proyecto o ruta definida).
   - Opción equivalente: variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (si el usuario prefiere env vars).

3. **Confirmar que estas dos librerías se pueden instalar:** `cloudinary` y `firebase-admin` (npm). Si el proyecto debe quedar portable, recordar que van a `package.json`.

4. **Config extra (a definir):**
   - ¿Las subidas actuales (preset unsigned) se mantienen igual o se migran a subidas firmadas? (Por defecto: se mantienen como están; solo el borrado pasa por server).

**FORMATO PARA PEDIR AL USUARIO (copiar en la sesión nueva):**
> "Para arrancar el Hito 1 necesito que me pases: (1) CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET (de tu panel de Cloudinary → Settings → API Keys), (2) el JSON de service account de Firebase (Consola Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada), y (3) confirmar que puedo instalar `cloudinary` y `firebase-admin` con npm. ¿Las tenés / las cargo y te doy OK?"

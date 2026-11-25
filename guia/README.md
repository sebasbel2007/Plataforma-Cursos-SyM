# Cursos SyM — Plataforma de Educación Online

Marketplace de cursos online con sistema de roles, evaluación integrada y pasarela de pagos.  
Proyecto escolar — Desarrollo web con servicios en la nube.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Auth | Firebase Authentication |
| Base de Datos | Firebase Firestore |
| Almacenamiento (temp) | YouTube (videos), Google Drive (PDFs) |
| Pagos (temp) | Mercado Pago Sandbox |
| Hosting | GitHub Pages |

> **Temporal:** YouTube y Drive serán reemplazados por una solución de almacenamiento definitiva en la etapa final. Mercado Pago Sandbox será configurado con credenciales reales al finalizar.

---

## Roles de Usuario

- **Alumno** — Registro gratuito. Compra cursos individuales. Consume contenido, hace quizzes y examen final. Obtiene certificado PDF.
- **Profesor** — Membresía única de $20.000 ARS. Crea y publica cursos. Recibe 70% de cada venta. Sus cursos pasan por moderación antes de publicarse.
- **Administrador** — Control total. Modera cursos, gestiona usuarios y finanzas.

---

## Reglas de Negocio Clave

- Split de pagos: **70% Profesor / 30% Plataforma** (fijo, no configurable)
- Membresía profesor: **$20.000 ARS** (pago único)
- Precio de cursos: **$0 (gratis) hasta $500 USD en ARS**
- Reembolso: permitido solo si el alumno consumió **menos del 50% de los módulos**
- Cursos: máximo **15 módulos** por curso
- Quiz por módulo: **obligatorio** para avanzar al siguiente
- Examen final: **multiple choice**, corrección automática
- Todo curso (incluso gratuito) pasa por **moderación del Admin** antes de publicarse
- Categorías y etiquetas: creadas por **Admin y Profesores**
- Notificaciones in-app: **tiempo real** (Firestore listeners)
- Correos transaccionales: **pendiente** (se implementa con la pasarela definitiva)
- Idioma: **Español únicamente**

---

## Diseño y UI

- Modo claro y oscuro con toggle (botón en esquina desktop / menú lateral mobile)
- Logo cambia según el modo: `logo-claro.png` / `logo-oscuro.png`
- Paleta: fondos gris oscuro/negro, texto blanco, acento azul/cian neón suave
- Layout: **Bento Grid** para dashboards y paneles
- Tarjetas de cursos: esquinas redondeadas, miniatura, barra de progreso, efecto apilamiento si hay múltiples en categoría
- Menú lateral fijo (desktop) / desplegable (mobile)
- Tipografía sans-serif moderna, contraste claro entre títulos e info secundaria

---

## Estructura de Carpetas

```
plataforma cursos SyM/
├── index.html                  # Landing / Catálogo (página de inicio)
├── assets/
│   ├── css/
│   │   ├── main.css            # Estilos globales, variables, temas
│   │   ├── components.css      # Tarjetas, botones, modales, bento grid
│   │   └── responsive.css      # Media queries
│   ├── js/
│   │   ├── app.js              # Inicialización, router, tema claro/oscuro
│   │   ├── auth.js             # Login, registro, logout, estado de sesión
│   │   ├── db.js               # Todas las operaciones con Firestore
│   │   ├── storage.js          # Manejo de URLs (YouTube/Drive por ahora)
│   │   ├── payments.js         # Integración Mercado Pago Sandbox
│   │   └── notifications.js    # Listeners en tiempo real, campanita
│   └── img/                    # Imágenes estáticas de la UI
├── pages/
│   ├── auth/
│   │   ├── login.html
│   │   └── register.html
│   ├── catalog/
│   │   └── catalog.html        # Catálogo con filtros
│   ├── course/
│   │   ├── course-detail.html  # Ficha del curso (antes de comprar)
│   │   ├── course-player.html  # Consumo de contenido (video+texto+quiz)
│   │   └── course-exam.html    # Examen final
│   ├── checkout/
│   │   └── checkout.html       # Confirmación de compra + términos
│   ├── dashboard-student/
│   │   └── index.html          # Dashboard del alumno
│   ├── dashboard-teacher/
│   │   ├── index.html          # Dashboard del profesor
│   │   ├── course-editor.html  # Crear/editar curso (módulos, clases, quizzes)
│   │   └── stats.html          # Estadísticas de ventas y alumnos
│   └── dashboard-admin/
│       ├── index.html          # Panel admin principal
│       ├── moderation.html     # Cola de cursos para aprobar/rechazar
│       ├── users.html          # Gestión de usuarios
│       └── finances.html       # Pagos, comisiones, disputas, reembolsos
├── firebase/
│   ├── firebase-config.js      # Credenciales Firebase (referencia a .env)
│   ├── firestore-rules.txt     # Reglas de seguridad de Firestore
│   └── firestore-schema.md     # Esquema completo de colecciones
├── legal/
│   ├── terms.html              # Términos y condiciones
│   └── privacy.html            # Política de privacidad
└── .env.example                # Variables de entorno requeridas
```

---

## Setup

```bash
# 1. Clonar repositorio
git clone https://github.com/[usuario]/cursos-sym.git

# 2. Copiar variables de entorno
cp .env.example .env
# Completar con credenciales de Firebase y Mercado Pago Sandbox

# 3. Abrir index.html en navegador o deployar en GitHub Pages
```

---

## Estado del Proyecto

Ver `CONTEXTO.md` para el estado detallado por módulo y etapas de desarrollo.

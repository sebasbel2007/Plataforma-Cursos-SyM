// File: plataforma cursos SyM/assets/js/auth.js

import { auth } from '../../firebase/firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createUserDoc, getUserData } from './db.js';
import { showToast, redirectByRole, onSessionChange } from './app.js';

export { onSessionChange, redirectByRole };

// ─── Registro alumno ──────────────────────────────────────────
export async function registerStudent(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await _saveUserDoc(cred.user.uid, { uid: cred.user.uid, email, displayName: name, role: 'student' });
  return cred.user;
}

// ─── Registro profesor (pendiente de pago) ────────────────────
export async function registerTeacherPending(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  // NO se guarda en Firestore hasta que el pago se confirme
  // Se guarda temporalmente en sessionStorage para el checkout-result
  sessionStorage.setItem('sym-pending-teacher', JSON.stringify({
    uid: cred.user.uid, email, displayName: name
  }));
  return cred.user;
}

// ─── Login ────────────────────────────────────────────────────
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userData = await _waitForUserDoc(cred.user.uid);
  if (userData?.suspended) {
    await signOut(auth);
    throw new Error('Tu cuenta fue suspendida. Contactá al soporte.');
  }
  return { user: cred.user, role: userData?.role || 'student' };
}

// ─── Reset contraseña ─────────────────────────────────────────
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ─── Bind login form ──────────────────────────────────────────
export function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    const btn      = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Ingresando...';
    try {
      const { role } = await login(email, password);
      redirectByRole(role);
    } catch (err) {
      showToast(_parseError(err.code || err.message), 'error');
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });
}

// ─── Bind register form ───────────────────────────────────────
export function bindRegisterForm(getRoleOverride) {
  const form = document.getElementById('register-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = form.querySelector('#name').value.trim();
    const email    = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    const role     = getRoleOverride ? getRoleOverride() : (form.querySelector('[name="role"]:checked')?.value || 'student');
    const btn      = form.querySelector('[type="submit"]');

    if (password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
    console.log('>>> ROL SELECCIONADO:', role);
    try {
      if (role === 'teacher') {
        console.log('>>> Registrando como profesor...');
        const user = await registerTeacherPending(name, email, password);
        console.log('>>> Cuenta creada, uid:', user.uid);
        sessionStorage.setItem('sym-pending-checkout', '1');
        console.log('>>> Flag guardado, redirigiendo a checkout...');
        window.location.href = '../checkout/checkout.html?type=membership';
      } else {
        console.log('>>> Registrando como alumno...');
        await registerStudent(name, email, password);
        redirectByRole('student');
      }
    } catch (err) {
      console.error('>>> ERROR en registro:', err);
      showToast(_parseError(err.code || err.message), 'error');
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
    }
  });
}

// ─── Internos ─────────────────────────────────────────────────
async function _saveUserDoc(uid, data) {
  for (let i = 0; i < 3; i++) {
    try {
      await createUserDoc(uid, {
        photoURL: null,
        membershipStatus: 'none',
        membershipPaidAt: null,
        suspended: false,
        suspendedReason: null,
        ...data
      });
      return;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(r => setTimeout(r, 600));
    }
  }
}

async function _waitForUserDoc(uid) {
  for (let i = 0; i < 8; i++) {
    const data = await getUserData(uid);
    if (data) return data;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

function _parseError(code) {
  const map = {
    'auth/email-already-in-use':   'Ese correo ya está registrado.',
    'auth/invalid-email':          'El correo no es válido.',
    'auth/weak-password':          'La contraseña es muy débil.',
    'auth/user-not-found':         'No existe una cuenta con ese correo.',
    'auth/wrong-password':         'Contraseña incorrecta.',
    'auth/too-many-requests':      'Demasiados intentos. Intentá más tarde.',
    'auth/network-request-failed': 'Error de conexión.',
    'auth/invalid-credential':     'Credenciales inválidas.'
  };
  return map[code] || code || 'Ocurrió un error. Intentá de nuevo.';
}

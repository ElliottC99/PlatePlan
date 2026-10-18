/**
 * src/services/AuthService.js (v3.31.19)
 * Resolves Firebase Auth state safely for household synchronization.
 * Singleton guarded to eliminate duplicate authentication listeners.
 */

let authPromise = null;
let authLogged = false;

export function closeLoginUI() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('plateplan-login-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

export function showLoginUI() {
  if (typeof document === 'undefined') return;
  let modal = document.getElementById('plateplan-login-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'plateplan-login-modal';
    modal.className = 'modal-wrap';
    modal.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.65);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);padding:16px;box-sizing:border-box;';
    
    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:390px;background:var(--surface,#ffffff);border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.2);box-sizing:border-box">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <span style="font-size:24px">🍽️</span>
          <h2 style="margin:0;font-size:20px;font-weight:800;color:var(--text,#0f172a);letter-spacing:-0.02em">Plate<span style="color:#2563eb">Plan</span></h2>
        </div>
        <p style="margin:0 0 18px 0;font-size:13px;color:var(--text2,#64748b);line-height:1.4">
          Sign in to access shared household recipes, meal plans, and pantry sync for Elliott &amp; Chloe.
        </p>

        <form id="pp-auth-form" style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label for="pp-auth-email" style="display:block;font-size:12px;font-weight:700;color:var(--text,#1e293b);margin-bottom:4px">Email Address</label>
            <input type="email" id="pp-auth-email" name="email" autocomplete="email" required placeholder="name@example.com" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border,#cbd5e1);border-radius:8px;font-size:13px;background:var(--surface,#ffffff);color:var(--text,#0f172a);outline:none">
          </div>

          <div>
            <label for="pp-auth-password" style="display:block;font-size:12px;font-weight:700;color:var(--text,#1e293b);margin-bottom:4px">Password</label>
            <input type="password" id="pp-auth-password" name="password" autocomplete="current-password" required placeholder="••••••••" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border,#cbd5e1);border-radius:8px;font-size:13px;background:var(--surface,#ffffff);color:var(--text,#0f172a);outline:none">
          </div>

          <div id="pp-auth-error-msg" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600"></div>

          <button type="submit" id="pp-auth-submit-btn" class="btn primary" style="width:100%;padding:10px;font-size:13.5px;font-weight:700;background:#2563eb;color:#ffffff;border:none;border-radius:8px;cursor:pointer;margin-top:4px">
            Sign In to Household
          </button>

          <button type="button" id="pp-auth-offline-btn" class="btn ghost" style="width:100%;padding:8px;font-size:12px;color:var(--text2,#64748b);background:transparent;border:none;cursor:pointer;margin-top:2px">
            Continue in Offline / Local Mode →
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = modal.querySelector('#pp-auth-form');
    const submitBtn = modal.querySelector('#pp-auth-submit-btn');
    const offlineBtn = modal.querySelector('#pp-auth-offline-btn');
    const errorEl = modal.querySelector('#pp-auth-error-msg');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = modal.querySelector('#pp-auth-email')?.value?.trim();
        const password = modal.querySelector('#pp-auth-password')?.value;
        if (!email || !password) return;

        if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in...'; }

        try {
          const auth = window.firebase?.auth?.();
          if (!auth || typeof auth.signInWithEmailAndPassword !== 'function') {
            throw new Error('Firebase Auth service unavailable');
          }
          await auth.signInWithEmailAndPassword(email, password);
          closeLoginUI();
          if (typeof window.syncNow === 'function') {
            window.syncNow();
          }
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast('Signed in successfully! ☁️', 'success');
          }
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err?.message || 'Authentication failed. Please verify email and password.';
            errorEl.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In to Household';
          }
        }
      });
    }

    if (offlineBtn) {
      offlineBtn.addEventListener('click', () => {
        closeLoginUI();
        if (typeof window.setSyncStatus === 'function') {
          window.setSyncStatus('local', 'Local only (Sign in to sync)');
        }
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Operating in Local Mode', 'info');
        }
      });
    }
  }

  modal.style.display = 'flex';
}

if (typeof window !== 'undefined') {
  window.openPlatePlanLogin = showLoginUI;
  window.closePlatePlanLogin = closeLoginUI;
}

export function waitForAuth(timeoutMs = 5000) {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.firebase || typeof window.firebase.auth !== 'function') {
      authPromise = null;
      return resolve(null);
    }

    const authInstance = window.firebase.auth();
    if (authInstance.currentUser) {
      closeLoginUI();
      if (!authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${authInstance.currentUser.email || authInstance.currentUser.uid}`);
      }
      return resolve(authInstance.currentUser);
    }

    let resolved = false;
    let unsubscribe = () => {};

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (typeof unsubscribe === 'function') unsubscribe();
        console.warn('[Auth] Auth state resolution timed out.');
        resolve(window.firebase?.auth()?.currentUser || null);
      }
    }, timeoutMs);

    unsubscribe = authInstance.onAuthStateChanged(async (user) => {
      if (!resolved) {
        if (user) {
          resolved = true;
          clearTimeout(timer);
          if (typeof unsubscribe === 'function') unsubscribe();
          closeLoginUI();
          if (!authLogged) {
            authLogged = true;
            console.log(`[AuthService] Authenticated as: ${user.email || user.uid}`);
          }
          resolve(user);
        } else {
          if (!authLogged) {
            authLogged = true;
            console.log('[AuthService] No user session detected. Prompting authentication...');
          }
          showLoginUI();
          resolved = true;
          clearTimeout(timer);
          if (typeof unsubscribe === 'function') unsubscribe();
          resolve(null);
        }
      }
    }, (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (typeof unsubscribe === 'function') unsubscribe();
        authPromise = null;
        console.warn('[AuthService] onAuthStateChanged error:', error);
        resolve(null);
      }
    });
  });

  return authPromise;
}


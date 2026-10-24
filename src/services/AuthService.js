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
      <div class="card" style="width:100%;max-width:380px;background:var(--surface,#ffffff);border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.2);box-sizing:border-box;text-align:center">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:26px">🍽️</span>
          <h2 style="margin:0;font-size:20px;font-weight:800;color:var(--text,#0f172a);letter-spacing:-0.02em">Plate<span style="color:#2563eb">Plan</span></h2>
        </div>
        <p style="margin:0 0 20px 0;font-size:13px;color:var(--text2,#64748b);line-height:1.4">
          Sign in with your Google Account to access shared household recipes, meal plans, and pantry sync for Elliott &amp; Chloe.
        </p>

        <div id="pp-auth-error-msg" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:14px;text-align:left"></div>

        <button type="button" id="pp-google-login-btn" class="btn" style="width:100%;padding:10px 14px;font-size:13.5px;font-weight:700;background:#ffffff;color:#1e293b;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/></svg>
          Sign in with Google
        </button>

        <button type="button" id="pp-auth-offline-btn" class="btn ghost" style="width:100%;padding:8px;font-size:12px;color:var(--text2,#64748b);background:transparent;border:none;cursor:pointer;margin-top:10px">
          Continue in Offline / Local Mode →
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const googleBtn = modal.querySelector('#pp-google-login-btn');
    const offlineBtn = modal.querySelector('#pp-auth-offline-btn');
    const errorEl = modal.querySelector('#pp-auth-error-msg');

    if (googleBtn) {
      googleBtn.addEventListener('click', () => {
        if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
        googleBtn.disabled = true;
        googleBtn.style.opacity = '0.7';

        signInWithGoogle()
          .catch(err => {
            if (errorEl) {
              errorEl.textContent = err?.message || 'Google Sign-In failed. Please try again.';
              errorEl.style.display = 'block';
            }
            googleBtn.disabled = false;
            googleBtn.style.opacity = '1';
          });
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

export async function signInWithGoogle() {
  if (typeof window === 'undefined' || !window.firebase?.auth) {
    throw new Error('Firebase Auth unavailable');
  }
  const provider = new window.firebase.auth.GoogleAuthProvider();
  try {
    await window.firebase.auth().signInWithRedirect(provider);
  } catch (err) {
    console.error('[AuthService] Google Sign-In redirect failed:', err);
    throw err;
  }
}

if (typeof window !== 'undefined') {
  window.signInWithGoogle = signInWithGoogle;
  window.openPlatePlanLogin = showLoginUI;
  window.closePlatePlanLogin = closeLoginUI;
}

export function waitForAuth(timeoutMs = 8000) {
  if (authPromise) return authPromise;
  
  authPromise = new Promise((resolve) => {
    let resolved = false;
    let unsubscribe = null;
    
    const finish = (user) => {
      if (resolved) return;
      resolved = true;
      if (unsubscribe) unsubscribe();
      
      if (user && !authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${user.email || user.uid}`);
        closeLoginUI();
      }
      resolve(user);
    };

    const timer = setTimeout(() => {
      console.warn('[Auth] Auth state resolution timed out.');
      finish(window.firebase?.auth()?.currentUser || null);
    }, timeoutMs);

    const checkFirebase = setInterval(() => {
      if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.auth === 'function') {
        clearInterval(checkFirebase);
        const authInstance = window.firebase.auth();
        
        if (typeof authInstance.getRedirectResult === 'function') {
          authInstance.getRedirectResult().catch(() => {});
        }

        if (authInstance.currentUser) {
          clearTimeout(timer);
          return finish(authInstance.currentUser);
        }
        
        unsubscribe = authInstance.onAuthStateChanged((user) => {
          clearTimeout(timer);
          finish(user);
        });
      }
    }, 50); // Poll every 50ms for the Firebase SDK
  });
  
  return authPromise;
}


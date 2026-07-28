export const UPDATE_PHASES = Object.freeze([
  'idle',
  'checking',
  'downloading',
  'ready',
  'activating',
  'verifying',
  'complete',
  'error',
]);

const UPDATE_SESSION_KEY = 'plateplan_update_completed';
const UPDATE_LAST_CHECK_KEY = 'plateplan_update_last_check';
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
const INSTALL_TIMEOUT = 20000;
const ACTIVATION_TIMEOUT = 15000;

export function normaliseUpdateMarker(raw) {
  if (!raw) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    return {
      targetCache: String(value.targetCache || value.cacheName || ''),
      targetVersion: String(value.targetVersion || value.appVersion || ''),
      requestedAt: Number(value.requestedAt) || 0,
    };
  } catch (_error) {
    return null;
  }
}

export function releaseMatches(info, appVersion, expectedCache) {
  return Boolean(
    info?.cacheName &&
    info.cacheName === expectedCache &&
    (!info.appVersion || info.appVersion === appVersion)
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createUpdateService({
  legacy,
  workspaces,
  appVersion,
  expectedCache,
}) {
  let registration = null;
  let registered = false;
  let phase = 'idle';
  let phaseDetail = '';
  let applying = false;
  let reloading = false;
  let offeredWorker = null;
  let activatedInfo = null;
  let targetInfo = null;
  let activationTimer = null;
  let offerTimer = null;
  let lastCheckAt = 0;
  let activeCacheName = '';
  let verifyingController = false;
  try { lastCheckAt = Number(localStorage.getItem(UPDATE_LAST_CHECK_KEY)) || 0; } catch (_error) {}
  const subscribers = new Set();

  const publish = (nextPhase, detail = '') => {
    if (!UPDATE_PHASES.includes(nextPhase)) return;
    phase = nextPhase;
    phaseDetail = detail;
    updatePreferencesPanel();
    subscribers.forEach(listener => listener({ phase, detail }));
  };

  const setLastCheck = value => {
    lastCheckAt = value;
    try { localStorage.setItem(UPDATE_LAST_CHECK_KEY, String(value)); } catch (_error) {}
    updatePreferencesPanel();
  };

  const updatePreferencesPanel = () => {
    const version = document.getElementById('plateplan-update-version');
    const cache = document.getElementById('plateplan-update-cache');
    const status = document.getElementById('plateplan-update-status');
    const button = document.getElementById('plateplan-check-update');
    if (version) version.textContent = appVersion;
    if (cache) cache.textContent = activeCacheName || expectedCache;
    if (status) {
      const checked = lastCheckAt
        ? ` · checked ${new Date(lastCheckAt).toLocaleString()}`
        : '';
      const labels = {
        idle: `Ready${checked}`,
        checking: 'Checking for an update…',
        downloading: 'Downloading update…',
        ready: 'Update ready',
        activating: 'Activating update…',
        verifying: 'Verifying update…',
        complete: 'Up to date',
        error: phaseDetail || 'Update check failed',
      };
      status.textContent = labels[phase] || labels.idle;
    }
    if (button) {
      button.disabled = ['checking', 'downloading', 'activating', 'verifying'].includes(phase);
      button.textContent = phase === 'checking' ? 'Checking…' : 'Check for updates';
    }
  };

  const startupIsBlocked = () => {
    const auth = document.getElementById('plateplan-auth-screen');
    if (auth && isVisible(auth)) return true;
    if (document.getElementById('baked-state-recovery-banner')) return true;
    if (document.getElementById('overlay')?.classList.contains('visible')) return true;
    return [...document.querySelectorAll('.modal-wrap.open')].some(isVisible);
  };

  const removeBanner = () => {
    document.getElementById('plateplan-update-banner')?.remove();
  };

  const renderBanner = ({
    title = 'PlatePlan update available',
    copy = 'A newer version is ready.',
    action = 'Update now',
    mode = 'update',
  } = {}) => {
    removeBanner();
    const banner = document.createElement('section');
    banner.id = 'plateplan-update-banner';
    banner.className = 'plateplan-update-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `
      <div class="plateplan-update-banner-copy">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(copy)}</span>
      </div>
      <div class="plateplan-update-banner-actions">
        <button class="btn primary" type="button" id="plateplan-update-apply">${escapeHtml(action)}</button>
        <button class="btn ghost" type="button" id="plateplan-update-later" aria-label="Dismiss update notice">Later</button>
      </div>`;
    banner.querySelector('#plateplan-update-apply').addEventListener('click', () => apply({ mode }));
    banner.querySelector('#plateplan-update-later').addEventListener('click', removeBanner);
    document.body.appendChild(banner);
  };

  const scheduleOffer = (worker, options = {}) => {
    offeredWorker = worker || offeredWorker;
    clearTimeout(offerTimer);
    const attempt = () => {
      if ((!offeredWorker && options.mode !== 'reload') || applying) return;
      if (startupIsBlocked()) {
        offerTimer = setTimeout(attempt, 900);
        return;
      }
      publish('ready');
      renderBanner(options);
    };
    attempt();
  };

  const getWorkerInfo = (worker, timeoutMs = 2200) => new Promise(resolve => {
    if (!worker) {
      resolve({ appVersion: '', cacheName: '', buildId: '' });
      return;
    }
    const channel = new MessageChannel();
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        appVersion: String(value?.appVersion || ''),
        cacheName: String(value?.cacheName || ''),
        buildId: String(value?.buildId || ''),
      });
    };
    channel.port1.onmessage = event => finish(event.data);
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      worker.postMessage({ type: 'PLATEPLAN_GET_VERSION' }, [channel.port2]);
    } catch (_error) {
      finish(null);
    }
  });

  const waitForWaitingWorker = (timeoutMs = INSTALL_TIMEOUT) => new Promise((resolve, reject) => {
    if (registration?.waiting) {
      resolve(registration.waiting);
      return;
    }
    let settled = false;
    let timer = null;
    const cleanups = [];
    const finish = (worker, error = null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      cleanups.forEach(cleanup => cleanup());
      if (worker) resolve(worker);
      else reject(error || new Error('The update did not finish downloading.'));
    };
    const watch = worker => {
      if (!worker) return;
      publish('downloading');
      const stateChanged = () => {
        if (registration?.waiting || worker.state === 'installed') {
          finish(registration?.waiting || worker);
        } else if (worker.state === 'redundant') {
          finish(null, new Error('The downloaded update was replaced before it could install.'));
        }
      };
      worker.addEventListener('statechange', stateChanged);
      cleanups.push(() => worker.removeEventListener('statechange', stateChanged));
      stateChanged();
    };
    const updateFound = () => watch(registration?.installing);
    registration?.addEventListener('updatefound', updateFound);
    cleanups.push(() => registration?.removeEventListener('updatefound', updateFound));
    watch(registration?.installing);
    if (!settled) {
      timer = setTimeout(
        () => finish(null, new Error('The update is taking longer than expected.')),
        timeoutMs
      );
    }
  });

  const showOverlayPhase = (title, detail) => {
    legacy.showOverlay?.(title, detail);
  };

  const saveMarker = info => {
    try {
      sessionStorage.setItem(UPDATE_SESSION_KEY, JSON.stringify({
        targetCache: info?.cacheName || '',
        targetVersion: info?.appVersion || '',
        requestedAt: Date.now(),
      }));
    } catch (_error) {}
  };

  const clearMarker = () => {
    try { sessionStorage.removeItem(UPDATE_SESSION_KEY); } catch (_error) {}
  };

  const readMarker = () => {
    try { return normaliseUpdateMarker(sessionStorage.getItem(UPDATE_SESSION_KEY)); }
    catch (_error) { return null; }
  };

  const isCurrentRelease = info => releaseMatches(info, appVersion, expectedCache);

  const getInstalledReleaseInfo = async () => {
    const workers = [
      navigator.serviceWorker.controller,
      registration?.active,
    ].filter((worker, index, all) => worker && all.indexOf(worker) === index);
    let lastInfo = { appVersion: '', cacheName: '', buildId: '' };
    for (const worker of workers) {
      const info = await getWorkerInfo(worker);
      if (isCurrentRelease(info)) return info;
      if (info.cacheName) lastInfo = info;
    }
    return lastInfo;
  };

  const finishAlreadyActive = info => {
    clearTimeout(activationTimer);
    applying = false;
    activeCacheName = info?.cacheName || expectedCache;
    clearMarker();
    removeBanner();
    legacy.hideOverlay?.();
    publish('complete');
    legacy.showToast?.(`PlatePlan ${appVersion} is installed and ready.`);
  };

  const showFailure = message => {
    clearTimeout(activationTimer);
    applying = false;
    legacy.hideOverlay?.();
    publish('error', message);
    legacy.showInfo?.(
      'Update could not finish',
      `<p>${escapeHtml(message || 'PlatePlan could not activate the update.')}</p>
       <div class="btn-row plateplan-update-dialog-actions">
         <button class="btn primary" type="button" id="plateplan-update-retry">Retry</button>
         <button class="btn ghost" type="button" id="plateplan-update-close">Close</button>
       </div>`
    );
    document.getElementById('plateplan-update-retry')?.addEventListener('click', () => {
      legacy.closeInfo?.();
      apply();
    });
    document.getElementById('plateplan-update-close')?.addEventListener('click', () => legacy.closeInfo?.());
  };

  const verifyController = async () => {
    if (verifyingController || reloading) return;
    verifyingController = true;
    publish('verifying');
    showOverlayPhase('Verifying PlatePlan update…', 'PlatePlan will reopen once the new version is confirmed.');
    try {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const info = await getWorkerInfo(navigator.serviceWorker.controller, 900);
        const cacheMatches = !targetInfo?.cacheName || info.cacheName === targetInfo.cacheName;
        const versionMatches = !targetInfo?.appVersion || info.appVersion === targetInfo.appVersion;
        if (info.cacheName && cacheMatches && versionMatches) {
          clearTimeout(activationTimer);
          if (reloading) return;
          activeCacheName = info.cacheName;
          reloading = true;
          saveMarker(info);
          location.reload();
          return;
        }
        await wait(350);
      }
      showFailure('The new service worker did not take control. Your current PlatePlan remains available; retry when the connection is stable.');
    } finally {
      verifyingController = false;
    }
  };

  const requestActivation = worker => new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    channel.port1.onmessage = event => {
      if (event.data?.type === 'PLATEPLAN_ACTIVATION_ACCEPTED') finish();
    };
    const timer = setTimeout(() => {
      try {
        worker.postMessage({ type: 'SKIP_WAITING' });
        finish();
      } catch (_error) {
        finish(new Error('PlatePlan could not ask the downloaded update to activate.'));
      }
    }, 1800);
    try {
      worker.postMessage({ type: 'PLATEPLAN_ACTIVATE_UPDATE' }, [channel.port2]);
    } catch (_error) {
      finish(new Error('PlatePlan could not contact the downloaded update.'));
    }
  });

  const applyNow = async ({ mode = 'update' } = {}) => {
    removeBanner();
    legacy.closeInfo?.();
    applying = true;
    publish('activating');

    try {
      if (mode === 'reload' && activatedInfo?.cacheName) {
        targetInfo = activatedInfo;
        saveMarker(targetInfo);
        showOverlayPhase('Reopening PlatePlan…', 'The update is already installed.');
        reloading = true;
        location.reload();
        return;
      }

      let worker = registration?.waiting;
      if (!worker) {
        const activeBeforeCheck = await getInstalledReleaseInfo();
        if (isCurrentRelease(activeBeforeCheck)) {
          finishAlreadyActive(activeBeforeCheck);
          return;
        }
        publish('checking');
        showOverlayPhase('Checking for the PlatePlan update…', 'This should only take a moment.');
        await registration?.update();
        worker = registration?.waiting;
        if (!worker && !registration?.installing) {
          const activeAfterCheck = await getInstalledReleaseInfo();
          if (isCurrentRelease(activeAfterCheck)) {
            finishAlreadyActive(activeAfterCheck);
            return;
          }
          throw new Error(
            'No downloaded update is waiting. GitHub Pages may still be publishing; close this message and try again in a few minutes.'
          );
        }
      }
      if (!worker) {
        worker = await waitForWaitingWorker();
      }

      targetInfo = await getWorkerInfo(worker);
      if (!targetInfo.cacheName) throw new Error('PlatePlan could not verify the downloaded update.');
      saveMarker(targetInfo);
      publish('activating');
      showOverlayPhase('Activating PlatePlan update…', 'PlatePlan will reopen automatically.');
      activationTimer = setTimeout(() => {
        showFailure('The update did not activate in time. Your current PlatePlan has not been replaced.');
      }, ACTIVATION_TIMEOUT);
      await requestActivation(worker);
    } catch (error) {
      showFailure(
        navigator.onLine === false
          ? 'You are offline. Reconnect, then retry the update.'
          : error.message
      );
    }
  };

  const showDirtyEditorChoice = mode => {
    legacy.showInfo?.(
      'Finish your edits before updating',
      `<p>PlatePlan found unsaved changes in the open editor.</p>
       <div class="btn-row plateplan-update-dialog-actions">
         <button class="btn primary" type="button" id="plateplan-update-save">Save changes and update</button>
         <button class="btn danger" type="button" id="plateplan-update-discard">Discard draft and update</button>
         <button class="btn ghost" type="button" id="plateplan-update-not-now">Not now</button>
       </div>`
    );
    document.getElementById('plateplan-update-save')?.addEventListener('click', async () => {
      legacy.closeInfo?.();
      if (await workspaces.saveDirty()) applyNow({ mode });
      else legacy.showToast?.('Finish or correct the highlighted editor fields before updating.');
    });
    document.getElementById('plateplan-update-discard')?.addEventListener('click', async () => {
      legacy.closeInfo?.();
      await workspaces.discardDirty();
      applyNow({ mode });
    });
    document.getElementById('plateplan-update-not-now')?.addEventListener('click', () => legacy.closeInfo?.());
  };

  const apply = async ({ mode = activatedInfo ? 'reload' : 'update' } = {}) => {
    if (applying) return;
    if (workspaces.hasDirty()) {
      showDirtyEditorChoice(mode);
      return;
    }
    await applyNow({ mode });
  };

  const watchInstalling = worker => {
    if (!worker) return;
    const isApplicationUpdate = Boolean(navigator.serviceWorker.controller);
    if (isApplicationUpdate) publish('downloading');
    const stateChanged = () => {
      if (worker.state === 'installed' && registration?.waiting && navigator.serviceWorker.controller) {
        offeredWorker = registration.waiting;
        scheduleOffer(offeredWorker);
      } else if (!isApplicationUpdate && worker.state === 'activated') {
        getWorkerInfo(registration?.active || navigator.serviceWorker.controller).then(info => {
          if (info.cacheName) activeCacheName = info.cacheName;
          publish('complete');
        });
      } else if (worker.state === 'redundant') {
        publish('error', 'The downloaded update was replaced before installation.');
      }
    };
    worker.addEventListener('statechange', stateChanged);
    stateChanged();
  };

  const check = async ({ manual = false } = {}) => {
    if (!registration || applying || ['checking', 'downloading'].includes(phase)) return false;
    if (navigator.onLine === false) {
      const message = 'You are offline. Reconnect before checking for updates.';
      publish('error', message);
      if (manual) legacy.showInfo?.('Update check unavailable', `<p>${escapeHtml(message)}</p>`);
      return false;
    }
    publish('checking');
    try {
      await registration.update();
      setLastCheck(Date.now());
      if (registration.waiting) {
        offeredWorker = registration.waiting;
        scheduleOffer(offeredWorker);
        return true;
      }
      if (registration.installing) {
        const worker = await waitForWaitingWorker();
        offeredWorker = worker;
        scheduleOffer(worker);
        return true;
      }
      publish('complete');
      if (manual) {
        legacy.showInfo?.(
          'PlatePlan is up to date',
          `<p>You are using PlatePlan <strong>${escapeHtml(appVersion)}</strong>.</p>`
        );
      }
      return false;
    } catch (error) {
      const message = navigator.onLine === false
        ? 'You are offline. Reconnect before checking for updates.'
        : error.message;
      publish('error', message);
      if (manual) legacy.showInfo?.('Update check unavailable', `<p>${escapeHtml(message)}</p>`);
      return false;
    }
  };

  const showCompletionWhenReady = () => {
    const attempt = () => {
      if (startupIsBlocked()) {
        setTimeout(attempt, 800);
        return;
      }
      legacy.hideOverlay?.();
      legacy.showToast?.(`PlatePlan updated to version ${appVersion}.`);
    };
    attempt();
  };

  const confirmCompletedUpdate = async () => {
    const marker = readMarker();
    if (!marker) return;
    if (marker.requestedAt && Date.now() - marker.requestedAt > 10 * 60 * 1000) {
      clearMarker();
      return;
    }
    const active = await getWorkerInfo(navigator.serviceWorker.controller);
    const targetCache = marker.targetCache || expectedCache;
    const targetVersion = marker.targetVersion || appVersion;
    if (
      isCurrentRelease(active) ||
      (
      active.cacheName &&
      (!targetCache || active.cacheName === targetCache) &&
      (!targetVersion || active.appVersion === targetVersion)
      )
    ) {
      clearMarker();
      removeBanner();
      publish('complete');
      showCompletionWhenReady();
      return;
    }
    if (registration?.waiting) {
      offeredWorker = registration.waiting;
      scheduleOffer(offeredWorker, {
        title: 'PlatePlan update needs one more step',
        copy: 'The update downloaded but did not finish activating.',
        action: 'Finish update',
      });
    }
  };

  const onControllerChange = async () => {
    const info = await getWorkerInfo(navigator.serviceWorker.controller);
    if (info.cacheName) {
      activeCacheName = info.cacheName;
      updatePreferencesPanel();
    }
    if (applying) {
      verifyController();
      return;
    }
    const marker = readMarker();
    if (
      info.cacheName &&
      marker &&
      (!marker.targetCache || marker.targetCache === info.cacheName) &&
      (!marker.targetVersion || marker.targetVersion === info.appVersion)
    ) {
      activatedInfo = info;
      scheduleOffer(null, {
        title: 'PlatePlan update is installed',
        copy: 'Reopen once to finish using the new version.',
        action: 'Reopen',
        mode: 'reload',
      });
      return;
    }
    if (info.cacheName && info.cacheName !== expectedCache) {
      activatedInfo = info;
      scheduleOffer(null, {
        title: 'PlatePlan updated in another window',
        copy: 'Reopen when you are ready to use the new version.',
        action: 'Reopen',
        mode: 'reload',
      });
    }
  };

  const onWorkerMessage = event => {
    if (!['PLATEPLAN_UPDATE_ACTIVE', 'PLATEPLAN_UPDATE_ACTIVATED'].includes(event.data?.type)) return;
    const info = {
      appVersion: String(event.data?.appVersion || ''),
      cacheName: String(event.data?.cacheName || ''),
      buildId: String(event.data?.buildId || ''),
    };
    if (info.cacheName) {
      activeCacheName = info.cacheName;
      updatePreferencesPanel();
    }
    if (applying) {
      verifyController();
    } else if (info.cacheName && info.cacheName !== expectedCache) {
      activatedInfo = info;
      scheduleOffer(null, {
        title: 'PlatePlan updated in another window',
        copy: 'Reopen when you are ready to use the new version.',
        action: 'Reopen',
        mode: 'reload',
      });
    }
  };

  const register = async () => {
    if (registered || !('serviceWorker' in navigator) || location.protocol === 'file:') return null;
    registered = true;
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.addEventListener('message', onWorkerMessage);
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      const active = await getWorkerInfo(navigator.serviceWorker.controller);
      activeCacheName = active.cacheName || '';
      registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
      if (registration.installing) watchInstalling(registration.installing);
      if (registration.waiting && navigator.serviceWorker.controller) {
        offeredWorker = registration.waiting;
        scheduleOffer(offeredWorker);
      }
      await confirmCompletedUpdate();
      setTimeout(() => check({ manual: false }), 1400);
      window.addEventListener('online', () => {
        if (Date.now() - lastCheckAt >= UPDATE_CHECK_INTERVAL) check({ manual: false });
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheckAt >= UPDATE_CHECK_INTERVAL) {
          check({ manual: false });
        }
      });
      updatePreferencesPanel();
      return registration;
    } catch (error) {
      publish('error', error.message);
      console.warn('PlatePlan service worker registration failed', error);
      return null;
    }
  };

  return Object.freeze({
    register,
    check,
    apply,
    phase: () => ({ phase, detail: phaseDetail }),
    activeInfo: () => getWorkerInfo(navigator.serviceWorker.controller),
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    updatePreferencesPanel,
  });
}

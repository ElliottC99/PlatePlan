const EDITOR_ROOT_SELECTOR = [
  '.modal-wrap.open:not(#app-confirm-wrap):not(#app-prompt-wrap)',
  '#manual-ing-panel',
].join(',');

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function editorRootFor(target) {
  if (!(target instanceof Element)) return null;
  const root = target.closest(EDITOR_ROOT_SELECTOR);
  return root && isVisible(root) ? root : null;
}

function visibleButtons(root) {
  return [...root.querySelectorAll('button')].filter(isVisible);
}

function findSaveButton(root) {
  const candidates = visibleButtons(root).filter(button =>
    /^(save(?:\s|$)|apply to meal plan)/i.test((button.textContent || '').trim())
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function findCancelButton(root) {
  return visibleButtons(root).find(button =>
    /^(cancel|discard|close)$/i.test((button.textContent || '').trim())
  ) || null;
}

function waitForEditorToSettle(root, timeoutMs = 2400) {
  return new Promise(resolve => {
    const started = Date.now();
    const check = () => {
      if (!document.contains(root) || !isVisible(root) || root.dataset.workspaceDirty !== 'true') {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 80);
    };
    check();
  });
}

export function createWorkspaceService() {
  const contracts = new WeakMap();
  let restoreTarget = null;

  const markDirty = root => {
    if (root) root.dataset.workspaceDirty = 'true';
  };
  const markClean = root => {
    if (root) delete root.dataset.workspaceDirty;
  };

  document.addEventListener('input', event => {
    if (event.target?.matches?.('[readonly],[disabled],[data-update-ignore]')) return;
    markDirty(editorRootFor(event.target));
  }, true);
  document.addEventListener('change', event => {
    if (event.target?.matches?.('[readonly],[disabled],[data-update-ignore]')) return;
    markDirty(editorRootFor(event.target));
  }, true);

  new MutationObserver(records => {
    for (const record of records) {
      const root = record.target instanceof Element
        ? record.target.closest?.(EDITOR_ROOT_SELECTOR) || record.target
        : null;
      if (root instanceof HTMLElement && !isVisible(root)) markClean(root);
    }
  }).observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });

  const dirty = () => [...document.querySelectorAll(EDITOR_ROOT_SELECTOR)]
    .filter(root => isVisible(root) && root.dataset.workspaceDirty === 'true');

  const saveDirty = async () => {
    for (const root of dirty()) {
      const contract = contracts.get(root);
      if (contract?.save) {
        const saved = await contract.save();
        if (saved === false) return false;
        markClean(root);
        continue;
      }
      const button = findSaveButton(root);
      if (!button || button.disabled) {
        root.querySelector('input,select,textarea,button')?.focus?.();
        return false;
      }
      button.click();
      if (!await waitForEditorToSettle(root)) {
        root.querySelector('[aria-invalid="true"],:invalid,.msg.error')?.focus?.();
        return false;
      }
    }
    return true;
  };

  const discardDirty = async () => {
    for (const root of dirty()) {
      const contract = contracts.get(root);
      if (contract?.discard) await contract.discard();
      else findCancelButton(root)?.click();
      markClean(root);
    }
    return true;
  };

  return Object.freeze({
    active: () => document.querySelector('.modal-wrap.open,.mobile-action-sheet-wrap.open,.mobile-more-wrap.open'),
    closeActive: () => {
      const active = document.querySelector('.modal-wrap.open,.mobile-action-sheet-wrap.open,.mobile-more-wrap.open');
      active?.querySelector('[data-close],button[aria-label^="Close"]')?.click();
      return Boolean(active);
    },
    register(root, contract = {}) {
      if (!(root instanceof HTMLElement)) return () => {};
      contracts.set(root, contract);
      return () => contracts.delete(root);
    },
    rememberFocus() {
      restoreTarget = document.activeElement;
    },
    restoreFocus() {
      const target = restoreTarget;
      restoreTarget = null;
      if (target && document.contains(target)) setTimeout(() => target.focus?.(), 0);
    },
    markDirty,
    markClean,
    dirty,
    hasDirty: () => dirty().length > 0,
    saveDirty,
    discardDirty,
  });
}

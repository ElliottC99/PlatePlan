const EVENT_NAMES = [
  'click', 'change', 'input', 'keydown', 'blur', 'focus', 'submit',
  'error', 'load', 'mousedown', 'mouseenter', 'mouseleave', 'mousemove',
  'dragstart', 'dragover', 'dragend', 'toggle',
];
const ATTRIBUTE_FOR_EVENT = new Map(EVENT_NAMES.map(name => [name, `on${name}`]));
const DATA_ATTRIBUTE_FOR_EVENT = new Map(EVENT_NAMES.map(name => [name, `data-pp-${name}`]));

function upgradeElement(element) {
  if (!(element instanceof Element)) return;
  for (const eventName of EVENT_NAMES) {
    const source = ATTRIBUTE_FOR_EVENT.get(eventName);
    if (!element.hasAttribute(source)) continue;
    element.setAttribute(DATA_ATTRIBUTE_FOR_EVENT.get(eventName), element.getAttribute(source) || '');
    element.removeAttribute(source);
  }
}

function upgradeTree(root) {
  if (root instanceof Element) upgradeElement(root);
  root.querySelectorAll?.(EVENT_NAMES.map(name => `[on${name}]`).join(',')).forEach(upgradeElement);
}

function actionElementForEvent(event, eventName) {
  const attribute = DATA_ATTRIBUTE_FOR_EVENT.get(eventName);
  if (!(event.target instanceof Element)) return null;
  if (eventName === 'mouseenter' || eventName === 'mouseleave') {
    return event.target.hasAttribute(attribute) ? event.target : null;
  }
  return event.target.closest(`[${attribute}]`);
}

/**
 * Convert application inline handlers into delegated actions at runtime.
 */
export function installDelegatedActions() {
  upgradeTree(document);

  for (const eventName of EVENT_NAMES) {
    document.addEventListener(eventName, event => {
      const element = actionElementForEvent(event, eventName);
      if (!element) return;
      const code = element.getAttribute(DATA_ATTRIBUTE_FOR_EVENT.get(eventName)) || '';
      if (!code.trim()) return;
      try {
        // Native action runner: tries to evaluate or call global function
        let result;
        if (code.includes('(')) {
          result = eval(code); // Fallback to eval for existing inline handlers
        } else {
          const fn = window[code];
          if (typeof fn === 'function') {
            result = fn(event, element);
          }
        }
        if (result === false) {
          event.preventDefault();
          event.stopPropagation();
        }
      } catch (error) {
        console.error(`PlatePlan ${eventName} action failed`, error);
        // Only show fatal modal for user-initiated clicks/submits
        if (['click', 'submit'].includes(eventName)) {
          alert('This action could not finish. PlatePlan kept your data unchanged. Close the panel and try the action again.');
        }
      }
    }, true);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') upgradeElement(record.target);
      record.addedNodes.forEach(node => {
        if (node instanceof Element) upgradeTree(node);
      });
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: EVENT_NAMES.map(name => `on${name}`),
  });

  return Object.freeze({
    observer,
    upgrade: upgradeTree,
    remainingInlineHandlers: () => EVENT_NAMES.reduce(
      (total, name) => total + document.querySelectorAll(`[on${name}]`).length,
      0
    ),
  });
}

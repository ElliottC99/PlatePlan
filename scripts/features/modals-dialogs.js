/**
 * PlatePlan Modals Dialogs
 */
window.PlatePlanModals = window.PlatePlanModals || {};

function openAppChoiceModal(title, copy, choices, onChoose) {
  let wrap = document.getElementById('app-choice-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'app-choice-wrap';
    wrap.className = 'modal-wrap sheet-mobile';
    document.body.appendChild(wrap);
  }
  window.PlatePlanModals.State.platePlanChoiceAction = onChoose;
  wrap.innerHTML = `
    <div class="modal">
      <h3>${window.PlatePlanModals.ppEscapeHtml(title)}</h3>
      <p>${window.PlatePlanModals.ppEscapeHtml(copy)}</p>
      <div class="btn-row">
        ${(choices || []).map((choice, index) => `<button class="btn ${index === choices.length - 1 ? 'danger' : 'primary'}" onclick="PlatePlanModals.chooseAppChoice('${window.PlatePlanModals.ppEscapeAttr(choice.value)}')">${window.PlatePlanModals.ppEscapeHtml(choice.label)}</button>`).join('')}
        <button class="btn ghost" onclick="PlatePlanModals.closeAppChoiceModal()">Cancel</button>
      </div>
    </div>
  `;
  wrap.classList.add('open');
}
window.PlatePlanModals.openAppChoiceModal = openAppChoiceModal;

function chooseAppChoice(value) {
  const action = window.PlatePlanModals.State.platePlanChoiceAction;
  window.PlatePlanModals.closeAppChoiceModal();
  if (typeof action === 'function') action(value);
}
window.PlatePlanModals.chooseAppChoice = chooseAppChoice;

function closeAppChoiceModal() {
  document.getElementById('app-choice-wrap')?.classList.remove('open');
  window.PlatePlanModals.State.platePlanChoiceAction = null;
}
window.PlatePlanModals.closeAppChoiceModal = closeAppChoiceModal;

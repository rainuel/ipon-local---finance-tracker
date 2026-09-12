const modalRoot = () => document.getElementById("modal-root");
const toastRoot = () => document.getElementById("toast-root");

let lastFocusedElement = null;

/** Opens a modal with the given title and inner HTML. Returns the modal's content element so callers can attach listeners. */
export function openModal(title, innerHtml) {
  lastFocusedElement = document.activeElement;
  const root = modalRoot();
  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title">${title}</h2>
          <button type="button" class="icon-button" data-close-modal aria-label="Close">✕</button>
        </div>
        <div class="modal-body">${innerHtml}</div>
      </div>
    </div>
  `;

  root.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) closeModal();
    });
  });

  const modalEl = root.querySelector(".modal");
  modalEl.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("keydown", handleEscape);

  const firstInput = root.querySelector("input, select, textarea, button");
  if (firstInput) firstInput.focus();

  return root.querySelector(".modal-body");
}

function handleEscape(e) {
  if (e.key === "Escape") closeModal();
}

export function closeModal() {
  modalRoot().innerHTML = "";
  document.removeEventListener("keydown", handleEscape);
  if (lastFocusedElement) lastFocusedElement.focus();
}

/** Shows a brief, auto-dismissing feedback message. */
export function showToast(message, { type = "success" } = {}) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  toastRoot().appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/** Returns a Promise<boolean> — true if the user confirms a destructive action. */
export function confirmDialog(message, confirmLabel = "Confirm") {
  return new Promise((resolve) => {
    const body = openModal("Please confirm", `
      <p class="confirm-message">${message}</p>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-action="cancel">Cancel</button>
        <button type="button" class="button button-danger" data-action="confirm">${confirmLabel}</button>
      </div>
    `);

    body.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      closeModal();
      resolve(false);
    });
    body.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
  });
}

/**
 * Iconografía unificada con Font Awesome (sin emojis en la UI).
 * Uso: iconHtml("fa-copy") o setBtnIcon(button, "fa-moon", "Oscuro")
 */
const Icon = {
  copy: "fa-copy",
  check: "fa-check",
  chevronDown: "fa-chevron-down",
  chevronUp: "fa-chevron-up",
  moon: "fa-moon",
  sun: "fa-sun",
  print: "fa-print",
  share: "fa-share-nodes",
  bars: "fa-bars",
  xmark: "fa-xmark",
  mug: "fa-mug-hot",
  folder: "fa-folder",
  folderOpen: "fa-folder-open",
  file: "fa-file",
  fileLines: "fa-file-lines",
  circleCheck: "fa-circle-check",
  trophy: "fa-trophy",
  search: "fa-magnifying-glass",
  terminal: "fa-terminal",
  codeBranch: "fa-code-branch",
  rotateLeft: "fa-rotate-left",
  circleInfo: "fa-circle-info",
  download: "fa-download",
  whatsapp: "fa-brands fa-whatsapp",
  xTwitter: "fa-brands fa-x-twitter",
  link: "fa-link",
  github: "fa-brands fa-github",
};

function iconHtml(name, extraClass) {
  const extra = extraClass ? ` ${extraClass}` : "";
  const cls = name.includes("fa-brands") ? name : `fa-solid ${name}`;
  return `<i class="${cls}${extra}" aria-hidden="true"></i>`;
}

function setBtnIcon(btn, iconName, label) {
  if (!btn) return;
  btn.innerHTML = iconHtml(iconName);
  if (label) {
    const span = document.createElement("span");
    span.className = "btn-label";
    span.textContent = label;
    btn.appendChild(span);
  }
}

function swapBtnIcon(btn, iconName) {
  const ic = btn?.querySelector("i");
  if (ic) ic.className = iconName.startsWith("fa-brands") ? iconName : `fa-solid ${iconName}`;
}

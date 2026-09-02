/** Navegación por pestañas (compatible sin depender de `event` global) */
function openSection(id, buttonEl) {
  document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const section = document.getElementById(id);
  if (section) section.classList.add("active");
  const btn = buttonEl || (typeof event !== "undefined" ? event.currentTarget : null);
  if (btn) btn.classList.add("active");
  if (id === "git" && typeof window.__gitVizRefresh === "function") {
    requestAnimationFrame(() => window.__gitVizRefresh());
  }
  if (id === "simulador") {
    requestAnimationFrame(() => document.getElementById("sim-input")?.focus());
  }
}

/**
 * Estados del gráfico Git: nodos (commits), aristas parent→child, punteros de rama, HEAD.
 * `inactiveNodeIds` = commits “perdidos” del historial visible (p. ej. tras reset).
 */
const GIT_GRAPH_STATES = {
  "linear-0": {
    title: "Repositorio nuevo",
    nodes: [],
    edges: [],
    branchTips: {},
    headBranch: null,
    caption: "Aún no hay commits. Solo existe la carpeta del proyecto (y tras `git init`, `.git`).",
  },
  "linear-1": {
    title: "Primer commit",
    nodes: [{ id: "a", x: 160, y: 220, label: "a", branch: "main" }],
    edges: [],
    branchTips: { main: "a" },
    headBranch: "main",
    caption: "`git add .` y `git commit -m \"...\"` crean el primer punto del historial.",
  },
  "linear-2": {
    title: "Segundo commit",
    nodes: [
      { id: "a", x: 160, y: 220, label: "a", branch: "main" },
      { id: "b", x: 160, y: 150, label: "b", branch: "main" },
    ],
    edges: [{ from: "a", to: "b" }],
    branchTips: { main: "b" },
    headBranch: "main",
    caption: "Cada commit nuevo apunta al anterior: la rama `main` avanza.",
  },
  "linear-3": {
    title: "Tercer commit",
    nodes: [
      { id: "a", x: 160, y: 220, label: "a", branch: "main" },
      { id: "b", x: 160, y: 150, label: "b", branch: "main" },
      { id: "c", x: 160, y: 80, label: "c", branch: "main" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
    branchTips: { main: "c" },
    headBranch: "main",
    caption: "El tiempo sube hacia commits más recientes (como `git log` de abajo arriba).",
  },
  "linear-reset": {
    title: "Reset duro a b",
    nodes: [
      { id: "a", x: 160, y: 220, label: "a", branch: "main" },
      { id: "b", x: 160, y: 150, label: "b", branch: "main" },
      {
        id: "c",
        x: 160,
        y: 80,
        label: "c",
        branch: "main",
        ghost: true,
      },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c", dashed: true, ghost: true },
    ],
    branchTips: { main: "b" },
    headBranch: "main",
    caption:
      "`git reset --hard b` mueve `main` atrás: el commit `c` deja de ser alcanzable desde la rama (se muestra atenuado). ¡Cuidado en ramas compartidas!",
  },

  "branch-0": {
    title: "Solo main",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
    ],
    edges: [{ from: "m1", to: "m2" }],
    branchTips: { main: "m2" },
    headBranch: "main",
    caption: "Historial lineal en `main` antes de ramificar.",
  },
  "branch-1": {
    title: "Nueva rama feature",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
    ],
    edges: [{ from: "m1", to: "m2" }],
    branchTips: { main: "m2", feature: "m2" },
    headBranch: "main",
    caption:
      "`git branch feature` o `git switch -c feature` crean un puntero nuevo apuntando al mismo commit que `main`.",
  },
  "branch-2": {
    title: "Trabajando en feature",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
      { id: "f1", x: 260, y: 80, label: "f1", branch: "feature" },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "f1" },
    ],
    branchTips: { main: "m2", feature: "f1" },
    headBranch: "feature",
    caption: "HEAD está en `feature`. Nuevo commit `f1`: solo avanza `feature`, `main` sigue en `m2`.",
  },
  "branch-3": {
    title: "Otro commit en feature",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
      { id: "f1", x: 260, y: 130, label: "f1", branch: "feature" },
      { id: "f2", x: 260, y: 60, label: "f2", branch: "feature" },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "f1" },
      { from: "f1", to: "f2" },
    ],
    branchTips: { main: "m2", feature: "f2" },
    headBranch: "feature",
    caption: "La línea de `feature` diverge; `main` no ha cambiado.",
  },
  "branch-4": {
    title: "Volver a main",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
      { id: "f1", x: 260, y: 130, label: "f1", branch: "feature" },
      { id: "f2", x: 260, y: 60, label: "f2", branch: "feature" },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "f1" },
      { from: "f1", to: "f2" },
    ],
    branchTips: { main: "m2", feature: "f2" },
    headBranch: "main",
    caption: "`git switch main`. HEAD vuelve a `main` en `m2`; los commits de `feature` siguen existiendo.",
  },
  "branch-5": {
    title: "Merge de feature en main",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
      { id: "f1", x: 260, y: 130, label: "f1", branch: "feature" },
      { id: "f2", x: 260, y: 60, label: "f2", branch: "feature" },
      { id: "M", x: 160, y: 30, label: "M", branch: "main", merge: true },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "f1" },
      { from: "f1", to: "f2" },
      { from: "m2", to: "M" },
      { from: "f2", to: "M" },
    ],
    branchTips: { main: "M", feature: "f2" },
    headBranch: "main",
    caption:
      "`git merge feature` (desde `main`) crea un commit de fusión `M` con dos padres. La rama `feature` sigue existiendo hasta que la borres.",
  },
  "branch-6": {
    title: "Eliminar rama local",
    nodes: [
      { id: "m1", x: 160, y: 220, label: "m1", branch: "main" },
      { id: "m2", x: 160, y: 150, label: "m2", branch: "main" },
      { id: "f1", x: 260, y: 130, label: "f1", branch: "feature" },
      { id: "f2", x: 260, y: 60, label: "f2", branch: "feature" },
      { id: "M", x: 160, y: 30, label: "M", branch: "main", merge: true },
    ],
    edges: [
      { from: "m1", to: "m2" },
      { from: "m2", to: "f1" },
      { from: "f1", to: "f2" },
      { from: "m2", to: "M" },
      { from: "f2", to: "M" },
    ],
    branchTips: { main: "M" },
    headBranch: "main",
    caption:
      "`git branch -d feature` borra solo el puntero `feature`. Los commits `f1`, `f2` siguen en el grafo porque `M` los alcanza.",
  },
};

const BRANCH_COLORS = {
  main: "#27ae60",
  feature: "#9b59b6",
};

/** Misma figura para pasos distintos del texto (evita ambigüedad al hacer scroll). */
const GIT_VIZ_ALIASES = {
  "linear-3-remote": "linear-3",
  "linear-3-log": "linear-3",
};

/** Texto del panel cuando varios pasos comparten la misma figura. */
const GIT_GRAPH_COPY = {
  "linear-3-remote": {
    title: "Conectar con GitHub y subir",
    caption:
      "git remote add y git push publican tus commits. El dibujo local sigue mostrando la misma línea hasta el último commit.",
  },
  "linear-3-log": {
    title: "Tres commits en main",
    caption:
      "git log --oneline lista los mismos nodos: de abajo (más antiguo) a arriba (más reciente).",
  },
};

function renderGitGraph(stateKey) {
  const mount = document.getElementById("git-graph-svg");
  const titleEl = document.getElementById("git-graph-title");
  const captionEl = document.getElementById("git-graph-caption");
  if (!mount || !titleEl || !captionEl) return;

  const resolved = GIT_VIZ_ALIASES[stateKey] || stateKey;
  const state = GIT_GRAPH_STATES[resolved] || GIT_GRAPH_STATES["linear-0"];
  const copy = GIT_GRAPH_COPY[stateKey];
  titleEl.textContent = (copy && copy.title) || state.title;
  captionEl.textContent = (copy && copy.caption) || state.caption;

  const w = 320;
  const h = 280;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("class", "git-graph-svg-inner");
  svg.setAttribute("aria-hidden", "true");

  const nodeById = {};
  (state.nodes || []).forEach((n) => {
    nodeById[n.id] = n;
  });

  (state.edges || []).forEach((e) => {
    const from = nodeById[e.from];
    const to = nodeById[e.to];
    if (!from || !to) return;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    const ghost = e.ghost || from.ghost || to.ghost;
    line.setAttribute("stroke", ghost ? "#bdc3c7" : "#34495e");
    line.setAttribute("stroke-width", ghost ? "2" : "3");
    if (e.dashed || ghost) line.setAttribute("stroke-dasharray", "6 4");
    svg.appendChild(line);
  });

  (state.nodes || []).forEach((n) => {
    const ghost = n.ghost;
    const merge = n.merge;
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(n.x));
    circle.setAttribute("cy", String(n.y));
    circle.setAttribute("r", merge ? "14" : "12");
    const color =
      n.branch && BRANCH_COLORS[n.branch] ? BRANCH_COLORS[n.branch] : "#2980b9";
    circle.setAttribute("fill", ghost ? "#ecf0f1" : color);
    circle.setAttribute("stroke", ghost ? "#95a5a6" : "#1e8449");
    circle.setAttribute("stroke-width", ghost ? "2" : "2");
    if (ghost) circle.setAttribute("opacity", "0.45");
    svg.appendChild(circle);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(n.x));
    text.setAttribute("y", String(n.y + 4));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", ghost ? "#7f8c8d" : "#fff");
    text.setAttribute("font-size", "11");
    text.setAttribute("font-family", "Consolas, monospace");
    text.textContent = n.label || n.id;
    svg.appendChild(text);
  });

  const tips = state.branchTips || {};
  const branchNames = Object.keys(tips).sort((a, b) => {
    if (a === "main") return -1;
    if (b === "main") return 1;
    return a.localeCompare(b);
  });
  const tipLabelIndex = {};
  branchNames.forEach((branchName) => {
    const tipId = tips[branchName];
    const node = nodeById[tipId];
    if (!node || node.ghost) return;
    const idx = tipLabelIndex[tipId] || 0;
    tipLabelIndex[tipId] = idx + 1;
    const col = BRANCH_COLORS[branchName] || "#e67e22";
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(node.x + 18));
    label.setAttribute("y", String(node.y + 4 + idx * 14));
    label.setAttribute("fill", col);
    label.setAttribute("font-size", "11");
    label.setAttribute("font-weight", "700");
    label.textContent = branchName;
    svg.appendChild(label);
  });

  if (state.headBranch && tips[state.headBranch]) {
    const tipId = tips[state.headBranch];
    const node = nodeById[tipId];
    if (node && !node.ghost) {
      const headT = document.createElementNS(ns, "text");
      headT.setAttribute("x", String(node.x - 20));
      headT.setAttribute("y", String(node.y - 18));
      headT.setAttribute("fill", "#c0392b");
      headT.setAttribute("font-size", "10");
      headT.setAttribute("font-weight", "700");
      headT.textContent = "HEAD";
      svg.appendChild(headT);
    }
  }

  mount.innerHTML = "";
  mount.appendChild(svg);
}

function initGitScrollViz() {
  const steps = [...document.querySelectorAll(".git-viz-step[data-viz]")];
  if (!steps.length) return;

  let current = null;
  /** Zona de lectura: elegimos el paso cuyo centro está más cerca de esta franja. */
  const focusY = () => window.innerHeight * 0.38;

  const pickStep = () => {
    let best = null;
    let bestDist = Infinity;
    const fy = focusY();
    for (const el of steps) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 12 || r.top > window.innerHeight - 12) continue;
      const center = (r.top + r.bottom) / 2;
      const dist = Math.abs(center - fy);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    }
    if (!best) return;
    const key = best.getAttribute("data-viz");
    if (key && key !== current) {
      current = key;
      renderGitGraph(key);
    }
  };

  let scheduled = null;
  const onScrollOrResize = () => {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => {
      scheduled = null;
      pickStep();
    });
  };

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);

  window.__gitVizRefresh = pickStep;

  pickStep();

  const panel = document.getElementById("git-graph-panel");
  const zone = document.getElementById("git-interactive-zone");
  if (panel && zone) {
    const ioPanel = new IntersectionObserver(
      ([e]) => {
        if (e && e.isIntersecting) panel.classList.add("git-graph-panel--active");
        else panel.classList.remove("git-graph-panel--active");
      },
      { threshold: 0.05 }
    );
    ioPanel.observe(zone);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initGitScrollViz();
  renderGitReference();
  enhanceAllCommandBlocks();
  if (window.__reindexSearch) window.__reindexSearch();
});

/* ─── Copiar comandos (texto limpio, sin el prefijo >) ─── */

function copyText(text, btn) {
  const clean = text.trim();
  navigator.clipboard.writeText(clean).then(() => {
    const icon = btn.querySelector("i");
    const prevClass = icon ? icon.className : "fa-solid fa-copy";
    if (icon) icon.className = "fa-solid fa-check";
    btn.classList.add("btn-copy--ok");
    setTimeout(() => {
      if (icon) icon.className = prevClass;
      btn.classList.remove("btn-copy--ok");
    }, 1400);
  });
}

function buildCmdLine(text, opts) {
  opts = opts || {};
  const wrap = document.createElement("div");
  wrap.className = "cmd-line" + (opts.git ? " cmd-line--git" : "");

  const prompt = document.createElement("span");
  prompt.className = "cmd-prompt";
  prompt.textContent = ">";

  const code = document.createElement("code");
  code.className = "cmd-text";
  code.textContent = text;

  const actions = document.createElement("div");
  actions.className = "cmd-actions";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "btn-copy";
  copyBtn.title = "Copiar comando";
  copyBtn.setAttribute("aria-label", "Copiar comando");
  copyBtn.innerHTML = iconHtml(Icon.copy);
  copyBtn.addEventListener("click", () => copyText(text, copyBtn));
  actions.appendChild(copyBtn);

  if (opts.desc) {
    const descBtn = document.createElement("button");
    descBtn.type = "button";
    descBtn.className = "btn-desc";
    descBtn.title = "Qué hace este comando";
    descBtn.setAttribute("aria-label", "Mostrar descripción del comando");
    descBtn.innerHTML = iconHtml(Icon.chevronDown);
    descBtn.setAttribute("aria-expanded", "false");

    const descPanel = document.createElement("p");
    descPanel.className = "cmd-desc";
    descPanel.hidden = true;
    descPanel.textContent = opts.desc;

    descBtn.addEventListener("click", () => {
      const open = descPanel.hidden;
      descPanel.hidden = !open;
      descBtn.setAttribute("aria-expanded", open ? "true" : "false");
      const ic = descBtn.querySelector("i");
      if (ic) ic.className = open ? `fa-solid ${Icon.chevronUp}` : `fa-solid ${Icon.chevronDown}`;
    });
    actions.appendChild(descBtn);
    wrap.appendChild(prompt);
    wrap.appendChild(code);
    wrap.appendChild(actions);
    wrap.appendChild(descPanel);
  } else {
    wrap.appendChild(prompt);
    wrap.appendChild(code);
    wrap.appendChild(actions);
  }
  return wrap;
}

function enhanceCodeElement(codeEl, opts) {
  if (codeEl.closest(".cmd-line") || codeEl.classList.contains("inline-code")) return;
  const text = codeEl.textContent.replace(/^>\s*/, "").trim();
  const line = buildCmdLine(text, opts);
  codeEl.replaceWith(line);
}

function enhanceAllCommandBlocks() {
  document.querySelectorAll(".command-card > code, .git-viz-step > code").forEach((el) => {
    enhanceCodeElement(el);
  });
}

/* ─── Referencia Git con descripciones ─── */

const GIT_REF_SECTIONS = [
  {
    title: "Configuración e identidad",
    commands: [
      { cmd: "git --version", desc: "Muestra la versión instalada de Git." },
      { cmd: 'git config --global user.name "Tu Nombre"', desc: "Tu nombre aparecerá como autor en cada commit." },
      { cmd: 'git config --global user.email "tu@email.com"', desc: "Email vinculado a tus commits (debe coincidir con GitHub si usas verificación)." },
      { cmd: "git config --global init.defaultBranch main", desc: "Las repos nuevas usarán main como rama principal por defecto." },
    ],
  },
  {
    title: "Repositorio local",
    commands: [
      { cmd: "git init", desc: "Convierte la carpeta actual en repositorio Git (crea la carpeta oculta .git)." },
      { cmd: "git status", desc: "Resume archivos modificados, en staging y sin seguimiento." },
      { cmd: "git status -s", desc: "Misma información en formato corto (ideal para escaneo rápido)." },
      { cmd: "git add archivo.txt", desc: "Envía un archivo concreto al área de staging (preparación)." },
      { cmd: "git add .", desc: "Añade todos los cambios pendientes del directorio al staging." },
      { cmd: 'git commit -m "mensaje"', desc: "Guarda una instantánea del staging en el historial con un mensaje." },
      { cmd: "git log", desc: "Lista commits con autor, fecha e ID completo." },
      { cmd: "git log --oneline --graph --decorate --all", desc: "Historial compacto con ramas y fusiones dibujadas en texto." },
    ],
  },
  {
    title: "Deshacer y comparar",
    commands: [
      { cmd: "git diff", desc: "Muestra líneas cambiadas que aún no están en staging." },
      { cmd: "git restore archivo.txt", desc: "Descarta cambios locales en el archivo (vuelve al último commit)." },
      { cmd: "git restore --staged archivo.txt", desc: "Quita el archivo del staging pero mantiene cambios en disco." },
      { cmd: "git reset --soft HEAD~1", desc: "Deshace el último commit pero deja los cambios en staging." },
      {
        cmd: "git reset --hard <commit>",
        desc: "Mueve la rama al commit indicado y BORRA cambios locales posteriores. Solo en historial privado/no compartido.",
      },
      {
        cmd: "git revert <commit>",
        desc: "Crea un commit nuevo que deshace otro, sin reescribir historial. Preferido si ya hiciste push o trabajas en equipo.",
      },
    ],
  },
  {
    title: "Ramas",
    commands: [
      { cmd: "git branch", desc: "Lista ramas locales; la activa lleva asterisco (*)." },
      { cmd: "git branch nombre", desc: "Crea una rama nueva apuntando al commit actual (no cambia HEAD)." },
      { cmd: "git switch nombre", desc: "Cambia a otra rama (actualiza archivos del directorio de trabajo)." },
      { cmd: "git switch -c nombre", desc: "Crea la rama y cambia a ella en un solo paso." },
      { cmd: "git checkout nombre", desc: "Forma clásica de cambiar de rama (equivalente a switch en casos simples)." },
      { cmd: "git merge nombre", desc: "Integra otra rama en la rama actual (puede crear commit de merge)." },
      { cmd: "git branch -d nombre", desc: "Borra rama ya fusionada (solo el puntero, no los commits alcanzables)." },
      { cmd: "git branch -D nombre", desc: "Fuerza borrado de rama aunque no esté fusionada." },
    ],
  },
  {
    title: "Remoto (GitHub)",
    commands: [
      { cmd: "git clone https://github.com/usuario/repo.git", desc: "Descarga un repo completo con historial y remoto origin." },
      { cmd: "git remote -v", desc: "Lista URLs de remotos configurados (fetch/push)." },
      { cmd: "git remote add origin https://github.com/usuario/repo.git", desc: "Vincula tu repo local con uno vacío en GitHub." },
      { cmd: "git fetch origin", desc: "Trae commits y ramas del remoto sin fusionarlos aún." },
      { cmd: "git pull origin main", desc: "Descarga y fusiona cambios de main en tu rama actual." },
      { cmd: "git pull --rebase origin main", desc: "Aplica tus commits encima de los del remoto (historial más lineal)." },
      { cmd: "git push -u origin main", desc: "Sube commits y deja main local enlazada con origin/main." },
      { cmd: "git push origin --delete rama-remota", desc: "Elimina una rama en GitHub (tras mergear un PR, por ejemplo)." },
    ],
  },
  {
    title: "Avanzado (muy útil)",
    commands: [
      { cmd: "git stash", desc: "Guarda cambios locales temporalmente para cambiar de rama limpio." },
      { cmd: "git stash pop", desc: "Recupera el último stash y lo elimina de la pila." },
      { cmd: "git stash list", desc: "Muestra stashes guardados." },
      { cmd: "git cherry-pick <commit>", desc: "Copia un commit concreto a la rama actual." },
      { cmd: "git tag v1.0.0", desc: "Marca un punto importante del historial (release)." },
      { cmd: "git show <commit>", desc: "Detalle de un commit: autor, fecha y diff." },
    ],
  },
];

function renderGitReference() {
  const root = document.getElementById("git-ref-root");
  if (!root) return;
  root.innerHTML = "";
  GIT_REF_SECTIONS.forEach((section) => {
    const h3 = document.createElement("h3");
    h3.textContent = section.title;
    root.appendChild(h3);
    const card = document.createElement("div");
    card.className = "command-card command-card--git-ref";
    section.commands.forEach((item) => {
      card.appendChild(buildCmdLine(item.cmd, { git: true, desc: item.desc }));
    });
    root.appendChild(card);
  });
}

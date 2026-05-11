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
});

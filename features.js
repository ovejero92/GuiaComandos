(function () {
  const PAGE_URL = "https://ovejero92.github.io/GuiaComandos/";
  const PAGE_TITLE = "Guía de Comandos — CMD, PowerShell y Git";

  function initTheme() {
    const stored = localStorage.getItem("guia-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeBtn(theme);

    document.getElementById("btn-theme")?.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("guia-theme", next);
      updateThemeBtn(next);
    });
  }

  function updateThemeBtn(theme) {
    const btn = document.getElementById("btn-theme");
    if (!btn) return;
    setBtnIcon(btn, theme === "dark" ? Icon.sun : Icon.moon, theme === "dark" ? "Claro" : "Oscuro");
    btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
  }

  function initSearch() {
    const input = document.getElementById("global-search");
    const clear = document.getElementById("search-clear");
    const count = document.getElementById("search-count");
    if (!input) return;

    const indexCards = () => {
      document.querySelectorAll(".command-card, .git-viz-step, .info-card, .compare-table-wrap").forEach((el) => {
        if (!el.dataset.searchText) {
          el.dataset.searchText = el.textContent.toLowerCase().replace(/\s+/g, " ");
        }
      });
    };

    const filter = () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      let total = 0;

      document.querySelectorAll(".content-section").forEach((section) => {
        const items = section.querySelectorAll(".command-card, .git-viz-step, .info-card, .compare-table-wrap");
        let sectionVisible = 0;
        items.forEach((el) => {
          total++;
          const match = !q || (el.dataset.searchText || "").includes(q);
          el.classList.toggle("search-hidden", !match);
          if (match) {
            visible++;
            sectionVisible++;
          }
        });
        section.classList.toggle("section-empty-search", q.length > 0 && sectionVisible === 0);
      });

      if (count) {
        count.textContent = q ? `${visible} resultado${visible !== 1 ? "s" : ""}` : "";
        count.hidden = !q;
      }
    };

    input.addEventListener("input", filter);
    clear?.addEventListener("click", () => {
      input.value = "";
      filter();
      input.focus();
    });

    indexCards();
    window.__reindexSearch = indexCards;
  }

  function initShare() {
    document.getElementById("btn-share")?.addEventListener("click", async () => {
      const data = {
        title: PAGE_TITLE,
        text: "Guía de CMD, PowerShell y Git (con simulador)",
        url: PAGE_URL,
      };
      if (navigator.share) {
        try {
          await navigator.share(data);
        } catch (_) {}
      } else {
        copyText(PAGE_URL);
        toast("Enlace copiado");
      }
    });

    document.querySelectorAll("[data-share]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-share");
        const text = encodeURIComponent("Mirá esta guía de comandos:");
        const url = encodeURIComponent(PAGE_URL);
        let href = "";
        if (type === "whatsapp") href = `https://wa.me/?text=${text}%20${url}`;
        if (type === "twitter") href = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        if (type === "copy") {
          copyText(PAGE_URL);
          toast("Enlace copiado");
          return;
        }
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      });
    });
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text);
  }

  function toast(msg) {
    let t = document.getElementById("app-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "app-toast";
      t.className = "app-toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("app-toast--show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("app-toast--show"), 2200);
  }
  window.__toast = toast;

  function initPrint() {
    document.getElementById("btn-print")?.addEventListener("click", () => window.print());
  }

  function initMobileNav() {
    const toggle = document.getElementById("sidebar-toggle");
    const aside = document.querySelector("aside.sidebar");
    toggle?.addEventListener("click", () => {
      const open = aside?.classList.toggle("sidebar--open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".tab-btn, .nav-sub a").forEach((el) => {
      el.addEventListener("click", () => aside?.classList.remove("sidebar--open"));
    });
  }

  function initNavGroups() {
    document.querySelectorAll(".nav-group-toggle").forEach((btn) => {
      const group = btn.closest(".nav-group");
      const expanded = localStorage.getItem(`nav-${group?.dataset.group}`) !== "collapsed";
      if (group) group.classList.toggle("nav-group--collapsed", !expanded);
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      btn.addEventListener("click", () => {
        const collapsed = group?.classList.toggle("nav-group--collapsed");
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        localStorage.setItem(`nav-${group?.dataset.group}`, collapsed ? "collapsed" : "open");
      });
    });
  }

  function initFeedback() {
    const form = document.getElementById("feedback-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const subject = encodeURIComponent("Feedback — Guía Comandos");
      const body = encodeURIComponent(
        `Nombre: ${fd.get("name") || "(sin nombre)"}\n\nMensaje:\n${fd.get("message")}`
      );
      window.location.href = `mailto:soi.gustavo19@gmail.com?subject=${subject}&body=${body}`;
      toast("Se abre el mail para mandar la sugerencia");
    });
  }

  function initPWA() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  const COMMON_ERRORS = [
    {
      title: "fatal: not a git repository",
      cause: "Ejecutaste un comando git fuera de una carpeta con .git.",
      fix: "cd a tu proyecto y ejecuta git init, o clona el repo con git clone.",
    },
    {
      title: "Permission denied / acceso denegado",
      cause: "No tenés permisos sobre el archivo, carpeta o el antivirus bloquea.",
      fix: "Cierra programas que usen el archivo, ejecuta la terminal como administrador solo si hace falta, o mueve el proyecto a Documentos.",
    },
    {
      title: "Set-ExecutionPolicy — scripts deshabilitados",
      cause: "PowerShell bloquea scripts por seguridad.",
      fix: "Abre PowerShell como administrador: Set-ExecutionPolicy RemoteSigned",
    },
    {
      title: "error: failed to push / rejected",
      cause: "El remoto tiene commits que vos no tenés (alguien subió antes).",
      fix: "git pull origin main (o tu rama), resolvé conflictos si aparecen, luego git push.",
    },
    {
      title: "CONFLICT (content): Merge conflict in ...",
      cause: "Dos ramas cambiaron las mismas líneas.",
      fix: "Abrí el archivo, buscá <<<<<<< y =======, elegí la versión correcta, git add y git commit.",
    },
    {
      title: "nothing to commit, working tree clean",
      cause: "No hay cambios nuevos para guardar.",
      fix: "Editá un archivo primero, luego git add y git commit.",
    },
    {
      title: "git branch -d no está fully merged",
      cause: "La rama tiene commits que no están en la rama actual.",
      fix: "Hacé merge primero, o git branch -D para forzar (solo si sabés que no la necesitás).",
    },
  ];

  const COMPARE_ROWS = [
    { task: "Listar archivos", cmd: "dir", ps: "Get-ChildItem / ls", bash: "ls -la" },
    { task: "Cambiar carpeta", cmd: "cd ruta", ps: "Set-Location / cd", bash: "cd ruta" },
    { task: "Crear carpeta", cmd: "mkdir nombre", ps: "New-Item -ItemType Directory", bash: "mkdir nombre" },
    { task: "Crear archivo con texto", cmd: "echo texto > file.txt", ps: 'Set-Content file.txt "texto"', bash: 'echo "texto" > file.txt' },
    { task: "Ver contenido", cmd: "type file.txt", ps: "Get-Content / cat", bash: "cat file.txt" },
    { task: "Borrar archivo", cmd: "del file.txt", ps: "Remove-Item", bash: "rm file.txt" },
    { task: "Limpiar pantalla", cmd: "cls", ps: "Clear-Host / cls", bash: "clear" },
    { task: "Buscar en archivos", cmd: "findstr texto *.txt", ps: "Select-String", bash: "grep texto archivo" },
  ];

  const CLASS_FLOWS = [
    {
      title: "Subir tu TP a GitHub",
      steps: [
        "Crea carpeta del TP y ábrela en terminal.",
        "git init",
        "git add .",
        'git commit -m "Entrega TP"',
        "Crea repo vacío en GitHub (sin README).",
        "git remote add origin https://github.com/USUARIO/REPO.git",
        "git push -u origin main",
      ],
    },
    {
      title: "Clonar el repo del profe",
      steps: [
        "Copia la URL HTTPS del repo en GitHub.",
        "cd a donde quieras guardarlo.",
        "git clone https://github.com/profe/curso.git",
        "cd curso",
        "code . (opcional, abre en VS Code)",
      ],
    },
    {
      title: "Resolver un conflicto básico",
      steps: [
        "git pull origin main (aparece CONFLICT).",
        "Abrí el archivo marcado y buscá <<<<<<< HEAD.",
        "Dejá la versión correcta y borrá los marcadores.",
        "git add archivo.txt",
        'git commit -m "Resuelvo conflicto"',
        "git push",
      ],
    },
  ];

  const BASH_COMMANDS = [
    { cmd: "pwd", desc: "Muestra la carpeta actual (ruta completa)." },
    { cmd: "ls -la", desc: "Lista archivos incluyendo ocultos y permisos." },
    { cmd: "cd ..", desc: "Sube un nivel en el árbol de carpetas." },
    { cmd: "touch archivo.txt", desc: "Crea un archivo vacío o actualiza su fecha." },
    { cmd: "rm archivo.txt", desc: "Elimina un archivo." },
    { cmd: "rm -rf carpeta", desc: "Elimina carpeta y todo su contenido (¡irreversible!)." },
    { cmd: "chmod +x script.sh", desc: "Da permiso de ejecución a un script." },
    { cmd: "grep -r \"texto\" .", desc: "Busca texto recursivamente en la carpeta actual." },
    { cmd: "man comando", desc: "Manual de ayuda del comando (q para salir)." },
  ];

  function renderExtras() {
    renderErrors();
    renderCompare();
    renderFlows();
    renderBash();
    if (window.__reindexSearch) window.__reindexSearch();
  }

  function renderErrors() {
    const root = document.getElementById("errores-root");
    if (!root) return;
    root.innerHTML = COMMON_ERRORS.map(
      (e) => `
      <article class="info-card" data-searchable>
        <h3 class="info-card__title">${e.title}</h3>
        <p><strong>Causa:</strong> ${e.cause}</p>
        <p><strong>Solución:</strong> ${e.fix}</p>
      </article>`
    ).join("");
  }

  function renderCompare() {
    const root = document.getElementById("comparativa-root");
    if (!root) return;
    const rows = COMPARE_ROWS.map(
      (r) =>
        `<tr><td>${r.task}</td><td><code class="inline-code">${r.cmd}</code></td><td><code class="inline-code">${r.ps}</code></td><td><code class="inline-code">${r.bash}</code></td></tr>`
    ).join("");
    root.innerHTML = `
      <div class="compare-table-wrap table-scroll" data-searchable>
        <table class="compare-table">
          <thead><tr><th>Tarea</th><th>CMD</th><th>PowerShell</th><th>Bash / Linux</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderFlows() {
    const root = document.getElementById("flujos-root");
    if (!root) return;
    root.innerHTML = CLASS_FLOWS.map(
      (f) => `
      <article class="info-card" data-searchable>
        <h3 class="info-card__title">${f.title}</h3>
        <ol class="flow-steps">${f.steps.map((s) => `<li><code class="inline-code">${s}</code></li>`).join("")}</ol>
      </article>`
    ).join("");
  }

  function renderBash() {
    const root = document.getElementById("bash-root");
    if (!root || typeof buildCmdLine !== "function") return;
    root.innerHTML = "";
    const card = document.createElement("div");
    card.className = "command-card command-card--git-ref";
    card.dataset.searchable = "true";
    BASH_COMMANDS.forEach((item) => {
      card.appendChild(buildCmdLine(item.cmd, { desc: item.desc }));
    });
    root.appendChild(card);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initSearch();
    initShare();
    initPrint();
    initMobileNav();
    initNavGroups();
    initFeedback();
    initPWA();
    renderExtras();
  });
})();

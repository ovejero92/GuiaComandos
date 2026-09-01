/**
 * Simulador de terminal + Git en entorno controlado (sin tocar el PC real).
 */
(function () {
  const HOME = "C:\\Users\\Estudiante";
  const MAX_LOG = 200;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function shortId(n) {
    return n.toString(16).padStart(7, "0").slice(-7);
  }

  function normalizePath(cwd, input) {
    let p = (input || "").trim().replace(/\//g, "\\");
    if (!p) return cwd;
    if (/^[A-Za-z]:/.test(p)) return p.replace(/\\+$/, "") || p;
    if (p.startsWith("\\")) return p.replace(/\\+$/, "");
    const base = cwd.endsWith("\\") ? cwd.slice(0, -1) : cwd;
    const parts = base.split("\\");
    for (const seg of p.split("\\")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("\\") || HOME;
  }

  function pathKey(path) {
    return path.toLowerCase();
  }

  function isInside(child, parent) {
    const c = pathKey(child);
    const p = pathKey(parent);
    return c === p || c.startsWith(p + "\\");
  }

  function createInitialFS() {
    return {
      type: "dir",
      children: {},
    };
  }

  function getNode(fs, absPath) {
    if (pathKey(absPath) === pathKey(HOME)) return fs;
    const rel = absPath.slice(HOME.length).replace(/^\\/, "");
    if (!rel) return fs;
    let node = fs;
    for (const part of rel.split("\\")) {
      if (!node.children || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function ensureDir(fs, absPath) {
    if (pathKey(absPath) === pathKey(HOME)) return fs;
    const rel = absPath.slice(HOME.length).replace(/^\\/, "");
    let node = fs;
    let built = HOME;
    for (const part of rel.split("\\")) {
      built += "\\" + part;
      if (!node.children[part]) {
        node.children[part] = { type: "dir", children: {} };
      }
      node = node.children[part];
    }
    return node;
  }

  function listDir(fs, absPath) {
    const node = getNode(fs, absPath);
    if (!node) return { error: `El sistema no puede encontrar la ruta especificada: ${absPath}` };
    if (node.type !== "dir") return { error: "No es un directorio." };
    const items = Object.keys(node.children || {}).sort((a, b) => a.localeCompare(b));
    return { items, node };
  }

  function writeFile(fs, absPath, content) {
    const idx = absPath.lastIndexOf("\\");
    const dirPath = absPath.slice(0, idx);
    const name = absPath.slice(idx + 1);
    const dir = ensureDir(fs, dirPath);
    dir.children[name] = { type: "file", content: content ?? "" };
  }

  function readFile(fs, absPath) {
    const node = getNode(fs, absPath);
    if (!node) return { error: `No se encuentra el archivo: ${absPath}` };
    if (node.type !== "file") return { error: "Es un directorio." };
    return { content: node.content };
  }

  function deleteEntry(fs, absPath) {
    const idx = absPath.lastIndexOf("\\");
    const dirPath = absPath.slice(0, idx);
    const name = absPath.slice(idx + 1);
    const dir = getNode(fs, dirPath);
    if (!dir || !dir.children || !dir.children[name]) {
      return { error: "No se encuentra el archivo." };
    }
    delete dir.children[name];
    return { ok: true };
  }

  function collectFiles(fs, basePath, prefix, out) {
    const node = getNode(fs, basePath);
    if (!node || node.type !== "dir") return;
    for (const name of Object.keys(node.children || {})) {
      const full = basePath + "\\" + name;
      const rel = prefix ? prefix + "\\" + name : name;
      const child = node.children[name];
      if (child.type === "file") out[rel] = child.content;
      else collectFiles(fs, full, rel, out);
    }
  }

  function applySnapshot(fs, repoRoot, snapshot) {
    const repoNode = getNode(fs, repoRoot);
    if (!repoNode) return;
    repoNode.children = {};
    for (const [rel, content] of Object.entries(snapshot || {})) {
      writeFile(fs, repoRoot + "\\" + rel.replace(/\//g, "\\"), content);
    }
  }

  function createRepo() {
    return {
      root: null,
      defaultBranch: "main",
      branches: {},
      head: null,
      commits: {},
      commitSeq: 0,
      staging: {},
      lastError: null,
      lastHint: null,
    };
  }

  function findRepo(sim, cwd) {
    let p = cwd;
    while (isInside(p, HOME)) {
      const key = pathKey(p);
      if (sim.repos[key]) return { repo: sim.repos[key], root: p };
      const idx = p.lastIndexOf("\\");
      if (idx <= 0) break;
      p = p.slice(0, idx);
    }
    return null;
  }

  function repoSnapshot(sim, repoRoot) {
    const files = {};
    collectFiles(sim.fs, repoRoot, "", files);
    return files;
  }

  function headCommit(repo) {
    if (!repo.head || !repo.branches[repo.head]) return null;
    return repo.commits[repo.branches[repo.head]] || null;
  }

  function resolveCommitRef(repo, ref) {
    if (!ref) return null;
    const r = ref.trim();
    if (r === "HEAD") return headCommit(repo);
    if (r.startsWith("HEAD~")) {
      let cur = headCommit(repo);
      const n = parseInt(r.slice(5), 10) || 1;
      for (let i = 0; i < n && cur; i++) cur = cur.parent ? repo.commits[cur.parent] : null;
      return cur;
    }
    if (repo.branches[r]) return repo.commits[repo.branches[r]];
    for (const c of Object.values(repo.commits)) {
      if (c.id.startsWith(r) || c.id === r) return c;
    }
    return null;
  }

  function gitStatusText(sim, repo, repoRoot) {
    const head = headCommit(repo);
    const tracked = head ? head.snapshot : {};
    const working = repoSnapshot(sim, repoRoot);
    const lines = [`En la rama ${repo.head || repo.defaultBranch}`];
    if (!head) lines.push("\nAún no hay commits\n");
    const staged = [];
    const modified = [];
    const untracked = [];
    const allPaths = new Set([...Object.keys(tracked), ...Object.keys(working), ...Object.keys(repo.staging)]);
    for (const p of [...allPaths].sort()) {
      const inHead = tracked[p];
      const inWork = working[p];
      const inStage = repo.staging[p];
      if (inStage !== undefined && inStage !== inHead) staged.push(`\tmodificado:   ${p}`);
      else if (inStage !== undefined && inHead === undefined) staged.push(`\tnuevo archivo: ${p}`);
      if (inWork !== undefined && inHead === undefined && repo.staging[p] === undefined) untracked.push(`\t${p}`);
      else if (inWork !== undefined && inHead !== undefined && inWork !== inHead && repo.staging[p] === undefined)
        modified.push(`\tmodificado:   ${p}`);
    }
    if (staged.length) {
      lines.push("\nCambios a ser confirmados:", ...staged);
    }
    if (modified.length) {
      lines.push("\nCambios no rastreados:", ...modified);
    }
    if (untracked.length) {
      lines.push("\nArchivos sin seguimiento:", ...untracked);
    }
    if (!staged.length && !modified.length && !untracked.length && head) {
      lines.push("\nnada para hacer commit, el árbol de trabajo está limpio");
    }
    return lines.join("\n");
  }

  function createCommit(repo, message, snapshot, parents) {
    repo.commitSeq += 1;
    const id = shortId(repo.commitSeq);
    const commit = {
      id,
      message,
      snapshot: clone(snapshot),
      parent: parents.length === 1 ? parents[0] : null,
      parents: parents.length > 1 ? parents : null,
      branch: repo.head,
    };
    repo.commits[id] = commit;
    repo.branches[repo.head] = id;
    repo.staging = {};
    return commit;
  }

  function parseArgs(line) {
    const args = [];
    let cur = "";
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === " ") {
        if (cur) {
          args.push(cur);
          cur = "";
        }
      } else cur += ch;
    }
    if (cur) args.push(cur);
    return args;
  }

  class Simulator {
    constructor() {
      this.reset(true);
      this.logEl = document.getElementById("sim-log");
      this.inputEl = document.getElementById("sim-input");
      this.promptEl = document.getElementById("sim-prompt");
      this.explorerEl = document.getElementById("sim-explorer");
      this.helpEl = document.getElementById("sim-help-text");
      this.graphEl = document.getElementById("sim-git-graph");
    }

    reset(showWelcome) {
      this.fs = createInitialFS();
      this.cwd = HOME;
      this.repos = {};
      this.lines = [];
      this.lastError = null;
      this.lastHint =
        "Entorno reiniciado. Prueba: mkdir proyecto-comando → cd proyecto-comando → git init → echo hola > readme.txt → git add . → git commit -m \"Inicio\"";
      if (showWelcome !== false) {
        this.print("Simulador listo. Carpeta inicial vacía en C:\\Users\\Estudiante", "system");
        this.print("Escribe comandos CMD/Git. Usa «¿Qué pasó?» si algo falla o «Reiniciar» para volver a cero.", "system");
      }
      this.renderAll();
    }

    print(text, cls) {
      this.lines.push({ text, cls: cls || "out" });
      if (this.lines.length > MAX_LOG) this.lines.shift();
    }

    renderAll() {
      this.renderTerminal();
      this.renderExplorer();
      this.renderHelp();
      this.renderGitGraph();
    }

    renderTerminal() {
      if (!this.logEl) return;
      this.logEl.innerHTML = this.lines
        .map(
          (l) =>
            `<div class="sim-line sim-line--${l.cls}">${escapeHtml(l.text).replace(/\n/g, "<br>")}</div>`
        )
        .join("");
      this.logEl.scrollTop = this.logEl.scrollHeight;
      if (this.promptEl) this.promptEl.textContent = this.cwd + ">";
    }

    renderExplorer() {
      if (!this.explorerEl) return;
      const renderNode = (fsPath, name, depth) => {
        const node = getNode(this.fs, fsPath);
        if (!node) return "";
        const isDir = node.type === "dir";
        const active = pathKey(this.cwd) === pathKey(fsPath);
        const cls = active ? "sim-tree-item sim-tree-item--active" : "sim-tree-item";
        const icon = isDir ? "📁" : "📄";
        let html = `<div class="${cls}" style="padding-left:${depth * 14}px">${icon} ${escapeHtml(name)}</div>`;
        if (isDir && node.children) {
          for (const child of Object.keys(node.children).sort()) {
            html += renderNode(fsPath + "\\" + child, child, depth + 1);
          }
        }
        return html;
      };
      this.explorerEl.innerHTML =
        renderNode(HOME, "Estudiante", 0) ||
        `<div class="sim-tree-empty">Carpeta vacía</div>`;
    }

    renderHelp() {
      if (!this.helpEl) return;
      if (this.lastError) {
        this.helpEl.innerHTML = `<strong class="sim-help-error">Último error</strong><p>${escapeHtml(this.lastError)}</p>`;
      } else if (this.lastHint) {
        this.helpEl.innerHTML = `<strong>Ayuda</strong><p>${escapeHtml(this.lastHint)}</p>`;
      } else {
        this.helpEl.innerHTML =
          "<p>Escribe comandos en la terminal. Si Git falla, revisa que estés dentro de un repo (<code>git init</code>) y que hayas hecho <code>git add</code> antes de <code>commit</code>.</p>";
      }
    }

    renderGitGraph() {
      if (!this.graphEl) return;
      const found = findRepo(this, this.cwd);
      if (!found || !found.repo.head) {
        this.graphEl.innerHTML = '<p class="muted">Sin repo Git aquí o sin commits aún.</p>';
        return;
      }
      const repo = found.repo;
      const tips = repo.branches;
      const all = Object.values(repo.commits).sort((a, b) => a.id.localeCompare(b.id));

      if (!all.length) {
        this.graphEl.innerHTML = '<p class="muted">Sin commits todavía.</p>';
        return;
      }

      let html = '<div class="sim-graph-list">';
      for (const c of all.reverse()) {
        const branchLabels = Object.entries(tips)
          .filter(([, id]) => id === c.id)
          .map(([b]) => b);
        const headMark = tips[repo.head] === c.id ? " ← HEAD" : "";
        html += `<div class="sim-graph-row"><code>${c.id.slice(0, 7)}</code> ${escapeHtml(c.message)} <span class="sim-graph-br">${branchLabels.join(", ")}${headMark}</span></div>`;
      }
      html += "</div>";
      this.graphEl.innerHTML = html;
    }

    setError(msg, hint) {
      this.lastError = msg;
      if (hint) this.lastHint = hint;
      this.renderHelp();
    }

    clearError() {
      this.lastError = null;
    }

    run(rawLine) {
      const line = rawLine.trim();
      if (!line) return;
      this.print(this.cwd + "> " + line, "cmd");
      this.clearError();

      try {
        const out = this.execute(line);
        if (out) this.print(out, "out");
      } catch (e) {
        this.setError(String(e.message || e));
        this.print("Error: " + (e.message || e), "err");
      }
      this.renderAll();
    }

    execute(line) {
      const lower = line.toLowerCase();
      if (lower === "cls" || lower === "clear") {
        this.lines = [];
        return null;
      }

      if (lower.startsWith("git ")) return this.execGit(line);

      const args = parseArgs(line);
      const cmd = (args[0] || "").toLowerCase();

      if (cmd === "cd") {
        const target = args[1] ? normalizePath(this.cwd, args[1]) : HOME;
        if (!getNode(this.fs, target) || getNode(this.fs, target).type !== "dir") {
          this.setError("El sistema no puede encontrar la ruta especificada.", "Verifica el nombre con dir y usa cd nombre-carpeta");
          throw new Error("El sistema no puede encontrar la ruta especificada.");
        }
        this.cwd = target;
        return null;
      }

      if (cmd === "dir" || cmd === "ls") {
        const res = listDir(this.fs, this.cwd);
        if (res.error) throw new Error(res.error);
        if (!res.items.length) return " El volumen no tiene etiqueta.\n Directorio de " + this.cwd + "\n\n (vacío)";
        const rows = res.items.map((n) => {
          const t = res.node.children[n].type === "dir" ? "<DIR>" : "     ";
          return `${t}          ${n}`;
        });
        return ` El volumen no tiene etiqueta.\n Directorio de ${this.cwd}\n\n${rows.join("\n")}`;
      }

      if (cmd === "mkdir" || cmd === "md") {
        const name = args[1];
        if (!name) throw new Error("Falta el nombre de la carpeta.");
        const p = normalizePath(this.cwd, name);
        ensureDir(this.fs, p);
        this.lastHint = `Carpeta creada: ${p}. Entra con cd ${name.split("\\").pop()}`;
        return null;
      }

      if (cmd === "echo") {
        const gt = line.indexOf(">");
        if (gt === -1) return line.slice(5).trim();
        const content = line.slice(5, gt).trim().replace(/^"|"$/g, "");
        const filePart = line.slice(gt + 1).trim();
        const filePath = normalizePath(this.cwd, filePart);
        writeFile(this.fs, filePath, content);
        this.lastHint = `Archivo creado/actualizado: ${filePart}. Revisa con dir y usa git status si ya hiciste git init.`;
        return null;
      }

      if (cmd === "type" || cmd === "cat") {
        const res = readFile(this.fs, normalizePath(this.cwd, args[1]));
        if (res.error) throw new Error(res.error);
        return res.content;
      }

      if (cmd === "del") {
        const r = deleteEntry(this.fs, normalizePath(this.cwd, args[1]));
        if (r.error) throw new Error(r.error);
        return null;
      }

      this.setError(`Comando no reconocido: ${cmd}`, "Comandos disponibles: cd, dir, mkdir, echo, type, del, cls y todos los git ...");
      throw new Error(`Comando no reconocido: ${cmd}`);
    }

    execGit(line) {
      const args = parseArgs(line);
      args.shift();
      const sub = (args[0] || "").toLowerCase();
      const found = findRepo(this, this.cwd);

      if (sub === "init") {
        const key = pathKey(this.cwd);
        if (this.repos[key]) throw new Error("Repositorio Git ya inicializado.");
        const repo = createRepo();
        repo.root = this.cwd;
        repo.head = repo.defaultBranch;
        this.repos[key] = repo;
        this.lastHint = "Repo creado. Crea archivos (echo texto > archivo.txt), luego git add . y git commit -m \"mensaje\".";
        return `Inicializado repositorio Git vacío en ${this.cwd}\\.git`;
      }

      if (!found) {
        this.setError("fatal: no es un repositorio git (ni ninguno de los directorios padre)", "Entra a tu carpeta de proyecto y ejecuta git init");
        throw new Error("fatal: no es un repositorio git");
      }

      const { repo, root: repoRoot } = found;

      if (sub === "status") return gitStatusText(this, repo, repoRoot);

      if (sub === "add") {
        const target = args[1] || ".";
        const snap = repoSnapshot(this, repoRoot);
        if (target === ".") {
          for (const p of Object.keys(snap)) repo.staging[p] = snap[p];
        } else {
          const p = target.replace(/\//g, "\\");
          if (snap[p] === undefined) throw new Error(`ruta especificada '${target}' no concordó con ningún archivo`);
          repo.staging[p] = snap[p];
        }
        this.lastHint = "Archivos en staging. Confirma con git commit -m \"tu mensaje\".";
        return null;
      }

      if (sub === "commit") {
        let msg = "";
        const mi = args.indexOf("-m");
        if (mi !== -1) msg = args[mi + 1] || "";
        if (!msg) throw new Error("Abortando commit porque no se proporcionó un mensaje (-m).");
        if (!Object.keys(repo.staging).length) throw new Error("no hay nada preparado para commit (usa git add).");
        const parent = repo.branches[repo.head] || null;
        const commit = createCommit(repo, msg, repo.staging, parent ? [parent] : []);
        this.lastHint = `Commit ${commit.id.slice(0, 7)} creado. Sigue editando archivos o prueba git log --oneline.`;
        return `[${repo.head} ${commit.id.slice(0, 7)}] ${msg}`;
      }

      if (sub === "log") {
        const oneline = args.includes("--oneline");
        const chain = [];
        let cur = repo.branches[repo.head];
        while (cur) {
          chain.push(repo.commits[cur]);
          cur = repo.commits[cur]?.parent;
        }
        if (!chain.length) return "(sin commits)";
        return chain
          .map((c) => (oneline ? `${c.id.slice(0, 7)} ${c.message}` : `commit ${c.id}\nAuthor: Estudiante\n\n    ${c.message}`))
          .join("\n");
      }

      if (sub === "branch") {
        if (args[1] === "-d" || args[1] === "-D") {
          const name = args[2];
          if (!name) throw new Error("falta nombre de rama");
          if (name === repo.head) throw new Error(`no se puede borrar la rama '${name}' estando en ella`);
          if (!repo.branches[name]) throw new Error(`rama '${name}' no encontrada`);
          if (args[1] === "-d") {
            const tip = repo.branches[name];
            const headTip = repo.branches[repo.head];
            let reachable = tip === headTip;
            if (!reachable) {
              let cur = headTip;
              while (cur && !reachable) {
                const c = repo.commits[cur];
                if (!c) break;
                if (c.parent === tip || (c.parents && c.parents.includes(tip))) reachable = true;
                cur = c.parent;
              }
            }
            if (!reachable) {
              throw new Error(`la rama '${name}' no está fully merged (usa -D para forzar)`);
            }
          }
          delete repo.branches[name];
          this.lastHint = `Rama '${name}' eliminada (solo el puntero; los commits siguen si).`;
          return `Eliminada la rama ${name}`;
        }
        if (args[1] && args[1] !== "-a") {
          const name = args[1];
          if (repo.branches[name]) throw new Error(`ya existe una rama '${name}'`);
          repo.branches[name] = repo.branches[repo.head];
          return null;
        }
        return Object.keys(repo.branches)
          .map((b) => (b === repo.head ? `* ${b}` : `  ${b}`))
          .join("\n");
      }

      if (sub === "switch" || sub === "checkout") {
        let create = false;
        let name = args[1];
        if (sub === "switch" && args[1] === "-c") {
          create = true;
          name = args[2];
        }
        if (!name) throw new Error("falta rama");
        if (create) {
          if (repo.branches[name]) throw new Error(`ya existe '${name}'`);
          repo.branches[name] = repo.branches[repo.head];
        }
        if (!repo.branches[name]) throw new Error(`rama '${name}' no encontrada`);
        repo.head = name;
        const c = headCommit(repo);
        applySnapshot(this.fs, repoRoot, c ? c.snapshot : {});
        repo.staging = {};
        this.lastHint = `HEAD ahora está en '${name}'. Los archivos del directorio coinciden con ese commit.`;
        return null;
      }

      if (sub === "merge") {
        const name = args[1];
        if (!name) throw new Error("falta rama a fusionar");
        if (!repo.branches[name]) throw new Error(`rama '${name}' no encontrada`);
        if (name === repo.head) throw new Error("no se puede fusionar la rama actual consigo misma");
        const base = repo.branches[repo.head];
        const other = repo.branches[name];
        if (base === other) return "Already up to date.";
        const snap = { ...(repo.commits[base]?.snapshot || {}), ...(repo.commits[other]?.snapshot || {}) };
        applySnapshot(this.fs, repoRoot, snap);
        const staged = repoSnapshot(this, repoRoot);
        repo.staging = staged;
        const commit = createCommit(repo, `Merge branch '${name}'`, staged, [base, other]);
        this.lastHint = `Merge creado (${commit.id.slice(0, 7)}). Puedes borrar la rama con git branch -d ${name}.`;
        return `Merge made: ${commit.id.slice(0, 7)}`;
      }

      if (sub === "reset") {
        const hard = args.includes("--hard");
        const refArg = args[args.length - 1];
        const target = resolveCommitRef(repo, refArg);
        if (!target) throw new Error(`referencia ambigua o desconocida: ${refArg}`);
        repo.branches[repo.head] = target.id;
        if (hard) {
          applySnapshot(this.fs, repoRoot, target.snapshot);
          repo.staging = {};
          this.lastHint =
            "reset --hard movió la rama y borró cambios locales. Úsalo solo en commits NO publicados/compartidos. Si ya hiciste push, prefiere git revert.";
        } else {
          this.lastHint = "reset --soft/mixed no simulado aquí; usa --hard para volver atrás con cambios descartados.";
        }
        return `HEAD ahora está en ${target.id.slice(0, 7)}`;
      }

      if (sub === "revert") {
        const refArg = args[1];
        const target = resolveCommitRef(repo, refArg);
        if (!target) throw new Error(`commit desconocido: ${refArg}`);
        const cur = headCommit(repo);
        const snap = clone(cur ? cur.snapshot : {});
        for (const [p, v] of Object.entries(target.snapshot)) snap[p] = v;
        for (const p of Object.keys(cur?.snapshot || {})) {
          if (!(p in target.snapshot)) delete snap[p];
        }
        applySnapshot(this.fs, repoRoot, snap);
        repo.staging = repoSnapshot(this, repoRoot);
        const commit = createCommit(repo, `Revert "${target.message}"`, repo.staging, [repo.branches[repo.head]]);
        this.lastHint =
          "revert crea un commit NUEVO que deshace otro, sin borrar historial. Ideal cuando ya compartiste commits (push/PR). reset --hard reescribe la rama local.";
        return `[${repo.head} ${commit.id.slice(0, 7)}] Revert "${target.message}"`;
      }

      if (sub === "restore") {
        const file = args[args.length - 1];
        const head = headCommit(repo);
        if (!head) throw new Error("sin commits");
        const p = file.replace(/\//g, "\\");
        if (head.snapshot[p] !== undefined) writeFile(this.fs, repoRoot + "\\" + p, head.snapshot[p]);
        else deleteEntry(this.fs, repoRoot + "\\" + p);
        return null;
      }

      if (sub === "config") {
        return "config simulado (nombre/email ya configurados como Estudiante)";
      }

      if (sub === "remote") {
        if ((args[1] || "").toLowerCase() === "add") {
          this.lastHint = "Remoto 'origin' añadido (simulado). git push origin main simulará la subida.";
          return null;
        }
        return "origin\thttps://github.com/usuario/repo.git (simulado)";
      }

      if (sub === "push") {
        this.lastHint = "Push simulado: tus commits locales estarían en GitHub. En la vida real usa git push -u origin main la primera vez.";
        return "Enumerando objetos... simulado OK → origin/" + (args[2] || repo.head);
      }

      throw new Error(`git ${sub}: subcomando no implementado en el simulador`);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let sim = null;

  function initSimulator() {
    sim = new Simulator();
    window.__simulator = sim;

    const form = document.getElementById("sim-form");
    const input = document.getElementById("sim-input");
    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        sim.run(input.value);
        input.value = "";
      });
    }

    document.getElementById("sim-btn-reset")?.addEventListener("click", () => {
      if (confirm("¿Reiniciar todo el simulador? Se borrarán carpetas, archivos y repos Git simulados.")) {
        sim.reset(true);
      }
    });

    document.getElementById("sim-btn-help")?.addEventListener("click", () => {
      const el = document.getElementById("sim-help-panel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      sim.renderHelp();
    });

    document.querySelectorAll("[data-sim-run]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cmd = btn.getAttribute("data-sim-run");
        if (cmd && sim) {
          openSection("simulador", document.getElementById("tab-simulador"));
          sim.run(cmd);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initSimulator);
})();

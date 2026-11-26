// ============================================================
// 💻 TERMINAL ENGINE — Intérprete completo de comandos Linux
// Soporta: pipelines (|), redirección (>, >>), comillas,
// flags (-la, -p, -n), y todos los comandos del currículo
// ============================================================

import {
  VFSNode,
  buildBaseVFS,
  resolvePath,
  findNode,
} from './vfs';
import {
  PackageState,
  createPackageState,
  resolveDependencies,
  findReverseDeps,
  searchPackages,
  formatSize,
} from './packageManager';

export interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'welcome' | 'success' | 'warning';
  content: string;
}

export interface ServiceState {
  nginx: 'failed' | 'active';
}

export interface TerminalState {
  vfs: VFSNode;
  cwd: string;
  studentName: string;
  history: TerminalLine[];
  commandHistory: string[];
  services: ServiceState;
  killedPids: number[];
  packages: PackageState;
}

export function createTerminalState(studentName: string): TerminalState {
  return {
    vfs: buildBaseVFS(),
    cwd: '/home/estudiante',
    studentName,
    history: [],
    commandHistory: [],
    services: { nginx: 'failed' },
    killedPids: [],
    packages: createPackageState(),
  };
}

export function getPrompt(cwd: string): string {
  const displayPath = cwd === '/home/estudiante'
    ? '~'
    : cwd.replace('/home/estudiante', '~');
  return `estudiante@upta:${displayPath}$ `;
}

export interface CommandResult {
  output: TerminalLine[];
  newCwd: string;
  newVfs: VFSNode;
  services: ServiceState;
  killedPids: number[];
  /**
   * true solo si el comando falló de verdad.
   * NO depende del color de las líneas: `grep "ERROR"` pinta resultados en
   * rojo pero es una ejecución exitosa.
   */
  failed: boolean;
}

// ═══════════════════════════════════════════════════════════
// 🔤 TOKENIZER — respeta comillas dobles y simples
// ═══════════════════════════════════════════════════════════

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let inQuote: '"' | "'" | null = null;

  const flush = () => {
    if (cur.length > 0) { tokens.push(cur); cur = ''; }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      else cur += ch;
      continue;
    }

    if (ch === '"' || ch === "'") { inQuote = ch as '"' | "'"; continue; }
    if (ch === ' ' || ch === '\t') { flush(); continue; }

    if (ch === '|') { flush(); tokens.push('|'); continue; }

    if (ch === '>') {
      flush();
      if (input[i + 1] === '>') { tokens.push('>>'); i++; }
      else tokens.push('>');
      continue;
    }

    if (ch === '<') { flush(); tokens.push('<'); continue; }

    cur += ch;
  }
  flush();
  return tokens;
}

interface Redirect { mode: '>' | '>>'; target: string }

function parsePipeline(input: string): { stages: string[][]; redirect: Redirect | null } {
  const tokens = tokenize(input);
  const stages: string[][] = [];
  let cur: string[] = [];
  let redirect: Redirect | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '|') {
      if (cur.length) stages.push(cur);
      cur = [];
    } else if (t === '>' || t === '>>') {
      if (cur.length) stages.push(cur);
      cur = [];
      redirect = { mode: t as '>' | '>>', target: tokens[i + 1] || '' };
      i++;
    } else {
      cur.push(t);
    }
  }
  if (cur.length) stages.push(cur);
  return { stages, redirect };
}

// ═══════════════════════════════════════════════════════════
// 🧰 UTILIDADES
// ═══════════════════════════════════════════════════════════

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function octalToPerms(mode: string): string | null {
  if (!/^[0-7]{3}$/.test(mode)) return null;
  const map = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  return mode.split('').map((d) => map[parseInt(d, 10)]).join('');
}

function applyChmod(node: VFSNode, modeArg: string): boolean {
  // chmod +x / u+x / a+x → habilita ejecución
  if (['+x', 'u+x', 'a+x', 'ugo+x'].includes(modeArg)) {
    const base = node.permissions.slice(1); // 9 chars
    node.permissions =
      (node.type === 'directory' ? 'd' : '-') +
      (base[0] === 'r' ? 'r' : '-') + (base[1] === 'w' ? 'w' : '-') + 'x' +
      (base[3] === 'r' ? 'r' : '-') + (base[4] === 'w' ? 'w' : '-') + 'x' +
      (base[6] === 'r' ? 'r' : '-') + (base[7] === 'w' ? 'w' : '-') + 'x';
    return true;
  }
  const perms = octalToPerms(modeArg);
  if (!perms) return false;
  node.permissions = (node.type === 'directory' ? 'd' : '-') + perms;
  return true;
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

interface ExecCtx {
  state: TerminalState;
  cwd: string;
  stdin: string[] | null;
}

/**
 * Resolución de lectura con fallback educativo:
 * si la ruta relativa no existe en el cwd, busca en /home/estudiante.
 * (Mantiene el realismo POSIX para rutas absolutas y escritura.)
 */
const LAB_SEARCH_ROOTS = [
  '/home/estudiante',
  '/home/estudiante/documentos',
  '/var/log',
  '/tmp',
  '/etc',
];

function resolveLabPath(vfs: VFSNode, cwd: string, path: string): { node: VFSNode | null; fullPath: string } {
  const primary = resolvePath(vfs, cwd, path);
  if (primary.node) return primary;
  // Rutas absolutas se respetan tal cual (comportamiento POSIX real)
  if (path.startsWith('/') || path.startsWith('~')) return primary;
  // Fallback educativo: buscar el recurso en las rutas típicas del laboratorio
  for (const root of LAB_SEARCH_ROOTS) {
    if (root === cwd) continue;
    const alt = resolvePath(vfs, root, path);
    if (alt.node) return alt;
  }
  return primary;
}

function deleteAtPath(vfs: VFSNode, fullPath: string): boolean {
  const parentPath = fullPath.split('/').slice(0, -1).join('/') || '/';
  const name = fullPath.split('/').pop()!;
  const parent = findNode(vfs, parentPath);
  if (!parent?.children) return false;
  return parent.children.delete(name);
}

type StageResult = { lines: TerminalLine[]; newCwd?: string; error?: boolean };

// ═══════════════════════════════════════════════════════════
// ⚙️ EJECUTOR DE UNA ETAPA (comando individual)
// ═══════════════════════════════════════════════════════════

function execStage(args: string[], ctx: ExecCtx): StageResult {
  const { state, cwd } = ctx;
  const vfs = state.vfs;
  const stdin = ctx.stdin;
  const cmd = args[0];
  const rest = args.slice(1);
  const out = (content: string, type: TerminalLine['type'] = 'output'): TerminalLine =>
    ({ type, content });
  const err = (content: string): StageResult => ({ lines: [out(content, 'error')], error: true });

  if (!cmd) return { lines: [] };

  switch (cmd) {
    // ─── help ────────────────────────────────────────
    case 'help':
      return {
        lines: [
          out('╔════════════════════════════════════════════════════╗', 'info'),
          out('║   🐧  UPTA Terminal Lab — Comandos disponibles     ║', 'info'),
          out('╠════════════════════════════════════════════════════╣', 'info'),
          out('║  NAVEGACIÓN     pwd · cd · ls -la · find           ║', 'info'),
          out('║  ARCHIVOS       cat · head · tail · touch · cp     ║', 'info'),
          out('║                 mkdir -p · rm -rf                  ║', 'info'),
          out('║  TEXTO          echo · grep · sort · uniq · wc -l  ║', 'info'),
          out('║  PERMISOS       chmod · chown · whoami             ║', 'info'),
          out('║  SISTEMA        ps aux · kill · top                ║', 'info'),
          out('║  RED            ip a · ping · ss -tuln             ║', 'info'),
          out('║  SERVICIOS      systemctl status/restart/enable    ║', 'info'),
          out('║  SCRIPTING      chmod +x · ./script.sh · history   ║', 'info'),
          out('║  ARCHIVOS TAR   tar -czvf                          ║', 'info'),
          out('║  PAQUETES       apt update / search / show         ║', 'info'),
          out('║                 apt install / remove / list        ║', 'info'),
          out('║                 dpkg -l / -s / -L                  ║', 'info'),
          out('╚════════════════════════════════════════════════════╝', 'info'),
          out('Operadores:  | (tubería)   > (sobrescribir)   >> (anexar)', 'info'),
          out('Atajo: Ctrl+K abre el buscador global de comandos.', 'info'),
        ],
      };

    case 'clear':
      return { lines: [out('__CLEAR__')] };

    case 'pwd':
      return { lines: [out(cwd)] };

    case 'whoami':
      // El entorno virtual usa un usuario Linux fijo para todas las misiones.
      return { lines: [out('estudiante')] };

    case 'date':
      return { lines: [out(new Date().toString())] };

    case 'uname':
      return {
        lines: rest.includes('-a')
          ? [out('Linux upta-terminal-lab 5.15.0-lab #1 SMP x86_64 GNU/Linux')]
          : [out('Linux')],
      };

    case 'echo':
      return { lines: [out(rest.join(' '))] };

    // ─── ls ──────────────────────────────────────────
    case 'ls': {
      const flags = rest.filter((a) => a.startsWith('-')).join('');
      const targetArg = rest.find((a) => !a.startsWith('-')) || '.';
      const resolved = resolveLabPath(vfs, cwd, targetArg);

      if (!resolved.node) return err(`ls: no se puede acceder a '${targetArg}': No existe el fichero o el directorio`);

      const long = flags.includes('l');
      const human = flags.includes('h');
      const lines: TerminalLine[] = [];

      if (resolved.node.type === 'file') {
        lines.push(out(resolved.node.name));
      } else {
        if (long && resolved.node.children) {
          let total = 0;
          for (const [, c] of resolved.node.children) total += Math.ceil(c.size / 1024);
          lines.push(out(`total ${total}`));
        }
        const entries = [...(resolved.node.children?.entries() || [])].sort(([a], [b]) => a.localeCompare(b));
        for (const [name, child] of entries) {
          if (long) {
            const size = human ? humanSize(child.size).padStart(6) : String(child.size).padStart(8);
            const date = 'Ene 10 08:00';
            lines.push(out(`${child.permissions}  1 ${child.owner.padEnd(8)} ${child.group.padEnd(8)} ${size} ${date} ${name}${child.type === 'directory' ? '/' : ''}`));
          } else {
            lines.push(out(`${name}${child.type === 'directory' ? '/' : ''}`));
          }
        }
      }
      return { lines };
    }

    // ─── cd ──────────────────────────────────────────
    case 'cd': {
      const target = rest[0] || '~';
      if (target === '~') return { lines: [], newCwd: '/home/estudiante' };
      const resolved = resolvePath(vfs, cwd, target);
      if (!resolved.node || resolved.node.type !== 'directory') {
        return err(`cd: ${target}: No existe el fichero o el directorio`);
      }
      return { lines: [], newCwd: resolved.fullPath };
    }

    // ─── cat ─────────────────────────────────────────
    case 'cat': {
      if (stdin && rest.length === 0) return { lines: stdin.map((l) => out(l)) };
      if (rest.length === 0) return err('cat: falta operando de fichero');
      const lines: TerminalLine[] = [];
      let hadError = false;
      for (const f of rest) {
        const resolved = resolveLabPath(vfs, cwd, f);
        if (!resolved.node || resolved.node.type !== 'file') {
          lines.push(out(`cat: ${f}: No existe el fichero o el directorio`, 'error'));
          hadError = true;
        } else {
          (resolved.node.content || '').split('\n').forEach((l) => lines.push(out(l)));
        }
      }
      return { lines, error: hadError };
    }

    // ─── head / tail ────────────────────────────────
    case 'head':
    case 'tail': {
      let n = 10;
      const fileArgs: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '-n' && rest[i + 1]) { n = parseInt(rest[i + 1], 10) || 10; i++; }
        else if (/^-\d+$/.test(a)) { n = parseInt(a.slice(1), 10) || 10; }
        else if (!a.startsWith('-')) { fileArgs.push(a); }
      }

      let sourceLines: string[] | null = stdin;
      if (fileArgs.length > 0) {
        const resolved = resolveLabPath(vfs, cwd, fileArgs[0]);
        if (!resolved.node || resolved.node.type !== 'file') {
          return err(`${cmd}: no se puede abrir '${fileArgs[0]}' para lectura: No existe el fichero o el directorio`);
        }
        sourceLines = (resolved.node.content || '').split('\n');
      }
      if (!sourceLines) return err(`${cmd}: falta operando`);
      const sliced = cmd === 'head' ? sourceLines.slice(0, n) : sourceLines.slice(-n);
      return { lines: sliced.map((l) => out(l)) };
    }

    // ─── grep ────────────────────────────────────────
    case 'grep': {
      const pattern = rest.find((a) => !a.startsWith('-'));
      if (!pattern) return err('grep: falta patrón de búsqueda');
      const invert = rest.includes('-v');
      const fileArg = rest.filter((a) => !a.startsWith('-'))[1];

      let sourceLines: string[] | null = stdin;
      if (fileArg) {
        const resolved = resolveLabPath(vfs, cwd, fileArg);
        if (!resolved.node || resolved.node.type !== 'file') {
          return err(`grep: ${fileArg}: No existe el fichero o el directorio`);
        }
        sourceLines = (resolved.node.content || '').split('\n');
      }
      if (!sourceLines) return err('grep: (standard input) no disponible');

      const matched = sourceLines.filter((l) => l.includes(pattern) !== invert);
      const lines = matched.map((l) =>
        out(l, l.includes('ERROR') || l.includes('FAILED') ? 'error'
          : l.includes('WARNING') ? 'warning' : 'output'),
      );
      return { lines };
    }

    // ─── wc ──────────────────────────────────────────
    case 'wc': {
      const countLines = rest.includes('-l') || rest.length === 0;
      let sourceLines: string[] | null = stdin;
      const fileArg = rest.find((a) => !a.startsWith('-'));
      if (fileArg) {
        const resolved = resolveLabPath(vfs, cwd, fileArg);
        if (!resolved.node || resolved.node.type !== 'file') return err(`wc: ${fileArg}: No existe el fichero`);
        sourceLines = (resolved.node.content || '').split('\n');
      }
      if (!sourceLines) return { lines: [out('0')] };
      const n = countLines ? sourceLines.length : sourceLines.join(' ').split(/\s+/).filter(Boolean).length;
      return { lines: [out(String(n))] };
    }

    // ─── sort / uniq ────────────────────────────────
    case 'sort': {
      const src = stdin || [];
      return { lines: [...src].sort().map((l) => out(l)) };
    }
    case 'uniq': {
      const src = stdin || [];
      const deduped = src.filter((l, i) => i === 0 || l !== src[i - 1]);
      return { lines: deduped.map((l) => out(l)) };
    }

    // ─── find ────────────────────────────────────────
    case 'find': {
      const pathArg = rest.find((a) => !a.startsWith('-')) || '.';
      const nameIdx = rest.indexOf('-name');
      const pattern = nameIdx >= 0 ? rest[nameIdx + 1] : null;

      const resolved = resolvePath(vfs, cwd, pathArg);
      if (!resolved.node) return err(`find: '${pathArg}': No existe el fichero o el directorio`);

      const regex = pattern ? globToRegex(pattern) : null;
      const results: string[] = [];
      const walk = (node: VFSNode, path: string) => {
        const full = path === '/' ? `/${node.name}` : `${path}/${node.name}`;
        if (!regex || regex.test(node.name)) results.push(full);
        if (node.type === 'directory' && node.children) {
          for (const [, child] of node.children) walk(child, full);
        }
      };
      if (resolved.node.type === 'directory') {
        results.push(resolved.fullPath);
        for (const [, child] of resolved.node.children || []) walk(child, resolved.fullPath);
      } else {
        walk(resolved.node, resolved.fullPath.split('/').slice(0, -1).join('/') || '/');
      }
      return { lines: results.map((r) => out(r)) };
    }

    // ─── mkdir ───────────────────────────────────────
    case 'mkdir': {
      const recursive = rest.includes('-p');
      const targets = rest.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return err('mkdir: falta operando');

      for (const target of targets) {
        if (recursive) {
          // Para rutas relativas se parte del directorio actual. Antes se
          // duplicaba el cwd y mkdir -p parecía correcto, pero no creaba nada.
          const segments = target.split('/').filter((segment) => segment && segment !== '.');
          let curNode: VFSNode | undefined = target.startsWith('/')
            ? vfs
            : findNode(vfs, cwd) || undefined;

          for (const seg of segments) {
            if (seg === '..') {
              return err(`mkdir: la ruta '${target}' no puede contener '..' con -p en este laboratorio`);
            }
            if (!curNode || curNode.type !== 'directory') {
              return err(`mkdir: no se puede crear el directorio '${target}': No existe el fichero o el directorio`);
            }
            let next = curNode.children!.get(seg);
            if (!next) {
              next = {
                type: 'directory', name: seg, permissions: 'drwxr-xr-x',
                owner: 'estudiante', group: 'estudiante', size: 4096,
                children: new Map(), modified: new Date(), userCreated: true,
              };
              curNode.children!.set(seg, next);
            }
            if (next.type !== 'directory') {
              return err(`mkdir: no se puede crear el directorio '${target}': No es un directorio`);
            }
            curNode = next;
          }
        } else {
          const parentPath = target.includes('/') ? target.split('/').slice(0, -1).join('/') || '.' : '.';
          const dirName = target.split('/').pop()!;
          const parent = parentPath === '.' ? findNode(vfs, cwd) : resolvePath(vfs, cwd, parentPath).node;
          if (!parent || parent.type !== 'directory') {
            return err(`mkdir: no se puede crear el directorio '${target}': No existe el fichero o el directorio`);
          }
          if (parent.children!.has(dirName)) {
            return err(`mkdir: no se puede crear el directorio '${target}': El fichero ya existe`);
          }
          parent.children!.set(dirName, {
            type: 'directory', name: dirName, permissions: 'drwxr-xr-x',
            owner: 'estudiante', group: 'estudiante', size: 4096,
            children: new Map(), modified: new Date(), userCreated: true,
          });
        }
      }
      return { lines: [] };
    }

    // ─── touch ───────────────────────────────────────
    case 'touch': {
      const targets = rest.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return err('touch: falta operando');
      for (const target of targets) {
        const parentPath = target.includes('/') ? target.split('/').slice(0, -1).join('/') || '.' : '.';
        const fileName = target.split('/').pop()!;
        const parent = parentPath === '.' ? findNode(vfs, cwd) : resolveLabPath(vfs, cwd, parentPath).node;
        if (!parent || parent.type !== 'directory') {
          return err(`touch: no se puede efectuar 'touch' sobre '${target}': No existe el fichero o el directorio`);
        }
        const existingTouch = parent.children!.get(fileName);
        if (existingTouch) {
          existingTouch.modified = new Date();
          existingTouch.userCreated = true;
        } else {
          parent.children!.set(fileName, {
            type: 'file', name: fileName, permissions: '-rw-r--r--',
            owner: 'estudiante', group: 'estudiante', size: 0,
            content: '', modified: new Date(), userCreated: true,
          });
        }
      }
      return { lines: [] };
    }

    // ─── cp ──────────────────────────────────────────
    case 'cp': {
      const files = rest.filter((a) => !a.startsWith('-'));
      if (files.length < 2) return err('cp: falta operando');
      const [srcArg, dstArg] = files;
      const src = resolveLabPath(vfs, cwd, srcArg);
      if (!src.node || src.node.type !== 'file') return err(`cp: no se puede efectuar 'stat' sobre '${srcArg}': No existe el fichero`);

      let dstParent: VFSNode | null;
      let dstName: string;
      const dstResolved = resolveLabPath(vfs, cwd, dstArg);
      if (dstResolved.node && dstResolved.node.type === 'directory') {
        dstParent = dstResolved.node;
        dstName = src.node.name;
      } else {
        const parentPath = dstArg.includes('/') ? dstArg.split('/').slice(0, -1).join('/') || '/' : '.';
        dstParent = parentPath === '.' ? findNode(vfs, cwd) : resolveLabPath(vfs, cwd, parentPath).node;
        dstName = dstArg.split('/').pop()!;
      }
      if (!dstParent || dstParent.type !== 'directory') return err(`cp: no se puede crear '${dstArg}'`);

      dstParent.children!.set(dstName, {
        type: 'file', name: dstName, permissions: src.node.permissions,
        owner: 'estudiante', group: 'estudiante', size: src.node.size,
        content: src.node.content, modified: new Date(), userCreated: true,
      });
      return { lines: [] };
    }

    // ─── rm ──────────────────────────────────────────
    case 'rm': {
      const recursive = rest.includes('-r') || rest.includes('-rf') || rest.includes('-fr');
      const files = rest.filter((a) => !a.startsWith('-'));
      if (files.length === 0) return err('rm: falta operando');

      for (const target of files) {
        const resolved = resolveLabPath(vfs, cwd, target);
        if (!resolved.node) {
          return err(`rm: no se puede borrar '${target}': No existe el fichero o el directorio`);
        }
        if (resolved.node.type === 'directory') {
          if (!recursive) return err(`rm: no se puede borrar '${target}': Es un directorio`);
          if (resolved.fullPath === cwd) return err('rm: no se puede borrar el directorio actual');
        }
        // Borrado por ruta absoluta real del nodo encontrado
        deleteAtPath(vfs, resolved.fullPath);
      }
      return { lines: [] };
    }

    // ─── chmod ───────────────────────────────────────
    case 'chmod': {
      const modeArg = rest[0];
      const targetArg = rest[1];
      if (!modeArg || !targetArg) return err('chmod: falta operando');
      const resolved = resolveLabPath(vfs, cwd, targetArg);
      if (!resolved.node) return err(`chmod: no se puede acceder a '${targetArg}': No existe el fichero o el directorio`);
      if (!applyChmod(resolved.node, modeArg)) return err(`chmod: modo inválido '${modeArg}'`);
      resolved.node.userCreated = true;
      return { lines: [] };
    }

    // ─── chown ───────────────────────────────────────
    case 'chown': {
      const ownerArg = rest[0];
      const targetArg = rest[1];
      if (!ownerArg || !targetArg) return err('chown: falta operando');
      const resolved = resolveLabPath(vfs, cwd, targetArg);
      if (!resolved.node) return err(`chown: no se puede acceder a '${targetArg}': No existe el fichero o el directorio`);
      const [user, group] = ownerArg.split(':');
      if (user) resolved.node.owner = user;
      if (group) resolved.node.group = group;
      resolved.node.userCreated = true;
      return { lines: [] };
    }

    // ─── Ejecución de scripts ./ ────────────────────
    default: {
      if (cmd.startsWith('./')) {
        const scriptName = cmd.slice(2);
        const resolved = resolvePath(vfs, cwd, scriptName);
        if (!resolved.node || resolved.node.type !== 'file') {
          return err(`bash: ${cmd}: No existe el fichero o el directorio`);
        }
        if (!resolved.node.permissions.includes('x')) {
          return err(`bash: ${cmd}: Permiso denegado`);
        }
        // Mini-intérprete: ejecuta las líneas echo del script
        const scriptLines = (resolved.node.content || '').split('\n');
        const output: TerminalLine[] = [];
        for (const sl of scriptLines) {
          const m = sl.match(/^echo\s+(["']?)(.+)\1$/);
          if (m) output.push(out(m[2]));
        }
        // El script de auditoría del currículo imprime su firma oficial
        if (scriptName === 'auditoria.sh' && (resolved.node.content || '').includes('#!/bin/bash')) {
          output.push(out('Auditoria Exitosa UPTA', 'success'));
        }
        if (output.length === 0) output.push(out(''));
        return { lines: output };
      }
      return err(`bash: ${cmd}: orden no encontrada`);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 🖥️ COMANDOS DE SISTEMA (ps, kill, red, systemd, tar, etc.)
// ═══════════════════════════════════════════════════════════

function execSystemCommand(args: string[], ctx: ExecCtx): StageResult | null {
  const { state } = ctx;
  const out = (content: string, type: TerminalLine['type'] = 'output'): TerminalLine =>
    ({ type, content });
  const cmd = args[0];

  switch (cmd) {
    case 'ps': {
      const lines: TerminalLine[] = [
        out('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND'),
        out('root           1  0.0  0.1 169408 11800 ?        Ss   08:00   0:02 /sbin/init'),
        out('root         512  0.0  0.0  12344  5600 ?        Ss   08:00   0:00 /usr/sbin/sshd -D'),
      ];
      if (state.services.nginx === 'active') {
        lines.push(out('www-data     870  0.1  0.3  55420  9100 ?        S    08:01   0:01 nginx: worker process'));
      }
      if (!state.killedPids.includes(4092)) {
        lines.push(out('estudiante  4092 85.4  2.1 304112 42800 pts/0    R    09:30  12:44 python script_infinito.py'));
      }
      lines.push(out(`${state.studentName.toLowerCase()}   5120  0.0  0.0   9844  3500 pts/1    R+   10:05   0:00 ps aux`));
      return { lines };
    }

    case 'kill': {
      const sig = args.includes('-9') || args.includes('-SIGKILL');
      const pid = parseInt(args.find((a) => /^\d+$/.test(a)) || '', 10);
      if (!pid) return { lines: [out('kill: falta operando de PID', 'error')], error: true };
      if (pid === 4092 && !state.killedPids.includes(4092)) {
        state.killedPids.push(4092);
        return {
          lines: sig
            ? [out('[1]+  Killed                  python script_infinito.py')]
            : [out('')],
        };
      }
      return { lines: [out(`kill: (${pid}) - No existe ese proceso`, 'error')], error: true };
    }

    case 'useradd': {
      const name = args.filter((a) => !a.startsWith('-') && a !== '/bin/bash')[0];
      if (!name) return { lines: [out('useradd: falta nombre de usuario', 'error')], error: true };
      const home = state.vfs.children!.get('home')!;
      if (!home.children!.has(name)) {
        home.children!.set(name, {
          type: 'directory', name, permissions: 'drwxr-x---',
          owner: name, group: name, size: 4096,
          children: new Map(), modified: new Date(), userCreated: true,
        });
      }
      const passwd = findNode(state.vfs, '/etc/passwd');
      if (passwd) {
        passwd.content = (passwd.content || '') + `\n${name}:x:1001:1001::/home/${name}:/bin/bash`;
        passwd.size = passwd.content.length;
      }
      return { lines: [] };
    }

    case 'ip': {
      return {
        lines: [
          out('1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN'),
          out('    inet 127.0.0.1/8 scope host lo'),
          out('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP'),
          out('    inet 192.168.1.50/24 brd 192.168.1.255 scope global dynamic eth0'),
        ],
      };
    }
    case 'ifconfig':
      return execSystemCommand(['ip', 'a'], ctx);

    case 'ping': {
      const target = args.find((a) => !a.startsWith('-') && a !== '4') || '192.168.1.1';
      const lines: TerminalLine[] = [out(`PING ${target} (${target}) 56(84) bytes of data.`)];
      for (let i = 1; i <= 4; i++) {
        lines.push(out(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=0.${20 + i * 7} ms`));
      }
      lines.push(out(''));
      lines.push(out(`--- ${target} ping statistics ---`, 'info'));
      lines.push(out('4 packets transmitted, 4 received, 0% packet loss, time 3004ms', 'success'));
      return { lines };
    }

    case 'ss':
    case 'netstat': {
      return {
        lines: [
          out('Netid  State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port'),
          out('tcp    LISTEN  0       128      0.0.0.0:22            0.0.0.0:*        # sshd'),
          out('tcp    LISTEN  0       511      0.0.0.0:80            0.0.0.0:*        # nginx'),
          out('udp    UNCONN  0       0        127.0.0.53:53         0.0.0.0:*        # dns'),
        ],
      };
    }

    case 'systemctl': {
      const action = args[1];
      const service = args[2];
      if (!action || !service) return { lines: [out('systemctl: falta acción o servicio', 'error')], error: true };

      if (service !== 'nginx') return { lines: [out(`Failed to ${action} ${service}.service: Unit not found.`, 'error')], error: true };

      if (action === 'status') {
        if (state.services.nginx === 'failed') {
          return {
            lines: [
              out('● nginx.service - A high performance web server', 'info'),
              out('     Loaded: loaded (/lib/systemd/system/nginx.service; disabled)', 'output'),
              out('     Active: failed (Result: exit-code) since Fri 2026-01-10 14:30:00 -04', 'error'),
              out('   Main PID: 870 (code=exited, status=1/FAILURE)', 'error'),
              out('', 'output'),
              out('Ene 10 14:30:00 upta-terminal systemd[1]: nginx.service: Failed with result exit-code.', 'error'),
            ],
          };
        }
        return {
          lines: [
            out('● nginx.service - A high performance web server', 'info'),
            out('     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)', 'output'),
            out('     Active: active (running) since Fri 2026-01-10 15:00:00 -04', 'success'),
            out('   Main PID: 870 (nginx)', 'output'),
            out('      Tasks: 2 (limit: 4915)', 'output'),
            out('     Memory: 9.1M', 'output'),
          ],
        };
      }
      if (action === 'restart') {
        state.services.nginx = 'active';
        return {
          lines: [
            out('Synchronizing state of nginx.service with SysV service script...', 'output'),
            out('Active: active (running)', 'success'),
          ],
        };
      }
      if (action === 'enable') {
        return {
          lines: [
            out('Synchronizing state of nginx.service with SysV service script...', 'output'),
            out('Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service → /lib/systemd/system/nginx.service.', 'success'),
          ],
        };
      }
      if (action === 'start') {
        state.services.nginx = 'active';
        return { lines: [] };
      }
      return { lines: [out(`Unknown operation ${action}`, 'error')], error: true };
    }

    case 'tar': {
      const flags = args[1] || '';
      const archive = args[2];
      const target = args[3];
      if (!archive || !target) return { lines: [out('tar: falta nombre de fichero o directorio', 'error')], error: true };

      const targetNode = resolvePath(state.vfs, ctx.cwd, target).node;
      if (!targetNode) return { lines: [out(`tar: ${target}: No se puede efectuar stat: No existe el fichero o el directorio`, 'error')], error: true };

      const listed: string[] = [];
      const walk = (n: VFSNode, p: string) => {
        listed.push(p);
        if (n.type === 'directory' && n.children) {
          for (const [name, child] of n.children) walk(child, `${p}/${name}`);
        }
      };
      walk(targetNode, target.replace(/\/$/, ''));

      // Crear el archivo tar en el destino
      const parentPath = archive.includes('/') ? archive.split('/').slice(0, -1).join('/') || '/' : '.';
      const archiveName = archive.split('/').pop()!;
      const parent = parentPath === '.' ? findNode(state.vfs, ctx.cwd) : resolvePath(state.vfs, ctx.cwd, parentPath).node;
      if (parent && parent.type === 'directory') {
        parent.children!.set(archiveName, {
          type: 'file', name: archiveName, permissions: '-rw-r--r--',
          owner: 'estudiante', group: 'estudiante',
          size: 45 * 1024 + Math.floor(Math.random() * 2048),
          content: '[tarball gzip]', modified: new Date(), userCreated: true,
        });
      }

      const verbose = flags.includes('v');
      const lines: TerminalLine[] = verbose
        ? listed.map((p) => out(p))
        : [];
      return { lines };
    }

    case 'history': {
      return {
        lines: state.commandHistory.map((c, i) =>
          out(`  ${String(i + 1).padStart(4)}  ${c}`)),
      };
    }

    // ═══ GESTOR DE PAQUETES: apt / apt-get ═══════════
    case 'apt':
    case 'apt-get': {
      const pkgs = state.packages;
      const sub = args[1];
      const targets = args.slice(2).filter((a) => !a.startsWith('-'));
      const assumeYes = args.includes('-y') || args.includes('--yes');

      if (!sub) {
        return { lines: [
          out('apt 2.7.6 (amd64)', 'info'),
          out('Uso: apt [update|upgrade|install|remove|search|show|list] ...'),
        ] };
      }

      switch (sub) {
        case 'update': {
          pkgs.lastUpdate = Date.now();
          const total = Object.keys(pkgs.repo).length;
          return { lines: [
            out('Des:1 http://deb.upta.edu.ve/debian stable InRelease [142 kB]'),
            out('Des:2 http://deb.upta.edu.ve/debian stable/main amd64 Packages [8.2 MB]'),
            out('Des:3 http://security.upta.edu.ve/debian stable-security InRelease [48 kB]'),
            out('Descargados 8.390 kB en 2s (4.195 kB/s)'),
            out('Leyendo lista de paquetes... Hecho'),
            out('Creando árbol de dependencias... Hecho'),
            out(`Leyendo la información de estado... Hecho (${total} paquetes)`),
            pkgs.upgradable.length > 0
              ? out(`Se pueden actualizar ${pkgs.upgradable.length} paquetes. Ejecute «apt list --upgradable» para verlos.`, 'warning')
              : out('Todos los paquetes están actualizados.', 'success'),
          ] };
        }

        case 'upgrade': {
          if (pkgs.lastUpdate === null) {
            return { lines: [out('E: No se encontró la lista de paquetes. Ejecute «apt update» primero.', 'error')], error: true };
          }
          if (pkgs.upgradable.length === 0) {
            return { lines: [
              out('Leyendo lista de paquetes... Hecho'),
              out('0 actualizados, 0 nuevos se instalarán, 0 para eliminar.', 'success'),
            ] };
          }
          const list = [...pkgs.upgradable];
          pkgs.upgradable = [];
          return { lines: [
            out('Leyendo lista de paquetes... Hecho'),
            out('Creando árbol de dependencias... Hecho'),
            out('Se actualizarán los siguientes paquetes:', 'info'),
            out(`  ${list.join(' ')}`),
            out(`${list.length} actualizados, 0 nuevos se instalarán, 0 para eliminar.`),
            ...list.map((n) => out(`Desempaquetando ${n} ... Hecho`)),
            ...list.map((n) => out(`Configurando ${n} ... Hecho`)),
            out('✔ Actualización completada correctamente.', 'success'),
          ] };
        }

        case 'install': {
          if (targets.length === 0) {
            return { lines: [out('E: Debe indicar al menos un paquete para instalar.', 'error')], error: true };
          }
          if (pkgs.lastUpdate === null) {
            return { lines: [
              out('E: No se pudo localizar el paquete. ¿Olvidó ejecutar «apt update»?', 'error'),
            ], error: true };
          }

          const unknown = targets.filter((t) => !pkgs.repo[t]);
          if (unknown.length > 0) {
            return { lines: unknown.map((u) =>
              out(`E: No se ha podido localizar el paquete ${u}`, 'error')), error: true };
          }

          const already = targets.filter((t) => pkgs.installed.has(t));
          const toInstall = targets.filter((t) => !pkgs.installed.has(t));

          if (toInstall.length === 0) {
            return { lines: [
              out('Leyendo lista de paquetes... Hecho'),
              ...already.map((a) => out(`${a} ya está en su versión más reciente (${pkgs.repo[a].version}).`)),
              out('0 actualizados, 0 nuevos se instalarán, 0 para eliminar.'),
            ] };
          }

          // Resolver dependencias
          const deps = new Set<string>();
          for (const t of toInstall) {
            for (const d of resolveDependencies(pkgs, t)) deps.add(d);
          }
          const depList = [...deps];
          const allPkgs = [...depList, ...toInstall];
          const totalDownload = allPkgs.reduce((a, n) => a + pkgs.repo[n].size, 0);
          const totalDisk = allPkgs.reduce((a, n) => a + pkgs.repo[n].installedSize, 0);

          const lines: TerminalLine[] = [
            out('Leyendo lista de paquetes... Hecho'),
            out('Creando árbol de dependencias... Hecho'),
            out('Leyendo la información de estado... Hecho'),
          ];
          if (depList.length > 0) {
            lines.push(out('Se instalarán los siguientes paquetes adicionales:', 'info'));
            lines.push(out(`  ${depList.join(' ')}`));
          }
          lines.push(out('Se instalarán los siguientes paquetes NUEVOS:', 'info'));
          lines.push(out(`  ${allPkgs.join(' ')}`));
          lines.push(out(`0 actualizados, ${allPkgs.length} nuevos se instalarán, 0 para eliminar.`));
          lines.push(out(`Se necesita descargar ${formatSize(totalDownload)} de archivos.`));
          lines.push(out(`Se utilizarán ${formatSize(totalDisk)} de espacio de disco adicional.`));

          if (!assumeYes) {
            lines.push(out('¿Desea continuar? [S/n] S', 'warning'));
          }

          // Descarga + desempaquetado + configuración
          allPkgs.forEach((n, i) => {
            const p = pkgs.repo[n];
            lines.push(out(`Des:${i + 1} http://deb.upta.edu.ve/debian stable/${p.section} amd64 ${n} ${p.version} [${formatSize(p.size)}]`));
          });
          lines.push(out(`Descargados ${formatSize(totalDownload)} en 3s`));

          for (const n of allPkgs) {
            const p = pkgs.repo[n];
            lines.push(out(`Seleccionando el paquete ${n} previamente no seleccionado.`));
            lines.push(out(`Desempaquetando ${n} (${p.version}) ...`));
          }
          for (const n of allPkgs) {
            pkgs.installed.add(n);
            pkgs.repo[n].installed = true;
            // Instalar binarios en el VFS
            const binDir = findNode(state.vfs, '/usr/bin')
              || (() => {
                const usr = state.vfs.children!.get('usr')!;
                const bin: VFSNode = {
                  type: 'directory', name: 'bin', permissions: 'drwxr-xr-x',
                  owner: 'root', group: 'root', size: 4096,
                  children: new Map(), modified: new Date(),
                };
                usr.children!.set('bin', bin);
                return bin;
              })();
            for (const b of pkgs.repo[n].binaries) {
              binDir.children!.set(b, {
                type: 'file', name: b, permissions: '-rwxr-xr-x',
                owner: 'root', group: 'root', size: 1024 * 40,
                content: `[binario ELF: ${b}]`, modified: new Date(),
                userCreated: true,
              });
            }
            lines.push(out(`Configurando ${n} (${pkgs.repo[n].version}) ...`));
          }
          lines.push(out(`✔ ${allPkgs.length} paquete(s) instalado(s) correctamente.`, 'success'));
          return { lines };
        }

        case 'remove':
        case 'purge': {
          if (targets.length === 0) {
            return { lines: [out('E: Debe indicar al menos un paquete para eliminar.', 'error')], error: true };
          }
          const notInstalled = targets.filter((t) => !pkgs.installed.has(t));
          if (notInstalled.length === targets.length) {
            return { lines: notInstalled.map((n) =>
              out(`El paquete «${n}» no está instalado, no se eliminará`, 'warning')) };
          }

          const lines: TerminalLine[] = [
            out('Leyendo lista de paquetes... Hecho'),
            out('Creando árbol de dependencias... Hecho'),
          ];
          const removed: string[] = [];
          for (const t of targets) {
            if (!pkgs.installed.has(t)) continue;
            const revDeps = findReverseDeps(pkgs, t).filter((r) => !targets.includes(r));
            if (revDeps.length > 0) {
              lines.push(out(`E: El paquete «${t}» es requerido por: ${revDeps.join(', ')}`, 'error'));
              return { lines, error: true };
            }
            removed.push(t);
          }

          lines.push(out('Se ELIMINARÁN los siguientes paquetes:', 'warning'));
          lines.push(out(`  ${removed.join(' ')}`));
          const freed = removed.reduce((a, n) => a + pkgs.repo[n].installedSize, 0);
          lines.push(out(`0 actualizados, 0 nuevos se instalarán, ${removed.length} para eliminar.`));
          lines.push(out(`Se liberarán ${formatSize(freed)} de espacio de disco.`));

          for (const n of removed) {
            pkgs.installed.delete(n);
            pkgs.repo[n].installed = false;
            const binDir = findNode(state.vfs, '/usr/bin');
            if (binDir?.children) {
              for (const b of pkgs.repo[n].binaries) binDir.children.delete(b);
            }
            lines.push(out(`Desinstalando ${n} (${pkgs.repo[n].version}) ...`));
            if (sub === 'purge') {
              lines.push(out(`Purgando ficheros de configuración de ${n} ...`));
            }
          }
          lines.push(out(`✔ ${removed.length} paquete(s) eliminado(s).`, 'success'));
          return { lines };
        }

        case 'search': {
          const q = targets[0];
          if (!q) return { lines: [out('E: Debe indicar un término de búsqueda.', 'error')], error: true };
          const found = searchPackages(pkgs, q);
          if (found.length === 0) {
            return { lines: [out(`No se encontraron paquetes que coincidan con «${q}».`, 'warning')] };
          }
          const lines: TerminalLine[] = [out('Ordenando... Hecho'), out('Buscando en pantalla completa... Hecho'), out('')];
          for (const p of found) {
            lines.push(out(`${p.name}/stable ${p.version} amd64${pkgs.installed.has(p.name) ? ' [instalado]' : ''}`,
              pkgs.installed.has(p.name) ? 'success' : 'info'));
            lines.push(out(`  ${p.description}`));
            lines.push(out(''));
          }
          return { lines };
        }

        case 'show': {
          const name = targets[0];
          if (!name) return { lines: [out('E: Debe indicar un paquete.', 'error')], error: true };
          const p = pkgs.repo[name];
          if (!p) return { lines: [out(`E: No se ha podido localizar el paquete ${name}`, 'error')], error: true };
          return { lines: [
            out(`Package: ${p.name}`, 'info'),
            out(`Version: ${p.version}`),
            out(`Priority: optional`),
            out(`Section: ${p.section}`),
            out(`Installed-Size: ${formatSize(p.installedSize)}`),
            out(`Download-Size: ${formatSize(p.size)}`),
            out(`Depends: ${p.depends.length ? p.depends.join(', ') : '(ninguna)'}`),
            out(`Status: ${pkgs.installed.has(p.name) ? 'instalado' : 'no instalado'}`,
              pkgs.installed.has(p.name) ? 'success' : 'output'),
            out(`Description: ${p.description}`),
          ] };
        }

        case 'list': {
          const onlyUpgradable = args.includes('--upgradable');
          const onlyInstalled = args.includes('--installed');
          let list = Object.values(pkgs.repo);
          if (onlyUpgradable) list = list.filter((p) => pkgs.upgradable.includes(p.name));
          else if (onlyInstalled) list = list.filter((p) => pkgs.installed.has(p.name));

          const lines: TerminalLine[] = [out('Listando... Hecho')];
          for (const p of list.sort((a, b) => a.name.localeCompare(b.name))) {
            const inst = pkgs.installed.has(p.name);
            lines.push(out(
              `${p.name}/stable ${p.version} amd64${inst ? ' [instalado]' : ''}${onlyUpgradable ? ' [actualizable]' : ''}`,
              inst ? 'success' : 'output',
            ));
          }
          if (list.length === 0) lines.push(out('(sin resultados)', 'warning'));
          return { lines };
        }

        default:
          return { lines: [out(`E: Operación «${sub}» no válida para apt.`, 'error')], error: true };
      }
    }

    // ═══ dpkg ════════════════════════════════════════
    case 'dpkg': {
      const pkgs = state.packages;
      if (args.includes('-l') || args.includes('--list')) {
        const lines: TerminalLine[] = [
          out('Deseado=desconocido(U)/Instalar(I)/Eliminar(R)/Purgar(P)'),
          out('| Estado=No/Inst/Config/Desempaquetado/medio-conF/medio-Inst'),
          out('||/ Nombre               Versión          Arquitectura Descripción'),
          out('+++-====================-================-============-==============================='),
        ];
        for (const name of [...pkgs.installed].sort()) {
          const p = pkgs.repo[name];
          if (!p) continue;
          lines.push(out(`ii  ${p.name.padEnd(20)} ${p.version.padEnd(16)} amd64        ${p.description.slice(0, 31)}`));
        }
        lines.push(out(`\n${pkgs.installed.size} paquetes instalados.`, 'info'));
        return { lines };
      }

      const sIdx = args.findIndex((a) => a === '-s' || a === '--status');
      if (sIdx >= 0) {
        const name = args[sIdx + 1];
        const p = name ? pkgs.repo[name] : null;
        if (!p) return { lines: [out(`dpkg-query: no se encontró ningún paquete que corresponda con ${name}`, 'error')], error: true };
        if (!pkgs.installed.has(name)) {
          return { lines: [out(`dpkg-query: el paquete «${name}» no está instalado`, 'warning')] };
        }
        return { lines: [
          out(`Package: ${p.name}`, 'info'),
          out('Status: install ok installed', 'success'),
          out(`Priority: optional`),
          out(`Section: ${p.section}`),
          out(`Installed-Size: ${p.installedSize}`),
          out(`Version: ${p.version}`),
          out(`Depends: ${p.depends.join(', ') || '(ninguna)'}`),
          out(`Description: ${p.description}`),
        ] };
      }

      const lIdx = args.findIndex((a) => a === '-L' || a === '--listfiles');
      if (lIdx >= 0) {
        const name = args[lIdx + 1];
        const p = name ? pkgs.repo[name] : null;
        if (!p || !pkgs.installed.has(name)) {
          return { lines: [out(`dpkg-query: el paquete «${name}» no está instalado`, 'error')], error: true };
        }
        const lines = [out('/.'), out('/usr'), out('/usr/bin')];
        for (const b of p.binaries) lines.push(out(`/usr/bin/${b}`));
        lines.push(out('/usr/share/doc'), out(`/usr/share/doc/${p.name}`));
        return { lines };
      }

      return { lines: [
        out('Uso: dpkg -l           (listar instalados)'),
        out('     dpkg -s PAQUETE   (estado del paquete)'),
        out('     dpkg -L PAQUETE   (ficheros del paquete)'),
      ] };
    }

    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 🎯 EJECUCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

export function executeCommand(state: TerminalState, rawInput: string): CommandResult {
  const trimmed = rawInput.trim();
  const output: TerminalLine[] = [];
  let newCwd = state.cwd;
  const newServices = { ...state.services };
  const newKilled = [...state.killedPids];

  if (!trimmed) {
    output.push({ type: 'output', content: '' });
    return { output, newCwd, newVfs: state.vfs, services: newServices, killedPids: newKilled, failed: false };
  }

  const { stages, redirect } = parsePipeline(trimmed);

  if (stages.length === 0) {
    return { output, newCwd, newVfs: state.vfs, services: newServices, killedPids: newKilled, failed: false };
  }

  // Contexto mutable compartido entre etapas
  const shared = {
    state: {
      ...state,
      services: newServices,
      killedPids: newKilled,
    },
  };

  let stdin: string[] | null = null;
  let lastStageOutput: TerminalLine[] = [];
  let hadError = false;
  let stageCwd = newCwd;

  for (let i = 0; i < stages.length; i++) {
    const args = stages[i];
    if (args.length === 0) continue;

    const ctx: ExecCtx = {
      state: shared.state,
      cwd: stageCwd,
      stdin: i === 0 ? null : stdin,
    };

    // Primero intenta comandos de sistema (ps, kill, ip, tar...)
    let result = execSystemCommand(args, ctx);

    if (result === null) {
      // Comandos estándar
      if (i > 0 && ['pwd', 'cd', 'ls', 'mkdir', 'touch', 'rm', 'chmod', 'chown', 'cp', 'help', 'clear'].includes(args[0])) {
        // Estos comandos no leen stdin en pipes — se ejecutan igual
      }
      result = execStage(args, ctx);
    }

    if (result.error) hadError = true;
    if (result.newCwd) { stageCwd = result.newCwd; newCwd = result.newCwd; }

    lastStageOutput = result.lines;
    // La tubería transporta TODA la salida. Antes se descartaban las líneas
    // rojas, así que `grep "ERROR" archivo | wc -l` recibía 0 líneas.
    stdin = result.error ? [] : result.lines.map((l) => l.content);
  }

  // ─── Redirección de salida ─────────────────────────
  if (redirect && redirect.target) {
    const parentPath = redirect.target.includes('/')
      ? redirect.target.split('/').slice(0, -1).join('/') || '/'
      : '.';
    const fileName = redirect.target.split('/').pop()!;
    const parent = parentPath === '.'
      ? findNode(state.vfs, stageCwd)
      : resolveLabPath(state.vfs, stageCwd, parentPath).node;

    if (!parent || parent.type !== 'directory') {
      output.push({ type: 'error', content: `bash: ${redirect.target}: No existe el fichero o el directorio` });
    } else {
      const text = lastStageOutput.map((l) => l.content).join('\n');
      const existing = parent.children!.get(fileName);
      if (redirect.mode === '>>' && existing && existing.type === 'file') {
        existing.content = (existing.content || '') + '\n' + text;
        existing.size = existing.content.length;
        existing.modified = new Date();
        existing.userCreated = true;
      } else {
        parent.children!.set(fileName, {
          type: 'file', name: fileName, permissions: '-rw-r--r--',
          owner: 'estudiante', group: 'estudiante',
          size: text.length, content: text, modified: new Date(),
          userCreated: true,
        });
      }
      // Con redirección, la salida no va a pantalla (salvo errores)
      lastStageOutput = lastStageOutput.filter((l) => l.type === 'error');
    }
  }

  output.push(...lastStageOutput);

  return {
    output,
    newCwd,
    newVfs: state.vfs,
    services: newServices,
    killedPids: newKilled,
    failed: hadError,
  };
}

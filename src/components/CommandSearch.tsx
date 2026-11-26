// ============================================================
// 🔍 COMMAND SEARCH — Paleta de búsqueda global (Ctrl + K)
// Indexa: comandos, lecciones, misiones, paquetes y archivos VFS
// ============================================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { playSound } from '../utils/soundSynth';
import { MissionLevel } from '../engine/progressEngine';
import { VFSNode } from '../engine/vfs';
import { createPackageState } from '../engine/packageManager';

export type SearchKind = 'comando' | 'leccion' | 'mision' | 'paquete' | 'archivo' | 'accion';

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  keywords: string;
  action?: () => void;
}

interface CommandSearchProps {
  open: boolean;
  onClose: () => void;
  levels: MissionLevel[];
  vfs?: VFSNode | null;
  onNavigate?: (view: 'dashboard' | 'lecciones' | 'perfil') => void;
  onInsertCommand?: (cmd: string) => void;
}

const KIND_META: Record<SearchKind, { icon: string; label: string; color: string }> = {
  comando:  { icon: '⌨️', label: 'Comando', color: '#818cf8' },
  leccion:  { icon: '📚', label: 'Lección', color: '#22c55e' },
  mision:   { icon: '🎯', label: 'Misión',  color: '#7c3aed' },
  paquete:  { icon: '📦', label: 'Paquete', color: '#f97316' },
  archivo:  { icon: '📄', label: 'Archivo', color: '#94a3b8' },
  accion:   { icon: '⚡', label: 'Acción',  color: '#fb7185' },
};

// ─── Catálogo estático de comandos ────────────────────
const COMMAND_CATALOG: { cmd: string; desc: string; kw: string }[] = [
  { cmd: 'pwd', desc: 'Muestra la ruta del directorio actual', kw: 'ruta ubicacion directorio working' },
  { cmd: 'ls -la', desc: 'Lista archivos con detalles y ocultos', kw: 'listar ver contenido permisos' },
  { cmd: 'cd', desc: 'Cambia de directorio', kw: 'navegar mover entrar carpeta' },
  { cmd: 'cat', desc: 'Muestra el contenido de un archivo', kw: 'leer ver texto concatenar' },
  { cmd: 'head -n 5', desc: 'Primeras N líneas de un archivo', kw: 'inicio principio cabecera' },
  { cmd: 'tail -n 15', desc: 'Últimas N líneas de un archivo', kw: 'final ultimas log registro' },
  { cmd: 'mkdir -p', desc: 'Crea directorios anidados', kw: 'crear carpeta directorio nuevo' },
  { cmd: 'touch', desc: 'Crea un archivo vacío', kw: 'crear archivo nuevo vacio' },
  { cmd: 'cp', desc: 'Copia archivos o directorios', kw: 'copiar duplicar respaldo backup' },
  { cmd: 'rm -rf', desc: 'Elimina recursivamente y sin confirmar', kw: 'borrar eliminar purgar destruir' },
  { cmd: 'chmod 755', desc: 'Cambia permisos en notación octal', kw: 'permisos seguridad octal rwx' },
  { cmd: 'chown', desc: 'Cambia propietario y grupo', kw: 'dueño propietario grupo owner' },
  { cmd: 'grep', desc: 'Filtra líneas que coinciden con un patrón', kw: 'buscar filtrar patron regex' },
  { cmd: 'find -name', desc: 'Busca archivos por nombre', kw: 'buscar localizar encontrar' },
  { cmd: 'wc -l', desc: 'Cuenta líneas, palabras o bytes', kw: 'contar lineas numero total' },
  { cmd: 'sort', desc: 'Ordena líneas alfabéticamente', kw: 'ordenar alfabetico clasificar' },
  { cmd: 'uniq', desc: 'Elimina líneas duplicadas consecutivas', kw: 'duplicados unicos repetidos' },
  { cmd: 'tar -czvf', desc: 'Empaqueta y comprime en tarball', kw: 'comprimir archivar backup gzip' },
  { cmd: 'ps aux', desc: 'Lista todos los procesos activos', kw: 'procesos tareas memoria cpu' },
  { cmd: 'kill -9', desc: 'Termina un proceso por PID (SIGKILL)', kw: 'matar terminar detener proceso' },
  { cmd: 'useradd -m', desc: 'Crea un usuario con directorio home', kw: 'usuario cuenta crear alta' },
  { cmd: 'ip a', desc: 'Muestra interfaces y direcciones IP', kw: 'red network ip interfaz' },
  { cmd: 'ping -c 4', desc: 'Prueba conectividad con 4 paquetes ICMP', kw: 'red conectividad latencia' },
  { cmd: 'ss -tuln', desc: 'Lista sockets TCP/UDP en escucha', kw: 'puertos sockets red listening' },
  { cmd: 'systemctl status', desc: 'Consulta el estado de un servicio', kw: 'servicio daemon systemd' },
  { cmd: 'apt update', desc: 'Actualiza la lista de paquetes', kw: 'paquetes repositorio actualizar' },
  { cmd: 'apt install', desc: 'Instala uno o más paquetes', kw: 'instalar paquete software apt' },
  { cmd: 'apt search', desc: 'Busca paquetes en el repositorio', kw: 'buscar paquete repositorio' },
  { cmd: 'apt remove', desc: 'Desinstala paquetes del sistema', kw: 'desinstalar quitar eliminar' },
  { cmd: 'dpkg -l', desc: 'Lista todos los paquetes instalados', kw: 'paquetes instalados listar' },
  { cmd: 'history', desc: 'Muestra el historial de comandos', kw: 'historial registro comandos' },
  { cmd: 'whoami', desc: 'Muestra el usuario actual', kw: 'usuario quien soy identidad' },
];

export default function CommandSearch({
  open, onClose, levels, vfs, onNavigate, onInsertCommand,
}: CommandSearchProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(''); setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // ─── Construcción del índice de búsqueda ────────────
  const index = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    // Comandos
    for (const c of COMMAND_CATALOG) {
      items.push({
        id: `cmd-${c.cmd}`, kind: 'comando',
        title: c.cmd, subtitle: c.desc, keywords: `${c.cmd} ${c.kw}`,
        action: onInsertCommand ? () => onInsertCommand(c.cmd) : undefined,
      });
    }

    // Misiones y niveles
    for (const lvl of levels) {
      items.push({
        id: `lvl-${lvl.id}`, kind: 'leccion',
        title: lvl.name,
        subtitle: `${lvl.description} · ~20 min · ${lvl.steps.filter((s) => s.completed).length}/${lvl.steps.length} pasos`,
        keywords: `${lvl.name} ${lvl.description} nivel`,
        action: onNavigate ? () => onNavigate('dashboard') : undefined,
      });
      for (const s of lvl.steps) {
        items.push({
          id: `step-${s.id}`, kind: 'mision',
          title: s.command,
          subtitle: `${s.description}${s.completed ? ' · ✅ completado' : ''}`,
          keywords: `${s.command} ${s.description} ${s.hint}`,
          action: onInsertCommand ? () => onInsertCommand(s.command) : undefined,
        });
      }
    }

    // Paquetes del repositorio virtual
    const pkgState = createPackageState();
    for (const p of Object.values(pkgState.repo)) {
      items.push({
        id: `pkg-${p.name}`, kind: 'paquete',
        title: p.name,
        subtitle: `${p.description} · v${p.version} · ${p.section}`,
        keywords: `${p.name} ${p.description} ${p.section} paquete apt instalar`,
        action: onInsertCommand ? () => onInsertCommand(`apt install ${p.name}`) : undefined,
      });
    }

    // Archivos del VFS
    if (vfs) {
      const walk = (node: VFSNode, path: string) => {
        for (const [name, child] of node.children || []) {
          const full = `${path}/${name}`;
          items.push({
            id: `vfs-${full}`, kind: 'archivo',
            title: name,
            subtitle: `${full} · ${child.type === 'directory' ? 'directorio' : `${child.size} bytes`}`,
            keywords: `${name} ${full} archivo`,
            action: onInsertCommand
              ? () => onInsertCommand(child.type === 'directory' ? `cd ${full}` : `cat ${full}`)
              : undefined,
          });
          if (child.type === 'directory') walk(child, full);
        }
      };
      walk(vfs, '');
    }

    // Acciones de navegación
    if (onNavigate) {
      items.push(
        { id: 'go-dash', kind: 'accion', title: 'Ir al Dashboard',
          subtitle: 'Resumen de progreso y estadísticas', keywords: 'dashboard inicio panel progreso',
          action: () => onNavigate('dashboard') },
        { id: 'go-less', kind: 'accion', title: 'Ir a Lecciones',
          subtitle: 'Guía teórica de comandos Linux', keywords: 'lecciones teoria guia aprender',
          action: () => onNavigate('lecciones') },
        { id: 'go-prof', kind: 'accion', title: 'Ir a Perfil',
          subtitle: 'Editar datos y cambiar contraseña', keywords: 'perfil cuenta datos contraseña',
          action: () => onNavigate('perfil') },
      );
    }

    return items;
  }, [levels, vfs, onNavigate, onInsertCommand]);

  // ─── Filtrado con puntuación por relevancia ─────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, 12);

    const terms = q.split(/\s+/);
    const scored = index
      .map((item) => {
        const hay = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (!hay.includes(t)) return { item, score: -1 };
          if (item.title.toLowerCase().startsWith(t)) score += 10;
          else if (item.title.toLowerCase().includes(t)) score += 5;
          else score += 1;
        }
        return { item, score };
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    return scored.map((s) => s.item);
  }, [query, index]);

  useEffect(() => { setCursor(0); }, [query]);

  const runItem = useCallback((item: SearchItem) => {
    playSound('click');
    item.action?.();
    onClose();
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[cursor];
      if (item) runItem(item);
    }
  };

  // Mantener el elemento activo visible
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#13161f] border border-[#1f2430] rounded-2xl shadow-2xl overflow-hidden fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Campo de búsqueda */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1f2430]">
          <span className="text-base">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar comandos, lecciones, misiones, paquetes o archivos…"
            className="flex-1 bg-transparent text-white text-sm font-body outline-none placeholder:text-[#475569]"
            spellCheck={false}
          />
          <kbd className="text-[9px] font-terminal px-1.5 py-0.5 rounded border border-[#1f2430] text-[#64748b]">
            ESC
          </kbd>
        </div>

        {/* Resultados */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <span className="text-2xl opacity-40">🫥</span>
              <p className="text-xs text-[#64748b] font-body mt-2">
                Sin resultados para «{query}»
              </p>
            </div>
          ) : (
            results.map((item, i) => {
              const meta = KIND_META[item.kind];
              return (
                <button
                  key={item.id}
                  data-idx={i}
                  onClick={() => runItem(item)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl smooth-transition border ${
                    i === cursor
                      ? 'bg-[#7c3aed]/15 border-[#7c3aed]/35'
                      : 'border-transparent hover:bg-[#171a23]'
                  }`}
                >
                  <span className="text-sm shrink-0 mt-0.5">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[12px] font-terminal text-white truncate">
                        {item.title}
                      </code>
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded-full font-ui shrink-0"
                        style={{ background: `${meta.color}22`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#64748b] font-body mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  {i === cursor && (
                    <kbd className="shrink-0 self-center text-[9px] font-terminal text-[#7c3aed]">⏎</kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Pie con atajos */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[#1f2430] text-[9px] text-[#64748b] font-terminal">
          <span>↑↓ navegar</span>
          <span>⏎ seleccionar</span>
          <span>ESC cerrar</span>
          <span className="ml-auto">{results.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 📊 TOPBAR — Navegación superior con RBAC, tema y buscador
// STRICTLY NO SIDEBARS
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { playSound } from '../utils/soundSynth';
import { useTheme } from '../contexts/ThemeContext';
import { UserRole, ROLE_META } from '../engine/authEngine';

export type TopbarView =
  | 'simulador' | 'dashboard' | 'perfil' | 'lecciones'
  | 'supervision' | 'admin' | 'mensajes' | 'logout';

interface TopbarProps {
  studentName: string;
  studentEmail: string;
  role: UserRole;
  accessLabel?: string | null;
  unreadCount?: number;
  currentView: TopbarView;
  onNavigate: (view: TopbarView) => void;
  onOpenSearch: () => void;
}

const BASE_ITEMS: {
  id: TopbarView; label: string; icon: string; desc: string;
  perm?: string; onlyRole?: UserRole;
}[] = [
  { id: 'simulador', label: 'Simulador', icon: '🖥️', desc: 'Entorno de la máquina virtual' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊', desc: 'Resumen de estadísticas y avance' },
  { id: 'mensajes',  label: 'Mensajes',  icon: '📬',
    desc: 'Mensajes recibidos de tu docente', onlyRole: 'estudiante' },
  { id: 'perfil',    label: 'Perfil',    icon: '👤', desc: 'Datos de cuenta y contraseña' },
  { id: 'lecciones', label: 'Lecciones', icon: '📚', desc: 'Guía teórica de comandos Linux' },
  { id: 'supervision', label: 'Supervisión', icon: '👨‍🏫',
    desc: 'Métricas, progreso y mensajería', perm: 'analytics:read' },
  { id: 'admin', label: 'Administración', icon: '🛡️',
    desc: 'Solicitudes, usuarios y Modo Dios', perm: 'users:manage' },
];

export default function Topbar({
  studentName, studentEmail, role, accessLabel, unreadCount = 0,
  currentView, onNavigate, onOpenSearch,
}: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const meta = ROLE_META[role];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNav = (view: TopbarView) => {
    playSound('click');
    setMenuOpen(false);
    onNavigate(view);
  };

  const items = BASE_ITEMS.filter((i) => {
    if (i.onlyRole && role !== i.onlyRole) return false;
    return !i.perm || meta.permissions.includes(i.perm);
  });

  return (
    <header className="h-14 bg-[#0e111a] border-b border-[#1f2430] flex items-center justify-between px-5 shrink-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#f97316] flex items-center justify-center shadow-md shadow-[#7c3aed]/20">
          <span className="text-sm">🐧</span>
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-white font-ui leading-tight">Simulador Linux</h1>
          <p className="text-[9px] text-[#64748b] font-body tracking-wide">UPTA · Terminal Lab</p>
        </div>
        {accessLabel && (
          <span
            title="Todos los niveles del simulador están desbloqueados para tu rol"
            className="hidden md:inline-block text-[9px] px-2 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] font-ui ml-1 border border-[#f97316]/30"
          >
            {accessLabel}
          </span>
        )}
      </div>

      {/* Acciones derechas */}
      <div className="flex items-center gap-2">
        {/* Buscador */}
        <button
          onClick={() => { playSound('click'); onOpenSearch(); }}
          title="Buscar (Ctrl + K)"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/40 smooth-transition"
        >
          <span className="text-xs">🔍</span>
          <span className="hidden md:inline text-[11px] font-body">Buscar…</span>
          <kbd className="hidden lg:inline text-[9px] font-terminal px-1.5 py-0.5 rounded border border-[#1f2430]">
            ⌘K
          </kbd>
        </button>

        {/* Tema */}
        <button
          onClick={() => { playSound('click'); toggleTheme(); }}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="w-9 h-9 rounded-xl bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/40 smooth-transition flex items-center justify-center"
        >
          <span className="text-sm">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>

        {/* Usuario */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => { setMenuOpen(!menuOpen); playSound('click'); }}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl smooth-transition border ${
              menuOpen
                ? 'bg-[#7c3aed]/15 border-[#7c3aed]/40 text-white'
                : 'bg-[#13161f] border-[#1f2430] text-[#94a3b8] hover:border-[#7c3aed]/30 hover:text-white'
            }`}
          >
            <span className="text-sm">{meta.icon}</span>
            <span className="text-xs font-medium font-ui max-w-[100px] truncate hidden sm:block">
              {studentName}
            </span>
            <svg className={`w-3 h-3 smooth-transition ${menuOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#22c55e] text-white text-[10px] font-bold font-ui flex items-center justify-center border-2 border-[#0e111a]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#13161f] border border-[#1f2430] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50 fade-up">
              <div className="px-4 py-3 border-b border-[#1f2430]">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-white font-ui truncate">{studentName}</p>
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded-full font-ui shrink-0"
                    style={{ background: `${meta.color}22`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <p className="text-[10px] text-[#64748b] font-body truncate">{studentEmail}</p>
              </div>

              <div className="p-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left smooth-transition group ${
                      currentView === item.id
                        ? 'bg-[#7c3aed]/15 border border-[#7c3aed]/25'
                        : 'hover:bg-[#171a23] border border-transparent'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium font-ui ${
                          currentView === item.id ? 'text-white' : 'text-[#94a3b8] group-hover:text-white'
                        }`}>
                          {item.label}
                        </p>
                        {(item.id === 'mensajes' || item.id === 'admin') && unreadCount > 0 && (
                          <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#22c55e] text-white text-[9px] font-bold font-ui flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-[#64748b] font-body">{item.desc}</p>
                    </div>
                    {currentView === item.id && <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-[#1f2430] p-2">
                <button
                  onClick={() => handleNav('logout')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#f87171]/10 border border-transparent hover:border-[#f87171]/20 smooth-transition group"
                >
                  <span className="text-base">🚪</span>
                  <span className="text-sm font-medium text-[#94a3b8] group-hover:text-[#f87171] font-ui">
                    Cerrar Sesión
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

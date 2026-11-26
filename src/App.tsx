// ============================================================
// 🐧 Simulador Linux — UPTA Terminal Lab
// Auth (RBAC) → Dashboard / Supervisión / Admin → Máquina Virtual
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import AuthPage from './components/AuthPage';
import Topbar, { TopbarView } from './components/Topbar';
import DashboardView from './components/DashboardView';
import ProfileView from './components/ProfileView';
import SimulatorView, { resetMachineCache } from './components/SimulatorView';
import BootScreen from './components/BootScreen';
import LessonsView from './components/LessonsView';
import TeacherDashboard from './components/TeacherDashboard';
import SuperAdminPanel from './components/SuperAdminPanel';
import InboxView from './components/InboxView';
import CommandSearch from './components/CommandSearch';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { MissionLevel, createDefaultLevels } from './engine/progressEngine';
import { initAudio, playSound } from './utils/soundSynth';
import {
  RegisteredUser, getCurrentSession, logoutUser, updateUserProfile,
  getUsersDb, endSession, hasPermission, countUnread,
  getImpersonation, stopImpersonation, findUserByEmail, countPendingTeachers,
} from './engine/authEngine';

function getProgressKey(email: string): string {
  return `upta_progress_v4_${email.trim().toLowerCase()}`;
}

const ROLE_META_LABEL: Record<string, string> = {
  estudiante: 'Estudiante',
  profesor: 'Docente',
  administrador: 'SuperAdmin',
};

function AppShell() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<RegisteredUser | null>(null);
  const [view, setView] = useState<TopbarView>('dashboard');
  const [godMode, setGodMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  // Suplantación de identidad para soporte (SuperAdmin)
  const [impersonating, setImpersonating] = useState<RegisteredUser | null>(null);
  const [adminBackup, setAdminBackup] = useState<RegisteredUser | null>(null);

  const [levels, setLevels] = useState<MissionLevel[]>(createDefaultLevels);
  const [totalCommands, setTotalCommands] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [machine, setMachine] = useState<'off' | 'booting' | 'on'>('off');

  // ─── Carga de progreso individual ──────────────────
  const loadStudentProgress = useCallback((email: string) => {
    try {
      const prog = localStorage.getItem(getProgressKey(email));
      if (prog) {
        const p = JSON.parse(prog);
        const valid = Array.isArray(p.levels) && p.levels.length > 0
          && typeof p.levels[0].trayectoId === 'number';
        setLevels(valid ? p.levels : createDefaultLevels());
        setTotalCommands(typeof p.totalCommands === 'number' ? p.totalCommands : 0);
        setSessions(typeof p.sessions === 'number' ? p.sessions : 0);
        return;
      }
    } catch { /* ignore */ }
    setLevels(createDefaultLevels());
    setTotalCommands(0);
    setSessions(0);
  }, []);

  // ─── Sesión activa al iniciar ──────────────────────
  useEffect(() => {
    initAudio();
    const active = getCurrentSession();
    if (active?.email) {
      setUser(active);
      setAuthed(true);
      loadStudentProgress(active.email);
    }
  }, [loadStudentProgress]);

  // ─── Persistencia de progreso ──────────────────────
  useEffect(() => {
    if (!authed || !user) return;
    try {
      localStorage.setItem(
        getProgressKey(user.email),
        JSON.stringify({ levels, totalCommands, sessions }),
      );
    } catch { /* ignore */ }
  }, [levels, totalCommands, sessions, authed, user]);

  // ─── Contador de mensajes sin leer ─────────────────
  const refreshUnread = useCallback(() => {
    if (!user) { setUnread(0); return; }
    if (user.role === 'estudiante') setUnread(countUnread(user.email));
    // El SuperAdmin ve el contador de solicitudes docentes pendientes
    else if (user.role === 'administrador') setUnread(countPendingTeachers());
    else setUnread(0);
  }, [user]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 8000);
    return () => clearInterval(id);
  }, [refreshUnread, view]);

  // ─── Atajo global Ctrl/Cmd + K ─────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Acceso libre a niveles ────────────────────────
  // Profesor y Administrador ven TODO el contenido desbloqueado de forma
  // permanente (permiso `levels:unlock-all`). El Modo Dios del admin añade
  // además la señalización visual en la interfaz.
  const unlockAll = user ? hasPermission(user.role, 'levels:unlock-all') : false;
  const effectiveLevels = (unlockAll || godMode)
    ? levels.map((l) => ({ ...l, unlocked: true }))
    : levels;

  // Etiqueta de privilegio mostrada en la barra superior y en la VM
  const accessLabel = godMode
    ? '⚡ Modo Dios'
    : unlockAll
      ? '🔓 Acceso Total'
      : null;

  const handleAuthSuccess = useCallback((u: RegisteredUser) => {
    setUser(u);
    setAuthed(true);
    setGodMode(false);
    setView(u.role === 'profesor' ? 'supervision'
      : u.role === 'administrador' ? 'admin' : 'dashboard');
    loadStudentProgress(u.email);
  }, [loadStudentProgress]);

  const handleNavigate = useCallback((v: TopbarView) => {
    if (v === 'logout') {
      if (user) endSession(user.email);
      logoutUser();
      resetMachineCache();
      setAuthed(false); setUser(null); setMachine('off'); setGodMode(false);
      playSound('click');
      return;
    }
    if (v === 'simulador') { setView('dashboard'); return; }
    setView(v);
  }, [user]);

  const startPractice = useCallback(() => {
    setSessions((s) => s + 1);
    setMachine('booting');
  }, []);

  const resetLevels = useCallback(() => {
    resetMachineCache();
    setLevels(createDefaultLevels());
    setTotalCommands(0);
  }, []);

  // ─── Suplantación de identidad (soporte) ───────────
  const handleImpersonate = useCallback((target: RegisteredUser) => {
    if (!user) return;
    setAdminBackup(user);
    setImpersonating(target);
    setUser(target);
    setGodMode(false);
    resetMachineCache();
    setView(target.role === 'profesor' ? 'supervision' : 'dashboard');
    loadStudentProgress(target.email);
  }, [user, loadStudentProgress]);

  const stopImpersonating = useCallback(() => {
    if (!adminBackup) return;
    stopImpersonation();
    setUser(adminBackup);
    setImpersonating(null);
    setAdminBackup(null);
    resetMachineCache();
    setView('admin');
    loadStudentProgress(adminBackup.email);
    playSound('click');
  }, [adminBackup, loadStudentProgress]);

  // Restaurar suplantación tras recarga
  useEffect(() => {
    const imp = getImpersonation();
    if (imp && !impersonating) {
      const admin = findUserByEmail(imp.adminEmail);
      const target = findUserByEmail(imp.targetEmail);
      if (admin && target) {
        setAdminBackup(admin);
        setImpersonating(target);
        setUser(target);
        loadStudentProgress(target.email);
      }
    }
  }, []); // eslint-disable-line

  const saveProfile = useCallback((updates: RegisteredUser) => {
    if (!user) return;
    const res = updateUserProfile(user.email, updates);
    if (res.success && res.user) setUser(res.user);
    else {
      const current = getUsersDb()[user.email.toLowerCase()];
      if (current) setUser(current);
    }
  }, [user]);

  // ─── Acceso no autenticado ─────────────────────────
  if (!authed || !user) return <AuthPage onAuthSuccess={handleAuthSuccess} />;

  const canSupervise = hasPermission(user.role, 'analytics:read');
  const canAdmin = hasPermission(user.role, 'users:manage');

  // ─── Arranque de la VM ─────────────────────────────
  if (machine === 'booting') {
    return (
      <div className="fixed inset-0 z-50 bg-[#07080c] flex items-center justify-center p-3 sm:p-6">
        <div className="monitor-frame w-full h-full max-w-[1500px]">
          <div className="monitor-screen crt-overlay relative">
            <BootScreen studentName={user.nombre} onComplete={() => setMachine('on')} />
          </div>
          <div className="monitor-led">
            <span className="led-dot" />
            <span className="text-[9px] text-[#475569] font-ui tracking-[0.25em]">UPTA LAB</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── VM encendida ──────────────────────────────────
  if (machine === 'on') {
    return (
      <SimulatorView
        studentName={user.nombre}
        studentEmail={user.email}
        mascotSpecies={user.mascotSpecies}
        mascotGender={user.mascotGender}
        levels={effectiveLevels}
        accessLabel={accessLabel}
        onLevelsChange={setLevels}
        onCommandRun={() => setTotalCommands((c) => c + 1)}
        onExit={() => setMachine('off')}
        onReset={resetLevels}
      />
    );
  }

  // ─── Interfaz principal ────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-[#0d0f14]">
      {/* Banner de suplantación de identidad */}
      {impersonating && adminBackup && (
        <div className="bg-[#f97316] text-white px-5 py-2 flex items-center gap-3 shrink-0">
          <span className="text-sm">👁️</span>
          <p className="text-xs font-ui font-semibold flex-1 truncate">
            Estás viendo la plataforma como{' '}
            <strong>{impersonating.nombre} {impersonating.apellido}</strong>{' '}
            ({ROLE_META_LABEL[impersonating.role]}) · Modo soporte
          </p>
          <button
            onClick={stopImpersonating}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold font-ui smooth-transition shrink-0"
          >
            ✕ Volver a mi cuenta
          </button>
        </div>
      )}

      <Topbar
        studentName={`${user.nombre} ${user.apellido}`.trim()}
        studentEmail={user.email}
        role={user.role}
        accessLabel={accessLabel}
        unreadCount={unread}
        currentView={view}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {(view === 'dashboard' || view === 'simulador') && (
        <DashboardView
          studentName={user.nombre}
          trayecto={user.trayecto}
          mascotSpecies={user.mascotSpecies}
          mascotGender={user.mascotGender}
          levels={effectiveLevels}
          totalCommands={totalCommands}
          sessions={sessions}
          accessLabel={accessLabel}
          onStartPractice={startPractice}
          onGoLessons={() => setView('lecciones')}
        />
      )}

      {view === 'perfil' && <ProfileView user={user} onSave={saveProfile} />}
      {view === 'lecciones' && <LessonsView onStartPractice={startPractice} />}
      {view === 'mensajes' && user.role === 'estudiante' && (
        <InboxView email={user.email} onChanged={refreshUnread} />
      )}
      {view === 'supervision' && canSupervise && <TeacherDashboard teacher={user} />}
      {view === 'admin' && canAdmin && (
        <SuperAdminPanel
          currentEmail={user.email}
          godMode={godMode}
          onToggleGodMode={() => setGodMode((g) => !g)}
          onImpersonate={handleImpersonate}
        />
      )}

      {/* Acceso denegado por RBAC */}
      {((view === 'supervision' && !canSupervise) || (view === 'admin' && !canAdmin)) && (
        <div className="flex-1 flex items-center justify-center halo-both">
          <div className="text-center">
            <span className="text-4xl">🔒</span>
            <h2 className="text-lg font-bold text-white font-ui mt-3">Acceso restringido</h2>
            <p className="text-sm text-[#94a3b8] font-body mt-1">
              Tu rol no tiene permisos para acceder a esta sección.
            </p>
          </div>
        </div>
      )}

      <CommandSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        levels={effectiveLevels}
        onNavigate={(v) => setView(v)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

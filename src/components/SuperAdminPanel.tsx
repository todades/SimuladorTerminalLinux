// ============================================================
// 🛡️ SUPERADMIN — Métricas globales, matriz Docente→Estudiantes
// Modo Dios Total y suplantación de identidad para soporte
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  RegisteredUser, UserRole, ROLE_META, TRAYECTOS, TRAYECTO_META, getTrayectoMeta,
  getGlobalMetrics, getAssignmentMatrix, getUnassignedStudents,
  assignStudentToTeacher, getAllTeachers, isActiveToday,
  changeUserRole, toggleUserActive, deleteUser, isRootAdmin,
  startImpersonation, getPendingTeachers, approveTeacher, rejectTeacher,
  getNotifications, markNotificationsRead, dismissNotification,
  previewDeletion, toggleTeacherCascade, DeletionImpact, adminUpdateUser,
} from '../engine/authEngine';
import { createDefaultLevels, calculateProgress, MissionLevel } from '../engine/progressEngine';
import { api, ApiSection } from '../services/api';
import { playSound } from '../utils/soundSynth';

interface SuperAdminPanelProps {
  currentEmail: string;
  godMode: boolean;
  onToggleGodMode: () => void;
  onImpersonate: (user: RegisteredUser) => void;
}

const MASCOT_EMOJI: Record<string, string> = {
  pinguino: '🐧', zorro: '🦊', buho: '🦉', dragon: '🐉',
};

function loadLevels(email: string): MissionLevel[] {
  try {
    const raw = localStorage.getItem(`upta_progress_v4_${email.toLowerCase()}`);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.levels) && p.levels.length && typeof p.levels[0].trayectoId === 'number') {
        return p.levels;
      }
    }
  } catch { /* ignore */ }
  return createDefaultLevels();
}

export default function SuperAdminPanel({
  currentEmail, godMode, onToggleGodMode, onImpersonate,
}: SuperAdminPanelProps) {
  const [version, setVersion] = useState(0);
  const [trayectoFilter, setTrayectoFilter] = useState<string>('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [reassign, setReassign] = useState<RegisteredUser | null>(null);
  // Secciones para mostrar el nombre de sección elegida por el docente
  const [sections, setSections] = useState<ApiSection[]>([]);
  // Flujo de autorización docente
  const [approveTarget, setApproveTarget] = useState<RegisteredUser | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RegisteredUser | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Eliminación con previsualización de impacto
  const [delTarget, setDelTarget] = useState<RegisteredUser | null>(null);
  const [delImpact, setDelImpact] = useState<DeletionImpact | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const notify = useCallback((type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    playSound(type === 'ok' ? 'success' : 'error');
    setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    let active = true;
    api.getSections()
      .then((rows) => {
        if (active) setSections(rows || []);
      })
      .catch(() => {
        if (active) setSections([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const getSectionLabel = useCallback((sectionId?: number | null): string => {
    if (!sectionId) return 'No especificada';
    const found = sections.find((s) => s.id === sectionId);
    if (!found) return `Sección #${sectionId}`;
    return found.trayecto ? `${found.name} (${found.trayecto})` : found.name;
  }, [sections]);

  const metrics = useMemo(() => getGlobalMetrics(), [version]); // eslint-disable-line
  const matrix = useMemo(
    () => getAssignmentMatrix(trayectoFilter === 'todos' ? undefined : trayectoFilter),
    [trayectoFilter, version], // eslint-disable-line
  );
  const orphans = useMemo(() => getUnassignedStudents(), [version]); // eslint-disable-line
  const allTeachers = useMemo(() => getAllTeachers(), [version]); // eslint-disable-line
  const pending = useMemo(() => getPendingTeachers(), [version]); // eslint-disable-line
  const notifications = useMemo(() => getNotifications(currentEmail), [version, currentEmail]); // eslint-disable-line

  // Marcar notificaciones como leídas al abrir el panel
  useEffect(() => { markNotificationsRead(currentEmail); }, [currentEmail]);

  // ─── Autorización de docentes ──────────────────────
  const handleApprove = () => {
    if (!approveTarget) return;
    const chosenTrayecto = approveTarget.trayecto || TRAYECTOS[0];
    const res = approveTeacher(approveTarget.email, chosenTrayecto, currentEmail);
    if (res.success) {
      refresh();
      setApproveTarget(null);
      notify('ok', `✅ ${approveTarget.nombre} autorizado como docente (${chosenTrayecto}).`);
    } else notify('err', res.error || 'No se pudo aprobar.');
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    const res = rejectTeacher(rejectTarget.email, currentEmail, rejectReason);
    if (res.success) {
      refresh();
      setRejectTarget(null);
      setRejectReason('');
      notify('ok', 'Solicitud rechazada. Se notificó al solicitante.');
    } else notify('err', res.error || 'No se pudo rechazar.');
  };

  const matchSearch = (u: RegisteredUser) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${u.nombre} ${u.apellido} ${u.email} ${u.cedula}`.toLowerCase().includes(q);
  };

  const filteredMatrix = matrix.filter(
    (a) => matchSearch(a.teacher) || a.students.some(matchSearch),
  );

  // ─── Acciones ──────────────────────────────────────
  const handleRole = (email: string, role: UserRole) => {
    const res = changeUserRole(email, role);
    if (res.success) { refresh(); notify('ok', `Rol actualizado a ${ROLE_META[role].label}.`); }
    else notify('err', res.error || 'Error al cambiar el rol.');
  };

  const handleToggle = (email: string) => {
    const res = toggleUserActive(email);
    if (res.success) { refresh(); notify('ok', `Cuenta ${res.user?.active ? 'activada' : 'desactivada'}.`); }
    else notify('err', res.error || 'Error.');
  };

  /** Abre el diálogo mostrando qué se perderá */
  const askDelete = (u: RegisteredUser) => {
    const impact = previewDeletion(u.email);
    if (!impact.canDelete) { notify('err', impact.reason || 'No se puede eliminar.'); return; }
    setDelTarget(u);
    setDelImpact(impact);
    playSound('click');
  };

  const confirmDelete = () => {
    if (!delTarget) return;
    const name = `${delTarget.nombre} ${delTarget.apellido}`;
    const res = deleteUser(delTarget.email);
    if (res.success) {
      refresh();
      setDelTarget(null); setDelImpact(null); setConfirmDel(null);
      notify('ok', `${name} fue eliminado junto con todos sus datos.`);
    } else notify('err', res.error || 'Error al eliminar.');
  };

  const handleDelete = (email: string) => {
    const res = deleteUser(email);
    if (res.success) { refresh(); setConfirmDel(null); notify('ok', 'Usuario eliminado.'); }
    else notify('err', res.error || 'Error.');
  };

  /** Activa/desactiva un docente arrastrando a sus estudiantes */
  const handleTeacherCascade = (email: string, active: boolean) => {
    const res = toggleTeacherCascade(email, active);
    if (res.success) {
      refresh();
      notify('ok', active
        ? 'Docente y sus estudiantes activados.'
        : 'Docente y sus estudiantes desactivados.');
    } else notify('err', res.error || 'Error.');
  };

  /** Mueve al estudiante de Trayecto y reasigna titular automáticamente */
  const handleTrayecto = (studentEmail: string, trayecto: string) => {
    const res = adminUpdateUser(studentEmail, { trayecto });
    if (res.success) {
      refresh();
      setReassign(null);
      notify('ok', `Estudiante movido a ${trayecto}.`);
    } else notify('err', res.error || 'Error al cambiar el Trayecto.');
  };

  const handleAssign = (studentEmail: string, teacherEmail: string | null) => {
    const res = assignStudentToTeacher(studentEmail, teacherEmail);
    if (res.success) {
      refresh(); setReassign(null);
      notify('ok', teacherEmail ? 'Estudiante reasignado correctamente.' : 'Estudiante desvinculado.');
    } else notify('err', res.error || 'Error al reasignar.');
  };

  const handleImpersonate = (u: RegisteredUser) => {
    const res = startImpersonation(currentEmail, u.email);
    if (res.success && res.user) {
      playSound('boot');
      onImpersonate(res.user);
    } else notify('err', res.error || 'No se pudo suplantar.');
  };

  // ─── Fila de estudiante ────────────────────────────
  const StudentRow = ({ s }: { s: RegisteredUser }) => {
    const levels = loadLevels(s.email);
    const progress = calculateProgress(levels);
    const online = isActiveToday(s.email);
    return (
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 rounded-xl border smooth-transition ${
        s.active ? 'bg-[#0e111a] border-[#1f2430] hover:border-[#7c3aed]/30' : 'bg-[#f87171]/5 border-[#f87171]/20'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-sm shrink-0">{MASCOT_EMOJI[s.mascotSpecies] ?? '🎓'}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`text-xs font-semibold font-ui truncate ${s.active ? 'text-white' : 'text-[#64748b]'}`}>
                {s.nombre} {s.apellido}
              </p>
              {online && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" title="Activo hoy" />}
              {!s.active && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#f87171]/20 text-[#f87171] font-ui">
                  inactivo
                </span>
              )}
            </div>
            <p className="text-[9px] text-[#64748b] font-body truncate">
              {s.email} · C.I. {s.cedula}
            </p>
          </div>
        </div>

        <div className="w-24 shrink-0">
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-[#64748b] font-body">Avance</span>
            <span className="text-[#7c3aed] font-terminal font-bold">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#1f2430] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1]"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => setReassign(s)} title="Reasignar docente"
            className="px-2 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#6366f1]/40 smooth-transition">
            🔀
          </button>
          <button onClick={() => handleImpersonate(s)} title="Ver como este estudiante"
            className="px-2 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#f97316]/40 smooth-transition">
            👁️
          </button>
          <button onClick={() => handleToggle(s.email)}
            title={s.active ? 'Desactivar cuenta' : 'Activar cuenta'}
            className={`px-2 py-1 rounded-lg text-[9px] font-ui border smooth-transition ${
              s.active
                ? 'bg-[#13161f] border-[#1f2430] text-[#94a3b8] hover:text-[#fbbf24] hover:border-[#fbbf24]/40'
                : 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]'
            }`}>
            {s.active ? '🚫' : '✅'}
          </button>
          {confirmDel === s.email ? (
            <>
              <button onClick={() => handleDelete(s.email)}
                className="px-2 py-1 rounded-lg text-[9px] font-ui bg-[#f87171]/20 border border-[#f87171]/40 text-[#f87171]">
                Sí
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-2 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#64748b]">
                ✕
              </button>
            </>
          ) : (
            <button onClick={() => askDelete(s)} title="Eliminar estudiante"
              className="px-2 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-[#f87171] hover:border-[#f87171]/40 smooth-transition">
              🗑️
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-7xl mx-auto p-6 space-y-5">

        {/* ═══ Encabezado + Modo Dios Total ═══ */}
        <div className="bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 fade-up">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <span className="text-2xl">🛡️</span>
                <h2 className="text-xl font-extrabold text-white font-editorial">
                  Panel del SuperAdministrador
                </h2>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] font-ui border border-[#f97316]/30">
                  Admin Global Único
                </span>
              </div>
              <p className="text-sm text-[#94a3b8] font-body">
                Métricas en tiempo real, matriz de relaciones Docente–Estudiante y control total.
              </p>
            </div>
            <button
              onClick={() => { playSound('click'); onToggleGodMode(); }}
              className={`px-5 py-3 rounded-2xl text-sm font-bold font-ui smooth-transition border-2 ${
                godMode
                  ? 'bg-[#f97316]/20 border-[#f97316] text-[#f97316] glow-violet'
                  : 'bg-[#0e111a] border-[#1f2430] text-[#94a3b8] hover:border-[#f97316]/50'
              }`}
            >
              {godMode ? '⚡ Modo Dios Total ACTIVO' : '🔓 Activar Modo Dios Total'}
            </button>
          </div>
        </div>

        {/* ═══ SOLICITUDES DOCENTES PENDIENTES ═══ */}
        {pending.length > 0 && (
          <div className="bg-[#13161f] rounded-2xl border-2 border-[#fbbf24]/40 overflow-hidden fade-up">
            <div className="px-5 py-3 border-b border-[#1f2430] flex items-center gap-2"
              style={{ background: 'rgba(251,191,36,.08)' }}>
              <span className="text-base animate-pulse">🔔</span>
              <h3 className="text-sm font-bold text-[#fbbf24] font-ui">
                Solicitudes de Cuenta Docente
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#fbbf24] text-[#0d0f14] font-bold font-ui">
                {pending.length} pendiente{pending.length === 1 ? '' : 's'}
              </span>
              <span className="ml-auto text-[10px] text-[#64748b] font-body hidden sm:block">
                Requieren tu autorización para acceder
              </span>
            </div>

            <div className="divide-y divide-[#1f2430]">
              {pending.map((t) => (
                <div key={t.email} className="px-5 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/15 flex items-center justify-center text-base shrink-0">
                      {MASCOT_EMOJI[t.mascotSpecies] ?? '👨‍🏫'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white font-ui">
                          {t.nombre} {t.apellido}
                        </p>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#7c3aed]/20 text-[#a78bfa] font-ui">
                          {t.trayecto || 'Sin Trayecto'} · {getSectionLabel(t.sectionId)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748b] font-body">
                        {t.email} · C.I. {t.cedula} · 📞 {t.telefono}
                      </p>
                      <p className="text-[9px] text-[#475569] font-terminal mt-0.5">
                        Solicitado el {new Date(t.registeredAt).toLocaleString('es-VE', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setApproveTarget(t);
                          playSound('click');
                        }}
                        className="px-4 py-2 rounded-xl text-[11px] font-bold font-ui bg-[#22c55e]/20 border border-[#22c55e]/45 text-[#22c55e] hover:bg-[#22c55e]/30 smooth-transition"
                      >
                        ✅ Autorizar
                      </button>
                      <button
                        onClick={() => { setRejectTarget(t); setRejectReason(''); playSound('click'); }}
                        className="px-4 py-2 rounded-xl text-[11px] font-bold font-ui bg-[#f87171]/15 border border-[#f87171]/40 text-[#f87171] hover:bg-[#f87171]/25 smooth-transition"
                      >
                        ❌ Rechazar
                      </button>
                      <button
                        onClick={() => askDelete(t)}
                        title="Eliminar la solicitud y la cuenta por completo"
                        className="px-3 py-2 rounded-xl text-[11px] font-ui bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-[#f87171] hover:border-[#f87171]/40 smooth-transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Historial de notificaciones ═══ */}
        {notifications.length > 0 && (
          <details className="bg-[#13161f] rounded-2xl border border-[#1f2430] overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer flex items-center gap-2 hover:bg-[#171a23] smooth-transition">
              <span className="text-base">📨</span>
              <h3 className="text-sm font-bold text-white font-ui">Historial de Notificaciones</h3>
              <span className="ml-auto text-[10px] font-terminal text-[#64748b]">
                {notifications.length} evento(s)
              </span>
            </summary>
            <div className="divide-y divide-[#1f2430] max-h-64 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="px-5 py-2.5 flex items-start gap-3">
                  <span className="text-xs shrink-0 mt-0.5">
                    {n.type === 'teacher_request' ? '🔔'
                      : n.type === 'teacher_approved' ? '✅'
                      : n.type === 'teacher_rejected' ? '❌' : 'ℹ️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white font-ui">{n.title}</p>
                    <p className="text-[10px] text-[#94a3b8] font-body">{n.body}</p>
                    <p className="text-[9px] text-[#475569] font-terminal mt-0.5">
                      {new Date(n.createdAt).toLocaleString('es-VE', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => { dismissNotification(n.id); refresh(); }}
                    className="text-[10px] text-[#475569] hover:text-[#f87171] smooth-transition shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ═══ Métricas en tiempo real ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            { l: 'Total Docentes',    v: metrics.totalTeachers,      c: '#22c55e', i: '👨‍🏫' },
            { l: 'Total Estudiantes', v: metrics.totalStudents,      c: '#6366f1', i: '🎓' },
            { l: 'Activos Hoy',       v: metrics.activeToday,        c: '#7c3aed', i: '📈' },
            { l: 'En Línea Ahora',    v: metrics.onlineNow,          c: '#4ade80', i: '🟢' },
            { l: 'Sin Docente',       v: metrics.unassignedStudents, c: '#fbbf24', i: '⚠️' },
            { l: 'Desactivados',      v: metrics.inactiveAccounts,   c: '#f87171', i: '🚫' },
          ].map((k) => (
            <div key={k.l} className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-base">{k.i}</span>
                {k.l === 'En Línea Ahora' && metrics.onlineNow > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-extrabold font-terminal" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[9px] text-[#64748b] uppercase tracking-wider font-body mt-0.5">{k.l}</p>
            </div>
          ))}
        </div>

        {/* ═══ Distribución por Trayecto ═══ */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5">
          <h3 className="text-sm font-bold text-white font-ui mb-3">📊 Distribución por Trayecto</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.byTrayecto.map((t) => {
              const meta = getTrayectoMeta(t.trayecto);
              return (
                <div key={t.trayecto} className="bg-[#0e111a] rounded-xl p-4 border border-[#1f2430]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{meta.icon}</span>
                    <h4 className="text-xs font-bold font-ui" style={{ color: meta.color }}>
                      {t.trayecto}
                    </h4>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-lg font-extrabold font-terminal text-[#22c55e]">{t.teachers}</p>
                      <p className="text-[8px] text-[#64748b] uppercase font-body">Docentes</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold font-terminal text-[#818cf8]">{t.students}</p>
                      <p className="text-[8px] text-[#64748b] uppercase font-body">Estudiantes</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Filtros ═══ */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[#13161f] border border-[#1f2430] rounded-2xl px-4 py-2.5">
            <span className="text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar docente o estudiante…"
              className="flex-1 bg-transparent text-white text-sm font-body outline-none placeholder:text-[#475569]"
            />
          </div>
          <div className="flex gap-1 bg-[#13161f] border border-[#1f2430] rounded-2xl p-1 overflow-x-auto">
            <button onClick={() => setTrayectoFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold font-ui smooth-transition whitespace-nowrap ${
                trayectoFilter === 'todos' ? 'bg-[#7c3aed] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}>
              Todos
            </button>
            {TRAYECTOS.map((t) => (
              <button key={t} onClick={() => setTrayectoFilter(t)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold font-ui smooth-transition whitespace-nowrap ${
                  trayectoFilter === t ? 'bg-[#7c3aed] text-white' : 'text-[#94a3b8] hover:text-white'
                }`}>
                {TRAYECTO_META[t].icon} {TRAYECTO_META[t].short}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div className={`rounded-xl px-4 py-2.5 border fade-up ${
            toast.type === 'ok'
              ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
              : 'bg-[#f87171]/10 border-[#f87171]/30 text-[#f87171]'
          }`}>
            <p className="text-xs font-body font-medium">{toast.msg}</p>
          </div>
        )}

        {/* ═══ MATRIZ DOCENTE → ESTUDIANTES ═══ */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1f2430] flex items-center gap-2">
            <span className="text-base">🗂️</span>
            <h3 className="text-sm font-bold text-white font-ui">
              Matriz de Asignaciones Docente → Estudiantes
            </h3>
            <span className="ml-auto text-[10px] font-terminal text-[#64748b]">
              {filteredMatrix.length} docente(s)
            </span>
          </div>

          {filteredMatrix.length === 0 ? (
            <p className="py-10 text-center text-xs text-[#64748b] font-body">
              No hay docentes que coincidan con el filtro.
            </p>
          ) : (
            <div className="divide-y divide-[#1f2430]">
              {filteredMatrix.map(({ teacher, students, activeStudents }) => {
                const meta = getTrayectoMeta(teacher.trayecto);
                const isOpen = expanded === teacher.email;
                return (
                  <div key={teacher.email} className={teacher.active ? '' : 'bg-[#f87171]/5'}>
                    {/* Cabecera del docente */}
                    <div
                      onClick={() => { setExpanded(isOpen ? null : teacher.email); playSound('click'); }}
                      className="w-full text-left px-5 py-4 hover:bg-[#171a23] smooth-transition cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0"
                          style={{ background: `${meta.color}20` }}>
                          {MASCOT_EMOJI[teacher.mascotSpecies] ?? '👨‍🏫'}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white font-ui">
                              Prof. {teacher.nombre} {teacher.apellido}
                            </p>
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-ui"
                              style={{ background: `${meta.color}20`, color: meta.color }}>
                              {meta.icon} {teacher.trayecto}
                            </span>
                            {!teacher.active && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#f87171]/20 text-[#f87171] font-ui">
                                inactivo
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#64748b] font-body truncate">
                            {teacher.email} · C.I. {teacher.cedula}
                          </p>
                        </div>

                        {/* Contador de alumnos */}
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-extrabold font-terminal" style={{ color: meta.color }}>
                            {students.length}
                          </p>
                          <p className="text-[8px] text-[#64748b] uppercase font-body">
                            Estudiante{students.length === 1 ? '' : 's'}
                          </p>
                          {activeStudents !== students.length && (
                            <p className="text-[8px] text-[#22c55e] font-terminal">
                              {activeStudents} activos
                            </p>
                          )}
                        </div>

                        {/* Acciones siempre visibles */}
                        <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleImpersonate(teacher)}
                            title="Ver la plataforma como este docente"
                            className="px-2 py-1.5 rounded-lg text-[10px] font-ui bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#f97316]/40 smooth-transition"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleTeacherCascade(teacher.email, !teacher.active)}
                            title={teacher.active
                              ? 'Desactivar docente y sus estudiantes'
                              : 'Activar docente y sus estudiantes'}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-ui border smooth-transition ${
                              teacher.active
                                ? 'bg-[#0e111a] border-[#1f2430] text-[#94a3b8] hover:text-[#fbbf24] hover:border-[#fbbf24]/40'
                                : 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]'
                            }`}
                          >
                            {teacher.active ? '🚫' : '✅'}
                          </button>
                          <button
                            onClick={() => askDelete(teacher)}
                            title="Eliminar docente"
                            className="px-2 py-1.5 rounded-lg text-[10px] font-ui bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-[#f87171] hover:border-[#f87171]/40 smooth-transition"
                          >
                            🗑️
                          </button>
                        </div>

                        <span className={`text-[10px] text-[#7c3aed] smooth-transition shrink-0 ${isOpen ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                      </div>
                    </div>

                    {/* Lista desplegable de estudiantes */}
                    {isOpen && (
                      <div className="px-5 pb-4 space-y-2 fade-up bg-[#0b0d14]">
                        <div className="flex items-center gap-2 pt-1 pb-1">
                          <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-body">
                            Estudiantes a cargo
                          </p>
                          <div className="flex gap-1.5 ml-auto">
                            <button
                              onClick={() => handleRole(teacher.email, 'estudiante')}
                              title="Convertir este docente en estudiante"
                              className="px-2.5 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#6366f1]/40 smooth-transition"
                            >
                              🎓 Pasar a Estudiante
                            </button>
                            <button
                              onClick={() => handleToggle(teacher.email)}
                              title="Cambiar solo el estado del docente, sin tocar a sus estudiantes"
                              className="px-2.5 py-1 rounded-lg text-[9px] font-ui bg-[#13161f] border border-[#1f2430] text-[#94a3b8] hover:text-[#fbbf24] hover:border-[#fbbf24]/40 smooth-transition"
                            >
                              {teacher.active ? '🚫 Solo el docente' : '✅ Solo el docente'}
                            </button>
                          </div>
                        </div>

                        {students.length === 0 ? (
                          <p className="text-[11px] text-[#64748b] font-body py-3 text-center bg-[#0e111a] rounded-xl border border-[#1f2430]">
                            Este docente aún no tiene estudiantes asignados.
                          </p>
                        ) : (
                          students.filter(matchSearch).map((s) => <StudentRow key={s.email} s={s} />)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Estudiantes sin docente ═══ */}
        {orphans.length > 0 && (
          <div className="bg-[#13161f] rounded-2xl border border-[#fbbf24]/30 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1f2430] flex items-center gap-2"
              style={{ background: 'rgba(251,191,36,.06)' }}>
              <span className="text-base">⚠️</span>
              <h3 className="text-sm font-bold text-[#fbbf24] font-ui">
                Estudiantes sin Docente Asignado
              </h3>
              <span className="ml-auto text-[10px] font-terminal text-[#64748b]">
                {orphans.length} pendiente(s)
              </span>
            </div>
            <div className="p-4 space-y-2">
              {orphans.map((s) => <StudentRow key={s.email} s={s} />)}
            </div>
          </div>
        )}

        {/* ═══ Matriz de permisos ═══ */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5">
          <h3 className="text-sm font-bold text-white font-ui mb-3">🔐 Jerarquía de Roles (RBAC)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['estudiante', 'profesor', 'administrador'] as UserRole[]).map((r) => {
              const m = ROLE_META[r];
              return (
                <div key={r} className="bg-[#0e111a] rounded-xl p-4 border border-[#1f2430]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{m.icon}</span>
                    <h4 className="text-xs font-bold font-ui" style={{ color: m.color }}>{m.label}</h4>
                    {r === 'administrador' && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] font-ui">
                        único
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#64748b] font-body mb-3 leading-snug">{m.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {m.permissions.map((p) => (
                      <code key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-[#13161f] border border-[#1f2430] text-[#818cf8] font-terminal">
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[#64748b] font-body mt-3">
            🔒 El rol de SuperAdmin está reservado a{' '}
            <code className="text-[#f97316] font-terminal">{currentEmail}</code>
            {isRootAdmin(currentEmail) ? ' (cuenta raíz)' : ''} y no puede asignarse a otras cuentas.
          </p>
        </div>
      </div>

      {/* ═══ MODAL: Eliminar cuenta (con impacto) ═══ */}
      {delTarget && delImpact && (
        <div className="fixed inset-0 z-[96] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => { setDelTarget(null); setDelImpact(null); }}>
          <div className="w-full max-w-md bg-[#13161f] border-2 border-[#f87171]/50 rounded-2xl shadow-2xl overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-[#1f2430] flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,.1)' }}>
              <span className="text-lg">🗑️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-ui truncate">
                  Eliminar a {delTarget.nombre} {delTarget.apellido}
                </p>
                <p className="text-[10px] text-[#64748b] font-body truncate">
                  {ROLE_META[delTarget.role].icon} {ROLE_META[delTarget.role].label} · {delTarget.email}
                </p>
              </div>
              <button onClick={() => { setDelTarget(null); setDelImpact(null); }}
                className="w-7 h-7 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-[#94a3b8] font-body leading-relaxed">
                Esta acción es <strong className="text-[#f87171]">permanente</strong> y no
                se puede deshacer.
              </p>

              {/* Datos que se purgarán */}
              <div className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430] space-y-1.5">
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-body mb-1">
                  Se eliminarán también
                </p>
                {[
                  { icon: '📊', label: 'Progreso y niveles completados', n: '—' },
                  { icon: '⌨️', label: 'Comandos registrados', n: String(delImpact.commandLogs) },
                  { icon: '✉️', label: 'Mensajes enviados y recibidos', n: String(delImpact.messages) },
                  { icon: '🕒', label: 'Historial de sesiones', n: '—' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-xs">{r.icon}</span>
                    <span className="text-[11px] text-[#94a3b8] font-body flex-1">{r.label}</span>
                    <span className="text-[11px] font-terminal text-[#f87171]">{r.n}</span>
                  </div>
                ))}
              </div>

              {/* Aviso de cascada para docentes */}
              {delImpact.isTeacher && delImpact.orphanedStudents > 0 && (
                <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/35 rounded-xl px-3 py-2.5">
                  <p className="text-[11px] text-[#fbbf24] font-body leading-snug">
                    ⚠️ <strong>{delImpact.orphanedStudents} estudiante
                    {delImpact.orphanedStudents === 1 ? '' : 's'}</strong> quedará
                    {delImpact.orphanedStudents === 1 ? '' : 'n'} sin docente titular.
                    No se eliminan: podrás reasignarlos desde la sección
                    «Estudiantes sin Docente Asignado».
                  </p>
                </div>
              )}

              {/* Alternativa menos destructiva */}
              {delTarget.active && (
                <div className="bg-[#6366f1]/10 border border-[#6366f1]/30 rounded-xl px-3 py-2.5">
                  <p className="text-[11px] text-[#818cf8] font-body leading-snug">
                    💡 ¿Solo quieres bloquear el acceso? Usa <strong>🚫 Desactivar</strong>:
                    conserva los datos y es reversible.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setDelTarget(null); setDelImpact(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-sm font-semibold font-ui smooth-transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-[2] py-2.5 rounded-xl bg-[#f87171] text-white text-sm font-bold font-ui hover:bg-[#ef4444] smooth-transition"
                >
                  🗑️ Eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Autorizar docente ═══ */}
      {approveTarget && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setApproveTarget(null)}>
          <div className="w-full max-w-md bg-[#13161f] border-2 border-[#22c55e]/40 rounded-2xl shadow-2xl overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-[#1f2430] flex items-center gap-3"
              style={{ background: 'rgba(34,197,94,.08)' }}>
              <span className="text-lg">✅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-ui truncate">
                  Autorizar a {approveTarget.nombre} {approveTarget.apellido}
                </p>
                <p className="text-[10px] text-[#64748b] font-body truncate">
                  {approveTarget.email}
                </p>
              </div>
              <button onClick={() => setApproveTarget(null)}
                className="w-7 h-7 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430] space-y-1">
                <p className="text-[10px] text-[#64748b] font-body">
                  <strong className="text-[#94a3b8]">Cédula:</strong> {approveTarget.cedula}
                </p>
                <p className="text-[10px] text-[#64748b] font-body">
                  <strong className="text-[#94a3b8]">Teléfono:</strong> {approveTarget.telefono}
                </p>
                <p className="text-[10px] text-[#64748b] font-body">
                  <strong className="text-[#94a3b8]">Trayecto seleccionado:</strong> {approveTarget.trayecto || 'No especificado'}
                </p>
                <p className="text-[10px] text-[#64748b] font-body">
                  <strong className="text-[#94a3b8]">Sección seleccionada:</strong> {getSectionLabel(approveTarget.sectionId)}
                </p>
              </div>

              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#22c55e] font-body leading-snug">
                  Al autorizar, la cuenta se activará con el trayecto y sección indicados y el docente podrá iniciar sesión.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setApproveTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-sm font-semibold font-ui smooth-transition">
                  Cancelar
                </button>
                <button onClick={handleApprove}
                  className="flex-[2] py-2.5 rounded-xl bg-[#22c55e] text-white text-sm font-bold font-ui hover:bg-[#16a34a] smooth-transition">
                  ✅ Autorizar cuenta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Rechazar solicitud ═══ */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setRejectTarget(null)}>
          <div className="w-full max-w-md bg-[#13161f] border-2 border-[#f87171]/40 rounded-2xl shadow-2xl overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-[#1f2430] flex items-center gap-3"
              style={{ background: 'rgba(248,113,113,.08)' }}>
              <span className="text-lg">❌</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-ui truncate">
                  Rechazar a {rejectTarget.nombre} {rejectTarget.apellido}
                </p>
                <p className="text-[10px] text-[#64748b] font-body truncate">{rejectTarget.email}</p>
              </div>
              <button onClick={() => setRejectTarget(null)}
                className="w-7 h-7 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-xs">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1.5 font-body">
                  Motivo del rechazo <span className="text-[#475569]">(se enviará al solicitante)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="Ej: Los datos de cédula no corresponden al registro institucional."
                  className="w-full bg-[#0e111a] border border-[#1f2430] rounded-xl px-4 py-2.5 text-white text-sm font-body outline-none focus:border-[#f87171]/50 smooth-transition resize-none placeholder:text-[#475569]"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRejectTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-sm font-semibold font-ui smooth-transition">
                  Cancelar
                </button>
                <button onClick={handleReject}
                  className="flex-[2] py-2.5 rounded-xl bg-[#f87171] text-white text-sm font-bold font-ui hover:bg-[#ef4444] smooth-transition">
                  ❌ Rechazar solicitud
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Reasignar docente ═══ */}
      {reassign && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setReassign(null)}>
          <div className="w-full max-w-md bg-[#13161f] border border-[#1f2430] rounded-2xl shadow-2xl overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3.5 border-b border-[#1f2430] flex items-center gap-3">
              <span className="text-lg">🔀</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-ui truncate">
                  Reasignar a {reassign.nombre} {reassign.apellido}
                </p>
                <p className="text-[10px] text-[#64748b] font-body">
                  Actualmente en {reassign.trayecto || 'sin Trayecto'}
                </p>
              </div>
              <button onClick={() => setReassign(null)}
                className="w-7 h-7 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-xs">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
              {/* Cambio de Trayecto (solo la administración) */}
              <div className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430] mb-3">
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-body mb-2">
                  🎓 Mover de Trayecto
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TRAYECTOS.map((t) => {
                    const m = TRAYECTO_META[t];
                    const cur = reassign.trayecto === t;
                    return (
                      <button
                        key={t}
                        onClick={() => !cur && handleTrayecto(reassign.email, t)}
                        disabled={cur}
                        className={`py-2 rounded-lg text-[10px] font-semibold font-ui smooth-transition border ${
                          cur ? 'text-white cursor-default'
                              : 'bg-[#13161f] border-[#1f2430] text-[#94a3b8] hover:border-[#7c3aed]/40'
                        }`}
                        style={cur ? { background: `${m.color}25`, borderColor: `${m.color}70` } : {}}
                      >
                        {m.icon} {m.short} {cur && '✓'}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-[#475569] font-body mt-2">
                  Al cambiar de Trayecto se asigna automáticamente un docente de esa sección.
                </p>
              </div>

              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-body">
                👨‍🏫 Docente titular
              </p>
              <button
                onClick={() => handleAssign(reassign.email, null)}
                className="w-full text-left px-4 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-[#fbbf24] hover:border-[#fbbf24]/40 smooth-transition text-xs font-ui"
              >
                ⚠️ Sin docente asignado
              </button>
              {allTeachers.filter((t) => t.approvalStatus === 'approved').map((t) => {
                const meta = getTrayectoMeta(t.trayecto);
                const isCurrent = reassign.teacherEmail === t.email;
                return (
                  <button
                    key={t.email}
                    onClick={() => handleAssign(reassign.email, t.email)}
                    disabled={isCurrent}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border smooth-transition ${
                      isCurrent
                        ? 'bg-[#7c3aed]/15 border-[#7c3aed]/40 cursor-default'
                        : 'bg-[#0e111a] border-[#1f2430] hover:border-[#22c55e]/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{MASCOT_EMOJI[t.mascotSpecies] ?? '👨‍🏫'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white font-ui truncate">
                          Prof. {t.nombre} {t.apellido}
                        </p>
                        <p className="text-[9px] font-body" style={{ color: meta.color }}>
                          {meta.icon} {t.trayecto}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] text-[#a78bfa] font-ui shrink-0">actual</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

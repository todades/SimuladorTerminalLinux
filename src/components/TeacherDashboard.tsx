// ============================================================
// 👨‍🏫 TEACHER DASHBOARD — Supervisión analítica de estudiantes
// Métricas de desempeño, progreso e historial de ejecuciones
// ============================================================

import { useState, useMemo } from 'react';
import {
  RegisteredUser, getStudentsByTeacher, getCommandLog, getSessions,
  sendMessage, getThread, Message, TRAYECTO_META,
} from '../engine/authEngine';
import { MissionLevel, createDefaultLevels, calculateProgress } from '../engine/progressEngine';
import { playSound } from '../utils/soundSynth';
import Mascot from './Mascot';
import MascotHud from './MascotHud';
import { getRank, getArchetype, safeSpecies } from '../engine/mascotEngine';

interface StudentMetrics {
  user: RegisteredUser;
  progress: number;
  stepsDone: number;
  stepsTotal: number;
  commands: number;
  errors: number;
  accuracy: number;
  sessions: number;
  lastActivity: number | null;
}

function loadStudentLevels(email: string): MissionLevel[] {
  try {
    const raw = localStorage.getItem(`upta_progress_v4_${email.toLowerCase()}`);
    if (!raw) return createDefaultLevels();
    const p = JSON.parse(raw);
    if (Array.isArray(p.levels) && p.levels.length && typeof p.levels[0].trayectoId === 'number') {
      return p.levels;
    }
  } catch { /* ignore */ }
  return createDefaultLevels();
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'Sin actividad';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
}

interface TeacherDashboardProps {
  teacher: RegisteredUser;
}

export default function TeacherDashboard({ teacher }: TeacherDashboardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // ─── Mensajería ───────────────────────────────────
  const [msgTarget, setMsgTarget] = useState<RegisteredUser | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [thread, setThread] = useState<Message[]>([]);
  const [sendMsg, setSendMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const openComposer = (u: RegisteredUser) => {
    setMsgTarget(u);
    setThread(getThread(teacher.email, u.email));
    setSubject(''); setBody(''); setSendMsg(null);
    playSound('click');
  };

  const handleSend = () => {
    if (!msgTarget) return;
    const res = sendMessage(teacher, msgTarget.email, subject, body);
    if (!res.success) {
      setSendMsg({ type: 'err', text: res.error || 'No se pudo enviar.' });
      playSound('error');
      return;
    }
    playSound('success');
    setSendMsg({ type: 'ok', text: `✅ Mensaje enviado a ${msgTarget.nombre}.` });
    setThread(getThread(teacher.email, msgTarget.email));
    setSubject(''); setBody('');
    setTimeout(() => setSendMsg(null), 3000);
  };

  const metrics = useMemo<StudentMetrics[]>(() => {
    // Solo los estudiantes asignados a este docente (FK teacher_id)
    const students = getStudentsByTeacher(teacher.email);
    return students.map((user) => {
      const levels = loadStudentLevels(user.email);
      const allSteps = levels.flatMap((l) => l.steps);
      const stepsDone = allSteps.filter((s) => s.completed).length;
      const log = getCommandLog(user.email);
      const errors = log.filter((e) => !e.success).length;
      const sessions = getSessions(user.email);
      const lastActivity = log.length ? log[log.length - 1].timestamp : null;
      return {
        user,
        progress: calculateProgress(levels),
        stepsDone,
        stepsTotal: allSteps.length,
        commands: log.length,
        errors,
        accuracy: log.length ? Math.round(((log.length - errors) / log.length) * 100) : 0,
        sessions: sessions.length,
        lastActivity,
      };
    });
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return metrics;
    return metrics.filter((m) =>
      `${m.user.nombre} ${m.user.apellido} ${m.user.email} ${m.user.trayecto}`
        .toLowerCase().includes(q));
  }, [metrics, filter]);

  // Agregados del curso
  const totals = useMemo(() => {
    const n = metrics.length || 1;
    return {
      students: metrics.length,
      avgProgress: Math.round(metrics.reduce((a, m) => a + m.progress, 0) / n),
      totalCommands: metrics.reduce((a, m) => a + m.commands, 0),
      avgAccuracy: Math.round(metrics.reduce((a, m) => a + m.accuracy, 0) / n),
      active: metrics.filter((m) => m.lastActivity && Date.now() - m.lastActivity < 86400000).length,
    };
  }, [metrics]);

  const detail = selected ? metrics.find((m) => m.user.email === selected) : null;
  const detailLog = selected ? getCommandLog(selected).slice(-60).reverse() : [];

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* Encabezado con sección asignada */}
        <div className="bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 fade-up">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Avatar docente con birrete y puntero táctico */}
            <div className="relative shrink-0">
              <Mascot
                species={safeSpecies(teacher.mascotSpecies)}
                gender={teacher.mascotGender === 'femenino' ? 'femenino' : 'masculino'}
                animation="float"
                size={84}
                showProp
                rank="sysadmin"
                hideVisor
              />
              <div className="absolute pointer-events-none"
                style={{ left: '50%', top: '30%', transform: 'translate(-50%,-50%)' }}>
                <MascotHud expression="analyze" gender={teacher.mascotGender} width={40} />
              </div>
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg">🎓</span>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                <h2 className="text-xl font-extrabold text-white font-editorial">
                  Administrador de Sección
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-ui border border-[#22c55e]/30">
                  {getArchetype(teacher.mascotSpecies).name} · {getArchetype(teacher.mascotSpecies).role}
                </span>
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full font-ui border"
                  style={{
                    background: `${TRAYECTO_META[teacher.trayecto]?.color ?? '#7c3aed'}20`,
                    color: TRAYECTO_META[teacher.trayecto]?.color ?? '#a78bfa',
                    borderColor: `${TRAYECTO_META[teacher.trayecto]?.color ?? '#7c3aed'}40`,
                  }}
                >
                  {TRAYECTO_META[teacher.trayecto]?.icon} {teacher.trayecto}
                </span>
              </div>
              <p className="text-sm text-[#94a3b8] font-body">
                Prof. <strong className="text-white">{teacher.nombre} {teacher.apellido}</strong> ·
                Supervisa el progreso de los estudiantes asignados a tu sección.
              </p>
            </div>
            <div className="bg-[#0e111a] rounded-2xl border border-[#1f2430] px-5 py-3 text-center shrink-0">
              <p className="text-2xl font-extrabold font-terminal text-[#22c55e]">
                {metrics.length}
              </p>
              <p className="text-[9px] text-[#64748b] uppercase tracking-wider font-body">
                A tu cargo
              </p>
            </div>
          </div>

          <div className="mt-4 bg-[#f97316]/10 border border-[#f97316]/30 rounded-xl px-4 py-2.5">
            <p className="text-[11px] text-[#f97316] font-body leading-snug">
              🔓 <strong>Modo Dios docente:</strong> todos los niveles del simulador están
              desbloqueados para que puedas inspeccionar o demostrar cualquier ejercicio.
            </p>
          </div>
        </div>

        {/* KPIs del curso */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: 'Mis Estudiantes', v: totals.students, c: '#6366f1', i: '🎓' },
            { l: 'Activos (24h)', v: totals.active, c: '#22c55e', i: '🟢' },
            { l: 'Progreso medio', v: `${totals.avgProgress}%`, c: '#7c3aed', i: '📈' },
            { l: 'Comandos', v: totals.totalCommands, c: '#fb7185', i: '⌨️' },
            { l: 'Precisión media', v: `${totals.avgAccuracy}%`, c: '#f97316', i: '🎯' },
          ].map((k) => (
            <div key={k.l} className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-base">{k.i}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: k.c }} />
              </div>
              <p className="text-xl font-extrabold font-terminal" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[9px] text-[#64748b] uppercase tracking-wider font-body mt-0.5">{k.l}</p>
            </div>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex items-center gap-2 bg-[#13161f] border border-[#1f2430] rounded-2xl px-4 py-2.5">
          <span className="text-sm">🔍</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por nombre, correo o trayecto…"
            className="flex-1 bg-transparent text-white text-sm font-body outline-none placeholder:text-[#475569]"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="text-[#64748b] hover:text-white text-xs">✕</button>
          )}
        </div>

        {/* Tabla de estudiantes */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1f2430]">
            <h3 className="text-sm font-bold text-white font-ui">
              📋 Estudiantes ({filtered.length})
            </h3>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center px-6">
              <span className="text-2xl opacity-40">🫥</span>
              <p className="text-xs text-[#64748b] font-body mt-2">
                {metrics.length === 0
                  ? 'Aún no tienes estudiantes asignados a tu sección. El administrador puede asignártelos desde el panel global.'
                  : 'No hay estudiantes que coincidan con el filtro.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1f2430]">
              {filtered.map((m) => (
                <button
                  key={m.user.email}
                  onClick={() => {
                    playSound('click');
                    setSelected(selected === m.user.email ? null : m.user.email);
                  }}
                  className="w-full text-left px-5 py-3.5 hover:bg-[#171a23] smooth-transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Insignia: avatar real + visor del estudiante */}
                    <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
                      <Mascot
                        species={safeSpecies(m.user.mascotSpecies)}
                        gender={m.user.mascotGender === 'femenino' ? 'femenino' : 'masculino'}
                        animation="float"
                        size={42}
                        rank={getRank(m.progress).tier}
                        hideVisor
                      />
                      <div className="absolute pointer-events-none"
                        style={{ left: '50%', top: '32%', transform: 'translate(-50%,-50%)' }}>
                        <MascotHud
                          expression={m.accuracy >= 80 ? 'success' : m.errors > 0 ? 'warning' : 'scan'}
                          gender={m.user.mascotGender}
                          width={22}
                        />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white font-ui truncate">
                        {m.user.nombre} {m.user.apellido}
                      </p>
                      <p className="text-[10px] text-[#64748b] font-body truncate">
                        {m.user.email} · {m.user.trayecto}
                      </p>
                    </div>

                    <div className="hidden sm:block w-28 shrink-0">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-[#64748b] font-body">Progreso</span>
                        <span className="text-[#7c3aed] font-terminal font-bold">{m.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1f2430] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1]"
                          style={{ width: `${m.progress}%` }} />
                      </div>
                    </div>

                    <div className="hidden md:flex gap-4 shrink-0 text-center">
                      <div>
                        <p className="text-xs font-bold font-terminal text-[#22c55e]">{m.stepsDone}/{m.stepsTotal}</p>
                        <p className="text-[8px] text-[#64748b] font-body uppercase">Pasos</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold font-terminal text-[#818cf8]">{m.commands}</p>
                        <p className="text-[8px] text-[#64748b] font-body uppercase">Cmds</p>
                      </div>
                      <div>
                        <p className={`text-xs font-bold font-terminal ${
                          m.accuracy >= 80 ? 'text-[#22c55e]' : m.accuracy >= 50 ? 'text-[#fbbf24]' : 'text-[#f87171]'
                        }`}>{m.accuracy}%</p>
                        <p className="text-[8px] text-[#64748b] font-body uppercase">Precisión</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        onClick={(e) => { e.stopPropagation(); openComposer(m.user); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openComposer(m.user); } }}
                        title={`Escribir a ${m.user.nombre}`}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-ui bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white hover:border-[#22c55e]/50 smooth-transition cursor-pointer"
                      >
                        ✉️ Mensaje
                      </span>
                      <div className="text-right w-20">
                        <p className="text-[9px] text-[#64748b] font-body">{timeAgo(m.lastActivity)}</p>
                        <span className={`text-[9px] smooth-transition inline-block ${
                          selected === m.user.email ? 'rotate-90' : ''
                        } text-[#7c3aed]`}>▶</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalle expandido */}
                  {selected === m.user.email && detail && (
                    <div className="mt-4 pt-4 border-t border-[#1f2430] fade-up">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          { l: 'Sesiones', v: detail.sessions, c: '#6366f1' },
                          { l: 'Comandos OK', v: detail.commands - detail.errors, c: '#22c55e' },
                          { l: 'Errores', v: detail.errors, c: '#f87171' },
                          { l: 'Registrado', v: new Date(detail.user.registeredAt)
                              .toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }), c: '#94a3b8' },
                        ].map((s) => (
                          <div key={s.l} className="bg-[#0e111a] rounded-xl p-2.5 border border-[#1f2430]">
                            <p className="text-sm font-bold font-terminal" style={{ color: s.c }}>{s.v}</p>
                            <p className="text-[8px] text-[#64748b] uppercase font-body">{s.l}</p>
                          </div>
                        ))}
                      </div>

                      <h4 className="text-[10px] font-bold text-white font-ui mb-2">
                        🕘 Historial de ejecuciones (últimos {detailLog.length})
                      </h4>
                      <div className="bg-[#0e111a] rounded-xl border border-[#1f2430] max-h-52 overflow-y-auto">
                        {detailLog.length === 0 ? (
                          <p className="text-[10px] text-[#64748b] font-body p-3 text-center">
                            Sin ejecuciones registradas todavía.
                          </p>
                        ) : (
                          detailLog.map((e, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1f2430] last:border-0">
                              <span className={`text-[9px] shrink-0 ${e.success ? 'text-[#22c55e]' : 'text-[#f87171]'}`}>
                                {e.success ? '✓' : '✗'}
                              </span>
                              <code className="text-[10px] font-terminal text-[#cbd5e1] flex-1 truncate">
                                {e.command}
                              </code>
                              {e.stepCompleted && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-ui shrink-0">
                                  misión
                                </span>
                              )}
                              <span className="text-[8px] text-[#475569] font-terminal shrink-0">
                                {new Date(e.timestamp).toLocaleTimeString('es-VE', {
                                  hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                 </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ COMPOSITOR DE MENSAJES ═══ */}
      {msgTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          onClick={() => setMsgTarget(null)}
        >
          <div
            className="w-full max-w-xl bg-[#13161f] border border-[#1f2430] rounded-2xl shadow-2xl overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1f2430]">
              <div className="w-9 h-9 rounded-xl bg-[#22c55e]/15 flex items-center justify-center text-sm">
                ✉️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white font-ui truncate">
                  Mensaje para {msgTarget.nombre} {msgTarget.apellido}
                </p>
                <p className="text-[10px] text-[#64748b] font-body truncate">
                  {msgTarget.email} · {msgTarget.trayecto}
                </p>
              </div>
              <button
                onClick={() => setMsgTarget(null)}
                className="w-7 h-7 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white smooth-transition text-xs"
              >
                ✕
              </button>
            </div>

            {/* Historial del hilo */}
            {thread.length > 0 && (
              <div className="px-5 py-3 border-b border-[#1f2430] max-h-44 overflow-y-auto space-y-2 bg-[#0e111a]">
                <p className="text-[9px] text-[#64748b] uppercase tracking-wider font-body">
                  Mensajes anteriores ({thread.length})
                </p>
                {thread.map((m) => (
                  <div key={m.id} className="bg-[#13161f] rounded-xl p-2.5 border border-[#1f2430]">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[11px] font-semibold text-white font-ui truncate flex-1">
                        {m.subject}
                      </p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-ui shrink-0 ${
                        m.read ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#fbbf24]/15 text-[#fbbf24]'
                      }`}>
                        {m.read ? 'leído' : 'sin leer'}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#94a3b8] font-body leading-snug">{m.body}</p>
                    <p className="text-[8px] text-[#475569] font-terminal mt-1">
                      {new Date(m.sentAt).toLocaleString('es-VE', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Formulario */}
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Asunto</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={80}
                  placeholder="Ej: Retroalimentación del Nivel 3"
                  className="w-full bg-[#0e111a] border border-[#1f2430] rounded-xl px-4 py-2.5 text-white text-sm font-body outline-none focus:border-[#22c55e]/50 smooth-transition placeholder:text-[#475569]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">
                  Mensaje <span className="text-[#475569]">({body.length}/500)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 500))}
                  rows={5}
                  placeholder="Escribe aquí tu retroalimentación, sugerencias o felicitaciones…"
                  className="w-full bg-[#0e111a] border border-[#1f2430] rounded-xl px-4 py-2.5 text-white text-sm font-body outline-none focus:border-[#22c55e]/50 smooth-transition resize-none placeholder:text-[#475569]"
                />
              </div>

              {/* Plantillas rápidas */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { s: '¡Excelente progreso!', b: 'Has avanzado muy bien en los niveles. ¡Sigue así!' },
                  { s: 'Repasa los permisos', b: 'Te recomiendo repasar la lección de chmod y permisos POSIX antes de continuar.' },
                  { s: 'Recordatorio de práctica', b: 'No olvides completar la práctica de esta semana en el simulador.' },
                ].map((t) => (
                  <button
                    key={t.s}
                    onClick={() => { setSubject(t.s); setBody(t.b); playSound('click'); }}
                    className="text-[9px] px-2.5 py-1 rounded-lg bg-[#0e111a] border border-[#1f2430] text-[#64748b] hover:text-white hover:border-[#22c55e]/40 smooth-transition font-ui"
                  >
                    {t.s}
                  </button>
                ))}
              </div>

              {sendMsg && (
                <div className={`rounded-xl px-3 py-2 border ${
                  sendMsg.type === 'ok'
                    ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]'
                    : 'bg-[#f87171]/10 border-[#f87171]/30 text-[#f87171]'
                }`}>
                  <p className="text-[11px] font-body">{sendMsg.text}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setMsgTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-sm font-semibold font-ui smooth-transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSend}
                  disabled={!subject.trim() || !body.trim()}
                  className="flex-[2] py-2.5 rounded-xl btn-mission text-white text-sm font-bold font-ui smooth-transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✉️ Enviar mensaje
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

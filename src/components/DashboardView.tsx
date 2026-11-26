// ============================================================
// 📊 DASHBOARD — Centro de mando del estudiante
// Estadísticas reales + botón principal "Comenzar Práctica"
// ============================================================

import { useState, useMemo } from 'react';
import Mascot, { MascotSpecies, MascotGender, MASCOT_INFO } from './Mascot';
import MascotHud from './MascotHud';
import { ARCHETYPES, getRank, HudExpression } from '../engine/mascotEngine';
import { MissionLevel, calculateProgress } from '../engine/progressEngine';
import { playSound } from '../utils/soundSynth';

type StatusFilter = 'todos' | 'completados' | 'progreso' | 'bloqueados';

const TRAYECTO_TAG: Record<number, { label: string; color: string; icon: string }> = {
  1: { label: 'T-I',   color: '#3B82F6', icon: '🔵' },
  2: { label: 'T-II',  color: '#22C55E', icon: '🟢' },
  3: { label: 'T-III', color: '#EAB308', icon: '🟡' },
  4: { label: 'T-IV',  color: '#EF4444', icon: '🔴' },
};

interface DashboardViewProps {
  studentName: string;
  trayecto: string;
  mascotSpecies: MascotSpecies;
  mascotGender: MascotGender;
  levels: MissionLevel[];
  totalCommands: number;
  sessions: number;
  /** Aviso de acceso privilegiado (profesor / administrador) */
  accessLabel?: string | null;
  onStartPractice: () => void;
  onGoLessons: () => void;
}

export default function DashboardView({
  studentName,
  trayecto,
  mascotSpecies,
  mascotGender,
  levels,
  totalCommands,
  sessions,
  accessLabel,
  onStartPractice,
  onGoLessons,
}: DashboardViewProps) {
  const progress = calculateProgress(levels);
  const allSteps = levels.flatMap((l) => l.steps);
  const doneSteps = allSteps.filter((s) => s.completed).length;
  const currentLevel = levels.find((l) => l.unlocked && !l.completed) || levels[levels.length - 1];
  const info = MASCOT_INFO[mascotSpecies];

  // ─── Mascota: rango, pose y HUD ────────────────────
  const rank = getRank(progress);
  const arch = ARCHETYPES[mascotSpecies];
  const [ctaHover, setCtaHover] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);
  const [hudExpr, setHudExpr] = useState<HudExpression>('scan');

  // Consejo según el arquetipo del personaje
  const tipPool = progress === 0 ? arch.voice.greet
    : progress >= 100 ? arch.voice.success
    : [...arch.voice.hint, ...arch.voice.greet];
  const currentTip = tipPool[tipIdx % tipPool.length];

  const cycleTip = () => {
    setTipIdx((i) => i + 1);
    setHudExpr('loading');
    playSound('click');
    setTimeout(() => setHudExpr('scan'), 900);
  };

  // ─── Navegación libre por niveles ──────────────────
  const [expanded, setExpanded] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [trayFilter, setTrayFilter] = useState<number | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');

  const filteredLevels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return levels.filter((lvl) => {
      if (trayFilter !== 'todos' && lvl.trayectoId !== trayFilter) return false;

      if (statusFilter === 'completados' && !lvl.completed) return false;
      if (statusFilter === 'progreso' && (lvl.completed || !lvl.unlocked)) return false;
      if (statusFilter === 'bloqueados' && lvl.unlocked) return false;

      if (!q) return true;
      // Busca en el nombre, la descripción y en los comandos de cada paso
      const haystack = [
        lvl.name, lvl.description,
        ...lvl.steps.map((s) => `${s.command} ${s.description}`),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [levels, query, trayFilter, statusFilter]);

  const hasFilters = query.trim() !== '' || trayFilter !== 'todos' || statusFilter !== 'todos';

  const clearFilters = () => {
    setQuery(''); setTrayFilter('todos'); setStatusFilter('todos');
    playSound('click');
  };

  const stats = [
    { label: 'Progreso Total',   value: `${progress}%`,                        color: '#7c3aed', icon: '📈' },
    { label: 'Objetivos',        value: `${doneSteps}/${allSteps.length}`,     color: '#22c55e', icon: '✅' },
    { label: 'Comandos Usados',  value: String(totalCommands),                 color: '#6366f1', icon: '⌨️' },
    { label: 'Sesiones',         value: String(sessions),                      color: '#fb7185', icon: '🕒' },
  ];

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* ─── HERO: Comenzar Práctica ─────────────── */}
        <div className="relative bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 glow-violet overflow-hidden fade-up">
          <div className="absolute -top-16 -right-10 w-72 h-72 bg-[#7c3aed]/10 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-20 left-1/4 w-64 h-64 bg-[#fb7185]/8 rounded-full blur-[90px] pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center gap-6">
            {/* Avatar evolutivo: cambia de atuendo según el rango */}
            <div className="relative shrink-0">
              <Mascot
                species={mascotSpecies}
                gender={mascotGender}
                animation="float"
                size={128}
                poseClass={ctaHover ? 'pose-ready' : ''}
                showProp
                rank={rank.tier}
                hideVisor
              />
              <div className="absolute pointer-events-none"
                style={{ left: '50%', top: '30%', transform: 'translate(-50%,-50%)' }}>
                <MascotHud expression={hudExpr} gender={mascotGender} width={62} />
              </div>
              {/* Insignia de rango */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rank-pop">
                <span className="text-[10px] px-2.5 py-1 rounded-full font-ui font-bold whitespace-nowrap border"
                  style={{
                    background: `${rank.color}22`, color: rank.color,
                    borderColor: `${rank.color}55`,
                  }}>
                  {rank.icon} {rank.label}
                </span>
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <span className="inline-block text-[10px] font-bold text-[#f97316] bg-[#f97316]/10 px-2.5 py-0.5 rounded-full mb-2 uppercase tracking-wider font-ui">
                {info.name} · Tu Asistente
              </span>
              <h2 className="text-2xl font-extrabold text-white font-editorial mb-1.5">
                ¡Hola, {studentName}! 👋
              </h2>
              <p className="text-sm text-[#94a3b8] font-body leading-relaxed max-w-xl">
                Pulsa <strong className="text-white">Comenzar Práctica</strong> para encender la
                computadora virtual y entrar a la terminal en pantalla completa.
                Todo ocurre en un entorno aislado — <strong className="text-[#22c55e]">nada afecta a tu equipo real</strong>.
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-5">
                <button
                  onClick={() => { playSound('click'); onStartPractice(); }}
                  onMouseEnter={() => { setCtaHover(true); setHudExpr('data'); }}
                  onMouseLeave={() => { setCtaHover(false); setHudExpr('scan'); }}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-2xl btn-mission text-white font-bold font-ui text-sm smooth-transition active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" />
                  </svg>
                  Comenzar Práctica
                </button>
                <button
                  onClick={() => { playSound('click'); onGoLessons(); }}
                  className="px-5 py-3.5 rounded-2xl border border-[#1f2430] bg-[#0e111a] text-sm font-medium text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/40 smooth-transition font-ui"
                >
                  📚 Ver lecciones
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Estadísticas ────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-4 hover:border-[#7c3aed]/30 smooth-transition fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">{s.icon}</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              </div>
              <p className="text-2xl font-extrabold font-terminal" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-body mt-0.5">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ─── Progreso + Ruta ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Barra de progreso general */}
          <div className="lg:col-span-2 bg-[#13161f] rounded-2xl border border-[#1f2430] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white font-ui">🎯 Ruta de Aprendizaje</h3>
              <span className="text-[10px] text-[#64748b] font-body">
                {trayecto} · Nivel {currentLevel?.id ?? 1} de {levels.length}
              </span>
            </div>

            {accessLabel && (
              <div className="mb-4 bg-[#f97316]/10 border border-[#f97316]/30 rounded-xl px-4 py-2.5">
                <p className="text-[11px] text-[#f97316] font-body leading-snug">
                  {accessLabel} · Todos los niveles están <strong>desbloqueados</strong> para
                  tu rol. Puedes entrar al simulador y practicar cualquier nivel sin
                  restricciones de progreso.
                </p>
              </div>
            )}

            <div className="mb-5">
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-[#94a3b8] font-body">Avance general</span>
                <span className="text-[#7c3aed] font-bold font-terminal">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-[#1f2430] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1] progress-shimmer smooth-transition"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* ─── Filtros ─────────────────────────── */}
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center gap-2 bg-[#0e111a] border border-[#1f2430] rounded-xl px-3 py-2">
                <span className="text-xs">🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar nivel o comando (ej: chmod, grep, tar)…"
                  className="flex-1 bg-transparent text-white text-xs font-body outline-none placeholder:text-[#475569]"
                />
                {query && (
                  <button onClick={() => setQuery('')}
                    className="text-[#64748b] hover:text-white text-xs">✕</button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {/* Filtro por Trayecto */}
                <button
                  onClick={() => { setTrayFilter('todos'); playSound('click'); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold font-ui smooth-transition border ${
                    trayFilter === 'todos'
                      ? 'bg-[#7c3aed]/25 border-[#7c3aed]/50 text-white'
                      : 'bg-[#0e111a] border-[#1f2430] text-[#64748b] hover:text-white'
                  }`}
                >
                  Todos
                </button>
                {[1, 2, 3, 4].map((t) => {
                  const tag = TRAYECTO_TAG[t];
                  const sel = trayFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => { setTrayFilter(sel ? 'todos' : t); playSound('click'); }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold font-ui smooth-transition border ${
                        sel ? 'text-white' : 'bg-[#0e111a] border-[#1f2430] text-[#64748b] hover:text-white'
                      }`}
                      style={sel ? { background: `${tag.color}28`, borderColor: `${tag.color}70` } : {}}
                    >
                      {tag.icon} {tag.label}
                    </button>
                  );
                })}

                <span className="w-px bg-[#1f2430] mx-1" />

                {/* Filtro por estado */}
                {([
                  ['todos', 'Estado'],
                  ['completados', '✅ Hechos'],
                  ['progreso', '▶ Abiertos'],
                  ['bloqueados', '🔒 Bloq.'],
                ] as [StatusFilter, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { setStatusFilter(k); playSound('click'); }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold font-ui smooth-transition border ${
                      statusFilter === k
                        ? 'bg-[#22c55e]/20 border-[#22c55e]/45 text-[#22c55e]'
                        : 'bg-[#0e111a] border-[#1f2430] text-[#64748b] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}

                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold font-ui bg-[#f87171]/10 border border-[#f87171]/30 text-[#f87171] hover:bg-[#f87171]/20 smooth-transition ml-auto"
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>

              {hasFilters && (
                <p className="text-[10px] text-[#64748b] font-body">
                  Mostrando <strong className="text-[#7c3aed]">{filteredLevels.length}</strong> de{' '}
                  {levels.length} niveles
                </p>
              )}
            </div>

            {/* ─── Lista de niveles desplegables ───── */}
            <div className="space-y-2.5">
              {filteredLevels.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="text-2xl opacity-40">🫥</span>
                  <p className="text-xs text-[#64748b] font-body mt-2">
                    Ningún nivel coincide con los filtros aplicados.
                  </p>
                </div>
              ) : filteredLevels.map((lvl) => {
                const done = lvl.steps.filter((s) => s.completed).length;
                const pct = Math.round((done / lvl.steps.length) * 100);
                const isOpen = expanded === lvl.id;
                const tag = TRAYECTO_TAG[lvl.trayectoId];
                return (
                  <div
                    key={lvl.id}
                    className={`rounded-xl border smooth-transition overflow-hidden ${
                      lvl.completed
                        ? 'bg-[#22c55e]/8 border-[#22c55e]/25'
                        : lvl.unlocked
                          ? 'bg-[#7c3aed]/8 border-[#7c3aed]/25'
                          : 'bg-[#0e111a] border-[#1f2430] opacity-60'
                    }`}
                  >
                    {/* Cabecera clicable */}
                    <button
                      onClick={() => { setExpanded(isOpen ? null : lvl.id); playSound('click'); }}
                      className="w-full text-left p-3 hover:bg-white/[0.03] smooth-transition"
                    >
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className={`text-xs font-semibold font-ui ${
                          lvl.completed ? 'text-[#22c55e]' : lvl.unlocked ? 'text-white' : 'text-[#64748b]'
                        }`}>
                          <span className={`inline-block text-[9px] mr-1.5 smooth-transition ${isOpen ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          {lvl.completed ? '✅ ' : lvl.unlocked ? '' : '🔒 '}{lvl.name}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-ui"
                            style={{ background: `${tag.color}22`, color: tag.color }}>
                            {tag.label}
                          </span>
                          <span className="text-[10px] font-terminal text-[#64748b]">
                            {done}/{lvl.steps.length}
                          </span>
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748b] font-body mb-2">{lvl.description}</p>
                      <div className="w-full h-1 bg-[#1f2430] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full smooth-transition"
                          style={{
                            width: `${pct}%`,
                            background: lvl.completed ? '#22c55e' : tag.color,
                          }}
                        />
                      </div>
                    </button>

                    {/* Comandos del nivel */}
                    {isOpen && (
                      <div className="px-3 pb-3 fade-up">
                        <div className="bg-[#0b0d14] rounded-xl border border-[#1f2430] p-2.5 space-y-1.5">
                          <p className="text-[9px] text-[#64748b] uppercase tracking-wider font-body px-1 pb-0.5">
                            Comandos del nivel ({lvl.steps.length}) · ~20 min
                          </p>
                          {lvl.steps.map((s, i) => (
                            <div
                              key={s.id}
                              className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border smooth-transition ${
                                s.completed
                                  ? 'bg-[#22c55e]/8 border-[#22c55e]/20'
                                  : 'bg-[#0e111a] border-[#1f2430]'
                              }`}
                            >
                              <span className="text-[9px] font-terminal text-[#475569] shrink-0 mt-0.5 w-4">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className={`text-[10px] shrink-0 mt-0.5 ${
                                s.completed ? 'text-[#22c55e]' : 'text-[#475569]'
                              }`}>
                                {s.completed ? '✅' : '○'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <code className={`cmd-wrap text-[11px] font-terminal ${
                                  s.completed ? 'text-[#22c55e]/70 line-through' : 'text-[#818cf8]'
                                }`}>
                                  {s.command}
                                </code>
                                <p className="text-[9px] text-[#64748b] font-body leading-snug mt-0.5">
                                  {s.description}
                                </p>
                              </div>
                            </div>
                          ))}

                          {lvl.unlocked ? (
                            <button
                              onClick={() => { playSound('click'); onStartPractice(); }}
                              className="w-full mt-2 py-2 rounded-lg btn-mission text-white text-[11px] font-bold font-ui smooth-transition"
                            >
                              ⏻ Practicar este nivel en el simulador
                            </button>
                          ) : (
                            <p className="mt-2 py-2 text-center text-[10px] text-[#64748b] font-body bg-[#0e111a] rounded-lg border border-[#1f2430]">
                              🔒 Completa los niveles anteriores para desbloquearlo
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consejo de la mascota */}
          <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-white font-ui">💬 Consejo de {info.name}</h3>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-ui ml-auto"
                style={{ background: `${arch.accentColor}20`, color: arch.accentColor }}>
                {arch.role}
              </span>
            </div>

            {/* Widget clicable: cambia de pose y consejo */}
            <button
              onClick={cycleTip}
              className="bg-[#0e111a] rounded-xl p-4 border border-[#1f2430] flex-1 mb-3 text-left hover:border-[#7c3aed]/40 smooth-transition active:scale-[0.98] group"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Mascot
                    species={mascotSpecies}
                    gender={mascotGender}
                    animation="float"
                    size={54}
                    poseClass="pose-explaining"
                    rank={rank.tier}
                    hideVisor
                  />
                  <div className="absolute pointer-events-none"
                    style={{ left: '50%', top: '30%', transform: 'translate(-50%,-50%)' }}>
                    <MascotHud expression={hudExpr} gender={mascotGender} width={26} />
                  </div>
                </div>
                <p className="text-[14px] text-[#cbd5e1] font-body leading-relaxed flex-1"
                  style={{ fontWeight: 500 }}>
                  "{currentTip}"
                </p>
              </div>
              <p className="text-[9px] text-[#475569] font-body mt-2.5 text-right group-hover:text-[#a78bfa] smooth-transition">
                ↻ Toca para otro consejo
              </p>
            </button>

            {/* Progresión de rangos */}
            <div className="flex items-center justify-between gap-1 bg-[#0e111a] rounded-xl p-2 border border-[#1f2430]">
              {(['novato', 'operador', 'sysadmin'] as const).map((t) => {
                const r = getRank(t === 'novato' ? 0 : t === 'operador' ? 34 : 70);
                const reached = rank.tier === t
                  || (t === 'novato')
                  || (t === 'operador' && rank.tier === 'sysadmin');
                return (
                  <div key={t} className="flex-1 text-center">
                    <div className="text-sm" style={{ opacity: reached ? 1 : 0.3 }}>{r.icon}</div>
                    <div className="text-[8px] font-ui mt-0.5"
                      style={{ color: reached ? r.color : '#475569' }}>
                      {r.label}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-[#64748b] font-body text-center mt-2">{arch.tagline}</p>
          </div>
        </div>

        {/* ─── Sobre la aplicación ─────────────────── */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h3 className="text-base font-bold text-white font-ui mb-2">Sobre el Simulador</h3>
              <p className="text-sm text-[#94a3b8] font-body leading-relaxed max-w-2xl">
                Terminal educativa con <strong className="text-white">Sistema de Archivos Virtual (VFS)</strong> en
                memoria. Practica comandos Linux reales en un entorno 100% aislado, diseñado para la
                comunidad de la <strong className="text-[#7c3aed]">Universidad Politécnica Territorial de Aragua</strong>.
              </p>
            </div>
            <div className="flex gap-8">
              {[
                { v: '17+',  l: 'Comandos', c: '#6366f1' },
                { v: '3',    l: 'Niveles',  c: '#7c3aed' },
                { v: '100%', l: 'Seguro',   c: '#22c55e' },
              ].map((s) => (
                <div key={s.l} className="text-center">
                  <div className="text-2xl font-extrabold font-terminal" style={{ color: s.c }}>{s.v}</div>
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider font-body mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 🐾 MASCOT COMPANION — Asistente vivo con HUD, poses y FX
// Flotante, arrastrable, con subtítulos grandes y tipeo
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import Mascot, { MascotSpecies, MascotGender } from './Mascot';
import MascotHud from './MascotHud';
import MascotFx from './MascotFx';
import { playSound } from '../utils/soundSynth';
import {
  MascotState, IDLE_STATE, ARCHETYPES, getRank, MascotPose, PointTarget,
} from '../engine/mascotEngine';

/** Compatibilidad con la API previa */
export type MascotMood = 'idle' | 'success' | 'error' | 'thinking';

interface MascotCompanionProps {
  species: MascotSpecies;
  gender: MascotGender;
  /** Estado completo del motor de mascotas */
  state?: MascotState;
  /** API simple heredada */
  message?: string;
  mood?: MascotMood;
  /** % de progreso → determina el rango/vestimenta */
  progress?: number;
  boundsRef?: React.RefObject<HTMLElement | null>;
}

const POSE_CLASS: Record<MascotPose, string> = {
  idle: '', explaining: 'pose-explaining', celebrate: '', panic: 'pose-panic',
  analyze: 'pose-analyze', throw: 'pose-throw', rewind: 'pose-rewind',
  'point-key': 'pose-point-key', ready: 'pose-ready', superpower: 'pose-superpower',
};

const POINT_LABEL: Record<Exclude<PointTarget, null>, { icon: string; text: string }> = {
  terminal:  { icon: '⌨️', text: 'Mira la terminal' },
  vfs:       { icon: '📁', text: 'Revisa el explorador' },
  missions:  { icon: '🎯', text: 'Revisa el panel de misión' },
  keyboard:  { icon: '⇥',  text: 'Usa la tecla TAB' },
};

/** Traduce el mood heredado a un estado completo */
function moodToState(mood: MascotMood, message: string): MascotState {
  switch (mood) {
    case 'success':
      return { pose: 'celebrate', hud: 'success', message, pointAt: null, fx: 'sparks', ttl: 0 };
    case 'error':
      return { pose: 'panic', hud: 'warning', message, pointAt: 'terminal', fx: 'none', ttl: 0 };
    case 'thinking':
      return { pose: 'analyze', hud: 'loading', message, pointAt: null, fx: 'none', ttl: 0 };
    default:
      return { ...IDLE_STATE, message };
  }
}

export default function MascotCompanion({
  species, gender, state, message = '', mood = 'idle',
  progress = 0, boundsRef,
}: MascotCompanionProps) {
  const arch = ARCHETYPES[species];
  const rank = getRank(progress);

  // Estado efectivo: prioriza el motor, cae al API heredada
  const st: MascotState = state ?? moodToState(mood, message);

  const [typed, setTyped] = useState('');
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fxSeed, setFxSeed] = useState(0);
  const dragRef = useRef({ sx: 0, sy: 0, ox: 0, oy: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  // Regenerar partículas al cambiar de efecto
  useEffect(() => { setFxSeed((s) => s + 1); }, [st.fx, st.message]);

  // ─── Tipeo progresivo ───────────────────────────────
  useEffect(() => {
    setTyped('');
    if (!st.message) return;
    let i = 0;
    const speed = Math.max(8, Math.min(24, 800 / st.message.length));
    const id = setInterval(() => {
      i += 1;
      setTyped(st.message.slice(0, i));
      if (i >= st.message.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [st.message]);

  // ─── Arrastre ───────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setDragging(true);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    let nx = dragRef.current.ox + dx;
    let ny = dragRef.current.oy + dy;

    const bounds = boundsRef?.current?.getBoundingClientRect();
    const self = rootRef.current?.getBoundingClientRect();
    if (bounds && self) {
      if (self.left + dx - bounds.left < 8) nx = dragRef.current.ox + (8 - (self.left - bounds.left));
      if (self.top + dy - bounds.top < 8)   ny = dragRef.current.oy + (8 - (self.top - bounds.top));
      const overR = (self.right + dx) - bounds.right;
      if (overR > -8) nx = dragRef.current.ox + dx - overR - 8;
      const overB = (self.bottom + dy) - bounds.bottom;
      if (overB > -8) ny = dragRef.current.oy + dy - overB - 8;
    }
    setPos({ x: nx, y: ny });
  }, [dragging, boundsRef]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  // Color de marco según la expresión del HUD
  const frameColor =
    st.hud === 'alert'   ? '#f87171'
    : st.hud === 'warning' ? '#fbbf24'
    : st.hud === 'success' ? '#22c55e'
    : st.hud === 'analyze' ? '#f97316'
    : arch.accentColor;

  const poseCls = POSE_CLASS[st.pose];
  const anim =
    st.pose === 'celebrate' ? 'jump'
    : st.pose === 'panic' ? 'bounce'
    : 'float';

  // ─── Minimizado ─────────────────────────────────────
  if (minimized) {
    return (
      <div ref={rootRef} className="absolute bottom-4 right-4 z-[70]"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        <button
          onClick={() => { setMinimized(false); playSound('click'); }}
          title={`Mostrar a ${arch.name}`}
          className="relative rounded-full p-1 hover:scale-110 smooth-transition"
          style={{ filter: `drop-shadow(0 0 12px ${frameColor}66)` }}
        >
          <Mascot species={species} gender={gender} animation={anim}
            size={58} poseClass={poseCls} rank={rank.tier} />
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0e111a] animate-pulse"
            style={{ background: frameColor }} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`absolute bottom-4 right-4 z-[70] flex items-end gap-3 select-none ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, maxWidth: 'min(600px, 76vw)' }}
    >
      {/* ═══ Bocadillo con subtítulos grandes ═══ */}
      <div
        className="relative rounded-2xl border-2 px-5 py-4 shadow-2xl backdrop-blur-sm bg-[#13161f]/95"
        style={{
          minWidth: 300, maxWidth: 440,
          borderColor: `${frameColor}70`,
          boxShadow: `0 10px 36px rgba(0,0,0,.5), 0 0 26px ${frameColor}2a`,
        }}
      >
        {/* Cabecera: nombre + rol + rango */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[13px] font-bold font-ui" style={{ color: frameColor }}>
            {arch.name}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-ui"
            style={{ background: `${arch.accentColor}20`, color: arch.accentColor }}>
            {arch.role}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-ui rank-pop"
            style={{ background: `${rank.color}22`, color: rank.color }}>
            {rank.icon} {rank.label}
          </span>

          <div className="ml-auto flex items-center gap-1" data-no-drag>
            <span className="text-[10px] text-[#475569] font-terminal mr-1 hidden sm:inline">⠿</span>
            <button
              onClick={() => { setMinimized(true); playSound('click'); }}
              title="Minimizar asistente"
              className="w-6 h-6 rounded-lg bg-black/30 hover:bg-black/50 text-[#94a3b8] hover:text-white smooth-transition text-xs leading-none"
            >
              ─
            </button>
          </div>
        </div>

        {/* SUBTÍTULO GRANDE */}
        <p className="font-body leading-relaxed text-white"
          style={{ fontSize: 17, lineHeight: 1.55, fontWeight: 500, letterSpacing: '0.01em' }}>
          {typed}
          {typed.length < st.message.length && (
            <span className="cursor-blink" style={{ color: frameColor }}>▌</span>
          )}
        </p>

        {/* Indicador direccional */}
        {st.pointAt && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/5">
            <span className="text-xs">{POINT_LABEL[st.pointAt].icon}</span>
            <span className="text-[11px] font-ui" style={{ color: frameColor }}>
              {POINT_LABEL[st.pointAt].text}
            </span>
            <span className="point-arrow text-xs" style={{ color: frameColor }}>→</span>
          </div>
        )}

        {/* Pico del bocadillo */}
        <div className="absolute -right-[9px] bottom-7 w-4 h-4 rotate-45 border-r-2 border-b-2 bg-[#13161f]"
          style={{ borderColor: `${frameColor}70` }} />
      </div>

      {/* ═══ Avatar + HUD + partículas ═══ */}
      <div className="relative shrink-0" style={{ filter: `drop-shadow(0 0 16px ${frameColor}55)` }}>
        <MascotFx fx={st.fx} accentColor={arch.accentColor} seed={fxSeed} />

        <Mascot
          species={species}
          gender={gender}
          animation={anim}
          size={108}
          poseClass={poseCls}
          showProp
          rank={rank.tier}
          hideVisor
        />

        {/* Visor HUD superpuesto sobre los ojos */}
        <div className="absolute pointer-events-none"
          style={{ left: '50%', top: '30%', transform: 'translate(-50%, -50%)' }}>
          <MascotHud expression={st.hud} gender={gender} width={52} />
        </div>
      </div>
    </div>
  );
}

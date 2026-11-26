// ============================================================
// 🥽 MASCOT HUD — Visor táctico con expresiones dinámicas
// Masculino: visor ámbar · Femenino: lazo rosa + acentos cian
// ============================================================

import { HudExpression } from '../engine/mascotEngine';
import { MascotGender } from './Mascot';

interface MascotHudProps {
  expression: HudExpression;
  gender: MascotGender;
  /** Ancho del visor en px (escala con el tamaño de la mascota) */
  width: number;
}

const GENDER_THEME: Record<MascotGender, {
  frame: string; glass: string; glow: string; accent: string;
}> = {
  masculino: {
    frame: '#e8a13a', glass: 'rgba(232,161,58,.22)',
    glow: 'rgba(232,161,58,.55)', accent: '#ffd089',
  },
  femenino: {
    frame: '#f472b6', glass: 'rgba(111,211,230,.22)',
    glow: 'rgba(244,114,182,.55)', accent: '#6fd3e6',
  },
};

export default function MascotHud({ expression, gender, width }: MascotHudProps) {
  const t = GENDER_THEME[gender];
  const h = Math.round(width * 0.30);

  // El color del cristal cambia según la expresión
  const glassColor =
    expression === 'alert'   ? 'rgba(248,113,113,.38)'
    : expression === 'warning' ? 'rgba(251,191,36,.32)'
    : expression === 'success' ? 'rgba(34,197,94,.30)'
    : expression === 'analyze' ? 'rgba(249,115,22,.34)'
    : t.glass;

  const glowColor =
    expression === 'alert'   ? 'rgba(248,113,113,.85)'
    : expression === 'warning' ? 'rgba(251,191,36,.7)'
    : expression === 'success' ? 'rgba(34,197,94,.7)'
    : expression === 'analyze' ? 'rgba(249,115,22,.8)'
    : t.glow;

  return (
    <div
      className={`relative overflow-hidden rounded-full border-2 ${
        expression === 'alert' ? 'hud-alert' : ''
      }`}
      style={{
        width, height: h,
        borderColor: expression === 'alert' ? '#f87171' : t.frame,
        background: glassColor,
        boxShadow: `0 0 ${Math.round(width * 0.22)}px ${glowColor}, inset 0 0 8px rgba(0,0,0,.35)`,
      }}
    >
      {/* ── Reposo: línea de escaneo ── */}
      {expression === 'scan' && (
        <div
          className="hud-scanline absolute inset-x-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)` }}
        />
      )}

      {/* ── Error de sintaxis: [!] ── */}
      {expression === 'warning' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-terminal font-bold leading-none text-[#fbbf24]"
            style={{ fontSize: h * 0.68 }}>
            [!]
          </span>
        </div>
      )}

      {/* ── Alerta roja: comando destructivo ── */}
      {expression === 'alert' && (
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          <span className="font-terminal font-black leading-none text-[#fecaca]"
            style={{ fontSize: h * 0.72 }}>
            ⚠
          </span>
        </div>
      )}

      {/* ── Éxito: check + chispas ── */}
      {expression === 'success' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-terminal font-bold leading-none text-[#4ade80]"
            style={{ fontSize: h * 0.66 }}>
            ✓
          </span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="hud-spark absolute text-[#86efac]"
              style={{
                fontSize: h * 0.34,
                left: `${18 + i * 30}%`,
                top: i % 2 ? '8%' : '52%',
                animationDelay: `${i * 0.22}s`,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      {/* ── Pensando: barra de carga ── */}
      {expression === 'loading' && (
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full overflow-hidden"
          style={{ background: 'rgba(0,0,0,.35)' }}>
          <div className="hud-loadbar h-full rounded-full"
            style={{ background: t.accent }} />
        </div>
      )}

      {/* ── Datos: barras de telemetría ── */}
      {expression === 'data' && (
        <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-2">
          {['hud-bar-a', 'hud-bar-b', 'hud-bar-c'].map((cls, i) => (
            <span key={i} className={`${cls} rounded-full`}
              style={{
                width: `${22 - i * 4}%`, height: 3,
                background: t.accent, transformOrigin: 'left center',
              }} />
          ))}
        </div>
      )}

      {/* ── Orgullo: credencial de usuario ── */}
      {expression === 'proud' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-terminal font-bold leading-none tracking-tight"
            style={{ fontSize: h * 0.42, color: t.accent }}>
            ID✓
          </span>
        </div>
      )}

      {/* ── Modo analítico total (Modo Dios) ── */}
      {expression === 'analyze' && (
        <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="hud-bar-a rounded-full"
              style={{
                width: 2, height: `${34 + (i % 3) * 22}%`,
                background: '#fdba74',
                animationDelay: `${i * 0.11}s`,
                transformOrigin: 'center',
              }} />
          ))}
        </div>
      )}

      {/* Brillo superior del cristal */}
      <div className="absolute inset-x-1 top-0.5 rounded-full pointer-events-none"
        style={{ height: Math.max(2, h * 0.18), background: 'rgba(255,255,255,.22)' }} />
    </div>
  );
}

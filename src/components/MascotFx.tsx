// ============================================================
// ✨ MASCOT FX — Capa de partículas contextuales
// confeti · chispas · llamaradas · tubería de datos · aura
// ============================================================

import { useMemo } from 'react';
import { MascotState } from '../engine/mascotEngine';

interface MascotFxProps {
  fx: MascotState['fx'];
  accentColor: string;
  /** Cambia para regenerar las partículas */
  seed: number;
}

const CONFETTI_COLORS = ['#f97316', '#fb7185', '#7c3aed', '#22c55e', '#fbbf24', '#38bdf8'];

export default function MascotFx({ fx, accentColor, seed }: MascotFxProps) {
  const pieces = useMemo(() => {
    if (fx === 'confetti') {
      return Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${8 + Math.random() * 84}%`,
        dx: `${(Math.random() - 0.5) * 90}px`,
        rot: `${Math.random() * 720 - 360}deg`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: `${Math.random() * 0.45}s`,
      }));
    }
    if (fx === 'sparks') {
      return Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        return {
          id: i,
          dx: `${Math.cos(angle) * 44}px`,
          dy: `${Math.sin(angle) * 44}px`,
          delay: `${i * 0.05}s`,
        };
      });
    }
    if (fx === 'flame') {
      return Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: `${28 + i * 11}%`,
        delay: `${i * 0.17}s`,
      }));
    }
    if (fx === 'pipe') {
      return Array.from({ length: 7 }, (_, i) => ({
        id: i,
        top: `${32 + (i % 3) * 14}%`,
        delay: `${i * 0.14}s`,
      }));
    }
    return [];
  }, [fx, seed]);

  if (fx === 'none') return null;

  // ── Aura del Modo Dios ──
  if (fx === 'aura') {
    return (
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="fx-aura-ring absolute rounded-full border-2"
            style={{
              width: `${108 + i * 26}%`,
              height: `${108 + i * 26}%`,
              borderColor: '#f97316',
              animationDelay: `${i * 0.35}s`,
              filter: 'blur(1px)',
            }}
          />
        ))}
        <span className="absolute inset-0 rounded-full"
          style={{ boxShadow: '0 0 42px rgba(249,115,22,.55)' }} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {/* ── Confeti (Vulpix celebra) ── */}
      {fx === 'confetti' && pieces.map((p: any) => (
        <span
          key={p.id}
          className="fx-confetti-piece"
          style={{
            left: p.left, top: '12%', background: p.color,
            animationDelay: p.delay,
            ['--dx' as string]: p.dx,
            ['--rot' as string]: p.rot,
          }}
        />
      ))}

      {/* ── Chispas radiales (éxito) ── */}
      {fx === 'sparks' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {pieces.map((p: any) => (
            <span
              key={p.id}
              className="fx-spark-dot"
              style={{
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
                animationDelay: p.delay,
                ['--dx' as string]: p.dx,
                ['--dy' as string]: p.dy,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Llamaradas (Ignis ante peligro) ── */}
      {fx === 'flame' && pieces.map((p: any) => (
        <span
          key={p.id}
          className="fx-flame-puff"
          style={{
            left: p.left, bottom: '16%',
            background: 'linear-gradient(to top, #f97316, #fbbf24, transparent)',
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* ── Tubería de datos (pipes / redirección) ── */}
      {fx === 'pipe' && pieces.map((p: any) => (
        <span
          key={p.id}
          className="fx-pipe-bit"
          style={{
            right: '6%', top: p.top,
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
            animationDelay: p.delay,
            ['--dist' as string]: '72px',
          }}
        />
      ))}
    </div>
  );
}

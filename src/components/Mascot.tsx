// ============================================================
// 🐾 MASCOTAS ANIMADAS — 4 Especies × 2 Géneros
// SVG vectorial con partes animadas: parpadeo, alas, cola, orejas
// Femenino: lazo rosa + pestañas · Masculino: visor táctico ámbar
// ============================================================

import { useEffect, useState } from 'react';

export type MascotSpecies = 'pinguino' | 'zorro' | 'buho' | 'dragon';
export type MascotGender = 'masculino' | 'femenino';

interface MascotProps {
  species: MascotSpecies;
  gender: MascotGender;
  animation?: 'float' | 'bounce' | 'jump' | 'idle';
  size?: number;          // px
  speechBubble?: string | null;
  showName?: boolean;
  className?: string;
  /** Clase de pose adicional (pose-explaining, pose-panic, …) */
  poseClass?: string;
  /** Muestra el prop del arquetipo: tableta, libro, cola, alas */
  showProp?: boolean;
  /** Vestimenta por rango: novato · operador · sysadmin */
  rank?: 'novato' | 'operador' | 'sysadmin';
  /** Oculta el visor SVG cuando se usa el HUD externo */
  hideVisor?: boolean;
}

export const MASCOT_INFO: Record<MascotSpecies, { name: string; emoji: string; trait: string }> = {
  pinguino: { name: 'Tux',    emoji: '🐧', trait: 'Clásico y amigable, experto en Linux' },
  zorro:    { name: 'Vulpix', emoji: '🦊', trait: 'Rápido y astuto, veloz en comandos' },
  buho:     { name: 'Athena', emoji: '🦉', trait: 'Sabio y analítico, guía teórico' },
  dragon:   { name: 'Ignis',  emoji: '🐉', trait: 'Poderoso y legendario, compilador' },
};

const PALETTE: Record<MascotSpecies, {
  body: string; belly: string; accent: string; dark: string; detail: string;
}> = {
  pinguino: { body: '#243447', belly: '#f8fafc', accent: '#f59e0b', dark: '#141d2b', detail: '#fb923c' },
  zorro:    { body: '#ea580c', belly: '#fef3c7', accent: '#fdba74', dark: '#9a3412', detail: '#fff7ed' },
  buho:     { body: '#5b6b80', belly: '#e2e8f0', accent: '#fbbf24', dark: '#3b4757', detail: '#cbd5e1' },
  dragon:   { body: '#10b981', belly: '#d1fae5', accent: '#fbbf24', dark: '#047857', detail: '#6ee7b7' },
};

const GENDER = {
  masculino: { color: '#e8a13a', label: 'Visor Táctico Ámbar' },
  femenino:  { color: '#f472b6', label: 'Lazo Rosa + Audífonos' },
};

export default function Mascot({
  species,
  gender,
  animation = 'idle',
  size = 96,
  speechBubble,
  showName = false,
  className = '',
  poseClass = '',
  showProp = false,
  rank,
  hideVisor = false,
}: MascotProps) {
  const [animClass, setAnimClass] = useState('animate-m-float');
  const c = PALETTE[species];
  const g = GENDER[gender];
  const info = MASCOT_INFO[species];

  useEffect(() => {
    switch (animation) {
      case 'float':  setAnimClass('animate-m-float'); break;
      case 'bounce': setAnimClass('animate-m-bounce'); break;
      case 'jump':   setAnimClass('animate-m-jump'); break;
      default:       setAnimClass('animate-m-float');
    }
  }, [animation]);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {speechBubble && (
        <div className="mb-2 bg-[#13161f] border border-[#1f2430] rounded-2xl px-3.5 py-2 max-w-[230px] relative shadow-lg fade-up">
          <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#13161f] border-r border-b border-[#1f2430] rotate-45" />
          <p className="text-[11px] text-[#94a3b8] leading-snug font-body">{speechBubble}</p>
        </div>
      )}

      <div className={`${animClass} ${poseClass}`} style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
          <defs>
            <radialGradient id={`bodyGrad-${species}`} cx="38%" cy="30%">
              <stop offset="0%" stopColor={c.body} stopOpacity="1" />
              <stop offset="100%" stopColor={c.dark} stopOpacity="1" />
            </radialGradient>
            <linearGradient id={`bellyGrad-${species}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor={c.belly} />
            </linearGradient>
          </defs>

          {/* Sombra base */}
          <ellipse cx="50" cy="95" rx="24" ry="4" fill="#000" opacity="0.28" />

          {/* ══ PROPS DE ARQUETIPO ══ */}
          {showProp && species === 'pinguino' && (
            /* Tux: minitableta de diagnósticos */
            <g className="svg-part">
              <rect x="68" y="58" width="22" height="16" rx="2.5" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.2" />
              <rect x="70" y="60" width="18" height="12" rx="1.5" fill="#0f172a" />
              <rect x="71.5" y="62" width="9" height="1.4" rx="0.7" fill="#38bdf8" opacity="0.9" />
              <rect x="71.5" y="65" width="13" height="1.4" rx="0.7" fill="#22c55e" opacity="0.8" />
              <rect x="71.5" y="68" width="6" height="1.4" rx="0.7" fill="#fbbf24" opacity="0.8" />
            </g>
          )}
          {showProp && species === 'buho' && (
            /* Athena: libro de manpages flotante */
            <g className="svg-part part-float-book">
              <path d="M66 52 L80 50 L80 64 L66 66 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
              <path d="M80 50 L94 52 L94 66 L80 64 Z" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
              <path d="M80 50 L80 64" stroke="#d97706" strokeWidth="1.2" />
              <path d="M69 55 L77 54 M69 58 L77 57 M83 55 L91 56 M83 58 L91 59"
                stroke="#92400e" strokeWidth="0.7" opacity="0.65" />
            </g>
          )}
          {showProp && species === 'dragon' && (
            /* Ignis: lupa de detective */
            <g className="svg-part">
              <circle cx="80" cy="56" r="8" fill="rgba(110,231,183,.25)" stroke="#34d399" strokeWidth="1.8" />
              <path d="M86 62 L92 69" stroke="#047857" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="77" cy="53" r="2.4" fill="#fff" opacity="0.5" />
            </g>
          )}

          {/* ── COLA (zorro / dragón) ───────────────── */}
          {species === 'zorro' && (
            <g className="svg-part part-tail">
              <path d="M72 74 Q92 70 94 52 Q96 74 78 84 Z" fill={c.body} />
              <path d="M84 62 Q94 58 94 52 Q95 66 84 72 Z" fill={c.detail} />
            </g>
          )}
          {species === 'dragon' && (
            <g className="svg-part part-tail">
              <path d="M72 76 Q92 74 96 58 Q98 80 76 86 Z" fill={c.dark} />
              <path d="M88 68 L94 62 L92 72 Z" fill={c.accent} />
            </g>
          )}

          {/* ── ALAS ────────────────────────────────── */}
          <g className="svg-part part-wing-l">
            {species === 'dragon' ? (
              <path d="M28 52 Q10 40 8 58 Q16 56 20 62 Q22 56 28 60 Z" fill={c.dark} />
            ) : (
              <ellipse cx="26" cy="62" rx="8" ry="16" fill={c.dark} />
            )}
          </g>
          <g className="svg-part part-wing-r">
            {species === 'dragon' ? (
              <path d="M72 52 Q90 40 92 58 Q84 56 80 62 Q78 56 72 60 Z" fill={c.dark} />
            ) : (
              <ellipse cx="74" cy="62" rx="8" ry="16" fill={c.dark} />
            )}
          </g>

          {/* ── CUERPO ──────────────────────────────── */}
          <g className="svg-part part-body">
            <ellipse cx="50" cy="64" rx="27" ry="29" fill={`url(#bodyGrad-${species})`} />
            <ellipse cx="50" cy="68" rx="18" ry="22" fill={`url(#bellyGrad-${species})`} />
            {species === 'dragon' && (
              <>
                <path d="M50 44 L54 50 L46 50 Z" fill={c.accent} opacity="0.8" />
                <path d="M50 56 L54 62 L46 62 Z" fill={c.accent} opacity="0.6" />
              </>
            )}
            {species === 'buho' && (
              <>
                <path d="M40 62 Q50 66 60 62" stroke={c.dark} strokeWidth="1.5" fill="none" opacity="0.4" />
                <path d="M40 70 Q50 74 60 70" stroke={c.dark} strokeWidth="1.5" fill="none" opacity="0.4" />
              </>
            )}
          </g>

          {/* ── PATAS ───────────────────────────────── */}
          <ellipse cx="40" cy="91" rx="8" ry="4" fill={c.accent} />
          <ellipse cx="60" cy="91" rx="8" ry="4" fill={c.accent} />

          {/* ── OREJAS / CUERNOS ────────────────────── */}
          <g className="svg-part part-ears">
            {species === 'zorro' && (
              <>
                <path d="M32 24 L28 6 L44 16 Z" fill={c.body} />
                <path d="M33 21 L31 11 L40 16 Z" fill={c.detail} />
                <path d="M68 24 L72 6 L56 16 Z" fill={c.body} />
                <path d="M67 21 L69 11 L60 16 Z" fill={c.detail} />
              </>
            )}
            {species === 'buho' && (
              <>
                <path d="M34 20 L30 6 L44 14 Z" fill={c.dark} />
                <path d="M66 20 L70 6 L56 14 Z" fill={c.dark} />
              </>
            )}
            {species === 'dragon' && (
              <>
                <path d="M36 18 Q30 6 38 8 Q40 12 42 16 Z" fill={c.accent} />
                <path d="M64 18 Q70 6 62 8 Q60 12 58 16 Z" fill={c.accent} />
              </>
            )}
          </g>

          {/* ── CABEZA ──────────────────────────────── */}
          <circle cx="50" cy="34" r="22" fill={`url(#bodyGrad-${species})`} />
          {species !== 'pinguino' && (
            <ellipse cx="50" cy="40" rx="14" ry="12" fill={c.belly} opacity="0.9" />
          )}
          {species === 'pinguino' && (
            <ellipse cx="50" cy="38" rx="15" ry="14" fill={c.belly} />
          )}

          {/* Brillo */}
          <ellipse className="part-shine" cx="41" cy="24" rx="7" ry="5" fill="#ffffff" opacity="0.3" />

          {/* ── OJOS ────────────────────────────────── */}
          <g className="svg-part part-eyes">
            {species === 'buho' ? (
              <>
                <circle cx="41" cy="35" r="9" fill="#fff" />
                <circle cx="59" cy="35" r="9" fill="#fff" />
                <circle cx="41" cy="35" r="5.5" fill="#1e293b" />
                <circle cx="59" cy="35" r="5.5" fill="#1e293b" />
                <circle cx="43" cy="33" r="2" fill="#fff" />
                <circle cx="61" cy="33" r="2" fill="#fff" />
              </>
            ) : (
              <>
                <ellipse cx="42" cy="33" rx="5.5" ry="6.5" fill="#fff" />
                <ellipse cx="58" cy="33" rx="5.5" ry="6.5" fill="#fff" />
                <circle cx="42.5" cy="34" r="3.2" fill="#111827" />
                <circle cx="58.5" cy="34" r="3.2" fill="#111827" />
                <circle cx="43.8" cy="32.4" r="1.3" fill="#fff" />
                <circle cx="59.8" cy="32.4" r="1.3" fill="#fff" />
              </>
            )}

            {/* Pestañas (femenino) */}
            {gender === 'femenino' && (
              <>
                <path d="M36 28 L33 25" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M39 26 L37.5 22.5" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M64 28 L67 25" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M61 26 L62.5 22.5" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" />
              </>
            )}
          </g>

          {/* ── PICO / HOCICO ───────────────────────── */}
          {species === 'pinguino' && (
            <path d="M50 40 L44 46 L56 46 Z" fill={c.accent} />
          )}
          {species === 'buho' && (
            <path d="M50 42 L46 47 L54 47 Z" fill={c.accent} />
          )}
          {species === 'zorro' && (
            <>
              <ellipse cx="50" cy="45" rx="7" ry="5" fill={c.detail} />
              <ellipse cx="50" cy="43" rx="2.6" ry="2" fill="#1f2937" />
              <path d="M50 45 L50 48 M50 48 Q46 50 45 47 M50 48 Q54 50 55 47"
                stroke="#1f2937" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </>
          )}
          {species === 'dragon' && (
            <>
              <ellipse cx="50" cy="45" rx="8" ry="5.5" fill={c.detail} />
              <circle cx="47" cy="44" r="1.3" fill="#065f46" />
              <circle cx="53" cy="44" r="1.3" fill="#065f46" />
              <path d="M45 49 Q50 52 55 49" stroke="#065f46" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* ── MEJILLAS (femenino) ─────────────────── */}
          {gender === 'femenino' && (
            <>
              <ellipse cx="34" cy="41" rx="4" ry="2.6" fill="#f472b6" opacity="0.45" />
              <ellipse cx="66" cy="41" rx="4" ry="2.6" fill="#f472b6" opacity="0.45" />
            </>
          )}

          {/* ══ ACCESORIOS POR GÉNERO ══════════════════ */}

          {/* ══ VESTIMENTA POR RANGO ══ */}
          {rank === 'operador' && (
            /* Operador: banda técnica en el pecho */
            <g className="svg-part">
              <path d="M34 58 L50 66 L66 58 L66 62 L50 70 L34 62 Z" fill="#6366f1" opacity="0.85" />
              <circle cx="50" cy="68" r="3.2" fill="#818cf8" stroke="#1e1b4b" strokeWidth="0.8" />
              <text x="50" y="69.6" fontSize="3.4" fill="#fff" textAnchor="middle" fontWeight="bold">⚙</text>
            </g>
          )}
          {rank === 'sysadmin' && (
            /* SysAdmin: capa + corona */
            <>
              <g className="svg-part">
                <path d="M26 50 Q22 76 30 90 L38 86 Q32 70 34 52 Z" fill="#f97316" opacity="0.55" />
                <path d="M74 50 Q78 76 70 90 L62 86 Q68 70 66 52 Z" fill="#f97316" opacity="0.55" />
              </g>
              <g className="svg-part">
                <path d="M38 12 L43 19 L50 10 L57 19 L62 12 L60 22 L40 22 Z"
                  fill="#fbbf24" stroke="#d97706" strokeWidth="0.9" />
                <circle cx="50" cy="15" r="1.7" fill="#fef08a" />
              </g>
            </>
          )}

          {/* MASCULINO: Visor táctico ámbar */}
          {!hideVisor && gender === 'masculino' && (
            <g>
              <rect x="28" y="26" width="44" height="9" rx="4.5" fill={g.color} opacity="0.32" />
              <rect x="28" y="26" width="44" height="9" rx="4.5" fill="none" stroke={g.color} strokeWidth="1.6" />
              <rect x="26" y="28.5" width="6" height="4" rx="2" fill={g.color} />
              <rect x="68" y="28.5" width="6" height="4" rx="2" fill={g.color} />
              <circle cx="66" cy="30.5" r="1.4" fill="#fff" opacity="0.85" />
              <path d="M32 30.5 L44 30.5" stroke={g.color} strokeWidth="1" opacity="0.7" />
            </g>
          )}

          {/* FEMENINO: Lazo rosa + audífonos cian */}
          {(!hideVisor || gender === 'femenino') && gender === 'femenino' && (
            <>
              {/* Audífonos */}
              <path d="M28 30 Q50 8 72 30" stroke="#6fd3e6" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
              <rect x="23" y="28" width="8" height="13" rx="4" fill="#6fd3e6" />
              <rect x="69" y="28" width="8" height="13" rx="4" fill="#6fd3e6" />
              <rect x="25" y="31" width="4" height="7" rx="2" fill="#0e7490" opacity="0.6" />
              <rect x="71" y="31" width="4" height="7" rx="2" fill="#0e7490" opacity="0.6" />

              {/* LAZO 🎀 */}
              <g className="svg-part part-bow">
                <path d="M30 20 Q18 10 17 20 Q16 30 30 22 Z" fill="#f472b6" />
                <path d="M30 20 Q42 10 43 20 Q44 30 30 22 Z" fill="#ec4899" />
                <path d="M30 20 Q22 14 19 19 Q17 24 29 21 Z" fill="#fb7ec0" opacity="0.7" />
                <path d="M30 20 Q38 14 41 19 Q43 24 31 21 Z" fill="#f9a8d4" opacity="0.6" />
                <circle cx="30" cy="21" r="4" fill="#db2777" />
                <circle cx="28.6" cy="19.8" r="1.4" fill="#fbcfe8" opacity="0.9" />
                <path d="M27 24 L24 31" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M33 24 L36 31" stroke="#ec4899" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </>
          )}
        </svg>
      </div>

      {showName && (
        <div className="mt-1.5 text-center">
          <p className="text-[11px] font-bold font-ui" style={{ color: c.body }}>
            {info.name}
          </p>
          <p className="text-[9px] text-[#64748b] font-body">{g.label}</p>
        </div>
      )}
    </div>
  );
}

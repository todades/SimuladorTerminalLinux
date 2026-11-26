// ============================================================
// 🐾 MASCOT ENGINE — Expresiones HUD, poses y reactividad
// Mapea eventos de la terminal/módulos a estados visuales
// ============================================================

import { MascotSpecies } from '../components/Mascot';

// ─── Expresiones del visor HUD ────────────────────────
export type HudExpression =
  | 'scan'      // línea de escaneo (reposo)
  | 'warning'   // [!] error de sintaxis
  | 'success'   // [✓] chispas / corazones
  | 'loading'   // barra de carga en bucle
  | 'alert'     // destello rojo — comando destructivo
  | 'proud'     // credencial de usuario (whoami)
  | 'analyze'   // modo analítico total (Modo Dios)
  | 'data';     // transferencia de datos (pipes/redirección)

// ─── Poses corporales ─────────────────────────────────
export type MascotPose =
  | 'idle'        // respiración + parpadeo
  | 'explaining'  // brazo/ala señalando
  | 'celebrate'   // salto de logro
  | 'panic'       // manos en la cabeza
  | 'analyze'     // pose de análisis pensativo
  | 'throw'       // gesto de lanzamiento al VFS
  | 'rewind'      // rebobinado de historial
  | 'point-key'   // apunta al teclado (TAB)
  | 'ready'       // preparación para el trabajo (hover CTA)
  | 'superpower'; // aura de Modo Dios

/** Hacia dónde apunta la mascota cuando explica */
export type PointTarget = 'terminal' | 'vfs' | 'missions' | 'keyboard' | null;

export interface MascotState {
  pose: MascotPose;
  hud: HudExpression;
  message: string;
  pointAt: PointTarget;
  /** Partículas decorativas: confeti, chispas, llamaradas */
  fx: 'none' | 'confetti' | 'sparks' | 'flame' | 'pipe' | 'aura';
  /** Duración en ms antes de volver a reposo; 0 = permanente */
  ttl: number;
}

export const IDLE_STATE: MascotState = {
  pose: 'idle', hud: 'scan', message: '', pointAt: null, fx: 'none', ttl: 0,
};

// ─── Arquetipos: identidad de cada personaje ──────────

export interface MascotArchetype {
  name: string;
  role: string;
  tagline: string;
  /** Prop que sostiene el personaje */
  prop: 'tablet' | 'tail' | 'book' | 'wings';
  accentColor: string;
  /** Cómo redacta cada tipo de mensaje */
  voice: {
    greet: string[];
    success: string[];
    error: string[];
    hint: string[];
    danger: string[];
    pipe: string[];
    tab: string[];
    history: string[];
    vfs: string[];
    proud: string[];
  };
}

export const ARCHETYPES: Record<MascotSpecies, MascotArchetype> = {
  // ── Tux: El Técnico / Analítico ──
  pinguino: {
    name: 'Tux', role: 'El Técnico', tagline: 'Riguroso en sintaxis POSIX',
    prop: 'tablet', accentColor: '#38bdf8',
    voice: {
      greet: [
        'Diagnóstico iniciado. Revisemos la jerarquía del sistema paso a paso.',
        'Sistema estable. Recuerda: cada flag altera el comportamiento del comando.',
      ],
      success: [
        'Sintaxis correcta. El comando se ejecutó conforme al estándar POSIX.',
        'Validado. Los parámetros fueron interpretados sin ambigüedad.',
      ],
      error: [
        'Error de sintaxis detectado. Verifica el orden de los argumentos.',
        'El parser rechazó la entrada. Revisa las rutas y los flags.',
      ],
      hint: [
        'Analiza la estructura: comando → flags → ruta.',
        'Consulta la jerarquía FHS antes de navegar a ciegas.',
      ],
      danger: [
        '⚠️ Operación destructiva interceptada. Entorno protegido activo.',
        '⚠️ Ese comando borraría el sistema. Aquí es seguro, pero en producción NO.',
      ],
      pipe: [
        'Flujo redirigido. La salida estándar ahora alimenta al siguiente proceso.',
        'Tubería establecida: stdout → stdin. Encadenamiento correcto.',
      ],
      tab: ['Usa TAB para autocompletar. Reduce errores de tipeo en un 90%.'],
      history: ['Historial recuperado. Reutilizar comandos es buena práctica.'],
      vfs: ['Sistema de archivos modificado. Verifica el árbol a la derecha.'],
      proud: ['Identidad confirmada. Credencial validada en el sistema.'],
    },
  },

  // ── Vulpix: El Entusiasta / Motivador ──
  zorro: {
    name: 'Vulpix', role: 'El Entusiasta', tagline: 'Celebra cada logro contigo',
    prop: 'tail', accentColor: '#fb923c',
    voice: {
      greet: [
        '¡Vamos con todo! Cada comando que escribes te hace más fuerte. 🔥',
        '¡Hoy dominamos la terminal! ¿Listo para la siguiente misión?',
      ],
      success: [
        '¡ESO ES! 🎉 ¡Lo clavaste a la primera!',
        '¡Increíble! Vas volando por estos niveles. ⚡',
        '¡BOOM! Otro objetivo conquistado. ¡Sigue así!',
      ],
      error: [
        '¡Tranqui! Todos fallamos al principio. Vuelve a intentarlo. 💪',
        'Casi casi… un pequeño ajuste y lo logras. ¡No te rindas!',
      ],
      hint: [
        '¡Tú puedes! Mira la pista y dale otra vez.',
        'Pssst… te doy una ayudita para que sigas avanzando.',
      ],
      danger: [
        '¡WOOOA! 😱 ¡Casi borras todo! Menos mal que estamos en el laboratorio.',
        '¡Frena! Ese comando es peligrosísimo fuera de aquí.',
      ],
      pipe: [
        '¡Mira esa tubería! Conectaste comandos como un pro. 🚀',
        '¡Combo de comandos! Eso sí es nivel avanzado.',
      ],
      tab: ['¡Dale al TAB! Te ahorra un montón de tecleo. ⌨️'],
      history: ['¡Rebobinando! Las flechas ↑↓ son tus mejores amigas.'],
      vfs: ['¡Mira el panel! Tu archivo ya apareció allá. ✨'],
      proud: ['¡Ese eres TÚ! Orgulloso de tenerte en el equipo. 🏅'],
    },
  },

  // ── Athena: La Sabia / Historiadora ──
  buho: {
    name: 'Athena', role: 'La Sabia', tagline: 'Teoría de sistemas y trivia GNU',
    prop: 'book', accentColor: '#fbbf24',
    voice: {
      greet: [
        'Bienvenido. ¿Sabías que Unix nació en 1969 en los Laboratorios Bell?',
        'La terminal es el interfaz más antiguo y potente. Estudiémosla con calma.',
      ],
      success: [
        'Excelente ejecución. Ese comando existe prácticamente sin cambios desde 1971.',
        'Correcto. Has aplicado un principio fundamental de la filosofía Unix.',
      ],
      error: [
        'El intérprete no reconoció la instrucción. Consultemos el manual.',
        'Sintaxis inválida. Recuerda: Linux distingue mayúsculas de minúsculas.',
      ],
      hint: [
        'Si estuvieras en una terminal real, "man comando" te daría la respuesta.',
        'Un consejo académico: comprende el porqué antes del cómo.',
      ],
      danger: [
        '⚠️ "rm -rf /" es el comando más temido de la historia de Unix. Jamás lo ejecutes en producción.',
        '⚠️ Has invocado una operación irreversible. Afortunadamente, estamos en un entorno aislado.',
      ],
      pipe: [
        'La tubería "|" fue inventada por Douglas McIlroy en 1973. Acabas de usar historia viva.',
        'Redirección aplicada. "Haz una cosa y hazla bien" — filosofía Unix.',
      ],
      tab: ['El autocompletado con TAB llegó con bash en 1989. Úsalo sabiamente.'],
      history: ['El historial de comandos se almacena en ~/.bash_history. Fascinante, ¿no?'],
      vfs: ['El árbol de directorios sigue el estándar FHS. Observa su estructura.'],
      proud: ['"whoami" responde consultando /etc/passwd. Tu identidad está registrada.'],
    },
  },

  // ── Ignis: El Detective / Explorador ──
  dragon: {
    name: 'Ignis', role: 'El Detective', tagline: 'Resuelve acertijos de depuración',
    prop: 'wings', accentColor: '#34d399',
    voice: {
      greet: [
        'Caso abierto. Investiguemos este sistema pista por pista. 🔍',
        'Todo sistema esconde secretos. Vamos a descubrirlos juntos.',
      ],
      success: [
        'Pista resuelta. El caso avanza en la dirección correcta. 🧩',
        'Deducción acertada. Un misterio menos en el expediente.',
      ],
      error: [
        'Callejón sin salida. Revisemos las evidencias de nuevo.',
        'La pista no encajó. Un buen detective reconsidera su hipótesis.',
      ],
      hint: [
        'Observa con atención: la respuesta está en los detalles del comando.',
        'Sigue el rastro. ¿Qué ruta estás usando realmente?',
      ],
      danger: [
        '🔥 ¡Alerta roja! Intentaste destruir la escena del crimen completa.',
        '🔥 Operación letal interceptada. El entorno blindado te salvó.',
      ],
      pipe: [
        'Conectaste las evidencias en cadena. Deducción encadenada perfecta.',
        'El flujo de datos revela el patrón. Buen trabajo investigativo.',
      ],
      tab: ['Pista: la tecla TAB revela nombres ocultos sin adivinar.'],
      history: ['Revisando el expediente de comandos anteriores…'],
      vfs: ['Nueva evidencia registrada en el árbol de archivos.'],
      proud: ['Identidad verificada. Credencial de investigador confirmada.'],
    },
  },
};

/** Acceso seguro: si la especie es inválida devuelve Tux */
export function getArchetype(species?: string | null): MascotArchetype {
  return ARCHETYPES[species as MascotSpecies] ?? ARCHETYPES.pinguino;
}

export function safeSpecies(species?: string | null): MascotSpecies {
  return (species && species in ARCHETYPES)
    ? species as MascotSpecies
    : 'pinguino';
}

// ─── Niveles de progresión (vestimenta evolutiva) ─────
export type RankTier = 'novato' | 'operador' | 'sysadmin';

export interface Rank {
  tier: RankTier;
  label: string;
  icon: string;
  color: string;
  minProgress: number;
}

export const RANKS: Rank[] = [
  { tier: 'novato',   label: 'Novato',   icon: '🌱', color: '#64748b', minProgress: 0 },
  { tier: 'operador', label: 'Operador', icon: '⚙️', color: '#6366f1', minProgress: 34 },
  { tier: 'sysadmin', label: 'SysAdmin', icon: '👑', color: '#f97316', minProgress: 70 },
];

export function getRank(progress: number): Rank {
  return [...RANKS].reverse().find((r) => progress >= r.minProgress) ?? RANKS[0];
}

// ─── Detección de comandos de riesgo ──────────────────

const DANGEROUS_PATTERNS = [
  /^\s*rm\s+(-[rfRF]+\s+)*\/\s*$/,          // rm -rf /
  /^\s*rm\s+-[rfRF]+\s+\/\*/,               // rm -rf /*
  /^\s*sudo\b/,                              // sudo
  /^\s*su\s+root/,                           // su root
  /^\s*mkfs/,                                // formatear
  /^\s*dd\s+.*of=\/dev\/[sh]d/,              // sobrescribir disco
  /:\(\)\{.*\|.*&.*\};:/,                    // fork bomb
  /^\s*chmod\s+-R\s+777\s+\/\s*$/,           // permisos totales en raíz
  /^\s*>\s*\/dev\/[sh]da/,                   // escribir en disco
];

export function isDangerousCommand(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(cmd));
}

// ─── Clasificación de comandos ────────────────────────

export function usesPipeOrRedirect(cmd: string): boolean {
  return /[|>]/.test(cmd);
}

export function isVfsMutation(cmd: string): boolean {
  return /^\s*(touch|mkdir|cp|mv|rm|tar)\b/.test(cmd);
}

export function isWhoami(cmd: string): boolean {
  return /^\s*whoami\s*$/.test(cmd);
}

// ─── Fábrica de estados contextuales ──────────────────

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface ReactionContext {
  species: MascotSpecies;
  command: string;
  failed: boolean;
  stepCompleted: boolean;
  successMessage?: string;
  hintMessage?: string;
}

/** Traduce el resultado de un comando al estado visual de la mascota */
export function reactToCommand(ctx: ReactionContext): MascotState {
  const v = ARCHETYPES[ctx.species].voice;

  // 1. Comando destructivo → pánico (máxima prioridad)
  if (isDangerousCommand(ctx.command)) {
    return {
      pose: 'panic', hud: 'alert', message: pick(v.danger),
      pointAt: 'terminal', fx: 'flame', ttl: 7000,
    };
  }

  // 2. Objetivo completado → celebración
  if (ctx.stepCompleted) {
    return {
      pose: 'celebrate', hud: 'success',
      message: ctx.successMessage ?? pick(v.success),
      pointAt: 'missions',
      fx: ctx.species === 'zorro' ? 'confetti' : 'sparks',
      ttl: 5500,
    };
  }

  // 3. Error de sintaxis → análisis
  if (ctx.failed) {
    return {
      pose: 'analyze', hud: 'warning',
      message: ctx.hintMessage ?? pick(v.error),
      pointAt: 'terminal', fx: 'none', ttl: 6000,
    };
  }

  // 4. whoami → orgullo
  if (isWhoami(ctx.command)) {
    return {
      pose: 'explaining', hud: 'proud', message: pick(v.proud),
      pointAt: 'terminal', fx: 'sparks', ttl: 4500,
    };
  }

  // 5. Pipes / redirección → transferencia de datos
  if (usesPipeOrRedirect(ctx.command)) {
    return {
      pose: 'explaining', hud: 'data', message: pick(v.pipe),
      pointAt: 'terminal', fx: 'pipe', ttl: 5000,
    };
  }

  // 6. Mutación del VFS → gesto de lanzamiento
  if (isVfsMutation(ctx.command)) {
    return {
      pose: 'throw', hud: 'data', message: pick(v.vfs),
      pointAt: 'vfs', fx: 'pipe', ttl: 4500,
    };
  }

  return IDLE_STATE;
}

/** Estado de reposo con el concepto del paso activo */
export function restState(species: MascotSpecies, conceptMsg?: string): MascotState {
  return {
    pose: 'idle', hud: 'scan',
    message: conceptMsg ?? pick(ARCHETYPES[species].voice.greet),
    pointAt: null, fx: 'none', ttl: 0,
  };
}

/** Pista por inactividad */
export function idleHintState(species: MascotSpecies, hint?: string): MascotState {
  return {
    pose: 'analyze', hud: 'loading',
    message: hint ?? pick(ARCHETYPES[species].voice.hint),
    pointAt: 'terminal', fx: 'none', ttl: 8000,
  };
}

/** Recordatorio de TAB */
export function tabHintState(species: MascotSpecies): MascotState {
  return {
    pose: 'point-key', hud: 'loading',
    message: pick(ARCHETYPES[species].voice.tab),
    pointAt: 'keyboard', fx: 'none', ttl: 4000,
  };
}

/** Navegación de historial */
export function historyState(species: MascotSpecies): MascotState {
  return {
    pose: 'rewind', hud: 'data',
    message: pick(ARCHETYPES[species].voice.history),
    pointAt: 'terminal', fx: 'none', ttl: 3000,
  };
}

/** Modo Dios activado */
export function godModeState(species: MascotSpecies): MascotState {
  return {
    pose: 'superpower', hud: 'analyze',
    message: `⚡ Modo superusuario activo. ${ARCHETYPES[species].name} opera sin restricciones.`,
    pointAt: null, fx: 'aura', ttl: 0,
  };
}

// ─── Consejos temáticos por módulo ────────────────────

export function lessonHoverFx(cmd: string): {
  fx: string; icon: string; label: string;
} | null {
  const map: Record<string, { fx: string; icon: string; label: string }> = {
    clear: { fx: 'wipe',    icon: '🧽', label: 'Limpiando la pantalla…' },
    pwd:   { fx: 'map',     icon: '🗺️', label: 'Desplegando mapa holográfico' },
    ls:    { fx: 'binocs',  icon: '🔭', label: 'Inspeccionando con binoculares' },
    cat:   { fx: 'magnify', icon: '🔍', label: 'Examinando con lupa digital' },
    grep:  { fx: 'magnify', icon: '🔎', label: 'Filtrando coincidencias' },
    find:  { fx: 'binocs',  icon: '🧭', label: 'Rastreando el sistema' },
  };
  const key = cmd.split(/\s+/)[0];
  return map[key] ?? null;
}

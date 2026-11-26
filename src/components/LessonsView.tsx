// ============================================================
// 📚 LECCIONES — Guía teórica de comandos Linux
// ============================================================

import { useState } from 'react';
import { playSound } from '../utils/soundSynth';
import { lessonHoverFx } from '../engine/mascotEngine';

interface LessonsViewProps {
  onStartPractice: () => void;
}

interface Lesson {
  cmd: string;
  full: string;
  desc: string;
  example: string;
  level: 'N1' | 'N2' | 'N3';
  icon: string;
}

const LESSONS: Lesson[] = [
  { cmd: 'pwd', full: 'Print Working Directory', icon: '📍', level: 'N1',
    desc: 'Muestra la ruta absoluta del directorio en el que te encuentras actualmente.',
    example: '$ pwd\n/home/estudiante' },
  { cmd: 'ls', full: 'List', icon: '📋', level: 'N1',
    desc: 'Lista archivos y directorios. Con -l muestra detalles y con -a incluye ocultos.',
    example: '$ ls\ndocumentos  practicas  proyectos\n\n$ ls -la\ntotal 24\ndrwxr-xr-x  estudiante  4096 documentos/' },
  { cmd: 'cd', full: 'Change Directory', icon: '🚪', level: 'N1',
    desc: 'Cambia el directorio actual. Usa .. para subir un nivel y sin argumentos vuelve al home.',
    example: '$ cd documentos\n$ pwd\n/home/estudiante/documentos\n$ cd ..' },
  { cmd: 'cat', full: 'Concatenate', icon: '📖', level: 'N1',
    desc: 'Muestra el contenido completo de uno o más archivos de texto en la terminal.',
    example: '$ cat bienvenido.txt\n🐧 ¡Bienvenido al UPTA Terminal Lab!' },
  { cmd: 'whoami', full: 'Who Am I', icon: '🪪', level: 'N1',
    desc: 'Muestra el nombre del usuario con el que estás autenticado en el sistema.',
    example: '$ whoami\nestudiante' },
  { cmd: 'clear', full: 'Clear Screen', icon: '🧹', level: 'N1',
    desc: 'Limpia todo el contenido visible de la terminal sin borrar el historial.',
    example: '$ clear' },
  { cmd: 'mkdir', full: 'Make Directory', icon: '📁', level: 'N2',
    desc: 'Crea uno o varios directorios nuevos dentro de la ubicación actual.',
    example: '$ mkdir practicas_linux\n$ ls\npracticas_linux/' },
  { cmd: 'touch', full: 'Touch File', icon: '📄', level: 'N2',
    desc: 'Crea archivos vacíos o actualiza la fecha de modificación de archivos existentes.',
    example: '$ touch ejercicio.txt\n$ ls\nejercicio.txt' },
  { cmd: 'rm', full: 'Remove', icon: '🗑️', level: 'N2',
    desc: 'Elimina archivos. Con la opción -r borra directorios de forma recursiva.',
    example: '$ rm ejercicio.txt\n$ rm -r carpeta_vieja/' },
  { cmd: 'echo', full: 'Echo', icon: '📢', level: 'N2',
    desc: 'Imprime en pantalla el texto que le pases como argumento.',
    example: '$ echo ¡Hola UPTA!\n¡Hola UPTA!' },
  { cmd: 'date', full: 'Date', icon: '🕒', level: 'N2',
    desc: 'Muestra la fecha y hora actuales configuradas en el sistema.',
    example: '$ date\nMar Ene 15 10:30:00 -04 2026' },
  { cmd: 'uname', full: 'Unix Name', icon: '⚙️', level: 'N3',
    desc: 'Muestra información del sistema operativo. Con -a despliega todos los detalles.',
    example: '$ uname -a\nUPTA GNU/Linux 5.15.0-lab x86_64' },

  // ── Gestión de paquetes ──
  { cmd: 'apt update', full: 'Advanced Package Tool', icon: '🔄', level: 'N2',
    desc: 'Sincroniza el índice local con los repositorios. Siempre ejecútalo antes de instalar.',
    example: '$ apt update\nDes:1 http://deb.upta.edu.ve/debian stable InRelease [142 kB]\nLeyendo lista de paquetes... Hecho\nSe pueden actualizar 3 paquetes.' },
  { cmd: 'apt search', full: 'Buscar paquetes', icon: '🔎', level: 'N2',
    desc: 'Busca paquetes por nombre o descripción dentro del repositorio.',
    example: '$ apt search forense\nsleuthkit/stable 4.12.0-1 amd64\n  The Sleuth Kit — análisis forense de sistemas de archivos' },
  { cmd: 'apt install', full: 'Instalar paquetes', icon: '📥', level: 'N2',
    desc: 'Instala paquetes resolviendo automáticamente sus dependencias.',
    example: '$ apt install nmap -y\nSe instalarán los siguientes paquetes adicionales:\n  lua5.4\nDesempaquetando nmap (7.94-1) ...\n✔ 2 paquete(s) instalado(s).' },
  { cmd: 'apt remove', full: 'Desinstalar paquetes', icon: '🗑️', level: 'N3',
    desc: 'Elimina paquetes. Con "purge" borra también sus ficheros de configuración.',
    example: '$ apt remove nmap\nSe ELIMINARÁN los siguientes paquetes:\n  nmap\nSe liberarán 23.5 MB de espacio.' },
  { cmd: 'dpkg -l', full: 'Debian Package', icon: '📋', level: 'N3',
    desc: 'Lista los paquetes instalados a bajo nivel, sin pasar por el resolutor de apt.',
    example: '$ dpkg -l\nii  nmap   7.94-1   amd64   Escáner de red\nii  curl   8.5.0-2  amd64   Transferencia por URL' },
  { cmd: 'dpkg -L', full: 'Listar ficheros', icon: '📂', level: 'N3',
    desc: 'Muestra todos los ficheros que instaló un paquete concreto.',
    example: '$ dpkg -L nmap\n/usr/bin/nmap\n/usr/bin/ncat\n/usr/bin/nping' },
];

const FHS = [
  { path: '/',      desc: 'Raíz del sistema de archivos' },
  { path: '/home',  desc: 'Directorios personales de los usuarios' },
  { path: '/etc',   desc: 'Archivos de configuración del sistema' },
  { path: '/var',   desc: 'Datos variables: registros (logs), colas' },
  { path: '/tmp',   desc: 'Archivos temporales, se limpian al reiniciar' },
  { path: '/bin',   desc: 'Binarios esenciales para todos los usuarios' },
  { path: '/usr',   desc: 'Programas y datos de sólo lectura del usuario' },
  { path: '/dev',   desc: 'Archivos de dispositivo (discos, terminales)' },
];

export default function LessonsView({ onStartPractice }: LessonsViewProps) {
  const [filter, setFilter] = useState<'todos' | 'N1' | 'N2' | 'N3'>('todos');
  const [open, setOpen] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const shown = filter === 'todos' ? LESSONS : LESSONS.filter((l) => l.level === filter);

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* Encabezado */}
        <div className="bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 flex flex-col md:flex-row md:items-center gap-5 fade-up">
          <div className="flex-1">
            <h2 className="text-xl font-extrabold text-white font-editorial mb-1.5">
              📚 Lecciones — Fundamentos de Linux
            </h2>
            <p className="text-sm text-[#94a3b8] font-body leading-relaxed max-w-2xl">
              Estudia la teoría de cada comando antes de practicarlo en la terminal.
              Cada tarjeta incluye la descripción y un ejemplo real de uso.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#6366f1]/15 text-[#818cf8] font-ui border border-[#6366f1]/25">
                ⏱️ ~20 min por bloque
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-ui border border-[#22c55e]/25">
                🛡️ Entorno 100% aislado
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#f97316]/15 text-[#f97316] font-ui border border-[#f97316]/25">
                📦 Incluye apt / dpkg
              </span>
            </div>
          </div>
          <button
            onClick={() => { playSound('click'); onStartPractice(); }}
            className="btn-mission px-6 py-3 rounded-2xl text-white font-bold font-ui text-sm smooth-transition shrink-0"
          >
            ⏻ Comenzar Práctica
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {(['todos', 'N1', 'N2', 'N3'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); playSound('click'); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold font-ui smooth-transition border ${
                filter === f
                  ? 'bg-[#7c3aed]/20 border-[#7c3aed]/45 text-white'
                  : 'bg-[#13161f] border-[#1f2430] text-[#94a3b8] hover:text-white'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'N1' ? 'N1 Básico' : f === 'N2' ? 'N2 Medio' : 'N3 Avanzado'}
            </button>
          ))}
        </div>

        {/* Tarjetas de comandos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((l, i) => (
            <div
              key={l.cmd}
              onClick={() => { setOpen(open === l.cmd ? null : l.cmd); playSound('click'); }}
              onMouseEnter={() => setHovered(l.cmd)}
              onMouseLeave={() => setHovered(null)}
              className="relative overflow-hidden bg-[#13161f] border border-[#1f2430] rounded-2xl p-5 hover:border-[#7c3aed]/35 smooth-transition cursor-pointer fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* ── Efecto temático de la mascota al pasar el cursor ── */}
              {hovered === l.cmd && lessonHoverFx(l.cmd) && (
                <div className="absolute inset-0 pointer-events-none z-10 fade-up">
                  {lessonHoverFx(l.cmd)!.fx === 'wipe' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                      style={{ animation: 'hud-load 1.1s ease-in-out infinite' }} />
                  )}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-[#0b0d14]/95 border border-[#7c3aed]/40 rounded-full px-2.5 py-1 shadow-lg">
                    <span className="text-xs animate-m-float">{lessonHoverFx(l.cmd)!.icon}</span>
                    <span className="text-[9px] text-[#a78bfa] font-ui whitespace-nowrap">
                      {lessonHoverFx(l.cmd)!.label}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{l.icon}</span>
                  <div>
                    <code className="text-[#818cf8] font-terminal font-bold text-sm">{l.cmd}</code>
                    <p className="text-[9px] text-[#475569] font-body">{l.full}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-ui ${
                  l.level === 'N1' ? 'bg-[#22c55e]/12 text-[#4ade80]'
                  : l.level === 'N2' ? 'bg-[#fbbf24]/12 text-[#fbbf24]'
                  : 'bg-[#f87171]/12 text-[#f87171]'
                }`}>
                  {l.level}
                </span>
              </div>

              <p className="text-xs text-[#94a3b8] font-body leading-relaxed mb-3">{l.desc}</p>

              <pre className={`bg-[#0d0f14] rounded-xl p-3 text-[10px] font-terminal text-[#94a3b8] leading-relaxed border border-[#1f2430] overflow-x-auto smooth-transition ${
                open === l.cmd ? 'max-h-64' : 'max-h-20 overflow-hidden'
              }`}>
                {l.example}
              </pre>

              <p className="text-[9px] text-[#475569] font-body mt-2 text-center">
                {open === l.cmd ? '▲ Contraer' : '▼ Ver ejemplo completo'}
              </p>
            </div>
          ))}
        </div>

        {/* FHS */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-6">
          <h3 className="text-base font-bold text-white font-ui mb-1.5">
            🗂️ FHS — Filesystem Hierarchy Standard
          </h3>
          <p className="text-xs text-[#94a3b8] font-body mb-4 max-w-3xl">
            La jerarquía estándar define dónde se guarda cada tipo de archivo en un sistema
            GNU/Linux. Conocerla te permite navegar cualquier distribución con confianza.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FHS.map((f) => (
              <div key={f.path} className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430]">
                <code className="text-[#818cf8] font-terminal text-xs font-bold">{f.path}</code>
                <p className="text-[10px] text-[#64748b] font-body mt-1 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Permisos */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-6">
          <h3 className="text-base font-bold text-white font-ui mb-1.5">🔐 Permisos de Archivos</h3>
          <p className="text-xs text-[#94a3b8] font-body mb-4 max-w-3xl">
            Cada archivo tiene tres grupos de permisos: propietario, grupo y otros.
            Cada grupo puede tener lectura (r), escritura (w) y ejecución (x).
          </p>
          <div className="bg-[#0e111a] rounded-xl p-4 border border-[#1f2430] font-terminal text-xs overflow-x-auto">
            <div className="text-[#94a3b8] whitespace-pre">
{`-rwxr-xr--   1 estudiante  estudiante  4096  tarea.sh
│└┬┘└┬┘└┬┘
│ │  │  └── otros:       r--  (solo lectura)
│ │  └───── grupo:       r-x  (lectura + ejecución)
│ └──────── propietario: rwx  (todos los permisos)
└────────── tipo:        -    (archivo)  |  d (directorio)`}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[
              { s: 'r', n: '4', d: 'Lectura',   c: '#22c55e' },
              { s: 'w', n: '2', d: 'Escritura', c: '#fbbf24' },
              { s: 'x', n: '1', d: 'Ejecución', c: '#f87171' },
            ].map((p) => (
              <div key={p.s} className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430] text-center">
                <div className="text-lg font-terminal font-bold" style={{ color: p.c }}>{p.s}</div>
                <div className="text-[10px] text-[#94a3b8] font-body">{p.d}</div>
                <div className="text-[9px] text-[#475569] font-terminal">valor {p.n}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

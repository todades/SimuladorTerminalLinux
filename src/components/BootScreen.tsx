// ============================================================
// 🖥️ BOOT SCREEN — Secuencia de encendido de la máquina virtual
// Simula el POST/BIOS y arranque del kernel dentro del monitor
// ============================================================

import { useEffect, useState } from 'react';
import { playSound } from '../utils/soundSynth';

interface BootScreenProps {
  studentName: string;
  onComplete: () => void;
}

const BOOT_LINES: { t: string; text: string; ok?: boolean }[] = [
  { t: '0.001', text: 'UPTA BIOS v4.2 — Universidad Politécnica Territorial de Aragua' },
  { t: '0.032', text: 'POST: Verificando memoria .......... 512 MB OK', ok: true },
  { t: '0.088', text: 'POST: Detectando CPU ............... Edu-Core x86_64', ok: true },
  { t: '0.141', text: 'Cargando gestor de arranque GRUB ...' },
  { t: '0.233', text: 'Kernel: UPTA GNU/Linux 5.15.0-lab (x86_64)' },
  { t: '0.319', text: 'Montando sistema de archivos virtual (VFS) ...', ok: true },
  { t: '0.402', text: 'Inicializando /dev, /proc, /sys ....... OK', ok: true },
  { t: '0.488', text: 'Red: eth0 enlace establecido — 1000 Mbps' },
  { t: '0.561', text: 'Servicio de progreso académico ........ ACTIVO', ok: true },
  { t: '0.647', text: 'Cargando entorno de prácticas ......... OK', ok: true },
  { t: '0.712', text: 'Iniciando sesión de estudiante ...' },
  { t: '0.845', text: '>>> ENTORNO LISTO — Bienvenido al laboratorio <<<', ok: true },
];

export default function BootScreen({ studentName, onComplete }: BootScreenProps) {
  const [visible, setVisible] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'power' | 'boot' | 'done'>('power');

  // Encendido
  useEffect(() => {
    playSound('boot');
    const t = setTimeout(() => setPhase('boot'), 850);
    return () => clearTimeout(t);
  }, []);

  // Líneas de arranque
  useEffect(() => {
    if (phase !== 'boot') return;
    if (visible >= BOOT_LINES.length) {
      const t = setTimeout(() => {
        setPhase('done');
        setTimeout(onComplete, 450);
      }, 550);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisible((v) => v + 1);
      setProgress(Math.round(((visible + 1) / BOOT_LINES.length) * 100));
      playSound('type');
    }, 130);
    return () => clearTimeout(t);
  }, [phase, visible, onComplete]);

  return (
    <div className={`w-full h-full bg-[#0d0f14] p-6 font-terminal overflow-hidden ${phase === 'power' ? 'power-on' : 'flicker'}`}>
      {phase !== 'power' && (
        <>
          {/* Encabezado */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🐧</span>
            <div>
              <p className="text-[#6366f1] text-sm font-bold">UPTA Terminal Lab</p>
              <p className="text-[#64748b] text-[10px]">Máquina Virtual Educativa · Sesión de {studentName}</p>
            </div>
          </div>

          {/* Log */}
          <div className="space-y-0.5 text-[11px] leading-relaxed">
            {BOOT_LINES.slice(0, visible).map((l, i) => (
              <div key={i} className="flex gap-3 fade-up">
                <span className="text-[#475569] shrink-0">[ {l.t} ]</span>
                <span className={l.ok ? 'text-[#22c55e]' : 'text-[#94a3b8]'}>{l.text}</span>
              </div>
            ))}
            {visible < BOOT_LINES.length && (
              <div className="flex gap-3">
                <span className="text-[#475569]">[ ..... ]</span>
                <span className="text-white cursor-blink">▊</span>
              </div>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="absolute bottom-10 left-6 right-6">
            <div className="flex justify-between text-[10px] text-[#64748b] mb-1.5">
              <span>Cargando entorno...</span>
              <span className="text-[#7c3aed] font-bold">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1f2430] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

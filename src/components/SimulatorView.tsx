// ============================================================
// 🖥️ SIMULADOR — Máquina virtual en pantalla completa
// Monitor físico + 3 columnas: Misión | Terminal | Explorador VFS
// Mascota con 3 estados: reposo · pista (30s inactivo/error) · éxito
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { MascotSpecies, MascotGender } from './Mascot';
import MascotCompanion from './MascotCompanion';
import {
  MascotState, IDLE_STATE, reactToCommand, restState,
  idleHintState, tabHintState, historyState, godModeState,
} from '../engine/mascotEngine';
import { playSound } from '../utils/soundSynth';
import {
  createTerminalState, executeCommand, getPrompt,
  TerminalLine, TerminalState,
} from '../engine/terminalEngine';
import {
  MissionLevel, MissionStep, checkStepCompletion, calculateProgress,
} from '../engine/progressEngine';
import { VFSNode, findNode } from '../engine/vfs';
import { logCommand, updateCurrentSession } from '../engine/authEngine';
import CommandSearch from './CommandSearch';

interface SimulatorViewProps {
  studentName: string;
  studentEmail: string;
  mascotSpecies: MascotSpecies;
  mascotGender: MascotGender;
  levels: MissionLevel[];
  /** Etiqueta de acceso privilegiado a mostrar en la barra de la VM */
  accessLabel?: string | null;
  onLevelsChange: (l: MissionLevel[]) => void;
  onCommandRun: () => void;
  onExit: () => void;
  onReset: () => void;
}

// ─── Color semántico por tipo de línea ─────────────────
function lineClass(l: TerminalLine): string {
  switch (l.type) {
    case 'input':   return 'text-[#22c55e]';
    case 'error':   return 'text-[#f87171]';
    case 'info':    return 'text-[#6366f1]';
    case 'success': return 'text-[#4ade80]';
    case 'warning': return 'text-[#fbbf24]';
    default:        return 'text-[#cbd5e1]';
  }
}

// ─── Persistencia de la máquina virtual entre encendidos ──
// Sin esto, apagar y volver a encender recreaba el VFS desde cero y los
// archivos creados en misiones anteriores desaparecían.
interface MachineSnapshot {
  state: TerminalState;
  lines: TerminalLine[];
  prompt: string;
}
let machineCache: MachineSnapshot | null = null;

export function resetMachineCache(): void {
  machineCache = null;
}

// ─── Paso activo: primer no-completado del primer nivel desbloqueado ──
function getNextStep(levels: MissionLevel[]): MissionStep | null {
  for (const lvl of levels) {
    if (!lvl.unlocked) continue;
    const pending = lvl.steps.find((s) => !s.completed);
    if (pending) return pending;
  }
  return null;
}

export default function SimulatorView({
  studentName, studentEmail, mascotSpecies, mascotGender,
  levels, accessLabel, onLevelsChange, onCommandRun, onExit, onReset,
}: SimulatorViewProps) {
  const [termState, setTermState] = useState<TerminalState>(
    () => machineCache?.state ?? createTerminalState(studentName),
  );
  const [currentInput, setCurrentInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>(() => machineCache?.lines ?? []);
  const [prompt, setPrompt] = useState(
    () => machineCache?.prompt ?? getPrompt('/home/estudiante'),
  );
  const [histIdx, setHistIdx] = useState(-1);
  const [vfsTree, setVfsTree] = useState<string[]>([]);
  const [mascot, setMascot] = useState<MascotState>(IDLE_STATE);
  const screenRef = useRef<HTMLDivElement>(null);
  const ttlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabUsed = useRef(false);
  const [flashStep, setFlashStep] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = calculateProgress(levels);

  // ─── Aplica un estado con expiración automática ──────
  const applyMascot = useCallback((next: MascotState, fallback?: MascotState) => {
    if (ttlTimer.current) clearTimeout(ttlTimer.current);
    setMascot(next);
    if (next.ttl > 0) {
      ttlTimer.current = setTimeout(
        () => setMascot(fallback ?? IDLE_STATE),
        next.ttl,
      );
    }
  }, []);

  // ─── Estado reposo: concepto técnico del paso actual ──
  const setRestTip = useCallback((lvls: MissionLevel[]) => {
    const next = getNextStep(lvls);
    const msg = next
      ? (next.mascotRest || next.hint)
      : '¡Has completado todos los niveles! Eres un administrador Linux de élite. 🏆';
    if (ttlTimer.current) clearTimeout(ttlTimer.current);
    setMascot(restState(mascotSpecies, msg));
  }, [mascotSpecies]);

  useEffect(() => { inputRef.current?.focus(); setRestTip(levels); }, []); // eslint-disable-line

  // ─── Modo Dios: pose de superpoder permanente ───────
  useEffect(() => {
    if (accessLabel?.includes('Modo Dios')) {
      if (ttlTimer.current) clearTimeout(ttlTimer.current);
      setMascot(godModeState(mascotSpecies));
    }
  }, [accessLabel, mascotSpecies]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  // ─── Árbol VFS: solo lo que crea/modifica el estudiante ──
  const buildTree = useCallback((vfs: VFSNode) => {
    // ¿Este nodo o alguno de sus descendientes fue creado por el estudiante?
    const hasUserContent = (node: VFSNode): boolean => {
      if (node.userCreated) return true;
      if (node.children) {
        for (const [, child] of node.children) {
          if (hasUserContent(child)) return true;
        }
      }
      return false;
    };

    const out: string[] = [];
    const walk = (node: VFSNode, prefix: string) => {
      const entries = [...(node.children?.entries() || [])]
        .filter(([, child]) => hasUserContent(child))
        .sort(([a], [b]) => a.localeCompare(b));

      entries.forEach(([name, child], i) => {
        const last = i === entries.length - 1;
        const icon = child.type === 'directory' ? '📁' : '📄';
        out.push(`${prefix}${last ? '└─' : '├─'} ${icon} ${name}`);
        if (child.type === 'directory' && child.children) {
          walk(child, `${prefix}${last ? '   ' : '│  '}`);
        }
      });
    };

    if (hasUserContent(vfs)) {
      out.push('📂 /');
      walk(vfs, '');
    }
    setVfsTree(out);
  }, []);

  useEffect(() => { buildTree(termState.vfs); }, [termState, buildTree]);

  // Guardar el estado de la máquina para que sobreviva al apagado
  useEffect(() => {
    machineCache = { state: termState, lines, prompt };
  }, [termState, lines, prompt]);

  // ─── Temporizador de inactividad (30s → pista) ─────
  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      const next = getNextStep(levels);
      if (next && !next.completed) {
        applyMascot(
          idleHintState(mascotSpecies,
            `Llevas un rato sin escribir… Pista: ${next.mascotTip || next.hint}`),
        );
      }
    }, 30000);
  }, [levels, mascotSpecies, applyMascot]);

  useEffect(() => { resetIdleTimer(); }, [currentInput, lines, resetIdleTimer]);
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  // ─── Ejecutar comando ───────────────────────────────
  const runCommand = useCallback(() => {
    const trimmed = currentInput.trim();
    if (!trimmed) return;
    playSound('enter');
    onCommandRun();

    const result = executeCommand(termState, trimmed);
    const isClear = result.output.length === 1 && result.output[0].content === '__CLEAR__';
    // Usa la bandera real del intérprete. `grep "ERROR"` colorea sus
    // resultados en rojo pero es una ejecución correcta.
    const commandSucceeded = !result.failed;

    if (isClear) setLines([]);
    else setLines((p) => [...p, { type: 'input' as const, content: `${prompt}${trimmed}` }, ...result.output]);

    const next: TerminalState = {
      ...termState,
      cwd: result.newCwd,
      vfs: result.newVfs,
      services: result.services,
      killedPids: result.killedPids,
      commandHistory: [...termState.commandHistory, trimmed],
    };
    setTermState(next);
    setPrompt(getPrompt(result.newCwd));
    setHistIdx(-1);

    const cloned = levels.map((l) => ({ ...l, steps: l.steps.map((s) => ({ ...s })) }));
    // Una misión solo se aprueba si el parser ejecutó el comando sin errores.
    // Esto evita marcar pasos como completos cuando una ruta o bandera falla.
    const { stepCompleted, levels: updated } = commandSucceeded
      ? checkStepCompletion(cloned, trimmed)
      : { stepCompleted: null, levels: cloned };

    // ─── Telemetría pedagógica ──────────────────────
    logCommand({
      email: studentEmail,
      command: trimmed,
      success: commandSucceeded,
      stepCompleted: stepCompleted?.id ?? null,
      timestamp: Date.now(),
    });
    updateCurrentSession(studentEmail, {
      commands: 1,
      errors: commandSucceeded ? 0 : 1,
      steps: stepCompleted ? 1 : 0,
    });

    if (stepCompleted) {
      onLevelsChange(updated);
      setFlashStep(stepCompleted.id);
      setTimeout(() => setFlashStep(null), 2000);
    }

    // ─── Reacción contextual de la mascota ──────────
    const pending = getNextStep(levels);
    const reaction = reactToCommand({
      species: mascotSpecies,
      command: trimmed,
      failed: result.failed,
      stepCompleted: Boolean(stepCompleted),
      successMessage: stepCompleted?.mascotSuccess,
      hintMessage: pending
        ? `Ese comando no funcionó. Pista: ${pending.mascotTip || pending.hint}`
        : undefined,
    });

    // Sonido acorde al estado resultante
    if (reaction.hud === 'alert') playSound('error');
    else if (stepCompleted) playSound('success');
    else if (result.failed) playSound('error');

    // Tras el TTL vuelve al concepto del siguiente paso
    const nextStep = getNextStep(stepCompleted ? updated : levels);
    applyMascot(
      reaction,
      restState(mascotSpecies, nextStep?.mascotRest || nextStep?.hint),
    );

    setCurrentInput('');
    buildTree(next.vfs);
  }, [currentInput, termState, prompt, levels, onLevelsChange, onCommandRun,
      buildTree, mascotSpecies, applyMascot, studentEmail]);

  // ─── Teclado ────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); runCommand(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const h = termState.commandHistory;
      if (!h.length) return;
      const i = histIdx < h.length - 1 ? histIdx + 1 : histIdx;
      setHistIdx(i); setCurrentInput(h[h.length - 1 - i] || '');
      // Animación de rebobinado
      applyMascot(historyState(mascotSpecies), restState(mascotSpecies, mascot.message));
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const h = termState.commandHistory;
      const i = histIdx > 0 ? histIdx - 1 : -1;
      setHistIdx(i); setCurrentInput(i === -1 ? '' : h[h.length - 1 - i] || '');
      applyMascot(historyState(mascotSpecies), restState(mascotSpecies, mascot.message));
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const parts = currentInput.split(/\s+/);
      const last = parts[parts.length - 1] || '';
      const node = findNode(termState.vfs, termState.cwd);
      if (node?.children) {
        const pre = last.includes('/') ? last.split('/').pop() || '' : last;
        const m: string[] = [];
        for (const [n] of node.children) if (n.startsWith(pre)) m.push(n);
        if (m.length === 1) {
          parts[parts.length - 1] = last.includes('/')
            ? last.split('/').slice(0, -1).join('/') + '/' + m[0] : m[0];
          setCurrentInput(parts.join(' '));
        }
      }
      tabUsed.current = true;
      return;
    }
    if (e.key === 'Backspace') playSound('delete');
    else if (e.key.length === 1) {
      playSound('type');
      // Si teclea una ruta larga sin usar TAB, recordárselo
      if (!tabUsed.current && currentInput.length === 14) {
        applyMascot(tabHintState(mascotSpecies), restState(mascotSpecies, mascot.message));
      }
    }
  };

  // Atajo Ctrl/Cmd + K dentro de la máquina virtual
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleResetLevel = () => {
    machineCache = null;
    const fresh = createTerminalState(studentName);
    setTermState(fresh); setLines([]); setCurrentInput('');
    setPrompt(getPrompt(fresh.cwd));
    onReset();
    tabUsed.current = false;
    applyMascot(restState(mascotSpecies,
      'Nivel reiniciado. ¡Tómate tu tiempo para practicar!'));
    buildTree(fresh.vfs);
  };

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-[#07080c] flex items-center justify-center p-3 sm:p-6">
      <div className="monitor-frame w-full h-full max-w-[1500px]">
        <div ref={screenRef} className="monitor-screen crt-overlay power-on relative">
          <div className="w-full h-full flex flex-col">

            {/* ─── Barra del sistema virtual ──────── */}
            <div className="h-9 bg-[#0e111a] border-b border-[#1f2430] flex items-center justify-between px-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs">🐧</span>
                <span className="text-[11px] text-[#94a3b8] font-ui font-medium">
                  UPTA GNU/Linux — Máquina Virtual
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#22c55e]/15 text-[#4ade80] font-ui">
                  EN LÍNEA
                </span>
                {accessLabel && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#f97316]/15 text-[#f97316] font-ui border border-[#f97316]/30">
                    {accessLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748b] font-terminal hidden sm:block">
                  {studentName}@upta
                </span>
                <button
                  onClick={() => { playSound('click'); setSearchOpen(true); }}
                  title="Buscar comandos y archivos (Ctrl + K)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#13161f] border border-[#1f2430] text-[10px] text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/40 smooth-transition font-ui"
                >
                  🔍 <kbd className="hidden md:inline font-terminal text-[9px]">⌘K</kbd>
                </button>
                <button
                  onClick={() => { playSound('click'); onExit(); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#13161f] border border-[#1f2430] text-[10px] text-[#94a3b8] hover:text-white hover:border-[#f87171]/40 smooth-transition font-ui"
                >
                  ⏻ Apagar
                </button>
              </div>
            </div>

            {/* ─── 3 columnas ─────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

              {/* IZQUIERDA: Misiones */}
              <div className="w-60 lg:w-72 shrink-0 bg-[#0e111a] border-r border-[#1f2430] flex flex-col">
                <div className="p-3 border-b border-[#1f2430]">
                  <h3 className="text-xs font-bold text-white font-ui">🎯 Panel de Misión</h3>
                  <div className="flex justify-between items-center mt-2 mb-1">
                    <span className="text-[9px] text-[#64748b] font-body uppercase tracking-wider">Progreso</span>
                    <span className="text-[10px] font-bold text-[#7c3aed] font-terminal">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1f2430] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#6366f1] progress-shimmer smooth-transition"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5">
                  {levels.filter((l) => l.unlocked).map((lvl) => (
                    <div key={lvl.id} className="mb-3">
                      <h4 className={`text-[10px] font-bold font-ui mb-1.5 px-1 ${lvl.completed ? 'text-[#22c55e]' : 'text-white'}`}>
                        {lvl.completed ? '✅ ' : '▶ '}{lvl.name}
                      </h4>
                      <div className="space-y-1">
                        {lvl.steps.map((s) => (
                          <div
                            key={s.id}
                            className={`w-full text-left flex items-start gap-1.5 px-2 py-1.5 rounded-lg smooth-transition border ${
                              flashStep === s.id
                                ? 'bg-[#22c55e]/15 border-[#22c55e]/40'
                                : s.completed
                                  ? 'bg-[#22c55e]/5 border-transparent'
                                  : 'border-transparent hover:bg-[#171a23]'
                            }`}
                          >
                            <span className={`text-[10px] shrink-0 mt-px ${s.completed ? 'text-[#22c55e]' : 'text-[#475569]'}`}>
                              {s.completed ? '✅' : '○'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <code className={`cmd-wrap text-[10px] font-terminal ${
                                s.completed ? 'text-[#22c55e]/60 line-through' : 'text-[#818cf8]'
                              }`}>
                                {s.command}
                              </code>
                              <p className="text-[9px] text-[#64748b] font-body leading-tight mt-0.5">
                                {s.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 border-t border-[#1f2430]">
                  <button
                    onClick={handleResetLevel}
                    className="w-full py-2 rounded-xl bg-[#13161f] border border-[#1f2430] text-[10px] font-medium text-[#94a3b8] hover:text-white hover:border-[#7c3aed]/40 smooth-transition font-ui"
                  >
                    🔄 Reiniciar Nivel
                  </button>
                </div>
              </div>

              {/* CENTRO: Terminal */}
              <div className="flex-1 flex flex-col min-w-0">
                <div
                  ref={scrollRef}
                  className="terminal-surface flex-1 bg-[#0d0f14] p-3.5 overflow-y-auto font-terminal text-[13px]"
                  onClick={() => inputRef.current?.focus()}
                >
                  {lines.length === 0 && (
                    <div className="mb-3 text-[#6366f1] text-[11px] leading-relaxed">
                      <div>╔═══════════════════════════════════════════╗</div>
                      <div>║   🐧  UPTA Terminal Lab · Simulador       ║</div>
                      <div>║   Usuario: {studentName.slice(0, 24).padEnd(24)}   ║</div>
                      <div>║   Escribe "help" para ver los comandos    ║</div>
                      <div>╚═══════════════════════════════════════════╝</div>
                    </div>
                  )}

                  {lines.map((l, i) => (
                    <div key={i} className={`leading-5 whitespace-pre-wrap break-words ${lineClass(l)}`}>
                      {l.content}
                    </div>
                  ))}

                  <div className="flex items-center mt-0.5">
                    <span className="text-[#22c55e] whitespace-pre shrink-0">{prompt}</span>
                    <input
                      ref={inputRef}
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={onKeyDown}
                      className="flex-1 bg-transparent text-white outline-none border-none font-terminal text-[13px] caret-[#7c3aed]"
                      spellCheck={false}
                      autoComplete="off"
                      aria-label="Entrada de terminal"
                    />
                  </div>
                </div>

                {/* Barra de estado */}
                <div className="h-6 bg-[#0e111a] border-t border-[#1f2430] flex items-center px-3 text-[9px] text-[#64748b] font-terminal gap-3 shrink-0">
                  <span>VFS 512 MB</span><span>|</span>
                  <span className="truncate">CWD: {termState.cwd}</span><span>|</span>
                  <span>TAB autocompleta · ↑↓ historial · | pipes · &gt; &gt;&gt; redirección</span>
                  <span className="ml-auto hidden sm:block">bash 5.1</span>
                </div>
              </div>

              {/* DERECHA: Explorador VFS + mascota ─── */}
              <div className="w-52 lg:w-60 shrink-0 bg-[#0e111a] border-l border-[#1f2430] flex flex-col">
                <div className="p-3 border-b border-[#1f2430]">
                  <h3 className="text-xs font-bold text-white font-ui">📁 Explorador VFS</h3>
                  <p className="text-[9px] text-[#64748b] font-body mt-0.5">Tus creaciones</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5">
                  {vfsTree.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-2 gap-2">
                      <span className="text-2xl opacity-40">📂</span>
                      <p className="text-[10px] text-[#64748b] font-body leading-snug">
                        Aún no has creado nada.
                      </p>
                      <p className="text-[9px] text-[#475569] font-body leading-snug">
                        Usa <code className="text-[#818cf8] font-terminal">mkdir</code>,{' '}
                        <code className="text-[#818cf8] font-terminal">touch</code> o{' '}
                        <code className="text-[#818cf8] font-terminal">cp</code> y aparecerá aquí.
                      </p>
                    </div>
                  ) : (
                    <pre className="text-[10px] font-terminal text-[#94a3b8] leading-relaxed whitespace-pre">
                      {vfsTree.join('\n')}
                    </pre>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* 🐾 Asistente vivo: flotante, arrastrable y con subtítulos grandes */}
          <MascotCompanion
            species={mascotSpecies}
            gender={mascotGender}
            state={mascot}
            progress={progress}
            boundsRef={screenRef}
          />
        </div>

        {/* LED del monitor */}
        <div className="monitor-led">
          <span className="led-dot" />
          <span className="text-[9px] text-[#475569] font-ui tracking-[0.25em]">UPTA LAB</span>
        </div>
      </div>

      {/* Buscador global dentro de la VM */}
      <CommandSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        levels={levels}
        vfs={termState.vfs}
        onInsertCommand={(cmd) => {
          setCurrentInput(cmd);
          applyMascot(restState(mascotSpecies,
            'Comando insertado desde el buscador. Revísalo y presiona Enter para ejecutarlo.'));
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
      />
    </div>
  );
}

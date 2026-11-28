// ============================================================
// 🔐 ACCESO — Iniciar Sesión / Crear Cuenta
// Validación estricta con base de datos real + sincronización Neon
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import Mascot, { MascotSpecies, MascotGender, MASCOT_INFO } from './Mascot';
import { playSound, initAudio } from '../utils/soundSynth';
import {
  loginUser, registerUser, RegisteredUser, DEMO_CREDENTIALS, ROLE_META,
  getTeachersByTrayecto, TRAYECTOS,
  isValidPhone, getPhoneOperator, PHONE_PREFIXES, PHONE_HINT,
} from '../engine/authEngine';
import { api, ApiSection } from '../services/api';

export interface RegisterPayload {
  nombre: string;
  apellido: string;
  email: string;
  cedula: string;
  trayecto: string;
  sectionId: number | null;
  genero: string;
  telefono: string;
  mascotSpecies: MascotSpecies;
  mascotGender: MascotGender;
  teacherEmail: string;
}

interface AuthPageProps {
  onAuthSuccess: (user: RegisteredUser) => void;
}

type RequestedRole = 'estudiante' | 'profesor';

const EMPTY: RegisterPayload = {
  nombre: '', apellido: '', email: '', cedula: '',
  trayecto: 'Trayecto I', sectionId: null, genero: 'masculino', telefono: '',
  mascotSpecies: 'pinguino', mascotGender: 'masculino',
  teacherEmail: '',
};

const BOOT_LOG = [
  { t: '0.02s', text: 'BIOS: Verificando integridad del sistema...' },
  { t: '0.14s', text: 'Kernel: UPTA GNU/Linux 5.15.0-lab cargado' },
  { t: '0.38s', text: 'VFS: Sistema de Archivos Virtual (512 MB) listo' },
  { t: '0.51s', text: 'Red: eth0 activo — 1000 Mbps Full Duplex' },
  { t: '0.67s', text: 'SSHD: Servicio remoto iniciado en puerto 22' },
  { t: '0.82s', text: 'Servidor educativo UPTA en línea' },
  { t: '0.95s', text: 'Base de datos de progreso conectada' },
  { t: '1.10s', text: '🐧 Mascota guía cargada y lista' },
  { t: '1.25s', text: '>>> SISTEMA LISTO — Bienvenido al laboratorio <<<' },
];

const SPECIES: MascotSpecies[] = ['pinguino', 'zorro', 'buho', 'dragon'];

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showPwd, setShowPwd] = useState(false);
  const [bootPhase, setBootPhase] = useState(0);

  // Secciones desde la API / Neon
  const [sections, setSections] = useState<ApiSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Register
  const [form, setForm] = useState<RegisterPayload>(EMPTY);
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [regGeneralErr, setRegGeneralErr] = useState('');
  const [reqRole, setReqRole] = useState<RequestedRole>('estudiante');
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const isTeacherReq = reqRole === 'profesor';

  useEffect(() => {
    initAudio();
    const i = setInterval(() => setBootPhase((p) => (p < BOOT_LOG.length ? p + 1 : p)), 190);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingSections(true);
    api.getSections()
      .then((rows) => {
        if (active) setSections(rows || []);
      })
      .catch(() => {
        if (active) setSections([]);
      })
      .finally(() => {
        if (active) setLoadingSections(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const availableSections = useMemo(
    () => sections.filter((s) => !form.trayecto || s.trayecto === form.trayecto),
    [sections, form.trayecto],
  );

  // Preseleccionar la primera sección disponible si aún no hay una válida para el trayecto
  useEffect(() => {
    if (availableSections.length === 0) {
      if (form.sectionId !== null) {
        setForm((p) => ({ ...p, sectionId: null }));
      }
      return;
    }
    const stillValid = availableSections.some((s) => s.id === form.sectionId);
    if (!stillValid) {
      setForm((p) => ({ ...p, sectionId: availableSections[0].id }));
    }
  }, [availableSections, form.sectionId]);

  // ─── Validadores ────────────────────────────────────
  const vEmail  = (v: string) => /^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(v.trim());
  const vCedula = (v: string) => /^\d{8}$/.test(v);
  const vTel    = (v: string) => isValidPhone(v);
  const vName   = (v: string) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{1,60}$/.test(v);
  const vPass   = (v: string) =>
    v.length >= 12 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v);

  // Docentes disponibles para el Trayecto seleccionado
  const availableTeachers = useMemo(
    () => getTeachersByTrayecto(form.trayecto),
    [form.trayecto],
  );

  useEffect(() => {
    if (!form.teacherEmail && availableTeachers.length > 0) {
      setForm((p) => ({ ...p, teacherEmail: availableTeachers[0].email }));
    }
  }, [availableTeachers, form.teacherEmail]);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (!vName(form.nombre))    e.nombre   = 'Solo letras y espacios (máx 60).';
    if (!vName(form.apellido))  e.apellido = 'Solo letras y espacios (máx 60).';
    if (!vEmail(form.email))    e.email    = 'El correo debe ser una cuenta Gmail válida (ejemplo@gmail.com).';
    if (!vCedula(form.cedula))  e.cedula   = 'La cédula debe tener exactamente 8 dígitos.';
    if (!vTel(form.telefono))   e.telefono = PHONE_HINT;
    if (!vPass(password))       e.password = 'Mín 12 caracteres: mayúscula, minúscula, número y símbolo.';
    if (!isTeacherReq && availableSections.length > 0 && !form.sectionId) {
      e.sectionId = 'Debes seleccionar una sección.';
    }
    if (!isTeacherReq && availableTeachers.length > 0 && !form.teacherEmail) {
      e.teacherEmail = 'Debes seleccionar tu docente titular.';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  }, [form, password, availableSections, availableTeachers, isTeacherReq]);

  // ─── LOGIN SUBMIT ───
  const submitLogin = (ev: React.FormEvent) => {
    ev.preventDefault();
    setLoginErr('');
    if (!loginEmail.trim() || !loginPwd) {
      setLoginErr('Por favor ingresa tu correo electrónico y contraseña.');
      playSound('error');
      return;
    }

    const res = loginUser(loginEmail, loginPwd);
    if (!res.success) {
      setLoginErr(res.error || 'Correo o contraseña incorrectos.');
      playSound('error');
      return;
    }

    playSound('boot');
    onAuthSuccess(res.user!);
  };

  // ─── REGISTER SUBMIT ───
  const submitRegister = (ev: React.FormEvent) => {
    ev.preventDefault();
    setRegGeneralErr('');
    if (!validate()) {
      playSound('error');
      return;
    }

    const res = registerUser({
      ...form,
      sectionId: form.sectionId,
      password,
      requestedRole: reqRole,
    } as Parameters<typeof registerUser>[0] & { sectionId?: number | null });

    if (!res.success) {
      setRegGeneralErr(res.error || 'No se pudo crear la cuenta.');
      playSound('error');
      return;
    }

    if (reqRole === 'profesor') {
      playSound('success');
      setPendingNotice(form.email);
      return;
    }

    playSound('boot');
    onAuthSuccess(res.user!);
  };

  const set = (k: keyof RegisterPayload, v: string | number | null) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrs((p) => { const n = { ...p }; delete n[k as string]; return n; });
    setRegGeneralErr('');
  };

  const okOf = (k: keyof RegisterPayload | 'password'): boolean | null => {
    const val = k === 'password' ? password : (form[k] as unknown as string);
    if (!val) return null;
    switch (k) {
      case 'nombre': case 'apellido': return vName(val);
      case 'email':    return vEmail(val);
      case 'cedula':   return vCedula(val);
      case 'telefono': return vTel(val);
      case 'password': return vPass(val);
      default: return null;
    }
  };

  const mark = (k: keyof RegisterPayload | 'password') => {
    const ok = okOf(k);
    if (ok === null) return { icon: '', cls: '' };
    return ok
      ? { icon: '✓', cls: 'text-[#22c55e]' }
      : { icon: '✗', cls: 'text-[#f87171]' };
  };

  const borderOf = (k: keyof RegisterPayload | 'password') => {
    if (errs[k]) return 'border-[#f87171]';
    if (okOf(k) === true) return 'border-[#22c55e]';
    return 'border-[#1f2430] focus:border-[#7c3aed]';
  };

  const baseInput = 'w-full bg-[#13161f] border rounded-xl px-4 py-2.5 text-white text-sm font-body placeholder:text-[#475569] focus:outline-none smooth-transition';

  return (
    <div className="min-h-screen bg-[#0d0f14] flex halo-both">

      {/* ─── IZQUIERDA: Formulario ────────────────── */}
      <div className="w-full lg:w-[500px] shrink-0 flex flex-col p-6 lg:p-9 overflow-y-auto max-h-screen">

        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#f97316] flex items-center justify-center shadow-lg shadow-[#7c3aed]/25">
            <span className="text-xl">🐧</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white font-ui leading-tight">Simulador Linux</h1>
            <p className="text-[10px] text-[#64748b] font-body tracking-wide">UPTA · Terminal Lab</p>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex bg-[#13161f] rounded-2xl p-1 mb-6 border border-[#1f2430]">
          {([['login', 'Iniciar Sesión'], ['register', 'Crear Cuenta']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setLoginErr(''); setRegGeneralErr(''); playSound('click'); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold font-ui smooth-transition ${
                tab === k ? 'bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/25' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <form onSubmit={submitLogin} className="space-y-4 fade-up">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5 font-body">Correo Electrónico</label>
              <input
                type="email" value={loginEmail} onChange={(e) => { setLoginEmail(e.target.value); setLoginErr(''); }}
                className={`${baseInput} border-[#1f2430] focus:border-[#7c3aed]`}
                placeholder="tucorreo@gmail.com" required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5 font-body">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={loginPwd} onChange={(e) => { setLoginPwd(e.target.value); setLoginErr(''); }}
                  className={`${baseInput} border-[#1f2430] focus:border-[#7c3aed] pr-12`}
                  placeholder="Mínimo 12 caracteres" required
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white smooth-transition">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {loginErr && (
              <div className="bg-[#f87171]/15 border border-[#f87171]/40 rounded-xl p-3.5 flex items-start gap-2.5">
                <span className="text-[#f87171] text-base shrink-0">⚠️</span>
                <p className="text-xs text-[#f87171] font-body font-medium leading-snug">{loginErr}</p>
              </div>
            )}

            <button type="submit" className="w-full btn-mission py-3 rounded-xl text-white font-semibold font-ui text-sm smooth-transition shadow-lg">
              Entrar al Laboratorio
            </button>

            <div className="mt-5 bg-[#0e111a] border border-[#1f2430] rounded-2xl p-4">
              <span className="text-[11px] font-bold text-[#a78bfa] font-ui block mb-2">
                💡 Cuentas de Demostración por Rol
              </span>
              <p className="text-[10px] text-[#94a3b8] font-body leading-relaxed mb-3">
                Pulsa una tarjeta para autocompletar las credenciales:
              </p>
              <div className="space-y-2">
                {DEMO_CREDENTIALS.map((c) => {
                  const m = ROLE_META[c.role];
                  return (
                    <button
                      key={c.role}
                      type="button"
                      onClick={() => {
                        setLoginEmail(c.email);
                        setLoginPwd(c.password);
                        setLoginErr('');
                        playSound('click');
                      }}
                      className="w-full text-left bg-[#13161f] hover:bg-[#171a23] rounded-xl p-2.5 border border-[#1f2430] hover:border-[#7c3aed]/40 smooth-transition"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{m.icon}</span>
                        <span className="text-[11px] font-bold font-ui" style={{ color: m.color }}>
                          {m.label}
                        </span>
                      </div>
                      <div className="font-terminal text-[10px] space-y-0.5 pl-6">
                        <div className="flex justify-between gap-2">
                          <span className="text-[#64748b]">Correo:</span>
                          <span className="text-white truncate">{c.email}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#64748b]">Clave:</span>
                          <span className="text-[#22c55e]">{c.password}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        )}

        {/* ── REGISTRO: AVISO PENDIENTE DOCENTE ── */}
        {tab === 'register' && pendingNotice && (
          <div className="fade-up space-y-4">
            <div className="bg-[#fbbf24]/10 border-2 border-[#fbbf24]/40 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">⏳</div>
              <h3 className="text-base font-bold text-[#fbbf24] font-ui mb-2">
                Solicitud enviada al administrador
              </h3>
              <p className="text-sm text-[#94a3b8] font-body leading-relaxed">
                Tu cuenta docente fue registrada con el correo{' '}
                <strong className="text-white">{pendingNotice}</strong> y está{' '}
                <strong className="text-[#fbbf24]">pendiente de autorización</strong>.
              </p>
              <p className="text-xs text-[#64748b] font-body mt-3 leading-relaxed">
                El SuperAdministrador revisará tu solicitud y te asignará una sección/trayecto.
                Podrás iniciar sesión en cuanto sea aprobada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingNotice(null);
                setTab('login');
                setForm(EMPTY);
                setPassword('');
                setReqRole('estudiante');
                playSound('click');
              }}
              className="w-full btn-mission py-3 rounded-xl text-white font-semibold font-ui text-sm smooth-transition"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* ── REGISTRO ── */}
        {tab === 'register' && !pendingNotice && (
          <form onSubmit={submitRegister} className="space-y-3 fade-up">
            <div>
              <label className="block text-[11px] text-[#94a3b8] mb-1.5 font-body">
                Tipo de cuenta
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { k: 'estudiante' as RequestedRole, icon: '🎓', label: 'Estudiante', sub: 'Acceso inmediato' },
                  { k: 'profesor' as RequestedRole,   icon: '👨‍🏫', label: 'Docente',   sub: 'Requiere aprobación' },
                ]).map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => {
                      setReqRole(o.k);
                      setErrs({});
                      setRegGeneralErr('');
                      playSound('click');
                    }}
                    className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl smooth-transition border ${
                      reqRole === o.k
                        ? 'bg-[#7c3aed]/20 border-[#7c3aed]/45'
                        : 'bg-[#13161f] border-[#1f2430] hover:border-[#7c3aed]/30'
                    }`}
                  >
                    <span className="text-lg">{o.icon}</span>
                    <span className={`text-[11px] font-semibold font-ui ${
                      reqRole === o.k ? 'text-white' : 'text-[#94a3b8]'
                    }`}>
                      {o.label}
                    </span>
                    <span className="text-[8px] text-[#64748b] font-body">{o.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {isTeacherReq && (
              <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-[#fbbf24] font-body leading-snug">
                  ⏳ Las cuentas docentes requieren <strong>autorización del
                  administrador</strong>. Tu solicitud quedará pendiente hasta ser aprobada.
                </p>
              </div>
            )}

            {regGeneralErr && (
              <div className="bg-[#f87171]/15 border border-[#f87171]/40 rounded-xl p-3 flex items-start gap-2.5 mb-2">
                <span className="text-[#f87171] text-base shrink-0">⚠️</span>
                <p className="text-xs text-[#f87171] font-body font-medium leading-snug">{regGeneralErr}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(['nombre', 'apellido'] as const).map((k) => (
                <div key={k}>
                  <label className="block text-[11px] text-[#94a3b8] mb-1 font-body capitalize">{k}</label>
                  <div className="relative">
                    <input
                      value={form[k]} onChange={(e) => set(k, e.target.value)}
                      className={`${baseInput} ${borderOf(k)} pr-8`} placeholder={`Tu ${k}`}
                    />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${mark(k).cls}`}>{mark(k).icon}</span>
                  </div>
                  {errs[k] && <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs[k]}</p>}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">Correo Electrónico</label>
              <div className="relative">
                <input
                  type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                  className={`${baseInput} ${borderOf('email')} pr-8`} placeholder="tucorreo@gmail.com"
                />
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${mark('email').cls}`}>{mark('email').icon}</span>
              </div>
              {errs.email && <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">Cédula (8 dígitos)</label>
                <div className="relative">
                  <input
                    value={form.cedula}
                    onChange={(e) => set('cedula', e.target.value.replace(/\D/g, '').slice(0, 8))}
                    maxLength={8}
                    className={`${baseInput} ${borderOf('cedula')} pr-8`} placeholder="12345678" inputMode="numeric"
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${mark('cedula').cls}`}>{mark('cedula').icon}</span>
                </div>
                {errs.cedula && <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.cedula}</p>}
              </div>
              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">
                  Teléfono
                  {getPhoneOperator(form.telefono) && isValidPhone(form.telefono) && (
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-ui">
                      {getPhoneOperator(form.telefono)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    value={form.telefono}
                    onChange={(e) => set('telefono', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    maxLength={11}
                    className={`${baseInput} ${borderOf('telefono')} pr-8`} placeholder="04120000000" inputMode="numeric"
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${mark('telefono').cls}`}>{mark('telefono').icon}</span>
                </div>

                <div className="flex gap-1 mt-1.5">
                  {PHONE_PREFIXES.map((p) => {
                    const sel = form.telefono.startsWith(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          set('telefono', p + form.telefono.replace(/\D/g, '').slice(4));
                          playSound('click');
                        }}
                        className={`flex-1 py-1 rounded-lg text-[9px] font-terminal smooth-transition border ${
                          sel
                            ? 'bg-[#7c3aed]/20 border-[#7c3aed]/45 text-white'
                            : 'bg-[#13161f] border-[#1f2430] text-[#64748b] hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                {errs.telefono
                  ? <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.telefono}</p>
                  : <p className="text-[9px] text-[#475569] mt-1 font-body">Ejemplo: 04120000000</p>}
              </div>
            </div>

            {/* Trayecto y Sección */}
            <div className={`grid gap-3 ${isTeacherReq ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {!isTeacherReq && (
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">Trayecto</label>
                  <select
                    value={form.trayecto}
                    onChange={(e) => {
                      const t = e.target.value;
                      const firstTeacher = getTeachersByTrayecto(t)[0]?.email ?? '';
                      const firstSec = sections.find((s) => s.trayecto === t)?.id ?? null;
                      setForm((p) => ({
                        ...p,
                        trayecto: t,
                        teacherEmail: firstTeacher,
                        sectionId: firstSec,
                      }));
                      setErrs((p) => {
                        const n = { ...p };
                        delete n.teacherEmail;
                        delete n.sectionId;
                        return n;
                      });
                    }}
                    className={`${baseInput} border-[#1f2430] focus:border-[#7c3aed]`}
                  >
                    {TRAYECTOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">
                  Sección {isTeacherReq ? '(preferencia)' : ''}
                </label>
                {loadingSections ? (
                  <div className={`${baseInput} border-[#1f2430] text-[#64748b]`}>
                    Cargando secciones...
                  </div>
                ) : availableSections.length === 0 ? (
                  <div className={`${baseInput} border-[#1f2430] text-[#64748b]`}>
                    Sin secciones cargadas en BD
                  </div>
                ) : (
                  <select
                    value={form.sectionId ?? ''}
                    onChange={(e) =>
                      set('sectionId', e.target.value ? Number(e.target.value) : null)
                    }
                    className={`${baseInput} ${errs.sectionId ? 'border-[#f87171]' : 'border-[#1f2430] focus:border-[#7c3aed]'}`}
                  >
                    {availableSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} ({sec.trayecto})
                      </option>
                    ))}
                  </select>
                )}
                {errs.sectionId && (
                  <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.sectionId}</p>
                )}
              </div>
            </div>

            {/* Género y Docente titular */}
            <div className={`grid gap-3 ${isTeacherReq ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">Género</label>
                <div className="flex gap-2">
                  {['masculino', 'femenino'].map((g) => (
                    <button key={g} type="button" onClick={() => set('genero', g)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-medium font-ui smooth-transition ${
                        form.genero === g ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/40 text-white'
                                          : 'bg-[#13161f] border border-[#1f2430] text-[#94a3b8]'
                      }`}>
                      {g === 'masculino' ? '♂ Masculino' : '♀ Femenino'}
                    </button>
                  ))}
                </div>
              </div>

              {!isTeacherReq && (
                <div>
                  <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">
                    Docente titular
                  </label>
                  {availableTeachers.length === 0 ? (
                    <div className="bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-[#fbbf24] font-body">
                        ⚠️ Sin docente asignado en {form.trayecto}.
                      </p>
                    </div>
                  ) : (
                    <select
                      value={form.teacherEmail}
                      onChange={(e) => set('teacherEmail', e.target.value)}
                      className={`${baseInput} ${errs.teacherEmail ? 'border-[#f87171]' : 'border-[#1f2430] focus:border-[#7c3aed]'}`}
                    >
                      <option value="">— Selecciona tu docente —</option>
                      {availableTeachers.map((t) => (
                        <option key={t.email} value={t.email}>
                          {t.nombre} {t.apellido}
                        </option>
                      ))}
                    </select>
                  )}
                  {errs.teacherEmail && (
                    <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.teacherEmail}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-[#94a3b8] mb-1 font-body">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrs((p) => { const n = { ...p }; delete n.password; return n; });
                    setRegGeneralErr('');
                  }}
                  className={`${baseInput} ${borderOf('password')} pr-16`}
                  placeholder="Mín 12 caracteres con símbolos y números"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-9 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white smooth-transition">
                  {showPwd ? '🙈' : '👁️'}
                </button>
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold ${mark('password').cls}`}>{mark('password').icon}</span>
              </div>
              {errs.password && <p className="text-[10px] text-[#f87171] mt-1 font-body">{errs.password}</p>}
            </div>

            {/* Mascota */}
            <div>
              <label className="block text-[11px] text-[#94a3b8] mb-1.5 font-body">Elige tu Mascota Guía</label>
              <div className="grid grid-cols-4 gap-2">
                {SPECIES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => { set('mascotSpecies', s); playSound('click'); }}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl smooth-transition ${
                      form.mascotSpecies === s ? 'bg-[#7c3aed]/20 border border-[#7c3aed]/40'
                                               : 'bg-[#13161f] border border-[#1f2430] hover:border-[#7c3aed]/30'
                    }`}>
                    <span className="text-lg">{MASCOT_INFO[s].emoji}</span>
                    <span className="text-[9px] text-[#94a3b8] font-body">{MASCOT_INFO[s].name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-[#94a3b8] mb-1.5 font-body">Género de la Mascota</label>
              <div className="flex gap-2">
                {(['masculino', 'femenino'] as MascotGender[]).map((g) => (
                  <button key={g} type="button"
                    onClick={() => { set('mascotGender', g); playSound('click'); }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium font-ui smooth-transition ${
                      form.mascotGender === g ? 'bg-[#6366f1]/20 border border-[#6366f1]/40 text-white'
                                              : 'bg-[#13161f] border border-[#1f2430] text-[#94a3b8]'
                    }`}>
                    {g === 'masculino' ? '♂ Visor Ámbar' : '♀ Lazo Rosa'}
                  </button>
                ))}
              </div>
            </div>

            {/* Vista previa */}
            <div className="bg-[#13161f] rounded-2xl p-4 border border-[#1f2430] flex justify-center">
              <Mascot species={form.mascotSpecies} gender={form.mascotGender} animation="float" size={100} showName />
            </div>

            <button type="submit" className="w-full btn-mission py-3 rounded-xl text-white font-semibold font-ui text-sm smooth-transition shadow-lg">
              {isTeacherReq ? '📨 Enviar Solicitud de Docente' : 'Crear Cuenta y Entrar'}
            </button>
          </form>
        )}

        <p className="text-[10px] text-[#475569] text-center mt-5 font-body">
          UPTA · Entorno 100% Aislado y Seguro
        </p>
      </div>

      {/* ─── DERECHA: Panel Terminal ──────────────── */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-10 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7c3aed]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#fb7185]/8 rounded-full blur-[100px]" />

        <div className="relative w-full max-w-lg bg-[#0e111a] border border-[#1f2430] rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1f2430]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
            </div>
            <span className="text-[10px] text-[#475569] font-terminal ml-2">upta-lab — bash — 80×24</span>
          </div>

          <div className="font-terminal text-[11px] leading-relaxed space-y-0.5 min-h-[210px]">
            {BOOT_LOG.slice(0, bootPhase).map((l, i) => (
              <div key={i} className="flex gap-3 fade-up">
                <span className="text-[#475569] shrink-0">[{l.t}]</span>
                <span className={i === BOOT_LOG.length - 1 ? 'text-[#22c55e]' : 'text-[#94a3b8]'}>{l.text}</span>
              </div>
            ))}
            {bootPhase >= BOOT_LOG.length && (
              <div className="flex gap-3 mt-3">
                <span className="text-[#22c55e]">$</span>
                <span className="text-white cursor-blink">▊</span>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { l: 'CPU', v: 'Edu-Core x64', c: '#7c3aed' },
              { l: 'RAM', v: '512 MB VFS',   c: '#6366f1' },
              { l: 'Red', v: '1000 Mbps',    c: '#22c55e' },
            ].map((m) => (
              <div key={m.l} className="bg-[#13161f] rounded-xl p-3 text-center border border-[#1f2430]">
                <div className="text-[9px] text-[#475569] font-body uppercase tracking-wider">{m.l}</div>
                <div className="text-[11px] font-terminal mt-1" style={{ color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] text-[#475569] mt-4 font-body">
            Servidor Educativo UPTA — Terminal con Sistema de Archivos Virtual
          </p>
        </div>
      </div>
    </div>
  );
}

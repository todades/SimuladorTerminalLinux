// ============================================================
// 👤 PERFIL — Edición de datos personales y cambio de contraseña
// Editables: Nombre, Apellido, Correo, Teléfono
// Solo lectura: Cédula, Trayecto, Docente, Género, Mascota
// (el Trayecto define la asignación docente → lo gestiona la administración)
// ============================================================

import { useState } from 'react';
import Mascot, { MASCOT_INFO } from './Mascot';
import { playSound } from '../utils/soundSynth';
import {
  RegisteredUser, updateUserPassword, findUserByEmail, getTrayectoMeta,
  isValidPhone, getPhoneOperator, PHONE_PREFIXES, PHONE_HINT,
} from '../engine/authEngine';

export type UserData = RegisteredUser;

interface ProfileViewProps {
  user: UserData;
  onSave: (u: UserData) => void;
}

export default function ProfileView({ user, onSave }: ProfileViewProps) {
  const [form, setForm] = useState<UserData>(user);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // Cambio de contraseña
  const [pwd, setPwd] = useState({ actual: '', nueva: '', confirmar: '' });
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const vNombre = (v: string) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{1,60}$/.test(v);
  const vEmail  = (v: string) => /^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(v.trim());
  const vTel    = (v: string) => isValidPhone(v);
  const vPass   = (v: string) =>
    v.length >= 12 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v);

  const set = (k: keyof UserData, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setSaved(false);
    setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  // ─── Guardar datos personales ────────────────────────
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!vNombre(form.nombre))   errs.nombre   = 'Solo letras y espacios (máx 60).';
    if (!vNombre(form.apellido)) errs.apellido = 'Solo letras y espacios (máx 60).';
    if (!vEmail(form.email))     errs.email    = 'El correo debe ser una cuenta Gmail válida (ejemplo@gmail.com).';
    if (!vTel(form.telefono))    errs.telefono = PHONE_HINT;
    setErrors(errs);
    if (Object.keys(errs).length > 0) { playSound('error'); return; }
    playSound('success');
    // Blindaje: los campos académicos y de identidad nunca se alteran
    // desde el perfil, solo la administración puede modificarlos.
    onSave({
      ...form,
      cedula:       user.cedula,
      trayecto:     user.trayecto,
      genero:       user.genero,
      teacherEmail: user.teacherEmail,
      role:         user.role,
      active:       user.active,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2800);
  };

  // ─── Cambiar contraseña ─────────────────────────────
  const handlePwd = (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!pwd.actual) {
      setPwdMsg({ type: 'err', text: 'Ingresa tu contraseña actual.' });
      playSound('error'); return;
    }
    if (!vPass(pwd.nueva)) {
      setPwdMsg({ type: 'err', text: 'Mín 12 caracteres: mayúscula, minúscula, número y símbolo.' });
      playSound('error'); return;
    }
    if (pwd.nueva !== pwd.confirmar) {
      setPwdMsg({ type: 'err', text: 'Las contraseñas nuevas no coinciden.' });
      playSound('error'); return;
    }

    const res = updateUserPassword(user.email, pwd.actual, pwd.nueva);
    if (!res.success) {
      setPwdMsg({ type: 'err', text: res.error || 'Contraseña actual incorrecta.' });
      playSound('error'); return;
    }

    playSound('success');
    if (res.user) onSave(res.user);
    setPwdMsg({ type: 'ok', text: '✅ Contraseña actualizada correctamente.' });
    setPwd({ actual: '', nueva: '', confirmar: '' });
    setTimeout(() => setPwdMsg(null), 3500);
  };

  const inputCls = (k: string) =>
    `w-full bg-[#0e111a] border rounded-xl px-4 py-2.5 text-white text-sm font-body
     placeholder:text-[#475569] focus:outline-none smooth-transition ${
       errors[k] ? 'border-[#f87171]' : 'border-[#1f2430] focus:border-[#7c3aed]'
     }`;

  const mascotInfo = MASCOT_INFO[user.mascotSpecies];
  // Datos académicos de solo lectura
  const trayMeta = getTrayectoMeta(user.trayecto);
  const titular = user.teacherEmail ? findUserByEmail(user.teacherEmail) : null;

  return (
    <div className="flex-1 overflow-y-auto halo-both">
      <div className="max-w-4xl mx-auto p-6 space-y-5">

        {/* ─── Banner de perfil ──────────────────────── */}
        <div className="bg-[#13161f] rounded-3xl border border-[#1f2430] p-6 flex flex-col sm:flex-row items-center gap-6 fade-up glow-violet">
          <div className="relative">
            <Mascot
              species={user.mascotSpecies}
              gender={user.mascotGender}
              animation="float"
              size={100}
            />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-extrabold text-white font-editorial leading-tight">
              {user.nombre} {user.apellido}
            </h2>
            <p className="text-sm text-[#94a3b8] font-body mt-0.5">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#7c3aed]/15 text-[#a78bfa] font-ui border border-[#7c3aed]/25">
                📚 {user.trayecto}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#6366f1]/15 text-[#818cf8] font-ui border border-[#6366f1]/25">
                🪪 C.I. {user.cedula}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#22c55e]/15 text-[#4ade80] font-ui border border-[#22c55e]/25">
                {mascotInfo.emoji} {mascotInfo.name}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#fb7185]/15 text-[#fb7185] font-ui border border-[#fb7185]/25">
                📞 {user.telefono}
              </span>
            </div>
          </div>
        </div>

        {/* ─── Grid: Datos + Contraseña ──────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Datos Personales */}
          <form onSubmit={handleSave} className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📝</span>
              <h3 className="text-sm font-bold text-white font-ui">Datos Personales</h3>
            </div>

            {/* Nombre y Apellido */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Nombre</label>
                <input
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  className={inputCls('nombre')}
                  placeholder="Tu nombre"
                />
                {errors.nombre && (
                  <p className="text-[10px] text-[#f87171] mt-1 font-body">{errors.nombre}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Apellido</label>
                <input
                  value={form.apellido}
                  onChange={(e) => set('apellido', e.target.value)}
                  className={inputCls('apellido')}
                  placeholder="Tu apellido"
                />
                {errors.apellido && (
                  <p className="text-[10px] text-[#f87171] mt-1 font-body">{errors.apellido}</p>
                )}
              </div>
            </div>

            {/* Correo */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Correo Electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputCls('email')}
                placeholder="tucorreo@gmail.com"
              />
              {errors.email && (
                <p className="text-[10px] text-[#f87171] mt-1 font-body">{errors.email}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">
                Teléfono
                {isValidPhone(form.telefono) && (
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e] font-ui">
                    {getPhoneOperator(form.telefono)}
                  </span>
                )}
              </label>
              <input
                value={form.telefono}
                onChange={(e) => set('telefono', e.target.value.replace(/\D/g, '').slice(0, 11))}
                maxLength={11}
                inputMode="numeric"
                className={inputCls('telefono')}
                placeholder="04120000000"
              />

              {/* Prefijos válidos */}
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
                          : 'bg-[#0e111a] border-[#1f2430] text-[#64748b] hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {errors.telefono
                ? <p className="text-[10px] text-[#f87171] mt-1 font-body">{errors.telefono}</p>
                : <p className="text-[9px] text-[#475569] mt-1 font-body">Ejemplo: 04120000000</p>}
            </div>

            {/* Botón guardar */}
            <button
              type="submit"
              className="w-full btn-mission py-2.5 rounded-xl text-white font-semibold font-ui text-sm smooth-transition"
            >
              Guardar Cambios
            </button>

            {saved && (
              <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl px-4 py-2.5 text-center">
                <p className="text-xs text-[#22c55e] font-body font-medium">
                  ✅ Perfil actualizado correctamente.
                </p>
              </div>
            )}
          </form>

          {/* Cambio de Contraseña */}
          <form onSubmit={handlePwd} className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🔐</span>
              <h3 className="text-sm font-bold text-white font-ui">Cambiar Contraseña</h3>
            </div>

            <p className="text-[11px] text-[#64748b] font-body leading-relaxed">
              Por seguridad, debes confirmar tu contraseña actual antes de establecer una nueva.
              La nueva debe tener mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.
            </p>

            {/* Contraseña actual */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwd.actual}
                  onChange={(e) => { setPwd((p) => ({ ...p, actual: e.target.value })); setPwdMsg(null); }}
                  className="w-full bg-[#0e111a] border border-[#1f2430] rounded-xl px-4 py-2.5 pr-11 text-white text-sm font-body
                    placeholder:text-[#475569] focus:outline-none focus:border-[#7c3aed] smooth-transition"
                  placeholder="••••••••••••"
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white smooth-transition text-sm"
                >
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Nueva contraseña */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Nueva contraseña</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd.nueva}
                onChange={(e) => { setPwd((p) => ({ ...p, nueva: e.target.value })); setPwdMsg(null); }}
                className="w-full bg-[#0e111a] border border-[#1f2430] rounded-xl px-4 py-2.5 text-white text-sm font-body
                  placeholder:text-[#475569] focus:outline-none focus:border-[#7c3aed] smooth-transition"
                placeholder="Mín 12 caracteres con símbolos"
              />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-[10px] text-[#94a3b8] mb-1.5 font-body">Confirmar contraseña</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd.confirmar}
                onChange={(e) => { setPwd((p) => ({ ...p, confirmar: e.target.value })); setPwdMsg(null); }}
                className={`w-full bg-[#0e111a] border rounded-xl px-4 py-2.5 text-white text-sm font-body
                  placeholder:text-[#475569] focus:outline-none smooth-transition ${
                    pwd.confirmar && pwd.nueva !== pwd.confirmar
                      ? 'border-[#f87171]'
                      : pwd.confirmar && pwd.nueva === pwd.confirmar
                        ? 'border-[#22c55e]'
                        : 'border-[#1f2430] focus:border-[#7c3aed]'
                  }`}
                placeholder="Repite la nueva contraseña"
              />
              {pwd.confirmar && pwd.nueva !== pwd.confirmar && (
                <p className="text-[10px] text-[#f87171] mt-1 font-body">Las contraseñas no coinciden.</p>
              )}
              {pwd.confirmar && pwd.nueva === pwd.confirmar && pwd.nueva !== '' && (
                <p className="text-[10px] text-[#22c55e] mt-1 font-body">✓ Las contraseñas coinciden.</p>
              )}
            </div>

            {/* Mensaje resultado */}
            {pwdMsg && (
              <div className={`rounded-xl px-4 py-2.5 border ${
                pwdMsg.type === 'ok'
                  ? 'bg-[#22c55e]/10 border-[#22c55e]/30'
                  : 'bg-[#f87171]/10 border-[#f87171]/30'
              }`}>
                <p className={`text-[11px] font-body font-medium ${
                  pwdMsg.type === 'ok' ? 'text-[#22c55e]' : 'text-[#f87171]'
                }`}>
                  {pwdMsg.text}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8]
                hover:text-white hover:border-[#7c3aed]/50 text-sm font-semibold font-ui smooth-transition"
            >
              Actualizar Contraseña
            </button>
          </form>
        </div>

        {/* ─── Info de solo lectura ──────────────────── */}
        <div className="bg-[#13161f] rounded-2xl border border-[#1f2430] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔒</span>
            <h3 className="text-sm font-bold text-white font-ui">Datos del Sistema</h3>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#64748b]/20 text-[#64748b] font-ui ml-1">
              Solo lectura
            </span>
          </div>
          {/* Trayecto y docente titular: destacados */}
          {user.role === 'estudiante' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl p-3.5 border"
                style={{
                  background: `${trayMeta.color}12`,
                  borderColor: `${trayMeta.color}35`,
                }}>
                <p className="text-[9px] text-[#64748b] font-body uppercase tracking-wider mb-1">
                  🎓 Trayecto Académico
                </p>
                <p className="text-sm font-bold font-ui" style={{ color: trayMeta.color }}>
                  {trayMeta.icon} {user.trayecto || 'Sin asignar'}
                </p>
              </div>

              <div className="rounded-xl p-3.5 border bg-[#22c55e]/8 border-[#22c55e]/25">
                <p className="text-[9px] text-[#64748b] font-body uppercase tracking-wider mb-1">
                  👨‍🏫 Docente Titular
                </p>
                <p className="text-sm font-bold font-ui text-[#4ade80] truncate">
                  {titular
                    ? `Prof. ${titular.nombre} ${titular.apellido}`
                    : 'Pendiente de asignación'}
                </p>
                {titular && (
                  <p className="text-[9px] text-[#64748b] font-body truncate mt-0.5">
                    {titular.email}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Cédula',    value: user.cedula,   icon: '🪪' },
              { label: 'Género',    value: user.genero === 'masculino' ? 'Masculino' : 'Femenino', icon: '👤' },
              { label: 'Mascota',   value: `${mascotInfo.emoji} ${mascotInfo.name}`, icon: '🐾' },
              { label: 'Registrado', value: user.registeredAt
                  ? new Date(user.registeredAt).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—', icon: '📅' },
            ].map((item) => (
              <div key={item.label} className="bg-[#0e111a] rounded-xl p-3 border border-[#1f2430]">
                <p className="text-[9px] text-[#64748b] font-body uppercase tracking-wider mb-1">
                  {item.icon} {item.label}
                </p>
                <p className="text-xs text-[#94a3b8] font-body font-medium truncate">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 bg-[#fbbf24]/8 border border-[#fbbf24]/25 rounded-xl px-3.5 py-2.5">
            <p className="text-[10px] text-[#fbbf24] font-body leading-snug">
              🔒 El <strong>Trayecto</strong> determina qué docente supervisa tu progreso,
              por lo que solo la administración puede modificarlo. Si necesitas un cambio
              de sección o corregir tu cédula, comunícate con la coordinación de la UPTA.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

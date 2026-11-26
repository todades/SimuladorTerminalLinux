// ============================================================
// 🔐 AUTH ENGINE — Motor de Autenticación y Base de Datos de Usuarios
// Almacenamiento local persistente con validación estricta de credenciales
// ============================================================

import { MascotSpecies, MascotGender } from '../components/Mascot';

// ─── RBAC: 3 niveles de acceso ────────────────────────
export type UserRole = 'estudiante' | 'profesor' | 'administrador';

export const ROLE_META: Record<UserRole, {
  label: string; icon: string; color: string; description: string;
  permissions: string[];
}> = {
  estudiante: {
    label: 'Estudiante', icon: '🎓', color: '#6366f1',
    description: 'Trayecto de aprendizaje, retos CLI y retroalimentación de progreso',
    permissions: ['simulator:use', 'lessons:read', 'progress:own'],
  },
  profesor: {
    label: 'Profesor', icon: '👨‍🏫', color: '#22c55e',
    description: 'Supervisión, mensajería y acceso libre a todos los niveles',
    permissions: ['simulator:use', 'lessons:read', 'progress:own',
      'progress:all', 'analytics:read', 'sessions:read',
      'messages:send', 'levels:unlock-all'],
  },
  administrador: {
    label: 'SuperAdmin', icon: '🛡️', color: '#f97316',
    description: 'Control global, matriz de relaciones y Modo Dios Total',
    permissions: ['simulator:use', 'lessons:read', 'progress:own',
      'progress:all', 'analytics:read', 'sessions:read',
      'messages:send', 'levels:unlock-all',
      'users:manage', 'roles:assign', 'godmode',
      'teachers:assign', 'impersonate', 'metrics:global'],
  },
};

export function hasPermission(role: UserRole, permission: string): boolean {
  return ROLE_META[role]?.permissions.includes(permission) ?? false;
}

// ─── Trayectos académicos ─────────────────────────────
export const TRAYECTOS = ['Trayecto I', 'Trayecto II', 'Trayecto III', 'Trayecto IV'] as const;
export type TrayectoName = typeof TRAYECTOS[number];

// ─── Prefijos telefónicos permitidos ──────────────────
export const PHONE_PREFIXES = ['0412', '0422', '0416', '0424'] as const;

export const PHONE_OPERATORS: Record<string, string> = {
  '0412': 'Digitel',
  '0422': 'Digitel',
  '0416': 'Movilnet',
  '0424': 'Movistar',
};

/** 11 dígitos con prefijo válido. Ejemplo: 04120000000 */
export const PHONE_REGEX = /^(0412|0422|0416|0424)\d{7}$/;

export function isValidPhone(v: string): boolean {
  return PHONE_REGEX.test(v.trim());
}

/** Devuelve la operadora si el prefijo es válido */
export function getPhoneOperator(v: string): string | null {
  const p = v.trim().slice(0, 4);
  return PHONE_OPERATORS[p] ?? null;
}

export const PHONE_HINT = `11 dígitos. Prefijos válidos: ${PHONE_PREFIXES.join(' · ')}`;

export interface TrayectoMeta { short: string; color: string; icon: string }

export const TRAYECTO_META: Record<string, TrayectoMeta> = {
  'Trayecto I':   { short: 'T-I',   color: '#3B82F6', icon: '🔵' },
  'Trayecto II':  { short: 'T-II',  color: '#22C55E', icon: '🟢' },
  'Trayecto III': { short: 'T-III', color: '#EAB308', icon: '🟡' },
  'Trayecto IV':  { short: 'T-IV',  color: '#EF4444', icon: '🔴' },
};

/** Fallback seguro: los docentes pendientes aún no tienen Trayecto. */
export const UNASSIGNED_TRAYECTO: TrayectoMeta = {
  short: 'S/A', color: '#64748b', icon: '⏳',
};

export function getTrayectoMeta(trayecto?: string | null): TrayectoMeta {
  if (!trayecto) return UNASSIGNED_TRAYECTO;
  return TRAYECTO_META[trayecto] ?? UNASSIGNED_TRAYECTO;
}

/** Estado de autorización de la cuenta (flujo de aprobación docente) */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface RegisteredUser {
  nombre: string;
  apellido: string;
  email: string;
  cedula: string;
  /** Vacío para docentes hasta que el SuperAdmin les asigne sección */
  trayecto: string;
  genero: string;
  telefono: string;
  passwordHash: string;
  mascotSpecies: MascotSpecies;
  mascotGender: MascotGender;
  registeredAt: string;
  role: UserRole;
  active: boolean;
  lastLogin?: string;
  /** Los docentes nacen 'pending'; estudiantes y admin 'approved' */
  approvalStatus: ApprovalStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  /**
   * Relación 1-a-Muchos Docente → Estudiantes.
   * Equivale a la FK `teacher_id` de la tabla `users` en Laravel.
   * Solo aplica al rol estudiante.
   */
  teacherEmail?: string | null;
}

// ─── Telemetría pedagógica (para el panel del profesor) ──
export interface CommandLogEntry {
  email: string;
  command: string;
  success: boolean;
  stepCompleted: string | null;
  timestamp: number;
}

export interface StudentSession {
  email: string;
  startedAt: number;
  endedAt: number | null;
  commandCount: number;
  errorCount: number;
  stepsCompleted: number;
}

// ─── Mensajería Docente → Estudiante ──────────────────
export interface Message {
  id: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: number;
  read: boolean;
}

const USERS_DB_KEY = 'upta_users_db_v3';
const SESSION_KEY = 'upta_current_session_v3';
const CMD_LOG_KEY = 'upta_command_log_v1';
const SESSIONS_KEY = 'upta_sessions_v1';
const MESSAGES_KEY = 'upta_messages_v1';

/** Correo del único administrador permitido en la plataforma */
export const ROOT_ADMIN_EMAIL = 'admin.upta@gmail.com';

export function isRootAdmin(email: string): boolean {
  return email.trim().toLowerCase() === ROOT_ADMIN_EMAIL;
}

// Función de hash simple y determinista para contraseñas de demostración
function hashPassword(password: string): string {
  let hash = 0;
  const salted = `UPTA_SALT_${password}_2026`;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  // Convertir a cadena hexadecimal base64-ish
  return `HASH_${Math.abs(hash).toString(16)}_${btoa(password).slice(0, 12)}`;
}

// ─── Cuentas demo: una por cada rol ──────────────────
// Las cuentas sembradas nacen ya aprobadas.
type SeedUser = Omit<RegisteredUser, 'approvalStatus'> & { approvalStatus?: ApprovalStatus };

const DEMO_USERS: RegisteredUser[] = ([
  {
    nombre: 'Estudiante', apellido: 'UPTA',
    email: 'estudiante.upta@gmail.com', cedula: '12345678',
    trayecto: 'Trayecto I', genero: 'masculino', telefono: '04121234567',
    passwordHash: hashPassword('Estudiante2026!#'),
    mascotSpecies: 'pinguino', mascotGender: 'masculino',
    registeredAt: new Date().toISOString(),
    role: 'estudiante', active: true,
    teacherEmail: 'profesor.upta@gmail.com',
  },
  {
    nombre: 'Ana', apellido: 'García',
    email: 'profesor.upta@gmail.com', cedula: '87654321',
    trayecto: 'Trayecto I', genero: 'femenino', telefono: '04241234567',
    passwordHash: hashPassword('Profesor2026!#'),
    mascotSpecies: 'buho', mascotGender: 'femenino',
    registeredAt: new Date().toISOString(),
    role: 'profesor', active: true,
  },
  {
    nombre: 'Carlos', apellido: 'Rondón',
    email: 'carlos.rondon.upta@gmail.com', cedula: '15234567',
    trayecto: 'Trayecto II', genero: 'masculino', telefono: '04227654321',
    passwordHash: hashPassword('Profesor2026!#'),
    mascotSpecies: 'zorro', mascotGender: 'masculino',
    registeredAt: new Date().toISOString(),
    role: 'profesor', active: true,
  },
  {
    nombre: 'María', apellido: 'Pérez',
    email: 'maria.perez.upta@gmail.com', cedula: '16345678',
    trayecto: 'Trayecto III', genero: 'femenino', telefono: '04129876543',
    passwordHash: hashPassword('Profesor2026!#'),
    mascotSpecies: 'dragon', mascotGender: 'femenino',
    registeredAt: new Date().toISOString(),
    role: 'profesor', active: true,
  },
  {
    nombre: 'Luis', apellido: 'Mendoza',
    email: 'luis.mendoza.upta@gmail.com', cedula: '17456789',
    trayecto: 'Trayecto IV', genero: 'masculino', telefono: '04165432198',
    passwordHash: hashPassword('Profesor2026!#'),
    mascotSpecies: 'pinguino', mascotGender: 'masculino',
    registeredAt: new Date().toISOString(),
    role: 'profesor', active: true,
  },
  {
    nombre: 'Admin', apellido: 'Sistema',
    email: 'admin.upta@gmail.com', cedula: '11223344',
    trayecto: 'Trayecto IV', genero: 'masculino', telefono: '04161234567',
    passwordHash: hashPassword('Admin2026!#Root'),
    mascotSpecies: 'dragon', mascotGender: 'masculino',
    registeredAt: new Date().toISOString(),
    role: 'administrador', active: true,
  },
] as SeedUser[]).map((u) => ({ ...u, approvalStatus: u.approvalStatus ?? 'approved' }));

// ─── Estudiantes de muestra distribuidos por docente ──
const SEED_STUDENTS: {
  n: string; a: string; mail: string; ci: string; tel: string;
  tray: string; teacher: string; g: 'masculino' | 'femenino';
  m: MascotSpecies; active?: boolean;
}[] = [
  { n: 'Pedro',    a: 'Linares',  mail: 'pedro.linares@gmail.com',   ci: '28111222', tel: '04121110001', tray: 'Trayecto I',   teacher: 'profesor.upta@gmail.com',        g: 'masculino', m: 'pinguino' },
  { n: 'Lucía',    a: 'Ferrer',   mail: 'lucia.ferrer@gmail.com',    ci: '28222333', tel: '04121110002', tray: 'Trayecto I',   teacher: 'profesor.upta@gmail.com',        g: 'femenino',  m: 'zorro' },
  { n: 'Daniel',   a: 'Ortega',   mail: 'daniel.ortega@gmail.com',   ci: '28333444', tel: '04121110003', tray: 'Trayecto I',   teacher: 'profesor.upta@gmail.com',        g: 'masculino', m: 'buho' },
  { n: 'Camila',   a: 'Rojas',    mail: 'camila.rojas@gmail.com',    ci: '28444555', tel: '04121110004', tray: 'Trayecto II',  teacher: 'carlos.rondon.upta@gmail.com',   g: 'femenino',  m: 'dragon' },
  { n: 'Andrés',   a: 'Salazar',  mail: 'andres.salazar@gmail.com',  ci: '28555666', tel: '04121110005', tray: 'Trayecto II',  teacher: 'carlos.rondon.upta@gmail.com',   g: 'masculino', m: 'pinguino' },
  { n: 'Valentina',a: 'Núñez',    mail: 'valentina.nunez@gmail.com', ci: '28666777', tel: '04121110006', tray: 'Trayecto II',  teacher: 'carlos.rondon.upta@gmail.com',   g: 'femenino',  m: 'zorro', active: false },
  { n: 'Jorge',    a: 'Bastidas', mail: 'jorge.bastidas@gmail.com',  ci: '28777888', tel: '04121110007', tray: 'Trayecto III', teacher: 'maria.perez.upta@gmail.com',     g: 'masculino', m: 'buho' },
  { n: 'Isabella', a: 'Moreno',   mail: 'isabella.moreno@gmail.com', ci: '28888999', tel: '04121110008', tray: 'Trayecto III', teacher: 'maria.perez.upta@gmail.com',     g: 'femenino',  m: 'dragon' },
  { n: 'Mateo',    a: 'Guerra',   mail: 'mateo.guerra@gmail.com',    ci: '28999000', tel: '04121110009', tray: 'Trayecto IV',  teacher: 'luis.mendoza.upta@gmail.com',    g: 'masculino', m: 'pinguino' },
  { n: 'Sofía',    a: 'Acosta',   mail: 'sofia.acosta@gmail.com',    ci: '29000111', tel: '04121110010', tray: 'Trayecto IV',  teacher: 'luis.mendoza.upta@gmail.com',    g: 'femenino',  m: 'zorro' },
];

for (const s of SEED_STUDENTS) {
  DEMO_USERS.push({
    nombre: s.n, apellido: s.a, email: s.mail, cedula: s.ci,
    trayecto: s.tray, genero: s.g, telefono: s.tel,
    passwordHash: hashPassword('Estudiante2026!#'),
    mascotSpecies: s.m, mascotGender: s.g,
    registeredAt: new Date().toISOString(),
    role: 'estudiante', active: s.active !== false,
    teacherEmail: s.teacher,
    approvalStatus: 'approved',
  });
}

export const DEMO_CREDENTIALS = [
  { role: 'estudiante' as UserRole, email: 'estudiante.upta@gmail.com', password: 'Estudiante2026!#' },
  { role: 'profesor' as UserRole,   email: 'profesor.upta@gmail.com',   password: 'Profesor2026!#' },
  { role: 'administrador' as UserRole, email: 'admin.upta@gmail.com',   password: 'Admin2026!#Root' },
];

// ═══ Telemetría: registro de comandos y sesiones ═══════

export function logCommand(entry: CommandLogEntry): void {
  try {
    const raw = localStorage.getItem(CMD_LOG_KEY);
    const log: CommandLogEntry[] = raw ? JSON.parse(raw) : [];
    log.push(entry);
    // Retener los últimos 2000 eventos
    localStorage.setItem(CMD_LOG_KEY, JSON.stringify(log.slice(-2000)));
  } catch { /* ignore */ }
}

export function getCommandLog(email?: string): CommandLogEntry[] {
  try {
    const raw = localStorage.getItem(CMD_LOG_KEY);
    const log: CommandLogEntry[] = raw ? JSON.parse(raw) : [];
    return email ? log.filter((e) => e.email === email) : log;
  } catch { return []; }
}

export function startSession(email: string): void {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: StudentSession[] = raw ? JSON.parse(raw) : [];
    sessions.push({
      email, startedAt: Date.now(), endedAt: null,
      commandCount: 0, errorCount: 0, stepsCompleted: 0,
    });
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(-500)));
  } catch { /* ignore */ }
}

export function updateCurrentSession(
  email: string,
  delta: { commands?: number; errors?: number; steps?: number },
): void {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: StudentSession[] = raw ? JSON.parse(raw) : [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].email === email && sessions[i].endedAt === null) {
        sessions[i].commandCount += delta.commands ?? 0;
        sessions[i].errorCount += delta.errors ?? 0;
        sessions[i].stepsCompleted += delta.steps ?? 0;
        break;
      }
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

export function endSession(email: string): void {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: StudentSession[] = raw ? JSON.parse(raw) : [];
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].email === email && sessions[i].endedAt === null) {
        sessions[i].endedAt = Date.now();
        break;
      }
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch { /* ignore */ }
}

export function getSessions(email?: string): StudentSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: StudentSession[] = raw ? JSON.parse(raw) : [];
    return email ? sessions.filter((s) => s.email === email) : sessions;
  } catch { return []; }
}

// ═══ Mensajería Docente → Estudiante ══════════════════

export function getMessages(): Message[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMessages(list: Message[]): void {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list.slice(-1000)));
  } catch { /* ignore */ }
}

export function sendMessage(
  from: RegisteredUser,
  toEmail: string,
  subject: string,
  body: string,
): AuthResult {
  if (!subject.trim()) return { success: false, error: 'El asunto no puede estar vacío.' };
  if (!body.trim()) return { success: false, error: 'El mensaje no puede estar vacío.' };
  const target = findUserByEmail(toEmail);
  if (!target) return { success: false, error: 'El destinatario no existe.' };

  const list = getMessages();
  list.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromEmail: from.email,
    fromName: `${from.nombre} ${from.apellido}`.trim(),
    toEmail: target.email,
    subject: subject.trim(),
    body: body.trim(),
    sentAt: Date.now(),
    read: false,
  });
  saveMessages(list);
  return { success: true };
}

/** Mensajes recibidos por un usuario (más recientes primero) */
export function getInbox(email: string): Message[] {
  const key = email.trim().toLowerCase();
  return getMessages()
    .filter((m) => m.toEmail === key)
    .sort((a, b) => b.sentAt - a.sentAt);
}

/** Conversación completa entre un docente y un estudiante */
export function getThread(teacherEmail: string, studentEmail: string): Message[] {
  const t = teacherEmail.trim().toLowerCase();
  const s = studentEmail.trim().toLowerCase();
  return getMessages()
    .filter((m) => m.fromEmail === t && m.toEmail === s)
    .sort((a, b) => a.sentAt - b.sentAt);
}

export function countUnread(email: string): number {
  return getInbox(email).filter((m) => !m.read).length;
}

export function markAllRead(email: string): void {
  const key = email.trim().toLowerCase();
  const list = getMessages();
  let changed = false;
  for (const m of list) {
    if (m.toEmail === key && !m.read) { m.read = true; changed = true; }
  }
  if (changed) saveMessages(list);
}

export function deleteMessage(id: string): void {
  saveMessages(getMessages().filter((m) => m.id !== id));
}

// ═══ Notificaciones del sistema (bandeja SuperAdmin) ══

export interface SystemNotification {
  id: string;
  type: 'teacher_request' | 'teacher_approved' | 'teacher_rejected' | 'info';
  title: string;
  body: string;
  targetEmail: string;      // destinatario de la notificación
  relatedEmail?: string;    // usuario al que se refiere
  createdAt: number;
  read: boolean;
}

const NOTIFICATIONS_KEY = 'upta_notifications_v1';

function readNotifications(): SystemNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeNotifications(list: SystemNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list.slice(-300)));
  } catch { /* ignore */ }
}

export function pushNotification(
  n: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>,
): void {
  const list = readNotifications();
  list.push({
    ...n,
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    read: false,
  });
  writeNotifications(list);
}

export function getNotifications(email: string): SystemNotification[] {
  const key = email.trim().toLowerCase();
  return readNotifications()
    .filter((n) => n.targetEmail === key)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function countUnreadNotifications(email: string): number {
  return getNotifications(email).filter((n) => !n.read).length;
}

export function markNotificationsRead(email: string): void {
  const key = email.trim().toLowerCase();
  const list = readNotifications();
  let changed = false;
  for (const n of list) {
    if (n.targetEmail === key && !n.read) { n.read = true; changed = true; }
  }
  if (changed) writeNotifications(list);
}

export function dismissNotification(id: string): void {
  writeNotifications(readNotifications().filter((n) => n.id !== id));
}

// ═══ Flujo de autorización de cuentas docentes ════════

/** Solicitudes de docente pendientes de revisión */
export function getPendingTeachers(): RegisteredUser[] {
  return Object.values(getUsersDb())
    .filter((u) => u.role === 'profesor' && u.approvalStatus === 'pending')
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
}

export function countPendingTeachers(): number {
  return getPendingTeachers().length;
}

/**
 * Aprueba una cuenta docente y le asigna su Trayecto/sección.
 * Solo puede ejecutarlo el SuperAdministrador.
 */
export function approveTeacher(
  email: string,
  trayecto: string,
  reviewerEmail: string,
): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  const user = db[key];
  if (!user) return { success: false, error: 'Usuario no encontrado.' };
  if (user.role !== 'profesor') {
    return { success: false, error: 'Solo las cuentas docentes requieren autorización.' };
  }
  if (!trayecto) {
    return { success: false, error: 'Debes asignar un Trayecto al aprobar al docente.' };
  }

  user.approvalStatus = 'approved';
  user.active = true;
  user.trayecto = trayecto;
  user.reviewedBy = reviewerEmail.trim().toLowerCase();
  user.reviewedAt = new Date().toISOString();
  user.rejectionReason = null;
  saveUsersDb(db);

  pushNotification({
    type: 'teacher_approved',
    title: '✅ Cuenta docente autorizada',
    body: `Tu solicitud fue aprobada. Se te asignó ${trayecto}. Ya puedes iniciar sesión.`,
    targetEmail: user.email,
    relatedEmail: user.email,
  });

  return { success: true, user };
}

/** Rechaza una solicitud docente con motivo opcional */
export function rejectTeacher(
  email: string,
  reviewerEmail: string,
  reason?: string,
): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  const user = db[key];
  if (!user) return { success: false, error: 'Usuario no encontrado.' };

  user.approvalStatus = 'rejected';
  user.active = false;
  user.reviewedBy = reviewerEmail.trim().toLowerCase();
  user.reviewedAt = new Date().toISOString();
  user.rejectionReason = reason?.trim() || 'No se indicó un motivo.';
  saveUsersDb(db);

  pushNotification({
    type: 'teacher_rejected',
    title: '❌ Solicitud docente rechazada',
    body: `Tu solicitud no fue aprobada. Motivo: ${user.rejectionReason}`,
    targetEmail: user.email,
    relatedEmail: user.email,
  });

  return { success: true, user };
}

// ═══ Jerarquía Docente → Estudiantes por Trayecto ═════

/** Docentes activos que imparten un Trayecto dado */
export function getTeachersByTrayecto(trayecto: string): RegisteredUser[] {
  return Object.values(getUsersDb())
    .filter((u) => u.role === 'profesor' && u.active && u.trayecto === trayecto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Todos los docentes activos (para el selector de registro) */
export function getAllTeachers(): RegisteredUser[] {
  return Object.values(getUsersDb())
    .filter((u) => u.role === 'profesor')
    .sort((a, b) => a.trayecto.localeCompare(b.trayecto) || a.nombre.localeCompare(b.nombre));
}

/** Estudiantes asignados a un docente */
export function getStudentsByTeacher(teacherEmail: string): RegisteredUser[] {
  const key = teacherEmail.trim().toLowerCase();
  return Object.values(getUsersDb())
    .filter((u) => u.role === 'estudiante' && u.teacherEmail === key)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Estudiantes sin docente titular asignado */
export function getUnassignedStudents(): RegisteredUser[] {
  const teachers = new Set(getAllTeachers().map((t) => t.email));
  return Object.values(getUsersDb())
    .filter((u) => u.role === 'estudiante' && (!u.teacherEmail || !teachers.has(u.teacherEmail)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export interface TeacherAssignment {
  teacher: RegisteredUser;
  students: RegisteredUser[];
  activeStudents: number;
}

/**
 * Matriz jerárquica Docente → Estudiantes.
 * Excluye a los docentes pendientes/rechazados: aún no tienen sección
 * y se gestionan en la bandeja de solicitudes.
 */
export function getAssignmentMatrix(trayectoFilter?: string): TeacherAssignment[] {
  return getAllTeachers()
    .filter((t) => t.approvalStatus === 'approved')
    .filter((t) => !trayectoFilter || t.trayecto === trayectoFilter)
    .map((teacher) => {
      const students = getStudentsByTeacher(teacher.email);
      return {
        teacher,
        students,
        activeStudents: students.filter((s) => s.active).length,
      };
    });
}

/** Reasigna un estudiante a otro docente titular */
export function assignStudentToTeacher(
  studentEmail: string,
  teacherEmail: string | null,
): AuthResult {
  const db = getUsersDb();
  const sKey = studentEmail.trim().toLowerCase();
  const student = db[sKey];
  if (!student) return { success: false, error: 'Estudiante no encontrado.' };
  if (student.role !== 'estudiante') {
    return { success: false, error: 'Solo los estudiantes pueden tener docente asignado.' };
  }
  if (teacherEmail) {
    const tKey = teacherEmail.trim().toLowerCase();
    const teacher = db[tKey];
    if (!teacher || teacher.role !== 'profesor') {
      return { success: false, error: 'El docente indicado no existe o no tiene rol de profesor.' };
    }
    student.teacherEmail = tKey;
  } else {
    student.teacherEmail = null;
  }
  saveUsersDb(db);
  return { success: true, user: student };
}

// ═══ Métricas globales en tiempo real (SuperAdmin) ════

export interface GlobalMetrics {
  totalTeachers: number;
  totalStudents: number;
  activeToday: number;
  onlineNow: number;
  unassignedStudents: number;
  inactiveAccounts: number;
  byTrayecto: { trayecto: string; teachers: number; students: number }[];
}

export function getGlobalMetrics(): GlobalMetrics {
  const all = Object.values(getUsersDb());
  const teachers = all.filter((u) => u.role === 'profesor');
  const students = all.filter((u) => u.role === 'estudiante');

  const DAY = 86400000;
  const now = Date.now();
  const log = getCommandLog();

  // Activos hoy: ejecutaron algún comando en las últimas 24 h
  const activeEmails = new Set(
    log.filter((e) => now - e.timestamp < DAY).map((e) => e.email),
  );
  // En línea ahora: actividad en los últimos 5 minutos
  const onlineEmails = new Set(
    log.filter((e) => now - e.timestamp < 5 * 60000).map((e) => e.email),
  );

  return {
    totalTeachers: teachers.length,
    totalStudents: students.length,
    activeToday: activeEmails.size,
    onlineNow: onlineEmails.size,
    unassignedStudents: getUnassignedStudents().length,
    inactiveAccounts: all.filter((u) => !u.active && !isRootAdmin(u.email)).length,
    byTrayecto: TRAYECTOS.map((t) => ({
      trayecto: t,
      teachers: teachers.filter((u) => u.trayecto === t).length,
      students: students.filter((u) => u.trayecto === t).length,
    })),
  };
}

/** ¿Tuvo actividad en las últimas 24 h? */
export function isActiveToday(email: string): boolean {
  const DAY = 86400000;
  const now = Date.now();
  return getCommandLog(email).some((e) => now - e.timestamp < DAY);
}

// ═══ Suplantación de identidad (soporte) ══════════════

const IMPERSONATE_KEY = 'upta_impersonate_v1';

export interface ImpersonationState {
  adminEmail: string;
  targetEmail: string;
  startedAt: number;
}

export function startImpersonation(adminEmail: string, targetEmail: string): AuthResult {
  const target = findUserByEmail(targetEmail);
  if (!target) return { success: false, error: 'Usuario no encontrado.' };
  if (isRootAdmin(targetEmail)) {
    return { success: false, error: 'No puedes suplantar la cuenta de administrador.' };
  }
  try {
    localStorage.setItem(IMPERSONATE_KEY, JSON.stringify({
      adminEmail: adminEmail.trim().toLowerCase(),
      targetEmail: target.email,
      startedAt: Date.now(),
    }));
  } catch { /* ignore */ }
  return { success: true, user: target };
}

export function getImpersonation(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(IMPERSONATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function stopImpersonation(): void {
  localStorage.removeItem(IMPERSONATE_KEY);
}

// ═══ Administración de usuarios (administrador único) ══

export function listAllUsers(): RegisteredUser[] {
  return Object.values(getUsersDb()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre));
}

/** Usuarios agrupados por rol, para la vista ordenada del admin */
export function listUsersByRole(): {
  profesores: RegisteredUser[];
  estudiantes: RegisteredUser[];
  administrador: RegisteredUser | null;
} {
  const all = listAllUsers();
  return {
    administrador: all.find((u) => u.role === 'administrador') ?? null,
    profesores: all.filter((u) => u.role === 'profesor'),
    estudiantes: all.filter((u) => u.role === 'estudiante'),
  };
}

/**
 * Solo se permite alternar entre estudiante y profesor.
 * El rol de administrador es exclusivo de ROOT_ADMIN_EMAIL.
 */
export function changeUserRole(email: string, role: UserRole): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  if (!db[key]) return { success: false, error: 'Usuario no encontrado.' };

  if (isRootAdmin(key)) {
    return { success: false, error: 'El administrador principal no puede cambiar de rol.' };
  }
  if (role === 'administrador') {
    return {
      success: false,
      error: 'La plataforma admite un solo administrador. No se puede asignar este rol.',
    };
  }

  db[key].role = role;
  saveUsersDb(db);
  const session = getCurrentSession();
  if (session?.email === key) setCurrentSession(db[key]);
  return { success: true, user: db[key] };
}

export function toggleUserActive(email: string): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  if (!db[key]) return { success: false, error: 'Usuario no encontrado.' };
  if (isRootAdmin(key)) {
    return { success: false, error: 'La cuenta del administrador no puede desactivarse.' };
  }
  db[key].active = !db[key].active;
  saveUsersDb(db);
  return { success: true, user: db[key] };
}

/** Qué ocurrirá al eliminar una cuenta (previsualización para el diálogo) */
export interface DeletionImpact {
  canDelete: boolean;
  reason?: string;
  isTeacher: boolean;
  orphanedStudents: number;
  commandLogs: number;
  messages: number;
}

export function previewDeletion(email: string): DeletionImpact {
  const key = email.trim().toLowerCase();
  const user = getUsersDb()[key];

  if (!user) {
    return { canDelete: false, reason: 'Usuario no encontrado.',
      isTeacher: false, orphanedStudents: 0, commandLogs: 0, messages: 0 };
  }
  if (isRootAdmin(key)) {
    return { canDelete: false, reason: 'La cuenta del administrador no puede eliminarse.',
      isTeacher: false, orphanedStudents: 0, commandLogs: 0, messages: 0 };
  }

  const isTeacher = user.role === 'profesor';
  return {
    canDelete: true,
    isTeacher,
    orphanedStudents: isTeacher ? getStudentsByTeacher(key).length : 0,
    commandLogs: getCommandLog(key).length,
    messages: getMessages().filter((m) => m.toEmail === key || m.fromEmail === key).length,
  };
}

/**
 * Elimina una cuenta y purga todos sus datos derivados.
 * Al borrar un docente, sus estudiantes quedan sin titular (no se eliminan).
 */
export function deleteUser(email: string): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  const user = db[key];

  if (!user) return { success: false, error: 'Usuario no encontrado.' };
  if (isRootAdmin(key)) {
    return { success: false, error: 'La cuenta del administrador no puede eliminarse.' };
  }

  // Cascada: liberar a los estudiantes del docente eliminado
  if (user.role === 'profesor') {
    for (const u of Object.values(db)) {
      if (u.role === 'estudiante' && u.teacherEmail === key) {
        u.teacherEmail = null;
      }
    }
  }

  delete db[key];
  saveUsersDb(db);

  // Purga de datos derivados
  try {
    localStorage.removeItem(`upta_progress_v4_${key}`);

    const logs = getCommandLog().filter((e) => e.email !== key);
    localStorage.setItem(CMD_LOG_KEY, JSON.stringify(logs));

    const sessions = getSessions().filter((s) => s.email !== key);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

    saveMessages(getMessages().filter((m) => m.toEmail !== key && m.fromEmail !== key));

    writeNotifications(
      readNotifications().filter((n) => n.targetEmail !== key && n.relatedEmail !== key),
    );
  } catch { /* ignore */ }

  return { success: true };
}

/** Activa o desactiva un docente junto con todos sus estudiantes */
export function toggleTeacherCascade(email: string, active: boolean): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  const teacher = db[key];

  if (!teacher) return { success: false, error: 'Docente no encontrado.' };
  if (isRootAdmin(key)) {
    return { success: false, error: 'La cuenta del administrador no puede desactivarse.' };
  }

  teacher.active = active;
  for (const u of Object.values(db)) {
    if (u.role === 'estudiante' && u.teacherEmail === key) {
      u.active = active;
    }
  }
  saveUsersDb(db);
  return { success: true, user: teacher };
}

/** Acción masiva sobre varias cuentas */
export function bulkToggleActive(emails: string[], active: boolean): number {
  const db = getUsersDb();
  let n = 0;
  for (const e of emails) {
    const key = e.trim().toLowerCase();
    if (db[key] && !isRootAdmin(key)) { db[key].active = active; n++; }
  }
  saveUsersDb(db);
  return n;
}

function seedDb(): Record<string, RegisteredUser> {
  const initial: Record<string, RegisteredUser> = {};
  for (const u of DEMO_USERS) initial[u.email.toLowerCase()] = u;
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(initial));
  return initial;
}

export function getUsersDb(): Record<string, RegisteredUser> {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    if (!raw) return seedDb();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return seedDb();

    let mutated = false;
    // Garantizar que las 3 cuentas demo existan siempre
    for (const demo of DEMO_USERS) {
      if (!parsed[demo.email.toLowerCase()]) {
        parsed[demo.email.toLowerCase()] = demo;
        mutated = true;
      }
    }
    // Migración: usuarios antiguos sin rol → estudiante
    for (const key of Object.keys(parsed)) {
      if (!parsed[key].role) { parsed[key].role = 'estudiante'; mutated = true; }
      if (parsed[key].active === undefined) { parsed[key].active = true; mutated = true; }
      // Migración: cuentas previas al flujo de aprobación quedan aprobadas
      if (!parsed[key].approvalStatus) { parsed[key].approvalStatus = 'approved'; mutated = true; }
      // Administrador único: degradar cualquier admin que no sea el raíz
      if (parsed[key].role === 'administrador' && key !== ROOT_ADMIN_EMAIL) {
        parsed[key].role = 'profesor';
        mutated = true;
      }
      // El administrador raíz siempre activo y con su rol
      if (key === ROOT_ADMIN_EMAIL) {
        if (parsed[key].role !== 'administrador') { parsed[key].role = 'administrador'; mutated = true; }
        if (!parsed[key].active) { parsed[key].active = true; mutated = true; }
      }
    }
    if (mutated) localStorage.setItem(USERS_DB_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return seedDb();
  }
}

export function saveUsersDb(db: Record<string, RegisteredUser>): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore quota error
  }
}

export function findUserByEmail(email: string): RegisteredUser | null {
  const db = getUsersDb();
  return db[email.trim().toLowerCase()] || null;
}

export function findUserByCedula(cedula: string): RegisteredUser | null {
  const db = getUsersDb();
  const cleanCed = cedula.trim();
  for (const user of Object.values(db)) {
    if (user.cedula === cleanCed) {
      return user;
    }
  }
  return null;
}

export function findUserByTelefono(telefono: string): RegisteredUser | null {
  const db = getUsersDb();
  const cleanTel = telefono.trim();
  for (const user of Object.values(db)) {
    if (user.telefono === cleanTel) {
      return user;
    }
  }
  return null;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: RegisteredUser;
}

/**
 * Registrar un nuevo estudiante
 */
export function registerUser(payload: {
  nombre: string;
  apellido: string;
  email: string;
  cedula: string;
  trayecto: string;
  genero: string;
  telefono: string;
  password: string;
  mascotSpecies: MascotSpecies;
  mascotGender: MascotGender;
  teacherEmail?: string;
  /** 'estudiante' (por defecto) o 'profesor' (requiere autorización) */
  requestedRole?: 'estudiante' | 'profesor';
}): AuthResult {
  const emailLower = payload.email.trim().toLowerCase();

  // Validar que sea una cuenta @gmail.com
  if (!/^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(emailLower)) {
    return {
      success: false,
      error: 'El correo electrónico debe ser una cuenta Gmail válida (ejemplo@gmail.com).',
    };
  }

  // Validar el prefijo telefónico
  if (!isValidPhone(payload.telefono)) {
    return { success: false, error: PHONE_HINT };
  }

  // Validar la cédula
  if (!/^\d{8}$/.test(payload.cedula.trim())) {
    return { success: false, error: 'La cédula debe tener exactamente 8 dígitos.' };
  }

  // Validaciones de duplicados
  const existingEmail = findUserByEmail(emailLower);
  if (existingEmail) {
    return {
      success: false,
      error: 'Este correo electrónico ya está registrado. Por favor inicia sesión.',
    };
  }

  const existingCedula = findUserByCedula(payload.cedula);
  if (existingCedula) {
    return {
      success: false,
      error: `La cédula ${payload.cedula} ya se encuentra registrada en el sistema.`,
    };
  }

  const existingTel = findUserByTelefono(payload.telefono);
  if (existingTel) {
    return {
      success: false,
      error: `El número de teléfono ${payload.telefono} ya está registrado con otra cuenta.`,
    };
  }

  const isTeacherRequest = payload.requestedRole === 'profesor';

  const newUser: RegisteredUser = {
    nombre: payload.nombre.trim(),
    apellido: payload.apellido.trim(),
    email: emailLower,
    cedula: payload.cedula.trim(),
    // Los docentes no eligen Trayecto: el SuperAdmin les asigna sección al aprobar
    trayecto: isTeacherRequest ? '' : payload.trayecto,
    genero: payload.genero,
    telefono: payload.telefono.trim(),
    passwordHash: hashPassword(payload.password),
    mascotSpecies: payload.mascotSpecies,
    mascotGender: payload.mascotGender,
    registeredAt: new Date().toISOString(),
    role: isTeacherRequest ? 'profesor' : 'estudiante',
    // La cuenta docente queda inactiva hasta la autorización
    active: !isTeacherRequest,
    approvalStatus: isTeacherRequest ? 'pending' : 'approved',
    // Docente titular del Trayecto (FK teacher_id) — solo estudiantes
    teacherEmail: isTeacherRequest
      ? null
      : (payload.teacherEmail?.trim().toLowerCase()
        ?? getTeachersByTrayecto(payload.trayecto)[0]?.email
        ?? null),
  };

  const db = getUsersDb();
  db[emailLower] = newUser;
  saveUsersDb(db);

  if (isTeacherRequest) {
    // Notificar al SuperAdmin de la solicitud pendiente
    pushNotification({
      type: 'teacher_request',
      title: 'Nueva solicitud de cuenta docente',
      body: `${newUser.nombre} ${newUser.apellido} (C.I. ${newUser.cedula}) solicita acceso como docente.`,
      targetEmail: ROOT_ADMIN_EMAIL,
      relatedEmail: newUser.email,
    });
    // No se inicia sesión: debe esperar aprobación
    return { success: true, user: newUser };
  }

  setCurrentSession(newUser);
  return { success: true, user: newUser };
}

/**
 * Iniciar sesión comprobando correo y contraseña en la base de datos de usuarios registrados
 */
export function loginUser(email: string, password: string): AuthResult {
  const emailLower = email.trim().toLowerCase();

  // Validar formato Gmail antes de buscar en la BD
  if (!/^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(emailLower)) {
    return {
      success: false,
      error: 'El correo electrónico debe ser una cuenta Gmail válida (ejemplo@gmail.com).',
    };
  }

  const user = findUserByEmail(emailLower);

  if (!user) {
    return {
      success: false,
      error: 'No existe ninguna cuenta registrada con este correo electrónico. Puedes crear tu cuenta en la pestaña "Crear Cuenta".',
    };
  }

  const providedHash = hashPassword(password);
  if (user.passwordHash !== providedHash) {
    return {
      success: false,
      error: 'La contraseña ingresada es incorrecta. Por favor verifica tus credenciales.',
    };
  }

  // Flujo de autorización docente
  if (user.approvalStatus === 'pending') {
    return {
      success: false,
      error: '⏳ Tu cuenta docente está pendiente de autorización por el administrador. Recibirás acceso cuando sea aprobada.',
    };
  }
  if (user.approvalStatus === 'rejected') {
    return {
      success: false,
      error: `❌ Tu solicitud de cuenta docente fue rechazada. Motivo: ${user.rejectionReason ?? 'no especificado'}`,
    };
  }

  if (user.active === false) {
    return {
      success: false,
      error: 'Tu cuenta ha sido desactivada. Contacta al administrador de la plataforma.',
    };
  }

  // Credenciales válidas: registrar último acceso y abrir sesión
  const db = getUsersDb();
  db[emailLower].lastLogin = new Date().toISOString();
  saveUsersDb(db);
  setCurrentSession(db[emailLower]);
  startSession(emailLower);
  return { success: true, user: db[emailLower] };
}

/**
 * Obtener la sesión activa del estudiante
 */
export function getCurrentSession(): RegisteredUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as RegisteredUser;
    if (!user || !user.email) return null;
    // Verificar que siga existiendo en la base de usuarios
    const verified = findUserByEmail(user.email);
    return verified || null;
  } catch {
    return null;
  }
}

/**
 * Guardar sesión activa
 */
export function setCurrentSession(user: RegisteredUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}

/**
 * Cerrar sesión
 */
export function logoutUser(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Actualizar el perfil desde la vista del usuario.
 *
 * Solo acepta campos de contacto y personalización. Los campos académicos
 * y de seguridad (trayecto, cédula, docente, rol, estado) se descartan:
 * únicamente la administración puede modificarlos.
 */
export function updateUserProfile(email: string, updates: Partial<RegisteredUser>): AuthResult {
  const db = getUsersDb();
  const emailLower = email.trim().toLowerCase();
  const existing = db[emailLower];
  if (!existing) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  // Lista blanca de campos editables por el propio usuario
  const safe: Partial<RegisteredUser> = {};
  if (updates.nombre !== undefined)        safe.nombre = updates.nombre.trim();
  if (updates.apellido !== undefined)      safe.apellido = updates.apellido.trim();
  if (updates.telefono !== undefined)      safe.telefono = updates.telefono.trim();
  if (updates.mascotSpecies !== undefined) safe.mascotSpecies = updates.mascotSpecies;
  if (updates.mascotGender !== undefined)  safe.mascotGender = updates.mascotGender;

  // El teléfono debe tener prefijo válido y ser único
  if (safe.telefono && safe.telefono !== existing.telefono) {
    if (!isValidPhone(safe.telefono)) {
      return { success: false, error: PHONE_HINT };
    }
    const dupe = findUserByTelefono(safe.telefono);
    if (dupe && dupe.email !== existing.email) {
      return { success: false, error: 'Ese teléfono ya está registrado en otra cuenta.' };
    }
  }

  const updated: RegisteredUser = {
    ...existing,
    ...safe,
    // Campos inmutables desde el perfil
    email:          existing.email,
    cedula:         existing.cedula,
    trayecto:       existing.trayecto,
    genero:         existing.genero,
    teacherEmail:   existing.teacherEmail,
    role:           existing.role,
    active:         existing.active,
    approvalStatus: existing.approvalStatus,
    passwordHash:   existing.passwordHash,
    registeredAt:   existing.registeredAt,
  };

  db[emailLower] = updated;
  saveUsersDb(db);
  setCurrentSession(updated);
  return { success: true, user: updated };
}

/**
 * Actualización administrativa: permite cambiar los campos académicos.
 * Reservado al SuperAdministrador.
 */
export function adminUpdateUser(
  email: string,
  updates: Partial<RegisteredUser>,
): AuthResult {
  const db = getUsersDb();
  const key = email.trim().toLowerCase();
  const existing = db[key];
  if (!existing) return { success: false, error: 'Usuario no encontrado.' };

  if (updates.cedula && updates.cedula !== existing.cedula) {
    const dupe = findUserByCedula(updates.cedula);
    if (dupe && dupe.email !== existing.email) {
      return { success: false, error: 'Esa cédula ya está registrada en otra cuenta.' };
    }
  }

  // Al mover de Trayecto se libera el titular si ya no corresponde
  let teacherEmail = updates.teacherEmail ?? existing.teacherEmail;
  if (updates.trayecto && updates.trayecto !== existing.trayecto) {
    const current = teacherEmail ? db[teacherEmail] : null;
    if (!current || current.trayecto !== updates.trayecto) {
      teacherEmail = getTeachersByTrayecto(updates.trayecto)[0]?.email ?? null;
    }
  }

  db[key] = { ...existing, ...updates, teacherEmail, email: existing.email };
  saveUsersDb(db);

  const session = getCurrentSession();
  if (session?.email === key) setCurrentSession(db[key]);

  return { success: true, user: db[key] };
}

/**
 * Cambiar contraseña de un usuario verificando contraseña actual
 */
export function updateUserPassword(email: string, actualPwd: string, nuevaPwd: string): AuthResult {
  const db = getUsersDb();
  const emailLower = email.trim().toLowerCase();
  const existing = db[emailLower];
  if (!existing) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  if (existing.passwordHash !== hashPassword(actualPwd)) {
    return { success: false, error: 'La contraseña actual no es correcta.' };
  }

  existing.passwordHash = hashPassword(nuevaPwd);
  db[emailLower] = existing;
  saveUsersDb(db);
  setCurrentSession(existing);
  return { success: true, user: existing };
}

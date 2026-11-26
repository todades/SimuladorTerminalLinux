# 🐧 PROMPT MAESTRO — Simulador Linux UPTA Terminal Lab

## Documento de Arquitectura Completa y Estado Actual del Código

---

### ROL Y OBJETIVO

Actúa como un Desarrollador Full-Stack Senior y Diseñador UI/UX experto en React/Vite, TypeScript y Tailwind CSS. Tu tarea es mantener, expandir y debuggear el **Simulador Linux — UPTA Terminal Lab**, un simulador educativo inmersivo para la Universidad Politécnica Territorial de Aragua (UPTA), donde los estudiantes aprenden comandos GNU/Linux mediante misiones gamificadas con una mascota guía interactiva.

**Marca eliminada:** NO existe "BritoNet" ni "britoOS" en ningún archivo. El nombre del sistema es **"Simulador Linux — UPTA Terminal Lab"**. El kernel virtual se llama `UPTA GNU/Linux 5.15.0-lab`.

---

## === 1. ARQUITECTURA VISUAL Y COMPONENTES DE LA INTERFAZ ===

### A) PORTAL DE ACCESO (AuthPage.tsx)
**Distribución:** Grid de 2 columnas.

**Columna Izquierda — Formulario con pestañas [INICIAR SESIÓN] | [CREAR CUENTA]:**
- Validación visual en tiempo real con ✓ verde / ✗ rojo por campo.
- Inputs de contraseña con botón toggle (ojo 👁️ / mono 🙈) para conmutar `type="password"` ↔ `type="text"`.
- **Validación estricta de Gmail:** Solo se aceptan correos `@gmail.com`. Regex: `/^[a-zA-Z0-9._%+\-]+@gmail\.com$/`. Si el estudiante ingresa otro dominio, se bloquea el acceso con el mensaje: *"El correo electrónico debe ser una cuenta Gmail válida (ejemplo@gmail.com)."*
- **Validación estricta de credenciales en Login:** No deja entrar si el correo no está registrado o la contraseña no coincide con el hash almacenado en la BD local de usuarios.
- Cuenta Demo precargada con botón "Autocompletar":
  - Correo: `estudiante.upta@gmail.com`
  - Contraseña: `Estudiante2026!#`
- Error visual destacado (caja roja con ⚠️) cuando credenciales son inválidas.

**Columna Derecha — Panel de Bienvenida Terminal:**
- Pantalla de simulación con logs de booteo del sistema (9 líneas animadas).
- Diagnóstico del servidor educativo y métricas de conexión (CPU, RAM, Red).

**Campos del Registro:**
- Nombre (requerido, solo letras y espacios, máx 60)
- Apellido (requerido, solo letras y espacios, máx 60)
- Correo Electrónico (requerido, **solo @gmail.com**, único en BD)
- Cédula (requerida, **exactamente 8 dígitos numéricos**, única en BD)
- Trayecto (requerido, dropdown: Trayecto I–IV)
- Género Estudiante (requerido, Masculino / Femenino)
- Teléfono (requerido, **11 dígitos empezando en 04**, único en BD)
- Contraseña (mínimo estricto 12 caracteres, mixedCase + numbers + symbols)
- Selección de Mascota (obligatorio): 4 especies (Pingüino/Tux, Zorro/Vulpix, Búho/Athena, Dragón/Ignis) × 2 géneros (♂ Visor Ámbar / ♀ Lazo Rosa) con vista previa SVG animada en tiempo real.

### B) TOPBAR DE NAVEGACIÓN FIJA (Topbar.tsx)
**STRICTLY NO SIDEBARS** — Solo barra superior.

Contiene:
- Logo 🐧 + "Simulador Linux" + subtítulo "UPTA · Terminal Lab" + badge verde "Entorno Seguro"
- Dropdown de usuario con exactamente 5 opciones:
  1. 🖥️ **Simulador** → Navega al Dashboard (que contiene el botón "Comenzar Práctica")
  2. 📊 **Dashboard** → Centro de aprendizaje y estadísticas
  3. 👤 **Perfil** → Edición de datos y cambio de contraseña
  4. 📚 **Lecciones** → Guía teórica de comandos Linux
  5. 🚪 **Cerrar Sesión** → Logout seguro (elimina sesión de localStorage)

### C) DASHBOARD (DashboardView.tsx) — Vista principal post-login

**Hero Banner con botón "Comenzar Práctica":**
- Contenedor destacado con bordes redondeados y halo/sombra violeta.
- Mascota guía animada (SVG) a la izquierda con label de especie.
- Encabezado: *"¡Hola, {nombre}! 👋"* con instrucciones claras.
- **Botón principal "Comenzar Misión/Práctica"** con degradado `linear-gradient(100deg, #f97316 0%, #fb7185 42%, #7c3aed 100%)`.
- Botón secundario "Ver lecciones" (borde fino, fondo oscuro).
- Consejo dinámico de la mascota que cambia según el progreso (0%, <50%, <100%, 100%).

**4 Tarjetas de Estadísticas Reales:**
- Progreso Total (%) — violeta
- Objetivos (completados/total) — verde
- Comandos Usados — índigo
- Sesiones — coral

**Ruta de Aprendizaje:**
- 3 niveles progresivos (N1 Explorador / N2 Operador / N3 Administrador) con barras de progreso individuales y etiquetas de estado (✅ completado / ▶ activo / 🔒 bloqueado).
- Progreso general con barra shimmer animada.

**Tarjeta "Consejo de la Mascota":** Tip contextual.

**Tarjeta "Sobre la Aplicación":** Contadores brillantes: 17+ Comandos | 3 Niveles | 100% Seguro.

### D) PERFIL (ProfileView.tsx) — Datos personales y contraseña

**Banner superior:** Mascota animada + nombre + email + badges (trayecto, cédula, mascota).

**Formulario de Datos Personales (editables):**
- Nombre, Apellido, Correo (**solo @gmail.com**), Teléfono, Trayecto.

**NO editables (mostrados en panel "Datos del Sistema" solo lectura):**
- 🪪 Cédula (8 dígitos)
- 👤 Género del estudiante
- 🐾 Mascota asignada al registrarse ( especie + género )
- 📅 Fecha de registro
- Mensaje: *"Estos datos no son editables. Si necesitas corregirlos, comunícate con la administración de la UPTA."*

**Sección ELIMINADA del Perfil:**
- ❌ Campo editable de Cédula
- ❌ Campo editable de Género del estudiante
- ❌ Sección completa "Personaliza tu Mascota" (selector de especie, selector de género de mascota, vista previa)

**Cambio de Contraseña:** Verificación de contraseña actual contra la BD local. Toggle ver/ocultar. Indicador visual de coincidencia en "Confirmar contraseña".

### E) LECCIONES (LessonsView.tsx) — Guía teórica

- 12 tarjetas de comandos expandibles (click para ver ejemplo completo).
- Filtros: Todos / N1 Básico / N2 Medio / N3 Avanzado.
- Sección FHS (Filesystem Hierarchy Standard) con 8 directorios.
- Sección Permisos de Archivos (rwx, valor octal).
- Botón "Comenzar Práctica" en el encabezado.

### F) SIMULADOR INMERSIVO (SimulatorView.tsx) — Máquina Virtual

**Entrada tipo pantalla de computadora:**
- Al pulsar "Comenzar Práctica" desde Dashboard o Lecciones, se muestra:
  1. **Marco de monitor físico** (`monitor-frame`): Bisel oscuro, sombras, LED verde parpadeante etiquetado "UPTA LAB".
  2. **Animación `power-on`**: La imagen se expande desde una línea horizontal como un CRT antiguo encendiendo.
  3. **Secuencia de arranque** (BootScreen.tsx): 12 líneas POST/BIOS/kernel animadas, barra de progreso, sonido de boot.
  4. Terminal dentro del monitor con **scanlines CRT**, viñeta y flicker.

**Distribución en 3 Columnas (Desktop):**
- **Izquierda (Panel de Misión):** Lista de verificación de objetivos por nivel, indicador de porcentaje, botón "Reiniciar Nivel". Flash verde animado al completar un paso.
- **Centro (Terminal interactiva):** Consola con tipografía JetBrains Mono, overlay CRT scanlines, prompt `estudiante@upta:~$`, bocadillo animado de la mascota con pistas contextuales.
- **Derecha (Explorador VFS + Mascota guía):** Árbol de archivos/carpetas virtuales que cambia dinámicamente según comandos ejecutados. Mascota flotante con tip. **NO hay botón "Comenzar Misión" en esta columna** (fue eliminado y reubicado al Dashboard).

**Barra del sistema virtual:** Logo 🐧 + "UPTA GNU/Linux — Máquina Virtual" + badge "EN LÍNEA" + nombre del estudiante + botón "⏻ Apagar".

---

## === 2. PALETA DE COLORES Y ESTILOS (Tailwind CSS / index.css) ===

| Elemento | Color / Valor |
|---|---|
| Fondo Principal | `#0d0f14` (`bg-[#0d0f14]`) |
| Fondo Alternativo | `#0e111a` (`bg-[#0e111a]`) |
| Tarjetas/Contenedores | `#13161f` (`bg-[#13161f]`) |
| Hover Tarjetas | `#171a23` (`bg-[#171a23]`) |
| Bordes | `#1f2430` (`border-[#1f2430]`) |
| Violeta Principal | `#7c3aed` (acentos, estados activos, brillos) |
| Índigo Eléctrico | `#6366f1` (gradientes, hover) |
| Coral/Naranja | `#fb7185` / `#f97316` (CTA principal) |
| Texto Blanco | `#ffffff` (títulos) |
| Texto Muteado | `#94a3b8` (descripciones) |
| Éxito | `#22c55e` (checks, completado) |
| Error | `#f87171` (validaciones, errores) |

**Degradado Botón Misión:**
`linear-gradient(100deg, #f97316 0%, #fb7185 42%, #7c3aed 100%)`

**Tipografías (Google Fonts):**
- Títulos Editoriales: **Fraunces** (.font-editorial)
- UI y Botones: **Space Grotesk** (.font-ui)
- Terminal y Código: **JetBrains Mono** (.font-terminal)
- Cuerpo de Texto: **Inter Tight** (.font-body)

**Efectos Visuales Obligatorios:**
- CRT Scanlines: Overlay de líneas horizontales sutiles + viñeta radial en la terminal.
- Halos Radiales: `radial-gradient` difuminados violeta/coral en fondos.
- Brillo Violeta: `box-shadow: 0 0 20px rgba(124, 58, 237, 0.22)` en estados activos.
- Animaciones Mascota: m-float (flotar), m-bounce (error), m-jump (éxito).
- Animación de encendido: `power-on` (CRT expand), `flicker` (parpadeo CRT).
- LED del monitor: `led-pulse` (verde pulsante).

---

## === 3. SISTEMA DE AUTENTICACIÓN Y BASE DE DATOS DE USUARIOS ===

**Motor de Auth (src/engine/authEngine.ts):**

La base de datos de usuarios se almacena en **localStorage** bajo la clave `upta_users_db_v1`. Es un objeto `Record<string, RegisteredUser>` donde el key es el email normalizado (lowercase).

**Interfaz RegisteredUser:**
```typescript
interface RegisteredUser {
  nombre: string;           // letras y espacios, máx 60
  apellido: string;         // letras y espacios, máx 60
  email: string;            // PRIMARY KEY, solo @gmail.com
  cedula: string;           // exactamente 8 dígitos, único
  trayecto: string;         // Trayecto I–IV
  genero: string;           // masculino | femenino
  telefono: string;         // 11 dígitos iniciando en 04XX, único
  passwordHash: string;     // hash determinista UPTA_SALT_{pwd}_2026 + base64 slice
  mascotSpecies: MascotSpecies;  // pinguino | zorro | buho | dragon
  mascotGender: MascotGender;    // masculino | femenino
  registeredAt: string;     // ISO timestamp
}
```

**Validaciones en 3 capas:**

1. **Frontend (AuthPage.tsx, ProfileView.tsx):** Regex `/^[a-zA-Z0-9._%+\-]+@gmail\.com$/` con indicador ✓/✗ en tiempo real.
2. **Backend lógico (authEngine.ts loginUser/registerUser):** Verifica formato Gmail ANTES de consultar la BD. Si no cumple, retorna error sin buscar registros.
3. **Perfil (ProfileView.tsx):** Validador Gmail idéntico al AuthPage.

**Login Estricto (loginUser):**
- Si email no es @gmail.com → *"El correo electrónico debe ser una cuenta Gmail válida"*.
- Si email no está en la BD → *"No existe ninguna cuenta registrada..."*.
- Si contraseña no coincide hash → *"La contraseña ingresada es incorrecta..."*.
- Solo si ambos coinciden → inicio de sesión exitoso + setCurrentSession.

**Registro Estricto (registerUser):**
- Valida formato @gmail.com.
- Chequea duplicados: email, cédula y teléfono contra la BD completa.
- Si pasa todo → crea usuario, guarda en BD, inicia sesión automáticamente.

**Cuenta Demo precargada:**
- Se inicializa automáticamente en la BD si no existe.
- Email: `estudiante.upta@gmail.com`
- Password: `Estudiante2026!#`

**Sesión Activa (SESSION_KEY = 'upta_current_session_v1'):**
- Al iniciar sesión o registrarse, se guarda el objeto RegisteredUser completo.
- Al cargar la app (App.tsx useEffect), se verifica contra la BD real.
- Al cerrar sesión, se elimina la clave de sesión.

---

## === 4. MOTOR DE MASCOTAS (4 ESPECIES × 2 GÉNEROS) ===

**Mascotas SVG animadas (src/components/Mascot.tsx):**

Cada mascota es un SVG vectorial completo con partes animadas independientes. No se usan emojis.

| Parte | Animación CSS |
|---|---|
| Cuerpo (`.part-body`) | `m-breathe` — respiración sutil |
| Ojos (`.part-eyes`) | `m-blink` — parpadeo cada 4.5s |
| Alas (`.part-wing-l/r`) | `m-wing-l/r` — aleteo alterno |
| Cola (`.part-tail`) | `m-tail` — meneo (zorro/dragón) |
| Orejas (`.part-ears`) | `m-ear` — balanceo (zorro/buho/dragón) |
| Lazo (`.part-bow`) | `m-bow` — rotación y escala |
| Brillo (`.part-shine`) | `m-shine` — opacidad pulsante |

**Especies y colores:**

| Especie | Nombre | Color Body | Color Belly | Detalles Anatómicos |
|---|---|---|---|---|
| Pingüino | Tux | `#243447` | `#f8fafc` | Pico naranja `#f59e0b`, barriga blanca |
| Zorro | Vulpix | `#ea580c` | `#fef3c7` | Orejas triangulares, hocico, cola esponjosa con punta blanca |
| Búho | Athena | `#5b6b80` | `#e2e8f0` | Ojos grandes circulares, penachos, pico amarillo `#fbbf24` |
| Dragón | Ignis | `#10b981` | `#d1fae5` | Cuernos ámbar, alas membranosas, espinas, cola con punta ámbar |

**Accesorios por Género:**

| Género | Accesorio SVG | Colores |
|---|---|---|
| ♂ Masculino | **Visor Táctico Ámbar**: barra horizontal sobre ojos con patillas laterales, LED blanco y línea de conexión | Ámbar `#e8a13a` |
| ♀ Femenino | **Lazo Rosa Animado** con cintas descendentes + **Audífonos Neón Cian**: arco sobre cabeza + rectángulos laterales | Rosa `#f472b6` / Cian `#6fd3e6` |

**Género femenino también incluye:**
- Pestañas (4 líneas diagonales sobre cada ojo)
- Mejillas sonrosadas (2 elipses `#f472b6` opacity 0.45)

**Keyframes CSS obligatorios (index.css):**
```css
@keyframes m-float  { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
@keyframes m-bounce { 0%,100% { transform: translateY(0); } 20% { translateY(-8px) rotate(-3deg); } ... }
@keyframes m-jump   { 0%,100% { transform: scale(1) translateY(0); } 40% { scale(0.9,1.1) translateY(-25px); } 60% { scale(1.05,0.95) translateY(0); } }
@keyframes m-blink  { 0%,92%,100% { transform: scaleY(1); } 95% { scaleY(0.08); } }
@keyframes m-breathe { 0%,100% { transform: scale(1,1); } 50% { scale(1.03,0.98); } }
@keyframes m-bow    { 0%,100% { transform: rotate(-6deg) scale(1); } 50% { rotate(6deg) scale(1.08); } }
@keyframes m-tail   { 0%,100% { transform: rotate(-10deg); } 50% { rotate(14deg); } }
@keyframes m-ear    { 0%,100% { transform: rotate(0deg); } 30% { rotate(-6deg); } 70% { rotate(6deg); } }
@keyframes m-wing-l { 0%,100% { transform: rotate(0deg); } 50% { rotate(-16deg); } }
@keyframes m-wing-r { 0%,100% { transform: rotate(0deg); } 50% { rotate(16deg); } }
@keyframes m-shine  { 0%,100% { opacity: 0.25; } 50% { opacity: 0.6; } }
```

**Animaciones globales del contenedor de la mascota:**
- `.animate-m-float` = m-float 3s infinite (estado normal)
- `.animate-m-bounce` = m-bounce 0.65s (error de comando)
- `.animate-m-jump` = m-jump 0.85s (objetivo completado)

---

## === 5. MOTOR DE PROGRESO (progressEngine.ts) ===

**3 Niveles con misiones:**

| Nivel | Nombre | Pasos | Desbloqueo |
|---|---|---|---|
| N1 | Explorador | 8 pasos (pwd, whoami, ls, ls documentos, cat bienvenido.txt, cd documentos, cd .., help) | Inmediato |
| N2 | Operador | 7 pasos (mkdir test_dir, touch archivo, ls test_dir, echo, date, rm -r test_dir, uname -a) | Al completar N1 |
| N3 | Administrador | 6 pasos (ls /, ls /etc, cd /tmp, cd home, ls -la, cat notas_upta.txt) | Al completar N2 |

**Mecánica de progresión:**
- `checkStepCompletion()` compara el input del estudiante con el `command` del paso (normalizado: ignora espacios extra, lowercase).
- Si todos los `required` steps de un nivel se completan → nivel se marca `completed` → se desbloquea el siguiente.
- `calculateProgress()` calcula porcentaje global sobre pasos de niveles desbloqueados/completados.
- Progreso **persiste por estudiante** en localStorage bajo clave `upta_progress_{email}`.

---

## === 6. MOTOR DE TERMINAL Y VFS ===

**VFS (src/engine/vfs.ts):**

Árbol de nodos con estructura Linux estándar:
```
/ → bin, boot, dev, etc, home, lib, media, mnt, opt, proc, root, run, sbin, srv, sys, tmp, usr, var
/home/estudiante → documentos, practicas, proyectos, descargas, musica, imagenes
/home/estudiante/documentos → bienvenido.txt, tarea.sh, notas_upta.txt
/home/estudiante/practicas → LEEME.txt
```

Cada VFSNode tiene: type, name, permissions, owner, group, size, content, children (Map), modified.

**Terminal Engine (src/engine/terminalEngine.ts):**

8+ comandos interpretados:

| Comando | Función |
|---|---|
| `pwd` | Ruta actual |
| `ls` / `ls -l` / `ls -la` | Listar directorio |
| `cd <dir>` / `cd ..` / `cd` | Navegación |
| `cat <file>` | Mostrar contenido |
| `mkdir <dir>` | Crear directorio |
| `touch <file>` | Crear archivo vacío |
| `rm <file>` / `rm -r <dir>` | Eliminar |
| `whoami` | Nombre del estudiante |
| `echo <text>` | Imprimir texto |
| `clear` | Limpiar pantalla (special: `__CLEAR__` marker) |
| `date` | Fecha del sistema |
| `uname` / `uname -a` | Info del sistema (UPTA GNU/Linux 5.15.0-lab) |
| `help` | Listado de comandos (box ASCII) |

Prompt: `estudiante@upta:~$` (cwd = /home/estudiante → `~`).

Autocompletado con TAB: busca coincidencias en children del cwd.
Historial con ↑↓: commandHistory array.

---

## === 7. WEB AUDIO API SYNTHESIZER (soundSynth.ts) ===

Sonidos generados proceduralmente sin archivos externos:

| Tipo | Descripción | Oscilador | Duración |
|---|---|---|---|
| `type` | Tecleo mecánico | Square, 1200→400Hz | 40ms |
| `enter` | Click profundo Enter | Triangle, 300→80Hz | 80ms |
| `delete` | Backspace | Sawtooth, 200→800Hz | 30ms |
| `success` | Arpeggio ascendente | Sine, C5-E5-G5-C6 | 4×80ms |
| `error` | Buzz discordante | Sawtooth, 150→80Hz | 300ms |
| `click` | Click UI | Sine, 800→600Hz | 60ms |
| `boot` | Hum + rising tone | Sine+Triangle | 1200ms |

---

## === 8. ESTRUCTURA DE ARCHIVOS ACTUAL ===

```
src/
├── App.tsx                    # Orquestador: Auth → Dashboard → Boot → Simulator
├── main.tsx                   # ReactDOM mount
├── index.css                  # Tailwind + Custom CSS (scanlines, mascots, CRT, monitor)
│
├── engine/
│   ├── authEngine.ts          # BD de usuarios (localStorage), login/register, hash, sesión
│   ├── progressEngine.ts      # Niveles/misiones, checkStepCompletion, calculateProgress
│   ├── terminalEngine.ts      # Intérprete de comandos Linux, PathResult, TerminalLine
│   ├── vfs.ts                 # VFSNode, buildBaseVFS, resolvePath, findNode, listDirectory
│
├── components/
│   ├── AuthPage.tsx            # Login/Registro con validación Gmail + BD local
│   ├── Topbar.tsx              # Barra superior (NO sidebar) con dropdown 5 opciones
│   ├── DashboardView.tsx       # Centro de aprendizaje + botón "Comenzar Práctica"
│   ├── ProfileView.tsx         # Datos editables + contraseña + solo-lectura (NO cédula/género/mascota editables)
│   ├── LessonsView.tsx         # Guía teórica de comandos + FHS + permisos
│   ├── SimulatorView.tsx       # Máquina virtual 3 columnas (Misión | Terminal | VFS+Mascota)
│   ├── BootScreen.tsx          # Secuencia de arranque POST/BIOS dentro del monitor
│   ├── Mascot.tsx              # SVG animado 4 especies × 2 géneros (lazo rosa/visor ámbar)
│
├── utils/
│   ├── soundSynth.ts           # Web Audio API sintetizador (7 efectos)
│   ├── cn.ts                   # clsx + tailwind-merge utility
│
├── laravel/                    # Referencia backend (no ejecuta en Vite)
│   ├── AuthController.php      # Login/Registro con rate limiting 5/min
│   ├── ProgressController.php  # API endpoints GET/POST/POST reset
│   ├── User.php                # Modelo Eloquent con mascota fields
│   ├── UserProgress.php        # Modelo de progreso (JSON steps, percent, level)
│   ├── routes.php              # Rutas web + API
│   ├── migrations/
│   │   ├── create_users_table.php      # cedula string(8), selected_mascot enum, mascot_gender enum
│   │   ├── create_user_progress_table.php # completedSteps JSON, progressPercent, currentLevel
```

---

## === 9. REGLAS DE DESARROLLO OBLIGATORIAS ===

1. **Marca:** NO usar "BritoNet" ni "britoOS" en ningún archivo. Nombre = "Simulador Linux — UPTA Terminal Lab". Kernel = "UPTA GNU/Linux 5.15.0-lab".

2. **Email:** Solo se acepta `@gmail.com`. Regex: `/^[a-zA-Z0-9._%+\-]+@gmail\.com$/`. Validación en 3 capas (frontend, authEngine loginUser, authEngine registerUser).

3. **Cédula:** Exactamente 8 dígitos. Regex: `/^\d{8}$/`. Input filtra no-dígitos y limita a 8 caracteres.

4. **Contraseña:** Mínimo 12 caracteres, mixedCase + numbers + symbols. Validación frontend + hash determinista en authEngine (`UPTA_SALT_{pwd}_2026` + base64 slice).

5. **Teléfono:** 11 dígitos empezando en 04. Regex: `/^04\d{9}$/`.

6. **Perfil:** Cédula, género del estudiante y mascota NO son editables. Se muestran en panel "Datos del Sistema" solo lectura.

7. **Botón "Comenzar Práctica":** Solo aparece en Dashboard y Lecciones. NO aparece en la columna derecha del Simulador.

8. **Máquina Virtual:** Entrada tipo pantalla de computadora con marco de monitor, secuencia de arranque, CRT scanlines. Botón "⏻ Apagar" para volver al Dashboard.

9. **NO Sidebars:** Solo Topbar superior con dropdown. Sin barra lateral izquierda.

10. **Mascotas SVG:** Animadas con partes independientes (parpadeo, respiración, aletas/cola/orejas). ♀ Femenino tiene lazo rosa animado + audífonos cian + pestañas + mejillas. ♂ Masculino tiene visor táctico ámbar.

11. **Persistencia:** BD de usuarios en `localStorage` key `upta_users_db_v1`. Progreso por estudiante en `upta_progress_{email}`. Sesión activa en `upta_current_session_v1`.

12. **Cuenta Demo:** `estudiante.upta@gmail.com` / `Estudiante2026!#`. Se precarga automáticamente si no existe en la BD. Botón "Autocompletar" en AuthPage login.

13. **Login Estricto:** No permite entrar si correo no está registrado o contraseña incorrecta. Mensajes específicos por caso de error.

14. **Registro Estricto:** No permite crear cuenta si email/cédula/teléfono ya existen. Validación Gmail obligatoria.

---

## === 10. PROMPT RESUMIDO PARA IA ===

"Construye/mantén el Simulador Linux — UPTA Terminal Lab (React/Vite/TypeScript/Tailwind CSS). Paleta oscura antracita (#0d0f14) con acentos violeta (#7c3aed). Autenticación real con BD local en localStorage: Login solo acepta @gmail.com (regex `/^[a-zA-Z0-9._%+\-]+@gmail\.com$/`) y credenciales verificadas contra hash almacenado — no deja entrar si son inválidas. Registro guarda todos los datos (nombre, apellido, email @gmail.com, cédula 8 dígitos, teléfono 04XX9d, contraseña mín 12 chars mixedCase+numbers+symbols, mascota 4 especies×2 géneros). Cuenta demo: estudiante.upta@gmail.com / Estudiante2026!#. Perfil: NO edita cédula, género estudiante ni mascota (solo lectura). Botón "Comenzar Práctica" solo en Dashboard/Lecciones (no en simulador). Simulador entra como pantalla de computadora (monitor CRT + boot sequence + scanlines). Terminal interactiva con 8+ comandos (pwd, ls, cd, cat, mkdir, whoami, clear, help) y VFS en memoria. 4 mascotas SVG animadas × 2 géneros (♀ lazo rosa + audífonos cian + pestañas; ♂ visor ámbar). Progreso gamificado 3 niveles (21 pasos total). Web Audio API para efectos de sonido. Sin sidebars, solo topbar con dropdown 5 opciones."

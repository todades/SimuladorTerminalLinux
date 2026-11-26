// ============================================================
// 📊 PROGRESS ENGINE — 4 Trayectos × 3 Niveles
// Motor de misiones gamificado con feedback de mascota
// ============================================================

import { api } from '../services/api';
import { getCurrentSession } from './authEngine';

export type TrayectoId = 1 | 2 | 3 | 4;

export interface MissionStep {
  id: string;
  command: string;           // comando exacto requerido (normalizado para comparación)
  altCommands?: string[];    // alternativas aceptadas (rutas relativas, etc.)
  description: string;
  hint: string;
  required: boolean;
  completed: boolean;
  mascotRest?: string;      // mensaje reposo (concepto técnico)
  mascotTip?: string;       // mensaje de pista (error / 30s inactivo)
  mascotSuccess?: string;   // mensaje de éxito (m-jump)
  expectedOutput?: string;  // fragmento de salida esperada
}

export interface MissionLevel {
  id: number;
  trayectoId: TrayectoId;
  name: string;
  description: string;
  steps: MissionStep[];
  unlocked: boolean;
  completed: boolean;
}

export interface Trayecto {
  id: TrayectoId;
  title: string;
  color: string;
  icon: string;
  levels: MissionLevel[];
}

export interface UserProgress {
  completedSteps: string[];
  progressPercent: number;
  currentTrayecto: TrayectoId;
  currentLevel: number;
  trayectos: Trayecto[];
  levels?: MissionLevel[];
}

// ─── TRAYECTO I: Fundamentos, Navegación, Gestión de Archivos y Permisos ──

function trayecto1(): MissionLevel[] {
  return [
    {
      id: 1, trayectoId: 1,
      name: 'Nivel 1: Exploración y Diagnóstico de Directorios',
      description: 'Navega el sistema de archivos e inspecciona registros del sistema.',
      unlocked: true, completed: false,
      steps: [
        {
          id: 't1_l1_s1', command: 'pwd', required: true, completed: false,
          description: 'Verificar ubicación actual en el sistema.',
          hint: 'Escribe pwd para ver tu ubicación actual.',
          mascotRest: '¡Hola! Para no perderte en Linux, siempre consulta tu ubicación con "pwd" (Print Working Directory).',
          mascotTip: '¿No sabes dónde estás? Escribe "pwd" para descubrir tu ruta actual.',
          mascotSuccess: '¡Perfecto! "pwd" te dice exactamente dónde estás en el árbol de directorios.',
          expectedOutput: '/home/estudiante',
        },
        {
          id: 't1_l1_s2', command: 'ls -la /var/log', required: true, completed: false,
          altCommands: ['ls -la /var/log/'],
          description: 'Inspeccionar el directorio /var/log mostrando archivos ocultos y detalles.',
          hint: 'Usa "ls -la /var/log" para ver permisos, propietarios y archivos ocultos.',
          mascotRest: 'La bandera "-la" te permite ver permisos, propietarios y archivos ocultos que inician con punto.',
          mascotTip: '¿Necesitas ver detalles y ocultos? Prueba "ls -la /var/log".',
          mascotSuccess: '¡Excelente! "-la" revela permisos, propietarios y archivos ocultos.',
          expectedOutput: 'drwxr-xr-x',
        },
        {
          id: 't1_l1_s3', command: 'cd /home/estudiante/documentos', required: true, completed: false,
          altCommands: ['cd documentos', 'cd ~/documentos', 'cd ~/documentos/'],
          description: 'Navegar al directorio de documentos personales.',
          hint: 'Usa "cd documentos" o "cd /home/estudiante/documentos" para moverte.',
          mascotRest: 'Nos hemos movido al directorio de trabajo. Observa cómo cambió la ruta en tu terminal.',
          mascotTip: '¿Necesitas moverte? "cd" cambia de directorio.',
          mascotSuccess: '¡Nos movimos! Observa cómo el prompt cambió a ~/documentos.',
          expectedOutput: '',
        },
        {
          id: 't1_l1_s4', command: 'head -n 5 diario.txt', required: true, completed: false,
          description: 'Leer los primeros 5 registros del diario del sistema.',
          hint: 'Escribe "head -n 5 diario.txt" para leer las primeras líneas.',
          mascotRest: '"head -n 5" es ideal para revisar rápidamente el encabezado de archivos de registro muy extensos.',
          mascotTip: '¿Quieres ver solo el inicio de un archivo? "head -n N archivo" muestra las primeras N líneas.',
          mascotSuccess: '¡Muy bien! "head -n 5" te ahorra leer archivos completos.',
          expectedOutput: 'Log entry',
        },
      ],
    },
    {
      id: 2, trayectoId: 1,
      name: 'Nivel 2: Estructuración, Redacción y Clonación de Archivos',
      description: 'Crea directorios, archivos y maneja redirección.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't1_l2_s1', command: 'mkdir -p proyectos/modulo1', required: true, completed: false,
          altCommands: ['mkdir -p proyectos/modulo1/'],
          description: 'Crear una estructura de carpetas anidadas para el Módulo 1.',
          hint: 'La opción "-p" crea directorios padres e hijos. Escribe "mkdir -p proyectos/modulo1".',
          mascotRest: 'La opción "-p" de mkdir crea directorios padres e hijos en una sola línea. ¡Ahorra mucho tiempo!',
          mascotTip: '¿Necesitas carpetas anidadas? "mkdir -p ruta/anidada" las crea todas.',
          mascotSuccess: '¡Estructura creada! "-p" es la forma eficiente de crear árboles de directorios.',
          expectedOutput: '',
        },
        {
          id: 't1_l2_s2', command: 'touch proyectos/modulo1/reporte.txt', required: true, completed: false,
          description: 'Crear un archivo en blanco llamado reporte.txt.',
          hint: 'Usa "touch proyectos/modulo1/reporte.txt" para crearlo.',
          mascotRest: '"touch" crea archivos vacíos al instante. Ahora está listo para recibir contenido.',
          mascotTip: '¿Necesitas un archivo vacío? "touch ruta/archivo" lo crea.',
          mascotSuccess: '¡Archivo creado! "touch" genera archivos vacíos en un instante.',
          expectedOutput: '',
        },
        {
          id: 't1_l2_s3', command: 'echo "Sistema Operativo Linux UPTA" > proyectos/modulo1/reporte.txt', required: true, completed: false,
          altCommands: ['echo "Sistema Operativo Linux UPTA">proyectos/modulo1/reporte.txt'],
          description: 'Redactar la cabecera oficial en el archivo mediante redirección.',
          hint: 'Usa "echo "texto" > archivo" para escribir. El operador > redirige la salida.',
          mascotRest: 'El operador ">" sobrescribe o crea el archivo insertando el texto proporcionado por "echo".',
          mascotTip: '¿Quieres escribir en un archivo? "echo texto > archivo" lo crea o sobrescribe.',
          mascotSuccess: '¡Escritura exitosa! ">" redirigió la salida de echo al archivo.',
          expectedOutput: '',
        },
        {
          id: 't1_l2_s4', command: 'cp proyectos/modulo1/reporte.txt proyectos/modulo1/backup.txt', required: true, completed: false,
          description: 'Generar una copia de respaldo del reporte.',
          hint: 'Usa "cp origen destino" para copiar archivos.',
          mascotRest: '¡Copia generada! Siempre es buena práctica crear backups antes de cambios.',
          mascotTip: '¿Necesitas un respaldo? "cp archivo_original copia" crea el duplicado.',
          mascotSuccess: '¡Backup creado! "cp" genera copias exactas de archivos.',
          expectedOutput: '',
        },
      ],
    },
    {
      id: 3, trayectoId: 1,
      name: 'Nivel 3: Permisos de Seguridad y Validación de Usuario',
      description: 'Aplica permisos POSIX y verifica tu identidad.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't1_l3_s1', command: 'chmod 600 proyectos/modulo1/backup.txt', required: true, completed: false,
          description: 'Aplicar permisos estrictos de lectura y escritura únicamente para el dueño.',
          hint: 'Aplica "chmod 600 proyectos/modulo1/backup.txt".',
          mascotRest: 'El código 600 en octal otorga (4+2=6) Lectura/Escritura al propietario y 0 a grupos y otros.',
          mascotTip: '¿Necesitas privacidad? "chmod 600" solo permite acceso al dueño.',
          mascotSuccess: '¡Permisos aplicados! 600 = rw-------. Solo el dueño puede leer y escribir.',
          expectedOutput: '',
        },
        {
          id: 't1_l3_s2', command: 'chmod 755 proyectos/modulo1', required: true, completed: false,
          altCommands: ['chmod 755 proyectos/modulo1/'],
          description: 'Otorgar acceso de lectura y ejecución al directorio de proyectos.',
          hint: 'Usa "chmod 755 proyectos/modulo1".',
          mascotRest: '755 permite acceso total al dueño, y lectura/ejecución al resto del personal informático.',
          mascotTip: '¿Directorio compartido? "chmod 755" permite acceso al dueño y lectura al resto.',
          mascotSuccess: '¡Permisos ajustados! 755 = rwxr-xr-x. Dueño total, resto lectura/ejecución.',
          expectedOutput: '',
        },
        {
          id: 't1_l3_s3', command: 'whoami', required: true, completed: false,
          description: 'Confirmar el nombre del usuario activo para firmar la entrega.',
          hint: 'Escribe "whoami" para verificar tu usuario.',
          mascotRest: '¡Felicidades! Has completado el Trayecto I. Tu usuario está autenticado y registrado.',
          mascotTip: '¿Quieres saber quién eres? "whoami" muestra tu nombre de usuario.',
          mascotSuccess: '🏆 ¡Trayecto I completado! Tu identidad está verificada. ¡Excelente trabajo, administrador!',
          expectedOutput: 'estudiante',
        },
      ],
    },
  ];
}

// ─── TRAYECTO II: Administración de Texto, Filtros, Tuberías y Empaquetado ──

function trayecto2(): MissionLevel[] {
  return [
    {
      id: 4, trayectoId: 2,
      name: 'Nivel 4: Filtrado y Búsqueda de Eventos en Registros',
      description: 'Busca y filtra información en logs del sistema.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't2_l1_s1', command: 'tail -n 15 sys_events.log', required: true, completed: false,
          altCommands: ['tail -n15 sys_events.log', 'tail -15 sys_events.log', 'cd /var/log'],
          description: 'Navegar a /var/log e inspeccionar las últimas 15 líneas de eventos.',
          hint: 'Primero navega con "cd /var/log" y luego ejecuta "tail -n 15 sys_events.log".',
          mascotRest: '"tail -n 15" es la herramienta preferida por administradores para diagnosticar eventos recientes. Los logs viven en /var/log.',
          mascotTip: '¿Necesitas ver el final de un log? Ve a /var/log con "cd" y usa "tail -n 15 sys_events.log".',
          mascotSuccess: '¡Últimos eventos visualizados! "tail" es esencial para monitoreo en tiempo real.',
          expectedOutput: 'sys_events',
        },
        {
          id: 't2_l1_s2', command: 'grep "ERROR" sys_events.log', required: true, completed: false,
          altCommands: ['grep ERROR sys_events.log', "grep 'ERROR' sys_events.log"],
          description: 'Filtrar y aislar líneas que contengan errores críticos.',
          hint: 'Filtra con "grep "ERROR" sys_events.log".',
          mascotRest: '"grep" busca patrones de texto en segundos. Ha encontrado los fallos registrados.',
          mascotTip: '¿Buscas algo específico? "grep PATRÓN archivo" filtra líneas que coincidan.',
          mascotSuccess: '¡Errores encontrados! "grep" aísla las líneas críticas del registro.',
          expectedOutput: 'ERROR',
        },
        {
          id: 't2_l1_s3', command: 'find /home -name "*.conf"', required: true, completed: false,
          altCommands: ['find /home/ -name "*.conf"'],
          description: 'Localizar todos los archivos de configuración .conf en /home.',
          hint: 'Usa "find /home -name "*.conf"" para buscar archivos.',
          mascotRest: '"find" rastrea recursivamente carpetas buscando patrones con comodines como "*.conf".',
          mascotTip: '¿Buscas archivos por nombre? "find ruta -name patrón" los encuentra.',
          mascotSuccess: '¡Archivos encontrados! "find" es el buscador más potente de Linux.',
          expectedOutput: '.conf',
        },
      ],
    },
    {
      id: 5, trayectoId: 2,
      name: 'Nivel 5: Tuberías (Pipes) y Redirección de Flujos',
      description: 'Combina comandos con pipes y redirige salida.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't2_l2_s1', command: 'grep "WARNING" sys_events.log | wc -l', required: true, completed: false,
          altCommands: ['grep WARNING sys_events.log | wc -l', "grep 'WARNING' sys_events.log | wc -l"],
          description: 'Contar la cantidad exacta de líneas que contienen advertencias.',
          hint: 'Usa "grep "WARNING" sys_events.log | wc -l" para contar coincidencias.',
          mascotRest: '¡Pipes en acción! La tubería "|" envía el resultado de grep como entrada para "wc -l" (Word Count lines).',
          mascotTip: '¿Contar resultados? "grep patrón archivo | wc -l" los cuenta.',
          mascotSuccess: '¡Pipes en acción! "|" conecta comandos como una cadena de producción.',
          expectedOutput: '14',
        },
        {
          id: 't2_l2_s2', command: 'cat usuarios.txt | sort | uniq > usuarios_ordenados.txt', required: true, completed: false,
          description: 'Ordenar alfabéticamente y eliminar duplicados de la lista de usuarios.',
          hint: 'Usa "cat usuarios.txt | sort | uniq > usuarios_ordenados.txt".',
          mascotRest: 'Combinaste 3 comandos con tuberías y redirigiste la salida a un archivo nuevo. ¡Nivel avanzado!',
          mascotTip: '¿Limpiar una lista? "cat archivo | sort | uniq > salida" ordena y elimina duplicados.',
          mascotSuccess: '¡3 comandos encadenados! sort + uniq + redirección = lista limpia.',
          expectedOutput: '',
        },
        {
          id: 't2_l2_s3', command: 'echo "Auditoría completada por estudiante" >> usuarios_ordenados.txt', required: true, completed: false,
          altCommands: ['echo "Auditoria completada por estudiante" >> usuarios_ordenados.txt'],
          description: 'Anexar la firma de auditoría al archivo sin borrar su contenido.',
          hint: 'Usa ">>" para anexar sin sobrescribir.',
          mascotRest: 'Usar ">>" anexa contenido al final. Si hubieses usado ">", habrías borrado el texto anterior.',
          mascotTip: '¿Agregar sin borrar? "echo texto >> archivo" anexa al final.',
          mascotSuccess: '¡Firma agregada! ">>" anexa sin destruir. ¡Cuidado con ">"!',
          expectedOutput: '',
        },
      ],
    },
    {
      id: 6, trayectoId: 2,
      name: 'Nivel 6: Archivado y Compresión de Datos de Auditoría',
      description: 'Empaqueta y comprime directorios con tarball.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't2_l3_s1', command: 'mkdir -p /tmp/respaldos', required: true, completed: false,
          description: 'Crear el directorio de respaldos temporales en /tmp.',
          hint: 'Usa "mkdir -p /tmp/respaldos".',
          mascotRest: 'La carpeta "/tmp" almacena archivos temporales del sistema.',
          mascotTip: '¿Directorio temporal? "/tmp" es el lugar estándar en Linux.',
          mascotSuccess: '¡Directorio creado! "/tmp" es el estándar para datos temporales.',
          expectedOutput: '',
        },
        {
          id: 't2_l3_s2', command: 'tar -czvf /tmp/respaldos/logs_backup.tar.gz /var/log', required: true, completed: false,
          altCommands: ['tar -czvf /tmp/respaldos/logs_backup.tar.gz /var/log/'],
          description: 'Empaquetar y comprimir todo el directorio de logs en un tarball .tar.gz.',
          hint: 'Comprime con "tar -czvf /tmp/respaldos/logs_backup.tar.gz /var/log".',
          mascotRest: '-c (create), -z (gzip), -v (verbose), -f (file). Has reducido el espacio en disco eficientemente.',
          mascotTip: '¿Comprimir? "tar -czvf archivo.tar.gz directorio" crea el tarball.',
          mascotSuccess: '¡Tarball creado! -c -z -v -f son las banderas clave de tar.',
          expectedOutput: 'logs_backup.tar.gz',
        },
        {
          id: 't2_l3_s3', command: 'ls -lh /tmp/respaldos', required: true, completed: false,
          altCommands: ['ls -lh /tmp/respaldos/'],
          description: 'Verificar el tamaño en formato humano del archivo comprimido.',
          hint: 'Usa "ls -lh /tmp/respaldos" para ver tamaños legibles.',
          mascotRest: 'La bandera "-h" convierte los bytes a KB, MB o GB para fácil lectura.',
          mascotTip: '¿Tamaño legible? "ls -lh" muestra KB/MB en vez de bytes.',
          mascotSuccess: '🏆 ¡Trayecto II completado! Dominas filtros, pipes y compresión.',
          expectedOutput: 'K',
        },
      ],
    },
  ];
}

// ─── TRAYECTO III: Control de Procesos, Usuarios, Permisos de Grupo y Red ──

function trayecto3(): MissionLevel[] {
  return [
    {
      id: 7, trayectoId: 3,
      name: 'Nivel 7: Auditoría de Recursos y Gestión de Procesos',
      description: 'Lista, filtra y finaliza procesos del sistema.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't3_l1_s1', command: 'ps aux', required: true, completed: false,
          description: 'Listar la tabla completa de procesos activos en la máquina virtual.',
          hint: 'Escribe "ps aux" para ver todos los procesos.',
          mascotRest: '"ps aux" muestra todos los procesos de todos los usuarios actualmente cargados en memoria RAM.',
          mascotTip: '¿Qué se está ejecutando? "ps aux" lista todos los procesos.',
          mascotSuccess: '¡Procesos listados! USER, PID, %CPU, %MEM, COMMAND.',
          expectedOutput: 'PID',
        },
        {
          id: 't3_l1_s2', command: 'ps aux | grep "python"', required: true, completed: false,
          altCommands: ['ps aux | grep python', "ps aux | grep 'python'"],
          description: 'Filtrar la lista para identificar el PID del proceso de Python fuera de control.',
          hint: 'Filtra con "ps aux | grep "python"".',
          mascotRest: 'Ese proceso con PID 4092 está consumiendo el 85% de CPU. Necesitamos terminarlo.',
          mascotTip: '¿Buscas un proceso? "ps aux | grep nombre" lo encuentra.',
          mascotSuccess: '¡Proceso encontrado! PID 4092 consume 85% de CPU. Hay que eliminarlo.',
          expectedOutput: 'python',
        },
        {
          id: 't3_l1_s3', command: 'kill -9 4092', required: true, completed: false,
          description: 'Forzar la finalización inmediata del proceso descontrolado.',
          hint: 'Termina el proceso con "kill -9 4092".',
          mascotRest: 'La señal "-9" (SIGKILL) fuerza el cierre inmediato del proceso liberando la CPU.',
          mascotTip: '¿Proceso rebelde? "kill -9 PID" lo termina por la fuerza.',
          mascotSuccess: '¡Proceso eliminado! SIGKILL (-9) fuerza el cierre inmediato.',
          expectedOutput: 'Killed',
        },
      ],
    },
    {
      id: 8, trayectoId: 3,
      name: 'Nivel 8: Aprovisionamiento de Usuarios y Permisos de Grupo',
      description: 'Crea usuarios, cambia propietarios y ajusta permisos de grupo.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't3_l2_s1', command: 'useradd -m -s /bin/bash docente_upta', required: true, completed: false,
          description: 'Crear una nueva cuenta de usuario para el docente.',
          hint: 'Usa "useradd -m -s /bin/bash docente_upta".',
          mascotRest: '"-m" crea el directorio personal y "-s /bin/bash" le asigna la consola interactiva Bash.',
          mascotTip: '¿Nuevo usuario? "useradd -m -s /bin/bash nombre" lo crea con home y shell.',
          mascotSuccess: '¡Usuario creado! "-m" genera el home y "-s" asigna la shell.',
          expectedOutput: '',
        },
        {
          id: 't3_l2_s2', command: 'chown docente_upta:estudiante /home/estudiante/documentos/reporte.txt', required: true, completed: false,
          description: 'Transferir la propiedad del archivo al nuevo docente y grupo estudiante.',
          hint: 'Usa "chown docente_upta:estudiante ruta".',
          mascotRest: '"chown usuario:grupo" ajusta los derechos de pertenencia sobre el archivo.',
          mascotTip: '¿Cambiar dueño? "chown usuario:grupo archivo" transfiere propiedad.',
          mascotSuccess: '¡Propiedad transferida! "chown" reasigna dueño y grupo.',
          expectedOutput: '',
        },
        {
          id: 't3_l2_s3', command: 'chmod 770 /home/estudiante/documentos', required: true, completed: false,
          altCommands: ['chmod 770 /home/estudiante/documentos/'],
          description: 'Establecer permisos de acceso total para dueño y grupo, bloqueando externos.',
          hint: 'Usa "chmod 770 /home/estudiante/documentos".',
          mascotRest: 'El código 770 otorga control al dueño y al grupo, garantizando privacidad frente a otros.',
          mascotTip: '¿Privacidad total? "chmod 770" da acceso solo a dueño y grupo.',
          mascotSuccess: '¡Permisos 770! Solo dueño y grupo acceden. drwxrwx---.',
          expectedOutput: '',
        },
      ],
    },
    {
      id: 9, trayectoId: 3,
      name: 'Nivel 9: Diagnóstico de Red e Inspección de Sockets',
      description: 'Verifica interfaces, conectividad y puertos.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't3_l3_s1', command: 'ip a', required: true, completed: false,
          altCommands: ['ifconfig'],
          description: 'Identificar las interfaces de red y sus direcciones IP.',
          hint: 'Usa "ip a" para ver la configuración de red.',
          mascotRest: '"ip a" muestra la configuración de red moderna en distribuciones Linux.',
          mascotTip: '¿Sin red? "ip a" muestra tus interfaces y direcciones.',
          mascotSuccess: '¡Interfaz detectada! eth0 con IP asignada.',
          expectedOutput: 'eth0',
        },
        {
          id: 't3_l3_s2', command: 'ping -c 4 192.168.1.1', required: true, completed: false,
          description: 'Probar conectividad con la puerta de enlace enviando 4 paquetes ICMP.',
          hint: 'Usa "ping -c 4 192.168.1.1".',
          mascotRest: '"-c 4" evita que el ping se ejecute infinitamente. La comunicación con el gateway es estable.',
          mascotTip: '¿Hay conexión? "ping -c 4 IP" verifica con 4 paquetes.',
          mascotSuccess: '¡Conectividad OK! 4 paquetes transmitidos, 0% pérdida.',
          expectedOutput: '4 packets transmitted',
        },
        {
          id: 't3_l3_s3', command: 'ss -tuln', required: true, completed: false,
          altCommands: ['netstat -tuln'],
          description: 'Inspeccionar los puertos TCP/UDP abiertos y en estado de escucha.',
          hint: 'Usa "ss -tuln" para ver puertos.',
          mascotRest: '"-tuln" (TCP, UDP, Listening, Numeric). ¡Excelente! Has dominado las redes.',
          mascotTip: '¿Puertos abiertos? "ss -tuln" lista los sockets en escucha.',
          mascotSuccess: '🏆 ¡Trayecto III completado! Dominas procesos, usuarios y redes.',
          expectedOutput: 'LISTEN',
        },
      ],
    },
  ];
}

// ─── TRAYECTO IV: Automatización, Systemd y Seguridad ──

function trayecto4(): MissionLevel[] {
  return [
    {
      id: 10, trayectoId: 4,
      name: 'Nivel 10: Gestión de Servicios del Sistema con Systemd',
      description: 'Administra servicios con systemctl.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't4_l1_s1', command: 'systemctl status nginx', required: true, completed: false,
          description: 'Consultar el estado operativo del servicio Nginx.',
          hint: 'Usa "systemctl status nginx".',
          mascotRest: 'El servidor web ha sufrido una caída. "systemctl status" nos indica el fallo.',
          mascotTip: '¿Servicio caído? "systemctl status servicio" muestra su estado.',
          mascotSuccess: '¡Estado diagnosticado! El servicio está caído. Hay que restaurarlo.',
          expectedOutput: 'failed',
        },
        {
          id: 't4_l1_s2', command: 'systemctl restart nginx', required: true, completed: false,
          description: 'Reiniciar el demonio del servicio para restaurar la conectividad.',
          hint: 'Usa "systemctl restart nginx".',
          mascotRest: '¡Servicio restaurado! "systemctl restart" vuelve a levantar el proceso en segundo plano.',
          mascotTip: '¿Reiniciar? "systemctl restart servicio" levanta el demonio.',
          mascotSuccess: '¡Nginx restaurado! "restart" reinicia el servicio.',
          expectedOutput: 'active',
        },
        {
          id: 't4_l1_s3', command: 'systemctl enable nginx', required: true, completed: false,
          description: 'Configurar el servicio para arranque automático.',
          hint: 'Usa "systemctl enable nginx".',
          mascotRest: '"enable" crea un enlace simbólico para asegurar que Nginx inicie tras cada reinicio.',
          mascotTip: '¿Arranque automático? "systemctl enable servicio" lo configura.',
          mascotSuccess: '¡Servicio habilitado! Nginx arrancará automáticamente.',
          expectedOutput: 'symlink',
        },
      ],
    },
    {
      id: 11, trayectoId: 4,
      name: 'Nivel 11: Creación, Permisos y Ejecución de Shell Scripts',
      description: 'Crea y ejecuta un script Bash automatizado.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't4_l2_s1', command: 'touch auditoria.sh', required: true, completed: false,
          description: 'Crear el archivo fuente para el script de auditoría.',
          hint: 'Usa "touch auditoria.sh".',
          mascotRest: 'Vamos a programar nuestra primera rutina Bash automatizada.',
          mascotTip: '¿Crear script? "touch nombre.sh" genera el archivo.',
          mascotSuccess: '¡Script creado! Ahora a escribir las instrucciones.',
          expectedOutput: '',
        },
        {
          id: 't4_l2_s2', command: 'echo "#!/bin/bash" > auditoria.sh', required: true, completed: false,
          description: 'Insertar la cabecera Shebang en el script.',
          hint: 'Usa "echo "#!/bin/bash" > auditoria.sh".',
          mascotRest: 'El Shebang "#!/bin/bash" le especifica al Kernel cuál intérprete debe procesar el script.',
          mascotTip: '¿Primera línea de un script? "#!/bin/bash" es el Shebang.',
          mascotSuccess: '¡Shebang insertado! "#!/bin/bash" indica el intérprete.',
          expectedOutput: '',
        },
        {
          id: 't4_l2_s3', command: 'chmod +x auditoria.sh', required: true, completed: false,
          description: 'Otorgar permisos de ejecución al script.',
          hint: 'Usa "chmod +x auditoria.sh".',
          mascotRest: 'La bandera "+x" habilita el bit de ejecución en los permisos del archivo.',
          mascotTip: '¿Ejecutar script? "chmod +x archivo.sh" habilita permisos.',
          mascotSuccess: '¡Ejecutable! "+x" habilita el bit de ejecución.',
          expectedOutput: '',
        },
        {
          id: 't4_l2_s4', command: './auditoria.sh', required: true, completed: false,
          description: 'Disparar la ejecución del script desde la consola.',
          hint: 'Ejecuta "./auditoria.sh".',
          mascotRest: '¡Script ejecutado! La sintaxis "./" indica a la terminal que ejecute un binario en la ruta actual.',
          mascotTip: '¿Ejecutar? "./script.sh" corre el script en la ruta actual.',
          mascotSuccess: '¡Script ejecutado! "./" indica ejecución local.',
          expectedOutput: 'Auditoria Exitosa UPTA',
        },
      ],
    },
    {
      id: 12, trayectoId: 4,
      name: 'Nivel 12: Auditoría Forense de Seguridad y Purga del Sistema',
      description: 'Analiza intrusiones y purga amenazas.',
      unlocked: false, completed: false,
      steps: [
        {
          id: 't4_l3_s1', command: 'grep "FAILED LOGIN" /var/log/auth.log | tail -n 10', required: true, completed: false,
          altCommands: ['grep "FAILED LOGIN" /var/log/auth.log | tail -10'],
          description: 'Filtrar los últimos 10 intentos fallidos de inicio de sesión.',
          hint: 'Usa "grep "FAILED LOGIN" /var/log/auth.log | tail -n 10".',
          mascotRest: 'Análisis forense en marcha. Hemos localizado los accesos no autorizados en "auth.log".',
          mascotTip: '¿Intrusiones? "grep FAILED LOGIN auth.log | tail -n 10" las filtra.',
          mascotSuccess: '¡Intrusos detectados! Forense completado.',
          expectedOutput: 'FAILED LOGIN',
        },
        {
          id: 't4_l3_s2', command: 'rm -rf /tmp/malware_temp', required: true, completed: false,
          altCommands: ['rm -rf /tmp/malware_temp/'],
          description: 'Purgar de forma recursiva y forzada el directorio malicioso.',
          hint: 'Usa "rm -rf /tmp/malware_temp" para eliminar la amenaza.',
          mascotRest: '¡Cuidado! "rm -rf" elimina carpetas y contenidos sin pedir confirmación. La amenaza fue eliminada.',
          mascotTip: '¿Eliminar amenaza? "rm -rf /tmp/malware_temp" la purga.',
          mascotSuccess: '¡Amenaza eliminada! "rm -rf" es destructivo pero necesario.',
          expectedOutput: '',
        },
        {
          id: 't4_l3_s3', command: 'history', required: true, completed: false,
          description: 'Extraer el historial de comandos ejecutados.',
          hint: 'Escribe "history" para ver el historial.',
          mascotRest: '¡Excelente trabajo Administrador! Has completado con éxito el Trayecto IV de la UPTA.',
          mascotTip: '¿Registro de acciones? "history" lista todos tus comandos.',
          mascotSuccess: '🏆 ¡Trayecto IV completado! Has alcanzado el nivel de Administrador Senior.',
          expectedOutput: '',
        },
      ],
    },
  ];
}

// ─── Composición de todos los trayectos ──────────────────

export function createDefaultTrayectos(): Trayecto[] {
  return [
    {
      id: 1, title: 'Fundamentos, Navegación y Permisos', color: '#3B82F6', icon: '🔵',
      levels: trayecto1(),
    },
    {
      id: 2, title: 'Filtros, Tuberías y Empaquetado', color: '#22C55E', icon: '🟢',
      levels: trayecto2(),
    },
    {
      id: 3, title: 'Procesos, Usuarios y Redes', color: '#EAB308', icon: '🟡',
      levels: trayecto3(),
    },
    {
      id: 4, title: 'Systemd, Scripting y Seguridad', color: '#EF4444', icon: '🔴',
      levels: trayecto4(),
    },
  ];
}

export function createDefaultLevels(): MissionLevel[] {
  return createDefaultTrayectos().flatMap((t) => t.levels);
}

// ─── Progress calculation ─────────────────────────────

export function calculateProgress(levels: MissionLevel[]): number {
  let total = 0;
  let completed = 0;
  for (const level of levels) {
    if (!level.unlocked && !level.completed) continue;
    for (const step of level.steps) {
      total++;
      if (step.completed) completed++;
    }
  }
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

export function getCompletedStepIds(levels: MissionLevel[]): string[] {
  const ids: string[] = [];
  for (const level of levels) {
    for (const step of level.steps) {
      if (step.completed) ids.push(step.id);
    }
  }
  return ids;
}

export function getActiveLevelId(levels: MissionLevel[]): number {
  const active = levels.find((l) => l.unlocked && !l.completed);
  if (active) return active.id;
  const lastCompleted = [...levels].reverse().find((l) => l.completed);
  return lastCompleted ? lastCompleted.id : 1;
}

export function checkStepCompletion(
  levels: MissionLevel[],
  userInput: string,
): { stepCompleted: MissionStep | null; levels: MissionLevel[] } {
  const cleanInput = userInput.trim();
  let completedStep: MissionStep | null = null;

  for (const level of levels) {
    if (!level.unlocked) continue;
    for (const step of level.steps) {
      if (step.completed) continue;
      const normalizedInput = cleanInput.replace(/\s+/g, ' ').toLowerCase();
      const normalizedCmd = step.command.replace(/\s+/g, ' ').toLowerCase();
      const altMatch = (step.altCommands || []).some(
        (alt) => alt.replace(/\s+/g, ' ').toLowerCase() === normalizedInput,
      );
      if (normalizedInput === normalizedCmd || altMatch) {
        step.completed = true;
        completedStep = step;
      }
    }
  }

  // Check if all required steps in current level are done
  for (const level of levels) {
    if (level.completed) continue;
    const allRequired = level.steps.filter((s) => s.required).every((s) => s.completed);
    if (allRequired && level.steps.filter((s) => s.required).length > 0) {
      level.completed = true;
      // Unlock next level in same trayecto
      const nextIdx = levels.findIndex(
        (l) => l.trayectoId === level.trayectoId && l.id === level.id + 1,
      );
      if (nextIdx >= 0) {
        levels[nextIdx].unlocked = true;
      }
      // Unlock next trayecto's first level if all levels in current trayecto done
      const allTrayectoDone = levels
        .filter((l) => l.trayectoId === level.trayectoId)
        .every((l) => l.completed);
      if (allTrayectoDone) {
        const nextTrayecto = level.trayectoId + 1;
        const firstOfNext = levels.find((l) => l.trayectoId === nextTrayecto);
        if (firstOfNext) {
          firstOfNext.unlocked = true;
        }
      }
    }
  }

  return { stepCompleted: completedStep, levels };
}

// ─── API Sync (Neon vía Render + localStorage de respaldo) ───

export async function syncProgressToApi(
  levels: MissionLevel[],
  userId?: number | null,
): Promise<boolean> {
  const sessionUser = getCurrentSession() as (ReturnType<typeof getCurrentSession> & { id?: number }) | null;
  const targetUserId = userId ?? sessionUser?.id ?? null;

  const completedSteps = getCompletedStepIds(levels);
  const progressPercent = calculateProgress(levels);
  const currentLevel = getActiveLevelId(levels);

  if (sessionUser?.email) {
    try {
      localStorage.setItem(
        `upta_progress_v4_${sessionUser.email.toLowerCase()}`,
        JSON.stringify({ completedSteps, progressPercent, currentLevel }),
      );
    } catch {
      // ignore storage errors
    }
  }

  if (!targetUserId || targetUserId <= 0) {
    return false;
  }

  try {
    await api.saveProgress({
      user_id: targetUserId,
      completed_steps: completedSteps,
      progress_percent: progressPercent,
      current_level: currentLevel,
    });
    return true;
  } catch (err) {
    console.warn('Sincronización de progreso pendiente:', err);
    return false;
  }
}

export async function syncStep(levels: MissionLevel[], userId?: number | null): Promise<boolean> {
  return syncProgressToApi(levels, userId);
}

export async function resetProgress(userId?: number | null): Promise<boolean> {
  const freshLevels = createDefaultLevels();
  return syncProgressToApi(freshLevels, userId);
}

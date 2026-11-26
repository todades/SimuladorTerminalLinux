// ============================================================
// 📁 VFS ENGINE — Virtual File System en memoria
// Archivos completos para los 4 Trayectos académicos
// ============================================================

export interface VFSNode {
  type: 'file' | 'directory';
  name: string;
  permissions: string;
  owner: string;
  group: string;
  size: number;
  content?: string;
  children?: Map<string, VFSNode>;
  modified: Date;
  /**
   * true cuando el nodo fue creado o modificado por el estudiante.
   * El Explorador VFS solo muestra estos nodos (empieza vacío).
   */
  userCreated?: boolean;
}

export interface VFSState {
  root: VFSNode;
  cwd: string;
}

export function buildBaseVFS(): VFSNode {
  const now = new Date();

  const root: VFSNode = {
    type: 'directory', name: '/', permissions: 'drwxr-xr-x',
    owner: 'root', group: 'root', size: 4096, children: new Map(), modified: now,
  };

  // ─── Standard Linux directories ─────────────────────
  const dirs: Record<string, { owner: string; group: string }> = {
    bin:  { owner: 'root', group: 'root' },
    boot: { owner: 'root', group: 'root' },
    dev:  { owner: 'root', group: 'root' },
    etc:  { owner: 'root', group: 'root' },
    home: { owner: 'root', group: 'root' },
    lib:  { owner: 'root', group: 'root' },
    media:{ owner: 'root', group: 'root' },
    mnt:  { owner: 'root', group: 'root' },
    opt:  { owner: 'root', group: 'root' },
    proc: { owner: 'root', group: 'root' },
    root: { owner: 'root', group: 'root' },
    run:  { owner: 'root', group: 'root' },
    sbin: { owner: 'root', group: 'root' },
    srv:  { owner: 'root', group: 'root' },
    sys:  { owner: 'root', group: 'root' },
    tmp:  { owner: 'root', group: 'root' },
    usr:  { owner: 'root', group: 'root' },
    var:  { owner: 'root', group: 'root' },
  };

  for (const [name, meta] of Object.entries(dirs)) {
    root.children!.set(name, {
      type: 'directory', name, permissions: 'drwxr-xr-x',
      owner: meta.owner, group: meta.group, size: 4096,
      children: new Map(), modified: now,
    });
  }

  // ─── /home/estudiante ──────────────────────────────
  const homeDir = root.children!.get('home')!;
  const estudianteDir: VFSNode = {
    type: 'directory', name: 'estudiante', permissions: 'drwxr-xr-x',
    owner: 'estudiante', group: 'estudiante', size: 4096,
    children: new Map(), modified: now,
  };
  homeDir.children!.set('estudiante', estudianteDir);

  const subdirs = ['documentos', 'practicas', 'proyectos', 'descargas', 'musica', 'imagenes'];
  for (const sub of subdirs) {
    estudianteDir.children!.set(sub, {
      type: 'directory', name: sub, permissions: 'drwxr-xr-x',
      owner: 'estudiante', group: 'estudiante', size: 4096,
      children: new Map(), modified: now,
    });
  }

  // ─── /home/estudiante/documentos ──────────────────
  const docsDir = estudianteDir.children!.get('documentos')!;
  const docsFiles: { name: string; content: string; perms: string; size?: number }[] = [
    {
      name: 'bienvenido.txt',
      content: '🐧 ¡Bienvenido al UPTA Terminal Lab!\n\n' +
        'Este es un simulador educativo de Linux para la comunidad UPTA.\n' +
        'Practica comandos libremente — nada afecta a tu equipo real.\n\n' +
        'Comandos disponibles: pwd, ls, cd, cat, mkdir, whoami, clear, help\n' +
        'Escribe "help" en cualquier momento para ver la lista completa.\n\n' +
        '— Tu mascota guía',
      perms: '-rw-r--r--',
    },
    {
      name: 'tarea.sh',
      content: '#!/bin/bash\n# Practica de comandos Linux\n# UPTA - Terminal Lab\n\necho "¡Hola desde el VFS!"\necho "Directorio actual: $(pwd)"\necho "Fecha: $(date)"\nls -la\n',
      perms: '-rwxr-xr-x',
    },
    {
      name: 'notas_upta.txt',
      content: '📚 NOTAS DE ESTUDIO — Linux Fundamentals\n\n' +
        'FHS: Filesystem Hierarchy Standard\n' +
        '/    → Raíz del sistema\n' +
        '/home → Directorios de usuarios\n' +
        '/etc  → Archivos de configuración\n' +
        '/var  → Datos variables (logs)\n' +
        '/tmp  → Archivos temporales\n\n' +
        'Permisos: r=lectura w=escritura x=ejecución\n' +
        'Formato: rwx para owner, group, others',
      perms: '-rw-r--r--',
    },
    {
      name: 'reporte.txt',
      content: 'Sistema Operativo Linux UPTA\n\nEste es el reporte de trabajo del módulo 1.\nFecha: ' + now.toLocaleDateString('es-VE') + '\nAutor: estudiante\nEstado: En progreso',
      perms: '-rw-r--r--',
    },
    {
      name: 'diario.txt',
      content: generateDiarioContent(),
      perms: '-rw-r--r--',
    },
  ];

  for (const f of docsFiles) {
    docsDir.children!.set(f.name, {
      type: 'file', name: f.name, permissions: f.perms,
      owner: 'estudiante', group: 'estudiante',
      size: f.size || f.content.length, content: f.content, modified: now,
    });
  }

  // ─── /home/estudiante/practicas ────────────────────
  const practDir = estudianteDir.children!.get('practicas')!;
  practDir.children!.set('LEEME.txt', {
    type: 'file', name: 'LEEME.txt', permissions: '-rw-r--r--',
    owner: 'estudiante', group: 'estudiante', size: 56,
    content: 'Directorio de prácticas.\nColoca aquí tus ejercicios de terminal.',
    modified: now,
  });

  // ─── /home/estudiante/config (Trayecto II) ─────────
  const configDir: VFSNode = {
    type: 'directory', name: 'config', permissions: 'drwxr-xr-x',
    owner: 'estudiante', group: 'estudiante', size: 4096,
    children: new Map(), modified: now,
  };
  estudianteDir.children!.set('config', configDir);

  configDir.children!.set('red.conf', {
    type: 'file', name: 'red.conf', permissions: '-rw-r--r--',
    owner: 'estudiante', group: 'estudiante', size: 120,
    content: '# Configuración de red UPTA\nHOSTNAME=servidor-upta\nIP=192.168.1.50\nGATEWAY=192.168.1.1\nDNS=8.8.8.8',
    modified: now,
  });
  configDir.children!.set('app.conf', {
    type: 'file', name: 'app.conf', permissions: '-rw-r--r--',
    owner: 'estudiante', group: 'estudiante', size: 85,
    content: '# Configuración de aplicación\nAPP_NAME=UPTA Terminal Lab\nVERSION=2.0\nDEBUG=false\nLOG_LEVEL=INFO',
    modified: now,
  });

  // ─── /home/estudiante/usuarios.txt (Trayecto II) ───
  estudianteDir.children!.set('usuarios.txt', {
    type: 'file', name: 'usuarios.txt', permissions: '-rw-r--r--',
    owner: 'estudiante', group: 'estudiante', size: 280,
    content: 'carlos\nmaria\nestudiante\nana\npedro\nlucia\nestudiante\nmateo\nsofia\ncarlos\nvalentina\nmateo\ndiego\ncamila\nandres\nisabella\nmateo\nestudiante\ndiego\npablo\n',
    modified: now,
  });

  // ─── /home/estudiante/auditoria.sh (Trayecto IV) ──
  estudianteDir.children!.set('auditoria.sh', {
    type: 'file', name: 'auditoria.sh', permissions: '-rw-r--r--',
    owner: 'estudiante', group: 'estudiante', size: 0,
    content: '', modified: now,
  });

  // ─── /var/log ─────────────────────────────────────
  const varLogDir = root.children!.get('var')!.children!.get('log')! || (() => {
    const log: VFSNode = {
      type: 'directory', name: 'log', permissions: 'drwxr-xr-x',
      owner: 'root', group: 'root', size: 4096,
      children: new Map(), modified: now,
    };
    root.children!.get('var')!.children!.set('log', log);
    return log;
  })();

  // sys_events.log (Trayecto II)
  varLogDir.children!.set('sys_events.log', {
    type: 'file', name: 'sys_events.log', permissions: '-rw-r-----',
    owner: 'root', group: 'root', size: 4096,
    content: generateSysEventsLog(),
    modified: now,
  });

  // auth.log (Trayecto IV)
  varLogDir.children!.set('auth.log', {
    type: 'file', name: 'auth.log', permissions: '-rw-r-----',
    owner: 'root', group: 'root', size: 3072,
    content: generateAuthLog(),
    modified: now,
  });

  // ─── /tmp ─────────────────────────────────────────
  const tmpDir = root.children!.get('tmp')!;

  // /tmp/respaldos (Trayecto II)
  tmpDir.children!.set('respaldos', {
    type: 'directory', name: 'respaldos', permissions: 'drwxrwxrwt',
    owner: 'root', group: 'root', size: 4096,
    children: new Map(), modified: now,
  });

  // /tmp/malware_temp (Trayecto IV)
  const malwareDir: VFSNode = {
    type: 'directory', name: 'malware_temp', permissions: 'drwxr-xr-x',
    owner: 'root', group: 'root', size: 4096,
    children: new Map(), modified: new Date(now.getTime() - 86400000),
  };
  malwareDir.children!.set('payload.exe', {
    type: 'file', name: 'payload.exe', permissions: '-rwxr-xr-x',
    owner: 'root', group: 'root', size: 666,
    content: '[MALWARE DETECTED - QUARANTINE PENDING]',
    modified: new Date(now.getTime() - 86400000),
  });
  malwareDir.children!.set('keylog.dat', {
    type: 'file', name: 'keylog.dat', permissions: '-rw-r--r--',
    owner: 'root', group: 'root', size: 2048,
    content: '[INTERCEPTED DATA - FORENSIC EVIDENCE]',
    modified: new Date(now.getTime() - 86400000),
  });
  tmpDir.children!.set('malware_temp', malwareDir);

  // ─── /etc (configs) ───────────────────────────────
  const etcDir = root.children!.get('etc')!;
  etcDir.children!.set('hostname', {
    type: 'file', name: 'hostname', permissions: '-rw-r--r--',
    owner: 'root', group: 'root', size: 16,
    content: 'upta-terminal-lab',
    modified: now,
  });
  etcDir.children!.set('passwd', {
    type: 'file', name: 'passwd', permissions: '-rw-r--r--',
    owner: 'root', group: 'root', size: 512,
    content: 'root:x:0:0:root:/root:/bin/bash\nestudiante:x:1000:1000:Estudiante UPTA:/home/estudiante:/bin/bash\ndocente_upta:x:1001:1001:Docente UPTA:/home/docente_upta:/bin/bash',
    modified: now,
  });
  etcDir.children!.set('nginx', {
    type: 'directory', name: 'nginx', permissions: 'drwxr-xr-x',
    owner: 'root', group: 'root', size: 4096,
    children: new Map(), modified: now,
  });
  etcDir.children!.get('nginx')!.children!.set('nginx.conf', {
    type: 'file', name: 'nginx.conf', permissions: '-rw-r--r--',
    owner: 'root', group: 'root', size: 256,
    content: 'worker_processes 1;\nevents { worker_connections 1024; }\nhttp { server { listen 80; } }',
    modified: now,
  });

  return root;
}

// ─── Generadores de contenido ──────────────────────────

function generateDiarioContent(): string {
  const lines = [
    'Log entry 1: [2026-01-10 08:00:01] Sistema iniciado correctamente.',
    'Log entry 2: [2026-01-10 08:00:03] Servicio de red eth0 activo — 192.168.1.50',
    'Log entry 3: [2026-01-10 08:00:05] Montaje de /home completado.',
    'Log entry 4: [2026-01-10 08:00:07] Demonio SSH iniciado en puerto 22.',
    'Log entry 5: [2026-01-10 08:00:10] Servidor Nginx en escucha puerto 80.',
    'Log entry 6: [2026-01-10 09:15:22] Usuario estudiante inició sesión.',
    'Log entry 7: [2026-01-10 09:30:45] Proceso python (PID 4092) consumo CPU elevado.',
    'Log entry 8: [2026-01-10 10:00:00] Copia de seguridad automática ejecutada.',
    'Log entry 9: [2026-01-10 10:05:12] Actualización de paquetes pendiente.',
    'Log entry 10: [2026-01-10 11:20:33] Conexión SSH desde 192.168.1.100 aceptada.',
    'Log entry 11: [2026-01-10 12:00:00] Rotación de logs completada.',
    'Log entry 12: [2026-01-10 13:45:10] Almacenamiento al 72% de capacidad.',
    'Log entry 13: [2026-01-10 14:30:00] Auditoría de seguridad ejecutada.',
    'Log entry 14: [2026-01-10 15:00:00] Estadísticas: 847 paquetes procesados.',
    'Log entry 15: [2026-01-10 16:00:00] Fin del día operacional.',
  ];
  return lines.join('\n');
}

function generateSysEventsLog(): string {
  // 14 WARNING + 7 ERROR + 9 INFO (el currículo espera `wc -l` = 14)
  const lines: string[] = [];
  const levels = [
    'INFO', 'WARNING', 'ERROR', 'INFO', 'WARNING', 'INFO', 'ERROR', 'WARNING', 'INFO', 'WARNING',
    'INFO', 'ERROR', 'WARNING', 'INFO', 'WARNING', 'INFO', 'ERROR', 'WARNING', 'INFO', 'WARNING',
    'WARNING', 'ERROR', 'WARNING', 'WARNING', 'WARNING', 'ERROR', 'WARNING', 'INFO', 'WARNING', 'ERROR',
  ];
  const msgs: Record<string, string[]> = {
    INFO: [
      'Network interface eth0 is up',
      'Scheduled backup completed',
      'Service nginx restarted',
      'User login from 192.168.1.100',
      'Firewall rule updated',
      'DNS resolution working',
      'Package cache updated',
      'Cron job executed',
      'Log rotation completed',
      'System health check passed',
    ],
    WARNING: [
      'High CPU usage detected on PID 4092',
      'Disk usage at 85% capacity',
      'Memory pressure detected',
      'Slow response from gateway 192.168.1.1',
      'Certificate expires in 30 days',
      'Unusual login pattern detected',
      'Rate limit approaching threshold',
      'Temporary file cleanup pending',
    ],
    ERROR: [
      'Connection refused on port 443',
      'Authentication failure for user admin',
      'Segmentation fault in process 4092',
      'Filesystem corruption detected on /dev/sda1',
      'Kernel panic - not syncing',
      'Service nginx failed to start',
      'Permission denied: /etc/shadow',
    ],
  };

  for (let i = 0; i < 30; i++) {
    const level = levels[i];
    const pool = msgs[level];
    const msg = pool[Math.floor(Math.random() * pool.length)];
    const h = String(8 + Math.floor(i / 3)).padStart(2, '0');
    const m = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    lines.push(`[${level}] 2026-01-${String(10 + Math.floor(i / 6)).padStart(2, '0')} ${h}:${m}:00 ${msg}`);
  }
  return lines.join('\n');
}

function generateAuthLog(): string {
  const lines: string[] = [
    'Jan 10 08:00:01 upta-terminal sshd[1234]: Accepted password for estudiante from 192.168.1.50 port 52341',
    'Jan 10 09:12:33 upta-terminal sshd[1234]: FAILED LOGIN FROM 203.45.67.89 for root',
    'Jan 10 09:12:34 upta-terminal sshd[1234]: FAILED LOGIN FROM 203.45.67.89 for root',
    'Jan 10 09:12:35 upta-terminal sshd[1234]: FAILED LOGIN FROM 203.45.67.89 for root',
    'Jan 10 10:45:12 upta-terminal sshd[1234]: FAILED LOGIN FROM 185.22.33.44 for admin',
    'Jan 10 10:45:13 upta-terminal sshd[1234]: FAILED LOGIN FROM 185.22.33.44 for admin',
    'Jan 10 11:00:00 upta-terminal sudo: estudiante : TTY=pts/0 ; COMMAND=/usr/bin/apt update',
    'Jan 10 12:30:22 upta-terminal sshd[1234]: FAILED LOGIN FROM 91.121.44.37 for root',
    'Jan 10 12:30:23 upta-terminal sshd[1234]: FAILED LOGIN FROM 91.121.44.37 for root',
    'Jan 10 13:00:00 upta-terminal sudo: estudiante : TTY=pts/0 ; COMMAND=/usr/bin/systemctl restart nginx',
    'Jan 10 14:15:44 upta-terminal sshd[1234]: FAILED LOGIN FROM 45.33.32.156 for test',
    'Jan 10 14:15:45 upta-terminal sshd[1234]: FAILED LOGIN FROM 45.33.32.156 for test',
    'Jan 10 15:00:00 upta-terminal sshd[1234]: Accepted publickey for estudiante from 192.168.1.50 port 52800',
    'Jan 10 16:22:11 upta-terminal sshd[1234]: FAILED LOGIN FROM 77.88.99.11 for guest',
    'Jan 10 16:22:12 upta-terminal sshd[1234]: FAILED LOGIN FROM 77.88.99.11 for guest',
    'Jan 10 17:05:33 upta-terminal sshd[1234]: FAILED LOGIN FROM 103.21.44.55 for root',
    'Jan 10 17:05:34 upta-terminal sshd[1234]: FAILED LOGIN FROM 103.21.44.55 for root',
    'Jan 10 17:05:35 upta-terminal sshd[1234]: FAILED LOGIN FROM 103.21.44.55 for root',
    'Jan 10 18:00:00 upta-terminal sshd[1234]: Accepted password for estudiante from 192.168.1.50 port 53100',
    'Jan 10 19:45:12 upta-terminal sshd[1234]: FAILED LOGIN FROM 58.69.42.17 for admin',
  ];
  return lines.join('\n');
}

// ─── PATH RESOLUTION ──────────────────────────────────

export function resolvePath(
  root: VFSNode,
  cwd: string,
  rawPath: string,
): { node: VFSNode | null; fullPath: string } {
  if (!rawPath || rawPath === '') return { node: findNode(root, cwd), fullPath: cwd };
  if (rawPath === '/') return { node: root, fullPath: '/' };

  let segments: string[];

  if (rawPath.startsWith('/')) {
    segments = rawPath.split('/').filter(Boolean);
  } else if (rawPath.startsWith('~')) {
    const home = '/home/estudiante';
    const rest = rawPath.slice(1);
    segments = [...home.split('/').filter(Boolean), ...rest.split('/').filter(Boolean)];
  } else {
    const cwdClean = cwd === '/' ? '' : cwd;
    segments = [...cwdClean.split('/').filter(Boolean), ...rawPath.split('/').filter(Boolean)];
  }

  // Process . and ..
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(seg);
  }

  const fullPath = '/' + resolved.join('/');

  let current: VFSNode | undefined = root;
  for (const seg of resolved) {
    if (!current.children) return { node: null, fullPath };
    current = current.children.get(seg);
    if (!current) return { node: null, fullPath };
  }

  return { node: current || null, fullPath };
}

export function findNode(root: VFSNode, path: string): VFSNode | null {
  if (path === '/' || path === '') return root;
  if (path.startsWith('~')) {
    return findNode(root, '/home/estudiante' + path.slice(1));
  }
  const segments = path.split('/').filter(Boolean);
  let current: VFSNode | undefined = root;
  for (const seg of segments) {
    if (!current.children) return null;
    current = current.children.get(seg);
    if (!current) return null;
  }
  return current || null;
}

export function listDirectory(node: VFSNode): string[] {
  if (!node.children) return [];
  const entries: string[] = [];
  for (const [name, child] of node.children) {
    const prefix = child.type === 'directory' ? 'd' : '-';
    const permStr = child.permissions;
    const ownerStr = child.owner.padEnd(10);
    const groupStr = child.group.padEnd(10);
    const sizeStr = String(child.size).padStart(8);
    const colorName = child.type === 'directory'
      ? `\x1b[1;34m${name}/\x1b[0m`
      : child.permissions.includes('x')
        ? `\x1b[1;32m${name}\x1b[0m`
        : name;
    entries.push(`${prefix}${permStr.slice(1)}  ${ownerStr} ${groupStr} ${sizeStr} ${colorName}`);
  }
  entries.sort((a, b) => {
    const aDir = a.startsWith('d') ? 0 : 1;
    const bDir = b.startsWith('d') ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.localeCompare(b);
  });
  return entries;
}

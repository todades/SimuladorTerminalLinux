// ============================================================
// 📦 PACKAGE MANAGER — Simulación de apt / dpkg
// Repositorio virtual con énfasis en ciberseguridad y forense
// ============================================================

export interface VirtualPackage {
  name: string;
  version: string;
  size: number;          // KB
  installedSize: number; // KB
  section: 'net' | 'security' | 'forensics' | 'utils' | 'devel' | 'admin';
  description: string;
  depends: string[];
  binaries: string[];    // binarios que instala en /usr/bin
  installed: boolean;
}

export interface PackageState {
  repo: Record<string, VirtualPackage>;
  installed: Set<string>;
  lastUpdate: number | null;   // timestamp de `apt update`
  upgradable: string[];
}

// ─── Repositorio virtual ──────────────────────────────

const REPO_DEFINITION: Omit<VirtualPackage, 'installed'>[] = [
  // ── Seguridad / Pentesting ──
  { name: 'nmap', version: '7.94-1', size: 5820, installedSize: 24100, section: 'security',
    description: 'Escáner de red y auditor de seguridad',
    depends: ['libpcap0.8', 'lua5.4'], binaries: ['nmap', 'ncat', 'nping'] },
  { name: 'hydra', version: '9.5-1', size: 980, installedSize: 3200, section: 'security',
    description: 'Cracker de login paralelizado para múltiples protocolos',
    depends: ['libssl3'], binaries: ['hydra', 'hydra-wizard'] },
  { name: 'john', version: '1.9.0-2', size: 4100, installedSize: 15800, section: 'security',
    description: 'John the Ripper — auditor de contraseñas',
    depends: ['libssl3'], binaries: ['john', 'unshadow'] },
  { name: 'aircrack-ng', version: '1.7-5', size: 1890, installedSize: 6400, section: 'security',
    description: 'Suite de auditoría de redes inalámbricas WiFi',
    depends: ['libpcap0.8', 'libssl3'], binaries: ['aircrack-ng', 'airmon-ng', 'airodump-ng'] },
  { name: 'nikto', version: '2.5.0-1', size: 420, installedSize: 1800, section: 'security',
    description: 'Escáner de vulnerabilidades para servidores web',
    depends: ['perl'], binaries: ['nikto'] },
  { name: 'fail2ban', version: '1.0.2-2', size: 460, installedSize: 2100, section: 'security',
    description: 'Previene intrusiones baneando IPs con fallos de autenticación',
    depends: ['python3'], binaries: ['fail2ban-client', 'fail2ban-server'] },
  { name: 'ufw', version: '0.36.2-1', size: 180, installedSize: 920, section: 'security',
    description: 'Uncomplicated Firewall — frontend sencillo para iptables',
    depends: ['iptables', 'python3'], binaries: ['ufw'] },
  { name: 'clamav', version: '1.0.3-1', size: 2400, installedSize: 9800, section: 'security',
    description: 'Motor antivirus de código abierto',
    depends: ['libssl3'], binaries: ['clamscan', 'freshclam'] },

  // ── Forense ──
  { name: 'sleuthkit', version: '4.12.0-1', size: 3200, installedSize: 12400, section: 'forensics',
    description: 'The Sleuth Kit — análisis forense de sistemas de archivos',
    depends: ['libewf3'], binaries: ['fls', 'icat', 'mmls', 'fsstat'] },
  { name: 'autopsy', version: '4.21.0-1', size: 48200, installedSize: 186000, section: 'forensics',
    description: 'Plataforma gráfica de análisis forense digital',
    depends: ['sleuthkit', 'default-jre'], binaries: ['autopsy'] },
  { name: 'foremost', version: '1.5.7-11', size: 96, installedSize: 320, section: 'forensics',
    description: 'Recuperación de archivos por cabeceras (data carving)',
    depends: [], binaries: ['foremost'] },
  { name: 'binwalk', version: '2.3.4-1', size: 310, installedSize: 1400, section: 'forensics',
    description: 'Analizador de firmware e imágenes binarias',
    depends: ['python3'], binaries: ['binwalk'] },
  { name: 'volatility3', version: '2.5.0-1', size: 2800, installedSize: 11200, section: 'forensics',
    description: 'Framework de análisis forense de memoria RAM',
    depends: ['python3'], binaries: ['vol'] },

  // ── Red ──
  { name: 'tcpdump', version: '4.99.4-3', size: 480, installedSize: 1600, section: 'net',
    description: 'Analizador de tráfico de red en línea de comandos',
    depends: ['libpcap0.8'], binaries: ['tcpdump'] },
  { name: 'wireshark', version: '4.0.11-1', size: 18400, installedSize: 72000, section: 'net',
    description: 'Analizador de protocolos de red con interfaz gráfica',
    depends: ['libpcap0.8', 'libqt5core5a'], binaries: ['wireshark', 'tshark'] },
  { name: 'net-tools', version: '2.10-0.1', size: 240, installedSize: 980, section: 'net',
    description: 'Herramientas clásicas de red (ifconfig, netstat, route)',
    depends: [], binaries: ['ifconfig', 'netstat', 'route', 'arp'] },
  { name: 'curl', version: '8.5.0-2', size: 320, installedSize: 1280, section: 'net',
    description: 'Transferencia de datos por URL desde la terminal',
    depends: ['libssl3'], binaries: ['curl'] },
  { name: 'openssh-server', version: '9.6p1-3', size: 680, installedSize: 2400, section: 'net',
    description: 'Servidor SSH para acceso remoto seguro',
    depends: ['libssl3'], binaries: ['sshd'] },

  // ── Utilidades ──
  { name: 'htop', version: '3.3.0-1', size: 180, installedSize: 640, section: 'utils',
    description: 'Visor interactivo de procesos del sistema',
    depends: ['libncursesw6'], binaries: ['htop'] },
  { name: 'tree', version: '2.1.1-2', size: 62, installedSize: 180, section: 'utils',
    description: 'Lista el contenido de directorios en formato de árbol',
    depends: [], binaries: ['tree'] },
  { name: 'vim', version: '9.1.0016-1', size: 1800, installedSize: 7200, section: 'utils',
    description: 'Editor de texto Vi IMproved',
    depends: [], binaries: ['vim', 'vi'] },
  { name: 'git', version: '2.43.0-1', size: 4200, installedSize: 18600, section: 'devel',
    description: 'Sistema de control de versiones distribuido',
    depends: ['libcurl4'], binaries: ['git'] },
  { name: 'python3', version: '3.11.6-1', size: 6800, installedSize: 24000, section: 'devel',
    description: 'Intérprete del lenguaje de programación Python 3',
    depends: [], binaries: ['python3', 'pip3'] },

  // ── Dependencias base (ya instaladas) ──
  { name: 'libpcap0.8', version: '1.10.4-4', size: 180, installedSize: 520, section: 'admin',
    description: 'Biblioteca de captura de paquetes de red', depends: [], binaries: [] },
  { name: 'libssl3', version: '3.1.4-2', size: 1900, installedSize: 5200, section: 'admin',
    description: 'Biblioteca criptográfica OpenSSL', depends: [], binaries: [] },
  { name: 'perl', version: '5.36.0-9', size: 3100, installedSize: 14000, section: 'devel',
    description: 'Intérprete del lenguaje Perl', depends: [], binaries: ['perl'] },
  { name: 'iptables', version: '1.8.10-3', size: 420, installedSize: 1800, section: 'admin',
    description: 'Herramienta de filtrado de paquetes del kernel', depends: [], binaries: ['iptables'] },
  { name: 'libncursesw6', version: '6.4-4', size: 140, installedSize: 480, section: 'admin',
    description: 'Biblioteca de interfaz de texto en terminal', depends: [], binaries: [] },
  { name: 'libcurl4', version: '8.5.0-2', size: 340, installedSize: 1100, section: 'admin',
    description: 'Biblioteca de transferencia por URL', depends: [], binaries: [] },
  { name: 'lua5.4', version: '5.4.6-3', size: 160, installedSize: 540, section: 'devel',
    description: 'Intérprete del lenguaje Lua', depends: [], binaries: ['lua5.4'] },
  { name: 'libewf3', version: '20140808-8', size: 220, installedSize: 760, section: 'admin',
    description: 'Biblioteca de formato EWF para imágenes forenses', depends: [], binaries: [] },
  { name: 'default-jre', version: '2:1.17-75', size: 180, installedSize: 420, section: 'devel',
    description: 'Entorno de ejecución Java por defecto', depends: [], binaries: ['java'] },
  { name: 'libqt5core5a', version: '5.15.10-2', size: 2100, installedSize: 8400, section: 'admin',
    description: 'Biblioteca Qt5 Core', depends: [], binaries: [] },
];

// Paquetes preinstalados en la máquina virtual
const PREINSTALLED = ['libpcap0.8', 'libssl3', 'perl', 'iptables', 'libncursesw6',
  'libcurl4', 'python3', 'vim', 'curl'];

// Paquetes con actualización disponible
const UPGRADABLE = ['curl', 'vim', 'python3'];

export function createPackageState(): PackageState {
  const repo: Record<string, VirtualPackage> = {};
  for (const def of REPO_DEFINITION) {
    repo[def.name] = { ...def, installed: PREINSTALLED.includes(def.name) };
  }
  return {
    repo,
    installed: new Set(PREINSTALLED),
    lastUpdate: null,
    upgradable: [...UPGRADABLE],
  };
}

// ─── Resolución recursiva de dependencias ─────────────

export function resolveDependencies(
  state: PackageState,
  pkgName: string,
  seen = new Set<string>(),
): string[] {
  if (seen.has(pkgName)) return [];
  seen.add(pkgName);

  const pkg = state.repo[pkgName];
  if (!pkg) return [];

  const result: string[] = [];
  for (const dep of pkg.depends) {
    if (state.installed.has(dep)) continue;
    result.push(...resolveDependencies(state, dep, seen));
    if (!result.includes(dep)) result.push(dep);
  }
  return result;
}

/** Paquetes instalados que dependen de `pkgName` (para avisar al remover) */
export function findReverseDeps(state: PackageState, pkgName: string): string[] {
  const out: string[] = [];
  for (const name of state.installed) {
    const pkg = state.repo[name];
    if (pkg && pkg.depends.includes(pkgName)) out.push(name);
  }
  return out;
}

export function searchPackages(state: PackageState, query: string): VirtualPackage[] {
  const q = query.toLowerCase();
  return Object.values(state.repo).filter(
    (p) => p.name.includes(q) || p.description.toLowerCase().includes(q),
  );
}

export function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} kB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

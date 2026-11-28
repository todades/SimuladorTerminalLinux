export interface ApiSection {
  id: number;
  name: string;
  trayecto: string;
  period: string;
  teacher_id?: number | null;
  is_active: boolean;
}

export interface ApiUser {
  id: number;
  full_name: string;
  email: string;
  cedula?: string | null;
  role: 'estudiante' | 'profesor' | 'superadmin' | string;
  trayecto?: string | null;
  section_id?: number | null;
  approval_status?: string;
  mascot_name?: string;
  mascot_gender?: string;
  last_seen?: string;
  created_at?: string;
  progress_percent?: number | null;
  current_level?: number | null;
  completed_steps?: string[] | null;
  updated_at?: string | null;
}

export interface ApiProgress {
  id: number;
  user_id: number;
  completed_steps: string[];
  progress_percent: number;
  current_level: number;
  updated_at: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  cedula?: string;
  role?: string;
  trayecto?: string;
  section_id?: number | null;
  mascot_name?: string;
  mascot_gender?: string;
}

export interface SaveProgressPayload {
  user_id: number;
  completed_steps: string[];
  progress_percent: number;
  current_level: number;
}

const RAW_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:3001/api';

const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Error HTTP ${response.status} al comunicarse con el servidor`;
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  health(): Promise<{ status: string; database: string }> {
    return request('/health');
  },

  async getSections(): Promise<ApiSection[]> {
    const res = await request<{ sections: ApiSection[] }>('/sections');
    return res.sections;
  },

  async register(payload: RegisterPayload): Promise<ApiUser> {
    const res = await request<{ user: ApiUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.user;
  },

  async login(email: string): Promise<ApiUser> {
    const res = await request<{ user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return res.user;
  },

  async saveProgress(payload: SaveProgressPayload): Promise<ApiProgress> {
    const res = await request<{ progress: ApiProgress }>('/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.progress;
  },

  async getUsers(): Promise<ApiUser[]> {
    const res = await request<{ users: ApiUser[] }>('/users');
    return res.users;
  },
};
```[cite: 15]

¿Qué archivo de `src/components/` renderiza esa pantalla de registro? Pásamelo por aquí y te agrego el selector de secciones en su interfaz.

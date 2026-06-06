import axios from 'axios';
import type { PaginatedResponse, Company, CompanyStats, Role, User, Client, ClientStaff } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Interceptors ──────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aura_access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // 403 Forbidden: sin permiso para esa acción — NO cerrar sesión, solo rechazar
    if (status === 403) {
      return Promise.reject(error);
    }

    // 401 Unauthorized: token expirado → intentar refresh UNA sola vez
    if (status === 401 && !original._retry) {
      original._retry = true;

      // Si el error viene del propio endpoint de refresh o de login → no reintentar
      if (original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      const refresh = localStorage.getItem('aura_refresh_token');
      if (!refresh) {
        // Sin refresh token → sesión realmente expirada
        _forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh });
        localStorage.setItem('aura_access_token', data.accessToken);
        document.cookie = `aura_access_token=${data.accessToken};path=/;max-age=${60 * 60 * 24 * 7}`;
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshError: any) {
        // Refresh falló con 401 → sesión genuinamente expirada
        if (refreshError?.response?.status === 401) {
          _forceLogout();
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

function _forceLogout() {
  localStorage.removeItem('aura_access_token');
  localStorage.removeItem('aura_refresh_token');
  document.cookie = 'aura_access_token=;path=/;max-age=0';
  // Usar replace para no dejar historial
  window.location.replace('/login?expired=1');
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (payload: { email: string; password: string }) =>
    api.post('/auth/login', payload).then((r) => r.data),
  register: (payload: object) =>
    api.post('/auth/register', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
};

// ── Company ───────────────────────────────────────────────────────────────────
export const companyApi = {
  get: (): Promise<Company> =>
    api.get('/company').then((r) => r.data),
  update: (data: Partial<Company>): Promise<Company> =>
    api.put('/company', data).then((r) => r.data),
  getStats: (): Promise<CompanyStats> =>
    api.get('/company/stats').then((r) => r.data),
  getRoles: (): Promise<Role[]> =>
    api.get('/company/roles').then((r) => r.data),
  updateRolePermissions: (roleId: string, permissions: string[]) =>
    api.patch(`/company/roles/${roleId}/permissions`, { permissions }).then((r) => r.data),
  getConfigs: () =>
    api.get('/company/configs').then((r) => r.data),
  upsertConfig: (key: string, value: string) =>
    api.patch(`/company/configs/${key}`, { value }).then((r) => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; userType?: string; roleSlug?: string }): Promise<PaginatedResponse<User>> =>
    api.get('/users', { params }).then((r) => r.data),
  get: (id: string): Promise<User> =>
    api.get(`/users/${id}`).then((r) => r.data),
  create: (data: object): Promise<User> =>
    api.post('/users', data).then((r) => r.data),
  update: (id: string, data: object): Promise<User> =>
    api.put(`/users/${id}`, data).then((r) => r.data),
  toggleStatus: (id: string): Promise<User> =>
    api.patch(`/users/${id}/status`).then((r) => r.data),
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/users/${id}/password`, { newPassword }).then((r) => r.data),
};

// ── Clients ───────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Client>> =>
    api.get('/clients', { params }).then((r) => r.data),
  get: (id: string): Promise<Client & { staff: ClientStaff[] }> =>
    api.get(`/clients/${id}`).then((r) => r.data),
  create: (data: object): Promise<Client> =>
    api.post('/clients', data).then((r) => r.data),
  update: (id: string, data: object): Promise<Client> =>
    api.put(`/clients/${id}`, data).then((r) => r.data),
  toggleStatus: (id: string): Promise<Client> =>
    api.patch(`/clients/${id}/status`).then((r) => r.data),
  // Usuarios del cliente (portal)
  getUsers: (clientId: string): Promise<any[]> =>
    api.get(`/clients/${clientId}/users`).then((r) => r.data),
  // Staff
  getStaff: (clientId: string): Promise<ClientStaff[]> =>
    api.get(`/clients/${clientId}/staff`).then((r) => r.data),
  createStaff: (clientId: string, data: object): Promise<ClientStaff> =>
    api.post(`/clients/${clientId}/staff`, data).then((r) => r.data),
  updateStaff: (clientId: string, staffId: string, data: object): Promise<ClientStaff> =>
    api.put(`/clients/${clientId}/staff/${staffId}`, data).then((r) => r.data),
  deleteStaff: (clientId: string, staffId: string) =>
    api.delete(`/clients/${clientId}/staff/${staffId}`).then((r) => r.data),
};

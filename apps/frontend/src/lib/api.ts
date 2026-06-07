import axios from 'axios';
import type {
  PaginatedResponse, Company, CompanyStats, Role, User, Client, ClientStaff,
  ServiceOrder, TemplateFlow, TemplateModule, ActivityThread, Project,
} from '@/types';

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
  bulkCreateStaff: (clientId: string, items: object[]) =>
    api.post(`/clients/${clientId}/staff/bulk`, { items }).then((r) => r.data),
};

// ── Service Orders ────────────────────────────────────────────────────────────
export const serviceOrdersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; clientId?: string }): Promise<PaginatedResponse<ServiceOrder>> =>
    api.get('/service-orders', { params }).then((r) => r.data),
  get: (id: string): Promise<ServiceOrder> =>
    api.get(`/service-orders/${id}`).then((r) => r.data),
  create: (data: object): Promise<ServiceOrder> =>
    api.post('/service-orders', data).then((r) => r.data),
  update: (id: string, data: {
    product?: string; scope?: string; observations?: string;
    startDate?: string; endDate?: string; durationDays?: number;
    clinicalLeaderId?: string | null; financialLeaderId?: string | null;
    clientLeaderId?: string | null;
  }): Promise<ServiceOrder> =>
    api.put(`/service-orders/${id}`, data).then((r) => r.data),
  changeStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/service-orders/${id}/status`, { status, reason }).then((r) => r.data),
  addImplementer: (id: string, userId: string, role?: string) =>
    api.post(`/service-orders/${id}/implementers`, { userId, role }).then((r) => r.data),
  removeImplementer: (id: string, userId: string) =>
    api.delete(`/service-orders/${id}/implementers/${userId}`).then((r) => r.data),
  generateProject: (id: string, data: {
    templateFlowId: string;
    name?: string;
    phaseDates?: { templatePhaseId: string; startDate?: string; endDate?: string; agentLeaderId?: string; clientLeaderId?: string }[];
    excludedModuleIds?: string[];
  }) =>
    api.post(`/service-orders/${id}/generate-project`, data).then((r) => r.data),
};

// ── Templates ─────────────────────────────────────────────────────────────────
export const templatesApi = {
  list: (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<TemplateFlow>> =>
    api.get('/templates', { params }).then((r) => r.data),
  get: (id: string): Promise<TemplateFlow> =>
    api.get(`/templates/${id}`).then((r) => r.data),
  create: (data: object): Promise<TemplateFlow> =>
    api.post('/templates', data).then((r) => r.data),
  update: (id: string, data: object): Promise<TemplateFlow> =>
    api.put(`/templates/${id}`, data).then((r) => r.data),
  deleteTemplate: (id: string) =>
    api.delete(`/templates/${id}`).then((r) => r.data),
  toggleTemplateStatus: (id: string): Promise<TemplateFlow> =>
    api.patch(`/templates/${id}/status`).then((r) => r.data),
  assignModule: (templateId: string, moduleId: string) =>
    api.post(`/templates/${templateId}/modules/assign`, { moduleId }).then((r) => r.data),
  // Module library
  listModules: (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<TemplateModule>> =>
    api.get('/templates/modules/all', { params }).then((r) => r.data),
  createModule: (data: { name: string; description?: string; estimatedDays?: number; days?: number; startDate?: string; endDate?: string }): Promise<TemplateModule> =>
    api.post('/templates/modules', data).then((r) => r.data),
  updateModuleById: (moduleId: string, data: { name?: string; description?: string }): Promise<TemplateModule> =>
    api.put(`/templates/modules/${moduleId}`, data).then((r) => r.data),
  deleteModuleById: (moduleId: string) =>
    api.delete(`/templates/modules/${moduleId}`).then((r) => r.data),
  toggleModuleStatus: (moduleId: string): Promise<TemplateModule> =>
    api.patch(`/templates/modules/${moduleId}/status`).then((r) => r.data),
  // Module detail (phases + activities scoped to a module)
  getModuleDetail: (moduleId: string) =>
    api.get(`/templates/modules/${moduleId}/detail`).then((r) => r.data),
  addPhaseToModule: (moduleId: string, data: object) =>
    api.post(`/templates/modules/${moduleId}/phases`, data).then((r) => r.data),
  updatePhaseInModule: (moduleId: string, phaseId: string, data: object) =>
    api.put(`/templates/modules/${moduleId}/phases/${phaseId}`, data).then((r) => r.data),
  deletePhaseFromModule: (moduleId: string, phaseId: string) =>
    api.delete(`/templates/modules/${moduleId}/phases/${phaseId}`).then((r) => r.data),
  reorderPhasesInModule: (moduleId: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/modules/${moduleId}/phases/reorder`, { items }).then((r) => r.data),
  addActivityToModulePhase: (moduleId: string, phaseId: string, data: object) =>
    api.post(`/templates/modules/${moduleId}/phases/${phaseId}/activities`, data).then((r) => r.data),
  updateActivityInModule: (moduleId: string, activityId: string, data: object) =>
    api.put(`/templates/modules/${moduleId}/activities/${activityId}`, data).then((r) => r.data),
  deleteActivityFromModule: (moduleId: string, activityId: string) =>
    api.delete(`/templates/modules/${moduleId}/activities/${activityId}`).then((r) => r.data),
  reorderActivitiesInModule: (moduleId: string, phaseId: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/modules/${moduleId}/phases/${phaseId}/activities/reorder`, { items }).then((r) => r.data),
  // Modules per template
  addModule: (id: string, data: object) =>
    api.post(`/templates/${id}/modules`, data).then((r) => r.data),
  updateModule: (id: string, moduleId: string, data: object) =>
    api.put(`/templates/${id}/modules/${moduleId}`, data).then((r) => r.data),
  deleteModule: (id: string, moduleId: string) =>
    api.delete(`/templates/${id}/modules/${moduleId}`).then((r) => r.data),
  reorderModules: (id: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/${id}/modules/reorder`, { items }).then((r) => r.data),
  // Phases
  addPhase: (id: string, moduleId: string, data: object) =>
    api.post(`/templates/${id}/modules/${moduleId}/phases`, data).then((r) => r.data),
  updatePhase: (id: string, phaseId: string, data: object) =>
    api.put(`/templates/${id}/phases/${phaseId}`, data).then((r) => r.data),
  deletePhase: (id: string, moduleId: string, phaseId: string) =>
    api.delete(`/templates/${id}/modules/${moduleId}/phases/${phaseId}`).then((r) => r.data),
  reorderPhases: (id: string, moduleId: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/${id}/modules/${moduleId}/phases/reorder`, { items }).then((r) => r.data),
  // Activities
  addActivity: (id: string, phaseId: string, data: object) =>
    api.post(`/templates/${id}/phases/${phaseId}/activities`, data).then((r) => r.data),
  deleteActivity: (id: string, activityId: string) =>
    api.delete(`/templates/${id}/activities/${activityId}`).then((r) => r.data),
  reorderActivities: (id: string, phaseId: string, items: { id: string; order: number }[]) =>
    api.patch(`/templates/${id}/phases/${phaseId}/activities/reorder`, { items }).then((r) => r.data),
  // Activity threads
  getThreads: (activityId: string): Promise<ActivityThread[]> =>
    api.get(`/templates/activities/${activityId}/threads`).then((r) => r.data),
  addThread: (activityId: string, content: string): Promise<ActivityThread> =>
    api.post(`/templates/activities/${activityId}/threads`, { content }).then((r) => r.data),
  deleteThread: (threadId: string) =>
    api.delete(`/templates/activities/threads/${threadId}`).then((r) => r.data),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<PaginatedResponse<Project>> =>
    api.get('/projects', { params }).then((r) => r.data),
  get: (id: string): Promise<Project> =>
    api.get(`/projects/${id}`).then((r) => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/projects/${id}/status`, { status }).then((r) => r.data),
  updatePhase: (phaseId: string, data: { status?: string; startDate?: string; endDate?: string; executionDate?: string }) =>
    api.patch(`/projects/phases/${phaseId}`, data).then((r) => r.data),
  updateActivity: (activityId: string, data: {
    status?: string; progressPercent?: number; actualHours?: number;
    observations?: string;
    plannedStartDate?: string | null; plannedEndDate?: string | null;
    actualStartDate?: string | null; actualEndDate?: string | null;
    executionDate?: string | null;
    assignedToId?: string | null; clientStaffId?: string | null;
  }) =>
    api.patch(`/projects/activities/${activityId}`, data).then((r) => r.data),
  addActivity: (phaseId: string, data: {
    name: string; description?: string; priority?: string; plannedHours?: number;
    plannedStartDate?: string; plannedEndDate?: string;
    actualStartDate?: string; actualEndDate?: string;
    assignedToId?: string; clientStaffId?: string;
  }) =>
    api.post(`/projects/phases/${phaseId}/activities`, data).then((r) => r.data),
  loadTemplate: (id: string, data: {
    templateFlowId: string;
    phaseDates?: { templatePhaseId: string; startDate?: string; endDate?: string }[];
  }) =>
    api.post(`/projects/${id}/load-template`, data).then((r) => r.data),
  deleteProject: (id: string) =>
    api.delete(`/projects/${id}`).then((r) => r.data),
};

import axios from 'axios';
import type {
  PaginatedResponse, Company, CompanyStats, Role, User, Client, ClientStaff,
  ServiceOrder, TemplateFlow, TemplateModule, ActivityThread, Project, Municipio, GlobalActivity,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  paramsSerializer: (params) => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach(v => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return parts.join('&');
  },
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

      // Si el error viene del propio endpoint de refresh, login o register → no reintentar
      if (
        original.url?.includes('/auth/refresh') ||
        original.url?.includes('/auth/login') ||
        original.url?.includes('/auth/register')
      ) {
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
  createRole: (name: string, description?: string): Promise<Role> =>
    api.post('/company/roles', { name, description }).then((r) => r.data),
  deleteRole: (roleId: string) =>
    api.delete(`/company/roles/${roleId}`).then((r) => r.data),
  updateRolePermissions: (roleId: string, permissions: string[]): Promise<Role> =>
    api.patch(`/company/roles/${roleId}/permissions`, { permissions }).then((r) => r.data),
  getConfigs: () =>
    api.get('/company/configs').then((r) => r.data),
  upsertConfig: (key: string, value: string) =>
    api.patch(`/company/configs/${key}`, { value }).then((r) => r.data),
  getDashboard: (filters?: { clientId?: string; agentId?: string; dateFrom?: string; dateTo?: string }): Promise<any> =>
    api.get('/company/dashboard', { params: filters }).then((r) => r.data),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (limit = 30): Promise<{ items: any[]; unread: number }> =>
    api.get('/notifications', { params: { limit } }).then((r) => r.data),
  markRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () =>
    api.patch('/notifications/read-all').then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/notifications/${id}`).then((r) => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe: (): Promise<User & { signatureData?: string | null }> =>
    api.get('/users/me').then((r) => r.data),
  updateSignature: (signatureData: string | null) =>
    api.patch('/users/me/signature', { signatureData }).then((r) => r.data),
  list: (params?: { page?: number; limit?: number; search?: string; userType?: string; roleSlug?: string }): Promise<PaginatedResponse<User>> =>
    api.get('/users', { params }).then((r) => r.data),
  listAgents: (params?: { limit?: number }): Promise<PaginatedResponse<User>> =>
    api.get('/users/agents', { params }).then((r) => r.data),
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
  delete: (id: string) =>
    api.delete(`/users/${id}`).then((r) => r.data),
};

// ── Clients ───────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<Client>> =>
    api.get('/clients', { params }).then((r) => r.data),
  get: (id: string): Promise<Client & { staff: ClientStaff[] }> =>
    api.get(`/clients/${id}`).then((r) => r.data),
  create: (data: object): Promise<Client> =>
    api.post('/clients', data).then((r) => r.data),
  bulkCreate: (items: object[]) =>
    api.post('/clients/bulk', { items }, { timeout: 60000 }).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/clients/${id}`).then((r) => r.data),
  bulkDelete: (ids: string[]) =>
    api.post('/clients/bulk-delete', { ids }).then((r) => r.data),
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

// ── Documentos / Tipos ────────────────────────────────────────────────────────
export const tiposDocumentoApi = {
  list: (): Promise<import('@/types').TipoDocumento[]> =>
    api.get('/documentos/tipos').then((r) => r.data),
  create: (data: { nombre: string; descripcion?: string; color?: string; orden?: number }) =>
    api.post('/documentos/tipos', data).then((r) => r.data),
  update: (id: string, data: { nombre?: string; descripcion?: string; color?: string; activo?: boolean; orden?: number }) =>
    api.put(`/documentos/tipos/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/documentos/tipos/${id}`).then((r) => r.data),
};

export const documentosApi = {
  list: (params?: {
    search?: string; tipoDocumentoId?: string;
    clientId?: string; serviceOrderId?: string; esInterno?: boolean;
    page?: number; limit?: number;
  }): Promise<{ data: import('@/types').Archivo[]; meta: { total: number; page: number; limit: number; totalPages: number } }> =>
    api.get('/documentos', { params }).then((r) => r.data),

  upload: (formData: FormData): Promise<import('@/types').Archivo> =>
    api.post('/documentos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }).then((r) => r.data),

  download: async (id: string, nombreOriginal: string) => {
    const res = await api.get(`/documentos/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = nombreOriginal;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  },

  delete: (id: string) =>
    api.delete(`/documentos/${id}`).then((r) => r.data),
};

// ── Municipios ────────────────────────────────────────────────────────────────
export const municipiosApi = {
  list: (params?: { page?: number; limit?: number; search?: string; departamento?: string }): Promise<PaginatedResponse<Municipio>> =>
    api.get('/municipios', { params }).then((r) => r.data),
  listAll: (): Promise<Municipio[]> =>
    api.get('/municipios/list').then((r) => r.data),
  listPublic: (): Promise<Municipio[]> =>
    api.get('/municipios-public/catalog').then((r) => r.data),
  create: (data: Omit<Municipio, 'id'>): Promise<Municipio> =>
    api.post('/municipios', data).then((r) => r.data),
  update: (id: string, data: Partial<Omit<Municipio, 'id'>>): Promise<Municipio> =>
    api.put(`/municipios/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/municipios/${id}`).then((r) => r.data),
  bulkCreate: (items: Omit<Municipio, 'id'>[]) =>
    api.post('/municipios/bulk', { items }, { timeout: 60000 }).then((r) => r.data),
};

// ── WhatsApp ──────────────────────────────────────────────────────────────────
export const whatsappApi = {
  getStatus: (): Promise<{ status: 'disconnected' | 'connecting' | 'qr' | 'connected'; phone?: string; qr?: string }> =>
    api.get('/whatsapp/status').then(r => r.data),
  disconnect: (): Promise<{ ok: boolean }> =>
    api.post('/whatsapp/disconnect').then(r => r.data),
  sendTest: (phone: string): Promise<{ ok: boolean; message: string; debug: Record<string, string> }> =>
    api.post('/whatsapp/send-test', { phone }).then(r => r.data),
};

// ── FAQ ───────────────────────────────────────────────────────────────────────

export interface FaqTipo {
  id: string; nombre: string; color?: string; icono?: string;
  descripcion?: string; orden: number; activo: boolean;
  _count?: { faqs: number };
}

export interface FaqListItem {
  id: string; titulo: string; descripcion?: string; etiquetas?: string;
  contenidoTexto?: string;
  vistas: number; activo: boolean; createdAt: string; updatedAt: string;
  tipo?: { id: string; nombre: string; color?: string; icono?: string } | null;
  autor?: { id: string; firstName: string; lastName: string } | null;
}

export interface FaqDetail extends FaqListItem { contenido: string; }

export const faqApi = {
  getTipos: (): Promise<FaqTipo[]> =>
    api.get('/faq/tipos').then(r => r.data),
  createTipo: (body: { nombre: string; color?: string; icono?: string; descripcion?: string; orden?: number }) =>
    api.post('/faq/tipos', body).then(r => r.data) as Promise<FaqTipo>,
  updateTipo: (id: string, body: Partial<{ nombre: string; color: string; icono: string; descripcion: string; orden: number; activo: boolean }>) =>
    api.patch(`/faq/tipos/${id}`, body).then(r => r.data) as Promise<FaqTipo>,
  deleteTipo: (id: string) =>
    api.delete(`/faq/tipos/${id}`).then(r => r.data),

  getFaqs: (params?: { q?: string; tipoId?: string; soloActivos?: boolean }): Promise<FaqListItem[]> =>
    api.get('/faq', { params }).then(r => r.data),
  getFaq: (id: string): Promise<FaqDetail> =>
    api.get(`/faq/${id}`).then(r => r.data),
  createFaq: (body: { titulo: string; contenido: string; descripcion?: string; tipoId?: string; etiquetas?: string[] }): Promise<FaqDetail> =>
    api.post('/faq', body).then(r => r.data),
  updateFaq: (id: string, body: Partial<{ titulo: string; contenido: string; descripcion: string; tipoId: string; etiquetas: string[]; activo: boolean }>): Promise<FaqDetail> =>
    api.patch(`/faq/${id}`, body).then(r => r.data),
  deleteFaq: (id: string) =>
    api.delete(`/faq/${id}`).then(r => r.data),
};

// ── Service Orders ────────────────────────────────────────────────────────────
export const serviceOrdersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; clientId?: string }): Promise<PaginatedResponse<ServiceOrder>> =>
    api.get('/service-orders', { params }).then((r) => r.data),
  listByClient: (clientId: string, limit = 200): Promise<PaginatedResponse<ServiceOrder>> =>
    api.get('/service-orders/by-client', { params: { clientId, limit } }).then((r) => r.data),
  get: (id: string): Promise<ServiceOrder> =>
    api.get(`/service-orders/${id}`).then((r) => r.data),
  create: (data: object): Promise<ServiceOrder> =>
    api.post('/service-orders', data).then((r) => r.data),
  update: (id: string, data: {
    ticketRubi?: string | null; product?: string; scope?: string; observations?: string;
    startDate?: string; endDate?: string; durationDays?: number;
    clinicalLeaderId?: string | null; financialLeaderId?: string | null;
    clientLeaderId?: string | null;
  }): Promise<ServiceOrder> =>
    api.put(`/service-orders/${id}`, data).then((r) => r.data),
  changeStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/service-orders/${id}/status`, { status, reason }).then((r) => r.data),
  addNote: (id: string, note: string, noteType: string, noteLevel: string, noteSubtype?: string, noteMitigation?: string, notifyClient?: boolean) =>
    api.post(`/service-orders/${id}/notes`, { note, noteType, noteLevel, noteSubtype, noteMitigation, notifyClient }).then((r) => r.data),
  notifyNote: (id: string, payload: { noteText: string; noteType: string; noteLevel: string; noteSubtype?: string; noteMitigation?: string; notifyClient?: boolean }) =>
    api.post(`/service-orders/${id}/notes/notify`, payload).then((r) => r.data),
  addImplementer: (id: string, userId: string, role?: string) =>
    api.post(`/service-orders/${id}/implementers`, { userId, role }).then((r) => r.data),
  removeImplementer: (id: string, userId: string) =>
    api.delete(`/service-orders/${id}/implementers/${userId}`).then((r) => r.data),
  deleteHistoryEntry: (id: string, historyId: string) =>
    api.delete(`/service-orders/${id}/history/${historyId}`).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/service-orders/${id}`).then((r) => r.data),
  bulkDelete: (ids: string[]) =>
    api.post('/service-orders/bulk-delete', { ids }).then((r) => r.data),
  generateProject: (id: string, data: {
    templateFlowId: string;
    name?: string;
    phaseDates?: { templatePhaseId: string; startDate?: string; endDate?: string; agentLeaderId?: string; clientLeaderId?: string }[];
    excludedModuleIds?: string[];
  }) =>
    api.post(`/service-orders/${id}/generate-project`, data).then((r) => r.data),
  executiveReport: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/executive-report`).then((r) => r.data),
  fullReport: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/full-report`).then((r) => r.data),
  getAlerts: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/alerts`).then((r) => r.data),
  sendReport: (id: string, body: { destinatarios: string[]; asunto?: string }): Promise<any> =>
    api.post(`/service-orders/${id}/send-report`, body).then((r) => r.data),
  sendPdf: (id: string, body: { destinatarios: string[]; asunto?: string; pdfBase64: string; filename?: string }): Promise<any> =>
    api.post(`/service-orders/${id}/send-pdf`, body).then((r) => r.data),
  sendReportPdf: (id: string, body: { destinatarios: string[]; asunto?: string; reportType: 'ejecutivo' | 'completo' }): Promise<any> =>
    api.post(`/service-orders/${id}/send-report-pdf`, body).then((r) => r.data),
  downloadReportPdf: (id: string, body: { reportType?: 'ejecutivo' | 'completo' }): Promise<Blob> =>
    api.post(`/service-orders/${id}/download-report-pdf`, body, { responseType: 'blob', timeout: 120000 }).then((r) => r.data),
  getWeeklySchedule: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/informe-schedule/weekly`).then((r) => r.data),
  saveWeeklySchedule: (id: string, body: any): Promise<any> =>
    api.post(`/service-orders/${id}/informe-schedule/weekly`, body).then((r) => r.data),
  runWeeklyNow: (id: string): Promise<any> =>
    api.post(`/service-orders/${id}/informe-schedule/weekly/run-now`).then((r) => r.data),
  getBimensualSchedule: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/informe-schedule/bimensual`).then((r) => r.data),
  saveBimensualSchedule: (id: string, body: any): Promise<any> =>
    api.post(`/service-orders/${id}/informe-schedule/bimensual`, body).then((r) => r.data),
  runBimensualNow: (id: string, period: 'quincenal' | 'mensual'): Promise<any> =>
    api.post(`/service-orders/${id}/informe-schedule/bimensual/run-now`, { period }).then((r) => r.data),
  downloadAnalysisPdf: (id: string): Promise<Blob> =>
    api.post(`/service-orders/${id}/download-analysis-pdf`, {}, { responseType: 'blob', timeout: 120000 }).then((r) => r.data),
  sendAnalysis: (id: string, body: { destinatarios: string[]; asunto?: string }): Promise<any> =>
    api.post(`/service-orders/${id}/send-analysis`, body).then((r) => r.data),
  getAnalysisSchedule: (id: string): Promise<any> =>
    api.get(`/service-orders/${id}/analysis-schedule`).then((r) => r.data),
  saveAnalysisSchedule: (id: string, body: any): Promise<any> =>
    api.post(`/service-orders/${id}/analysis-schedule`, body).then((r) => r.data),
  runAnalysisNow: (id: string): Promise<any> =>
    api.post(`/service-orders/${id}/analysis-schedule/run-now`).then((r) => r.data),
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
  // All modules with phases in one call (for selectors — avoids N individual requests)
  listModulesWithPhases: (): Promise<{ id: string; code: string; name: string; phases: { id: string; name: string; color: string; order: number }[] }[]> =>
    api.get('/templates/modules/all-with-phases').then((r) => r.data),
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
  bulkImportModules: (modules: object[]) =>
    api.post('/templates/modules/bulk-import', { modules }).then((r) => r.data),
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
  addThread: (activityId: string, payload: { content: string; newStatus?: string }): Promise<ActivityThread> =>
    api.post(`/templates/activities/${activityId}/threads`, payload).then((r) => r.data),
  deleteThread: (threadId: string) =>
    api.delete(`/templates/activities/threads/${threadId}`).then((r) => r.data),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<PaginatedResponse<Project>> =>
    api.get('/projects', { params }).then((r) => r.data),
  modulesByServiceOrder: (serviceOrderId: string): Promise<{ id: string | null; name: string | null; modules: { id: string; name: string; phases: { id: string; name: string; color: string; slug: string | null }[] }[] }> =>
    api.get(`/projects/by-service-order/${serviceOrderId}`).then((r) => r.data),
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
    blockedBy?: string; blockedNote?: string; unlockNote?: string;
  }) =>
    api.patch(`/projects/activities/${activityId}`, data).then((r) => r.data),
  addActivity: (phaseId: string, data: {
    name: string; description?: string; priority?: string; plannedHours?: number;
    plannedStartDate?: string; plannedEndDate?: string;
    actualStartDate?: string; actualEndDate?: string;
    assignedToId?: string; clientStaffId?: string;
  }) =>
    api.post(`/projects/phases/${phaseId}/activities`, data).then((r) => r.data),
  deleteActivity: (activityId: string) =>
    api.delete(`/projects/activities/${activityId}`).then((r) => r.data),
  bulkUpdateActivities: (items: Array<{ activityId: string; status: string; nota?: string; blockedBy?: string }>) =>
    api.post(`/projects/activities/bulk-update`, { items }).then((r) => r.data),
  getActivityClients: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get('/projects/activities/clients', { params }).then((r) => r.data) as Promise<{ id: string; businessName: string }[]>,
  getGlobalActivities: (params: { status?: string[]; clientId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }) =>
    api.get('/projects/activities/global', { params }).then((r) => r.data) as Promise<{
      data: GlobalActivity[];
      total: number;
      page: number;
      limit: number;
    }>,
  sendActivityReport: (body: { emails: string[]; subject?: string; message?: string; status?: string[]; clientId?: string; dateFrom?: string; dateTo?: string; agentIds?: string[] }) =>
    api.post('/projects/activities/send-report', body).then((r) => r.data) as Promise<{ enviados: number; destinatarios: number }>,
  getActivityReportSchedule: () =>
    api.get('/projects/activities/report-schedule').then((r) => r.data),
  saveActivityReportSchedule: (body: { enabled: boolean; diasSemana: number[]; hora: number; minuto: number; status: string[]; destinatarios: { email: string; agentIds?: string[] }[]; asunto?: string; mensaje?: string }) =>
    api.patch('/projects/activities/report-schedule', body).then((r) => r.data),
  runActivityReportNow: () =>
    api.post('/projects/activities/report-schedule/run-now').then((r) => r.data) as Promise<{ enviados: number; destinatarios: number }>,
  loadTemplate: (id: string, data: {
    templateFlowId: string;
    phaseDates?: { templatePhaseId: string; startDate?: string; endDate?: string }[];
    excludedModuleIds?: string[];
  }) =>
    api.post(`/projects/${id}/load-template`, data).then((r) => r.data),
  addModules: (id: string, data: {
    templateFlowId: string;
    selectedModuleIds: string[];
    phaseDates?: { templatePhaseId: string; startDate?: string; endDate?: string; agentLeaderId?: string; clientLeaderId?: string }[];
  }) =>
    api.post(`/projects/${id}/add-modules`, data).then((r) => r.data),
  deleteModule: (moduleId: string) =>
    api.delete(`/projects/modules/${moduleId}`).then((r) => r.data),
  deleteProject: (id: string) =>
    api.delete(`/projects/${id}`).then((r) => r.data),
};

// ── Actas ─────────────────────────────────────────────────────────────────────
export interface ActaFirmantePayload { id?: string; nombre?: string; cargo?: string; empresa?: string; email?: string; fecha?: string; orden?: number; documento?: string; signatureData?: string; signedAt?: string; signerType?: string; }
export interface ActaFechaVisitaPayload { fecha: string; horaInicio?: string; horaFin?: string; }
export interface ActaCompromisoPayload { numero?: number; compromiso: string; responsable?: string; estado?: string; assignedToId?: string; clientStaffId?: string; moduleId?: string; phaseId?: string; activityId?: string; }
export interface ActaParticipantePayload { numero?: number; nombre: string; horaEntrada?: string; horaSalida?: string; comprendio?: boolean; }
export interface ActaAccionPayload { accion: string; responsable?: string; fechaLimite?: string; }
export interface ActaContactoPayload { nombre?: string; telefono?: string; area?: string; }
export interface ActaActividadPayload { activityId: string; assignedToId?: string; clientStaffId?: string; status?: string; }

export interface CreateActaPayload {
  projectId: string;
  type: 'inicio' | 'visita' | 'cierre' | 'capacitacion' | 'entrega_soporte';
  numero?: string;
  fecha: string;
  ciudad?: string;
  municipioId?: string;
  lugar?: string;
  asunto?: string;
  objetivoGeneral?: string;
  alcance?: string;
  implementadorNombre?: string;
  jefeNombre?: string;
  actividadesRealizadas?: string;
  cuerpo?: string;
  cierreModulosJson?: string;
  moduloId?: string;
  expositor?: string;
  temasCapacitacion?: string;
  horaInicio?: string;
  horaFin?: string;
  nitCliente?: string;
  sedes?: string;
  responsableImplementador?: string;
  responsableSoporte?: string;
  capacitacionModalidad?: string;
  capacitacionHoras?: number;
  capacitacionPruebas?: boolean;
  requerimientosAdicionales?: string;
  observacionesGenerales?: string;
  ventanasDistintas?: string;
  modulosChecklist?: string;
  infraestructuraChecklist?: string;
  documentacionChecklist?: string;
  emisionElectronicaChecklist?: string;
  status?: string;
  firmantes?: ActaFirmantePayload[];
  fechasVisita?: ActaFechaVisitaPayload[];
  compromisos?: ActaCompromisoPayload[];
  participantes?: ActaParticipantePayload[];
  acciones?: ActaAccionPayload[];
  contactos?: ActaContactoPayload[];
  actaActividades?: ActaActividadPayload[];
}

export const actasApi = {
  list: (params: { projectId?: string; clientId?: string; type?: string } | string) => {
    const p = typeof params === 'string' ? { projectId: params } : params;
    return api.get('/actas', { params: p }).then((r) => r.data);
  },
  get: (id: string) =>
    api.get(`/actas/${id}`).then((r) => r.data),
  create: (data: CreateActaPayload) =>
    api.post('/actas', data).then((r) => r.data),
  update: (id: string, data: Partial<CreateActaPayload>) =>
    api.patch(`/actas/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/actas/${id}`).then((r) => r.data),
  signFirmante: (firmanteId: string, signatureData: string) =>
    api.patch(`/actas/firmantes/${firmanteId}/sign`, { signatureData }).then((r) => r.data),
  finalize: (id: string) =>
    api.patch(`/actas/${id}/finalizar`).then((r) => r.data),
  updateCompromiso: (compromisoId: string, estado: string) =>
    api.patch(`/actas/compromisos/${compromisoId}`, { estado }).then((r) => r.data),
  resendEmail: (actaId: string, firmanteId?: string) =>
    api.post(`/actas/${actaId}/resend-email`, { firmanteId }).then((r) => r.data),
};

export interface CreateVisitPayload {
  projectId: string;
  visitType?: string;
  visitDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  objective?: string;
  activitiesDone?: string;
  commitments?: string;
  observations?: string;
  status?: string;
  activityIds?: string[];
}

export const visitsApi = {
  list: (params?: { projectId?: string; status?: string; from?: string; to?: string }) =>
    api.get('/visits', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get(`/visits/${id}`).then((r) => r.data),
  create: (data: CreateVisitPayload) =>
    api.post('/visits', data).then((r) => r.data),
  update: (id: string, data: Partial<CreateVisitPayload>) =>
    api.patch(`/visits/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/visits/${id}`).then((r) => r.data),
};

export const requerimientosApi = {
  list: (params?: { page?: number; limit?: number; search?: string; clientId?: string; serviceOrderId?: string; agenteId?: string; area?: string; prioridad?: string; estadoActual?: string }) =>
    api.get('/requerimientos', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get(`/requerimientos/${id}`).then((r) => r.data),
  create: (data: {
    titulo: string; tipo?: string; prioridad?: string; descripcion: string;
    criteriosAceptacion?: string; templateModuleId?: string; templatePhaseId?: string;
    area: string; ticketRubi?: string; clientId: string; serviceOrderId?: string; agenteId: string;
  }) =>
    api.post('/requerimientos', data).then((r) => r.data),
  update: (id: string, data: {
    titulo?: string; descripcion?: string; tipo?: string; prioridad?: string; area?: string;
    ticketRubi?: string; agenteId?: string;
    serviceOrderId?: string | null; templateModuleId?: string | null; templatePhaseId?: string | null;
  }) =>
    api.patch(`/requerimientos/${id}`, data).then((r) => r.data),
  addGestion: (id: string, data: { fecha: string; estado: string; observacion: string; devueltoPor?: string; devueltoNota?: string }) =>
    api.post(`/requerimientos/${id}/gestiones`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/requerimientos/${id}`).then((r) => r.data),
  bulkGestion: (data: { ids: string[]; fecha: string; estado: string; observacion: string }) =>
    api.post('/requerimientos/bulk-gestion', data).then((r) => r.data),
  bulkGestionIndividual: (rows: { id: string; fecha: string; estado: string; observacion: string }[]) =>
    api.post('/requerimientos/bulk-gestion-individual', { rows }).then((r) => r.data),
  createBulk: (data: { requerimientos: object[] }) =>
    api.post('/requerimientos/bulk', data).then((r) => r.data),
  enviarCorreo: (data: {
    destinatarios: string[]; asunto?: string; mensaje?: string;
    clientId?: string; agenteId?: string; area?: string; prioridad?: string; estadosActual?: string[];
  }) =>
    api.post('/requerimientos/correo', data).then((r) => r.data),
  getSchedule: () =>
    api.get('/requerimientos/schedule').then((r) => r.data),
  saveSchedule: (cfg: object) =>
    api.post('/requerimientos/schedule', cfg).then((r) => r.data),
  runScheduleNow: () =>
    api.post('/requerimientos/schedule/run-now').then((r) => r.data),
  getAnalytics: (params?: { clientId?: string; agenteId?: string; area?: string; tipo?: string; dateFrom?: string; dateTo?: string }) =>
    api.get('/requerimientos/analytics', { params }).then((r) => r.data),
};

// ── Reportes ──────────────────────────────────────────────────────────────────
export const reportesApi = {
  ordenes: (params?: { estado?: string; clientId?: string; fechaDesde?: string; fechaHasta?: string }) =>
    api.get('/reportes/ordenes', { params }).then((r) => r.data),
  proyectos: (params?: { status?: string; clientId?: string }) =>
    api.get('/reportes/proyectos', { params }).then((r) => r.data),
  capacitaciones: (params?: { clientId?: string; serviceOrderId?: string }) =>
    api.get('/reportes/capacitaciones', { params }).then((r) => r.data),
  requerimientos: (params?: { estadoActual?: string; prioridad?: string; area?: string; clientId?: string; serviceOrderId?: string; fechaDesde?: string; fechaHasta?: string }) =>
    api.get('/reportes/requerimientos', { params }).then((r) => r.data),
};

// ── Cronograma ────────────────────────────────────────────────────────────────
export const cronogramaApi = {
  list: (params?: { agenteId?: string; clientId?: string; fechaDesde?: string; fechaHasta?: string; tipoActa?: string; status?: string }) =>
    api.get('/cronograma', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get(`/cronograma/${id}`).then((r) => r.data),
  create: (data: {
    titulo: string; fecha: string; horaInicio: string; horaFin: string;
    agenteId: string; clientId?: string; serviceOrderId?: string; notas?: string; color?: string; tipoActa?: string;
  }) =>
    api.post('/cronograma', data).then((r) => r.data),
  update: (id: string, data: {
    titulo?: string; fecha?: string; horaInicio?: string; horaFin?: string;
    agenteId?: string; clientId?: string; serviceOrderId?: string;
    notas?: string; color?: string; status?: string; actaId?: string;
  }) =>
    api.patch(`/cronograma/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/cronograma/${id}`).then((r) => r.data),
  respond: (token: string, action: 'accept' | 'cancel', motivo?: string) =>
    api.post('/cronograma/respond', { token, action, ...(motivo && { motivo }) }).then((r) => r.data),
  resendInvite: (id: string) =>
    api.post(`/cronograma/${id}/resend-invite`).then((r) => r.data),
};

// ── Comercial ─────────────────────────────────────────────────────────────────
export const comercialApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; clientId?: string }) =>
    api.get('/comercial/cotizaciones', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get(`/comercial/cotizaciones/${id}`).then((r) => r.data),
  create: (data: {
    titulo: string; clientId?: string; prospecto?: string; contacto?: string;
    email?: string; telefono?: string; valor?: number; descripcion?: string;
    validHasta?: string; notas?: string;
    items?: { descripcion: string; cantidad: number; valorUnitario: number; descuento?: number }[];
  }) =>
    api.post('/comercial/cotizaciones', data).then((r) => r.data),
  update: (id: string, data: {
    titulo?: string; clientId?: string; prospecto?: string; contacto?: string;
    email?: string; telefono?: string; valor?: number; status?: string;
    descripcion?: string; validHasta?: string; notas?: string;
    items?: { descripcion: string; cantidad: number; valorUnitario: number; descuento?: number }[];
  }) =>
    api.patch(`/comercial/cotizaciones/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/comercial/cotizaciones/${id}`).then((r) => r.data),
};

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
export const publicActasApi = {
  searchByDocumento: (documento: string) =>
    fetch(`${PUBLIC_API}/public/actas/pendientes?documento=${encodeURIComponent(documento)}`).then(r => r.json()),
  getActaFull: (firmanteId: string) =>
    fetch(`${PUBLIC_API}/public/actas/firmantes/${firmanteId}/acta`).then(r => r.json()),
  getFirmante: (id: string) =>
    fetch(`${PUBLIC_API}/public/actas/firmantes/${id}`).then(r => r.json()),
  signFirmante: (id: string, signatureData: string, comprendio?: boolean) =>
    fetch(`${PUBLIC_API}/public/actas/firmantes/${id}/sign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signatureData, ...(comprendio !== undefined && { comprendio }) }),
    }).then(r => r.json()),
};

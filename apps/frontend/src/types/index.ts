// ── Auth ──────────────────────────────────────────────────────────────────────
export type UserRole =
  | 'admin' | 'coordinator'
  | 'implementer_clinical' | 'implementer_financial' | 'implementer_support'
  | 'support' | 'client';

export type UserType = 'agent' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  role: UserRole;
  roleName: string;
  companyId: string;
  companyName?: string;
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: Meta;
}

// ── Company ───────────────────────────────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  commercialName?: string;
  nit: string;
  logo?: string;
  logoData?: string;
  primaryColor: string;
  secondaryColor: string;
  address?: string;
  city?: string;
  department?: string;
  email: string;
  phone?: string;
  website?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  emailSignature?: string;
  filesBasePath?: string;
  isActive: boolean;
}

export interface CompanyStats {
  users: number;
  clients: number;
  serviceOrders: number;
  activeProjects: number;
}

export interface SystemConfig {
  configKey: string;
  configValue: string;
  description?: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  permissions?: string;
  isSystem: boolean;
  isActive: boolean;
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  document: string;
  jobTitle?: string;
  phone?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  role: { id: string; name: string; slug: string };
  client?: { id: string; businessName: string; nit: string } | null;
}

// ── Municipios ────────────────────────────────────────────────────────────────
export interface Municipio {
  id: string;
  codigoDepartamento: string;
  nombreDepartamento: string;
  codigoMunicipio: string;
  nombreMunicipio: string;
  codigoPostal?: string | null;
}

// ── Clients ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  nit: string;
  businessName: string;
  commercialName?: string;
  address?: string;
  city?: string;
  department?: string;
  municipioId?: string | null;
  municipio?: Municipio | null;
  email?: string;
  phone?: string;
  economicActivity?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { staff: number; users: number; serviceOrders: number };
}

export interface ClientStaff {
  id: string;
  clientId: string;
  document: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  area?: string;
  isProjectLeader: boolean;
  isTrainingParticipant: boolean;
  isActSigner: boolean;
  isActive: boolean;
}

// ── Service Orders ────────────────────────────────────────────────────────────
export type OSStatus = 'pendiente' | 'en_curso' | 'suspendida' | 'completada' | 'cancelada';

export interface ServiceOrderImplementer {
  role: string;
  assignedAt: string;
  user: { id: string; firstName: string; lastName: string; jobTitle?: string };
}

export interface ServiceOrderHistory {
  id: string;
  serviceOrderId: string;
  changedById: string;
  fieldName: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface ServiceOrder {
  id: string;
  osNumber: string;
  ticketRubi?: string | null;
  product: string;
  scope?: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  observations?: string;
  status: OSStatus;
  createdAt: string;
  updatedAt: string;
  client: { id: string; businessName: string; nit: string };
  clinicalLeader?:  { id: string; firstName: string; lastName: string } | null;
  financialLeader?: { id: string; firstName: string; lastName: string } | null;
  clientLeader?:    { id: string; firstName: string; lastName: string } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  implementers: ServiceOrderImplementer[];
  history?: ServiceOrderHistory[];
  project?: { id: string; name: string; status: string; progressPercent: number } | null;
  _count?: { history: number };
}

// ── Documentos ────────────────────────────────────────────────────────────────
export interface TipoDocumento {
  id: string;
  nombre: string;
  descripcion?: string | null;
  color: string;
  scope: 'interno' | 'cliente' | 'ambos';
  activo: boolean;
  orden: number;
  createdAt: string;
  _count?: { archivos: number };
}

export interface Archivo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  nombreOriginal: string;
  mimeType: string;
  tamanioBytes: number;
  esInterno: boolean;
  createdAt: string;
  tipoDocumento: { id: string; nombre: string; color: string };
  client?:       { id: string; businessName: string; nit: string } | null;
  serviceOrder?: { id: string; osNumber: string; product: string; client?: { businessName: string } | null } | null;
  subidoPor:     { id: string; firstName: string; lastName: string };
}

// ── Templates ─────────────────────────────────────────────────────────────────
export interface TemplateActivity {
  id: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  estimatedHours: number;
  calculatedDays: number;
  defaultRole?: string;
  priority: string;
  assigneeType?: string | null;
  assigneeId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  executionDate?: string | null;
  subActivities?: { id: string; name: string; order: number; estimatedHours: number }[];
}

export interface TemplatePhase {
  id: string;
  name: string;
  slug: string;
  order: number;
  estimatedDays: number;
  color?: string;
  startDate?: string | null;
  endDate?: string | null;
  executionDate?: string | null;
  activities: TemplateActivity[];
}

export interface TemplateModule {
  id: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  estimatedDays: number;
  days: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  executionDate?: string | null;
  templateFlow?: { id: string; name: string; version: string };
  _count?: { phases: number };
  phases?: TemplatePhase[];
}

export interface ActivityThread {
  id: string;
  activityId: string;
  authorId: string;
  authorType: string;
  content: string;
  newStatus?: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; firstName: string; lastName: string; jobTitle?: string };
}

export interface TemplateFlow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  version: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  modules: TemplateModule[];
  _count?: { modules: number };
}

// ── Projects ──────────────────────────────────────────────────────────────────
export type ProjectStatus = 'activo' | 'pausado' | 'completado' | 'cancelado';
export type ActivityStatus = 'pendiente' | 'en_progreso' | 'completado' | 'bloqueado';
export type PhaseStatus   = 'pendiente' | 'en_progreso' | 'completado' | 'bloqueado';

export interface ProjectActivity {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: ActivityStatus;
  priority: string;
  progressPercent: number;
  plannedHours: number;
  actualHours: number;
  observations?: string;
  order: number;
  calculatedDays: number;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualStartDate?: string | null;
  actualEndDate?: string | null;
  executionDate?: string | null;
  assignedToId?: string | null;
  clientStaffId?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  clientStaff?: { id: string; firstName: string; lastName: string } | null;
  threads?: ActivityThread[];
  blockedBy?: string | null;
  blockedNote?: string | null;
  blockedSince?: string | null;
  clientDelayDays?: number;
}

export interface ProjectPhase {
  id: string;
  name: string;
  slug?: string;
  order: number;
  status: PhaseStatus;
  color?: string;
  progressPercent: number;
  startDate?: string | null;
  endDate?: string | null;
  executionDate?: string | null;
  activities: ProjectActivity[];
}

export interface ProjectModule {
  id: string;
  name: string;
  tipo?: string | null;
  order: number;
  progressPercent: number;
  isActive: boolean;
  phases: ProjectPhase[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  progressPercent: number;
  status: ProjectStatus;
  createdAt: string;
  serviceOrder: {
    id: string;
    osNumber: string;
    product: string;
    client: { id: string; businessName: string };
  };
  templateFlow?: { id: string; name: string } | null;
  modules?: ProjectModule[];
  _count?: { modules: number };
}

export interface GlobalActivity {
  id: string;
  code: string | null;
  name: string;
  status: string;
  priority: string;
  progressPercent: number;
  actualHours: number;
  updatedAt: string;
  executionDate: string | null;
  assignedTo: { id: string; firstName: string; lastName: string } | null;
  clientStaff: { id: string; firstName: string; lastName: string } | null;
  threads: { createdAt: string; author: { id: string; firstName: string; lastName: string } }[];
  phase: {
    id: string;
    name: string;
    projectModule: {
      id: string;
      name: string;
      project: {
        id: string;
        serviceOrder: {
          id: string;
          osNumber: string;
          product: string;
          client: { id: string; businessName: string };
        };
      };
    };
  };
}

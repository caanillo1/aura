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
  isActive: boolean;
}

export interface CompanyStats {
  users: number;
  clients: number;
  serviceOrders: number;
  activeProjects: number;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
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

// ── Clients ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string;
  nit: string;
  businessName: string;
  commercialName?: string;
  address?: string;
  city?: string;
  department?: string;
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

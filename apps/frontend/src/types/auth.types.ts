export type UserType = 'agent' | 'client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  role: string;
  roleName: string;
  companyId: string;
  companyName?: string;
  clientId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  userType: UserType;
  document: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  jobTitle?: string;
  agentRegPassword?: string;
  clientId?: string;
}

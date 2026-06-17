import { useAuthStore } from '@/store/auth.store';

export function usePermission() {
  const user = useAuthStore((s) => s.user);

  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions.includes(permission);
  };

  const canAny = (...perms: string[]): boolean => perms.some(can);
  const canAll = (...perms: string[]): boolean => perms.every(can);

  return { can, canAny, canAll };
}

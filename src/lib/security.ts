import { Permission, hasPermission } from './permissions';
import { UserProfile, UserRole } from '../types';

export interface SecurityPrincipal {
  id: string;
  organizationId: string;
  role: UserRole;
  fullName: string;
}

let activePrincipal: SecurityPrincipal | null = null;

export function setSecurityPrincipal(profile: UserProfile | null): void {
  activePrincipal = profile && profile.is_active
    ? {
        id: profile.id,
        organizationId: profile.organization_id,
        role: profile.role,
        fullName: profile.full_name,
      }
    : null;
}

export function getSecurityPrincipal(): SecurityPrincipal | null {
  return activePrincipal;
}

export function requirePermission(organizationId: string, permission: Permission): SecurityPrincipal {
  const principal = activePrincipal;
  if (!principal || principal.organizationId !== organizationId) {
    throw new Error('Authentication required for this organization');
  }
  if (!hasPermission(principal.role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
  return principal;
}

export function requireOrganization(organizationId: string): SecurityPrincipal {
  const principal = activePrincipal;
  if (!principal || principal.organizationId !== organizationId) {
    throw new Error('Authentication required for this organization');
  }
  return principal;
}
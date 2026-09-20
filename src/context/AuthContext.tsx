import React, { createContext, useContext, useEffect, useState } from 'react';
import { Organization, UserProfile, UserRole } from '../types';
import { DEFAULT_ORGANIZATION } from '../lib/mockData';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { StorageEngine } from '../services/storageEngine';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: UserProfile | null;
  organization: Organization;
  role: UserRole;
  isSupabaseReady: boolean;
  isLoading: boolean;
  onboardingCompleted: boolean;
  signIn: (email: string, pass: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    orgName: string
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateOrganization: (org: Partial<Organization>) => void;
  switchRole: (role: UserRole) => void;
  completeOnboarding: (orgData: Partial<Organization>) => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isUserRole(role: unknown): role is UserRole {
  return role === 'OWNER' || role === 'MANAGER' || role === 'CASHIER';
}

function fallbackProfileFromUser(user: User, organizationId: string): UserProfile {
  return {
    id: user.id,
    email: user.email || 'user@yaqoob.com',
    full_name: user.email?.split('@')[0] || 'Staff Member',
    role: 'CASHIER',
    organization_id: organizationId,
    is_active: true,
    created_at: user.created_at,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization, setOrganization] = useState<Organization>(() => {
    const org = StorageEngine.getOrganization(DEFAULT_ORGANIZATION.id);
    return org || DEFAULT_ORGANIZATION;
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    const profiles = StorageEngine.getProfiles(DEFAULT_ORGANIZATION.id);
    if (profiles.length > 0) return profiles[0];
    return {
      id: 'usr-owner-1',
      email: 'yaqoobenterprisesofficial@gmail.com',
      full_name: 'Muhammad Yaqoob',
      role: 'OWNER',
      organization_id: DEFAULT_ORGANIZATION.id,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  });

  const [role, setRole] = useState<UserRole>('OWNER');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('yaqoob_onboarding_done') === 'true';
    }
    return true;
  });

  const isSupabaseReady = isSupabaseConfigured();

  const loadCloudProfile = async (authUser: User): Promise<UserProfile> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return fallbackProfileFromUser(authUser, organization.id);
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,organization_id,is_active,created_at')
      .eq('id', authUser.id)
      .single();

    if (profileError || !data) {
      console.warn('Supabase profile lookup error:', profileError);
      return fallbackProfileFromUser(authUser, organization.id);
    }

    return {
      id: data.id,
      email: data.email || authUser.email || 'user@yaqoob.com',
      full_name: data.full_name || 'Staff Member',
      role: isUserRole(data.role) ? data.role : 'CASHIER',
      organization_id: data.organization_id || organization.id,
      is_active: data.is_active !== false,
      created_at: data.created_at || authUser.created_at,
    };
  };

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      if (supabase && isSupabaseReady) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            const profile = await loadCloudProfile(session.user);
            setUser(profile);
            setRole(profile.role);
          }
        } catch (err: any) {
          console.warn('Supabase auth session lookup error:', err);
        }
      }
      setIsLoading(false);
    }

    initAuth();
  }, [isSupabaseReady, organization.id]);

  const signIn = async (email: string, pass: string): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseReady) {
      try {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (sbError) {
          setIsLoading(false);
          setError(sbError.message);
          return { error: sbError.message };
        }
        if (data.user) {
          const profile = await loadCloudProfile(data.user);
          setUser(profile);
          setRole(profile.role);
        }
      } catch (err: any) {
        setIsLoading(false);
        setError(err.message || 'Authentication failed');
        return { error: err.message };
      }
    } else {
      // Local workspace session
      const mockUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        full_name: email.split('@')[0] || 'Muhammad Yaqoob',
        role: 'OWNER',
        organization_id: organization.id,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      StorageEngine.saveProfile(mockUser);
      setUser(mockUser);
      setRole('OWNER');
    }

    setIsLoading(false);
    return {};
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    orgName: string
  ): Promise<{ error?: string }> => {
    setError(null);
    setIsLoading(true);
    const supabase = getSupabaseClient();

    if (supabase && isSupabaseReady) {
      try {
        const { data, error: sbError } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: fullName,
              organization_name: orgName,
            },
          },
        });
        if (sbError) {
          setIsLoading(false);
          setError(sbError.message);
          return { error: sbError.message };
        }
        if (data.user) {
          const profile = await loadCloudProfile(data.user);
          setUser(profile);
          setRole(profile.role);
        }
      } catch (err: any) {
        setIsLoading(false);
        setError(err.message || 'Registration failed');
        return { error: err.message };
      }
    } else {
      const newOrg: Organization = {
        ...DEFAULT_ORGANIZATION,
        id: `org-${Date.now()}`,
        name: orgName,
        owner_name: fullName,
      };
      StorageEngine.updateOrganization(newOrg);
      setOrganization(newOrg);

      const profile: UserProfile = {
        id: `usr-${Date.now()}`,
        email,
        full_name: fullName,
        role: 'OWNER',
        organization_id: newOrg.id,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      StorageEngine.saveProfile(profile);
      setUser(profile);
      setRole('OWNER');
    }

    setIsLoading(false);
    return {};
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseReady) {
      await supabase.auth.signOut();
    }
    setUser(null);
  };

  const updateOrganization = (orgData: Partial<Organization>) => {
    const updated: Organization = {
      ...organization,
      ...orgData,
      updated_at: new Date().toISOString(),
    };
    StorageEngine.updateOrganization(updated);
    setOrganization(updated);
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const completeOnboarding = (orgData: Partial<Organization>) => {
    const updated: Organization = {
      ...organization,
      ...orgData,
      updated_at: new Date().toISOString(),
    };
    updateOrganization(updated);
    setOnboardingCompleted(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('yaqoob_onboarding_done', 'true');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        role,
        isSupabaseReady,
        isLoading,
        onboardingCompleted,
        signIn,
        signUp,
        signOut,
        updateOrganization,
        switchRole,
        completeOnboarding,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

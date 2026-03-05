import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface User {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    role?: string;
    created_at?: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    hasTenant: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    setTenantId: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadUserAndProfile = async (sessionUser: any) => {
            if (!sessionUser) {
                if (mounted) {
                    setUser(null);
                    setIsLoading(false);
                }
                return;
            }

            // Safety timeout: if Supabase hangs for more than 8 seconds,
            // force isLoading=false so the UI never gets permanently stuck.
            const timeout = setTimeout(() => {
                if (mounted) {
                    console.warn("[AuthContext] loadUserAndProfile timed out – forcing isLoading=false");
                    setIsLoading(false);
                }
            }, 8000);

            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('tenant_id, full_name, role')
                    .eq('id', sessionUser.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error("Error loading profile:", error);
                }

                if (mounted) {
                    const newUser = {
                        id: sessionUser.id,
                        email: sessionUser.email,
                        name: profile?.full_name || sessionUser.user_metadata?.name || 'Administrador',
                        tenantId: profile?.tenant_id || null,
                        role: profile?.role || 'admin',
                        created_at: sessionUser.created_at
                    };

                    setUser(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
                        return newUser;
                    });
                }
            } catch (err) {
                console.error("Unexpected error loading user profile", err);
            } finally {
                clearTimeout(timeout);
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        // 1. Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadUserAndProfile(session?.user || null);
        });

        // 2. Listen for auth changes.
        // We now also handle INITIAL_SESSION — this is the event Supabase fires when
        // the OAuth callback (Google) redirects back to /dashboard. Without handling it,
        // the second Google login gets stuck because getSession() fires but the
        // INITIAL_SESSION handler never ran, leaving stale state.
        // TOKEN_REFRESHED is still excluded to avoid unnecessary UI flashes.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (
                    event === 'SIGNED_IN' ||
                    event === 'SIGNED_OUT' ||
                    event === 'INITIAL_SESSION'
                ) {
                    // Only set loading if we don't already have user data (first load)
                    // This avoids a flash when switching tabs or minor re-auths
                    setIsLoading(prev => {
                        if (event === 'SIGNED_OUT') return true;
                        if (!user) return true;          // First load – show spinner
                        return prev;                     // Already loaded – stay silent
                    });
                    loadUserAndProfile(session?.user || null);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                console.error("Login error:", error);
                return false;
            }
            return true;
        } catch (error) {
            console.error("Unexpected login error", error);
            return false;
        } finally {
            // Fallback: if onAuthStateChange doesn't fire within a reasonable time,
            // release the loading lock. The auth state listener sets it back properly.
            setTimeout(() => setIsLoading(false), 5000);
        }
    };

    const loginWithGoogle = async () => {
        try {
            // Always redirect to /dashboard after Google OAuth callback.
            // Using the current page's origin ensures it works on both localhost and production.
            // We intentionally do NOT use window.location.href as redirectTo because:
            //   • If the user is already on /dashboard and re-authenticates (e.g. token expired),
            //     redirecting back to /dashboard is correct.
            //   • If they're on /login or /register we still want /dashboard (the app will
            //     route them correctly based on hasTenant once loaded).
            const redirectTo = `${window.location.origin}/dashboard`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo }
            });
            if (error) {
                console.error("Google login error:", error);
                throw error;
            }
        } catch (error) {
            console.error("Unexpected Google login error", error);
            throw error;
        }
    };

    const setTenantId = async (id: string) => {
        if (!user) return;

        try {
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                full_name: user.name,
                tenant_id: id,
                role: user.role || 'admin'
            }, {
                onConflict: 'id'
            });

            if (error) {
                console.error("Error setting tenant_id on profile:", error);
                throw error;
            }

            setUser({ ...user, tenantId: id });
        } catch (error) {
            console.error("Failed to set tenant:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut({ scope: 'global' });
            setUser(null);
        } catch (error) {
            console.error("Error logging out", error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            hasTenant: !!user?.tenantId,
            login,
            loginWithGoogle,
            logout,
            isLoading,
            setTenantId
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

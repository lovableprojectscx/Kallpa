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

        // GLOBAL Safety timeout: si Supabase auth (getSession) se queda pensando
        // o no responde, forzar isLoading = false para nunca dejar la web en blanco.
        const globalTimeout = setTimeout(() => {
            if (mounted) {
                console.warn("[AuthContext] Global Auth Initialization timed out – forcing isLoading=false");
                setIsLoading(false);
            }
        }, 5000);

        const loadUserAndProfile = async (sessionUser: any) => {
            if (!sessionUser) {
                if (mounted) {
                    setUser(null);
                    setIsLoading(false);
                    clearTimeout(globalTimeout);
                }
                return;
            }

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
                if (mounted) {
                    setIsLoading(false);
                    clearTimeout(globalTimeout);
                }
            }
        };

        // 1. Check active session on mount
        const checkSession = async () => {
            // CRITICAL FIX: If we are returning from Google OAuth, the URL will have ?code= or #access_token=
            // Supabase needs a moment to exchange this code for a real session in the background.
            // If we blindly call getSession() and immediately set user=null, AuthGuard will shoot them to /login,
            // which can break the flow.
            const urlParams = new URLSearchParams(window.location.search);
            const isOAuthRedirect = urlParams.has('code') || window.location.hash.includes('access_token=');

            if (isOAuthRedirect) {
                // Wait a bit before checking session manually, let onAuthStateChange (SIGNED_IN) handle it
                // We keep isLoading=true so AuthGuard shows the spinner and doesn't redirect.
                // WE MUST clear the 5 sec timeout, because OAuth callback parsing can be slow on slow networks!
                clearTimeout(globalTimeout);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            loadUserAndProfile(session?.user || null);
        };

        checkSession();

        // 2. Listen for auth changes.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                    if (event === 'INITIAL_SESSION' && !session) {
                        return;
                    }

                    // CRITICAL FIX: If we just signed in (e.g., from Register.tsx calling signUp), 
                    // we MUST set isLoading = true immediately so AuthGuard doesn't bounce the user 
                    // to /login while loadUserAndProfile is fetching the DB profile.
                    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                        setIsLoading(true);
                    }

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
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                console.error("Login error:", error);
                return false;
            }
            // Load profile directly — don't depend on onAuthStateChange firing SIGNED_IN,
            // which may not fire when re-logging in with an already-valid token (TOKEN_REFRESHED instead).
            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id, full_name, role')
                    .eq('id', data.user.id)
                    .single();

                const newUser = {
                    id: data.user.id,
                    email: data.user.email!,
                    name: profile?.full_name || data.user.user_metadata?.name || 'Administrador',
                    tenantId: profile?.tenant_id || null,
                    role: profile?.role || 'admin',
                    created_at: data.user.created_at
                };
                setUser(newUser);
            }
            return true;
        } catch (error) {
            console.error("Unexpected login error", error);
            return false;
        } finally {
            setIsLoading(false);
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
            // Forzamos limpiar el estado local INMEDIATAMENTE para evitar que 
            // la UI se quede trabada si Supabase signOut falla (por red o token inválido).
            setUser(null);

            // Usamos local scope porque global puede fallar y trabar la app
            // si el usuario tiene múltiples pestañas o la red falla.
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) {
                console.error("Supabase signOut error (token already invalid?):", error);
            }
        } catch (error) {
            console.error("Unexpected error logging out", error);
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

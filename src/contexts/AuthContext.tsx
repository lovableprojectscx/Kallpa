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
    logout: () => Promise<void>;
    isLoading: boolean;
    setTenantId: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initial load and auth state subscription
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

            try {
                // Get the user's profile which contains the tenant_id
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('tenant_id, full_name, role')
                    .eq('id', sessionUser.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error("Error loading profile:", error);
                }

                if (mounted) {
                    setUser({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        name: profile?.full_name || sessionUser.user_metadata?.name || 'Administrador',
                        tenantId: profile?.tenant_id || null,
                        role: profile?.role || 'admin',
                        created_at: sessionUser.created_at
                    });
                }
            } catch (err) {
                console.error("Unexpected error loading user profile", err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        // 1. Check active session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadUserAndProfile(session?.user || null);
        });

        // 2. Listen for auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                    // Solo activar la pantalla de carga (bloqueante) si el usuario realmente cerró sesión
                    // o si la app acaba de montar (lo cual ya está controlado por el isLoading inicial).
                    // Para SIGNED_IN o TOKEN_REFRESHED, actualizamos el perfil en segundo plano (silenciosamente)
                    // para no destruir el estado local actual de los formularios en pantalla.
                    if (event === 'SIGNED_OUT') {
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
    }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                console.error("Login error:", error);
                return false;
            }
            return true;
        } catch (error) {
            console.error("Unexpected login error", error);
            return false;
        } finally {
            // we don't setIsLoading(false) here because onAuthStateChange will trigger and set it
            // if we set it here it might unblock UI before profile is loaded.
        }
    };

    const setTenantId = async (id: string) => {
        if (!user) return;

        try {
            // Emplear upsert para garantizar la existencia de la fila en `profiles`
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                full_name: user.name,
                tenant_id: id,
                role: user.role || 'admin' // Preservar perfil de admin global si lo tiene
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

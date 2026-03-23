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

        // Seguridad global: si Supabase no responde en 5 s, desbloquea la UI
        // para evitar una pantalla en blanco indefinida.
        const globalTimeout = setTimeout(() => {
            if (mounted) {
                console.warn("[AuthContext] Auth init timed out – forcing isLoading=false");
                setIsLoading(false);
            }
        }, 5000);

        /**
         * Carga el perfil del usuario desde la tabla `profiles` y actualiza el estado global.
         * - Si `sessionUser` es null, limpia el estado (sesión cerrada).
         * - Si la query de perfil falla por un error distinto a "no rows" (PGRST116),
         *   conserva el estado anterior para evitar un redirect falso a /onboarding.
         * - Usa una comparación JSON para evitar re-renders innecesarios cuando los datos no cambian.
         */
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
                    // Error de red u otro error no recuperable: conservar estado actual
                    // para no resetear tenantId a null y evitar redirect falso a /onboarding.
                    console.error("Error loading profile:", error);
                    if (mounted) {
                        setIsLoading(false);
                        clearTimeout(globalTimeout);
                    }
                    return;
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

        /**
         * Verifica si hay una sesión activa al montar el provider.
         * Si la URL contiene un código OAuth (?code=) o un token (#access_token=),
         * no hace getSession() manualmente — deja que `onAuthStateChange` lo maneje
         * cuando Supabase termine de procesar el callback, evitando un redirect
         * prematuro a /login durante el intercambio de tokens.
         */
        const checkSession = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const isOAuthRedirect = urlParams.has('code') || window.location.hash.includes('access_token=');

            if (isOAuthRedirect) {
                clearTimeout(globalTimeout);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            loadUserAndProfile(session?.user || null);
        };

        checkSession();

        /**
         * Escucha cambios de sesión de Supabase en tiempo real.
         * - SIGNED_IN / INITIAL_SESSION con sesión: activa isLoading=true
         *   para que AuthGuard muestre el spinner mientras se carga el perfil.
         * - SIGNED_OUT: limpia el estado via loadUserAndProfile(null).
         * - TOKEN_REFRESHED e INITIAL_SESSION sin sesión: ignorados
         *   (el token refresh no necesita recargar el perfil).
         */
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                    if (event === 'INITIAL_SESSION' && !session) {
                        return;
                    }

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

    /**
     * Inicia sesión con email y contraseña.
     * Carga el perfil directamente desde el resultado de signInWithPassword,
     * sin depender de onAuthStateChange (que puede emitir TOKEN_REFRESHED en
     * lugar de SIGNED_IN si el token ya era válido, causando un loading infinito).
     * Retorna true si el login fue exitoso, false si hubo un error de credenciales.
     */
    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                console.error("Login error:", error);
                return false;
            }

            if (data.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('tenant_id, full_name, role')
                    .eq('id', data.user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    // Error al cargar perfil: el login fue exitoso en Auth pero no pudimos
                    // obtener el perfil. Logueamos el error pero retornamos true igual —
                    // el usuario entrará sin tenantId y será redirigido a /onboarding,
                    // donde podrá completar su configuración.
                    console.error("Profile load error after login:", profileError);
                }

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

    /**
     * Inicia el flujo de autenticación con Google OAuth.
     * Siempre redirige a /dashboard después del callback — el router se encarga
     * de redirigir al destino correcto según hasTenant y el rol del usuario.
     * Lanza excepción si Supabase falla (para que el componente muestre un error).
     */
    const loginWithGoogle = async () => {
        try {
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

    /**
     * Actualiza el tenant_id del usuario tanto en la BD (tabla profiles) como en el estado local.
     * Se llama desde Onboarding.tsx después de crear el tenant.
     * Usa upsert con onConflict='id' para evitar race conditions en doble submit.
     * Lanza excepción si la operación falla para que el llamador pueda manejarla.
     */
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

    /**
     * Cierra la sesión del usuario.
     * Limpia el estado local ANTES de llamar a Supabase para evitar que la UI
     * quede trabada si signOut falla (red caída, token ya inválido).
     * Usa scope='local' para no invalidar otras pestañas abiertas del mismo usuario.
     */
    const logout = async () => {
        try {
            setUser(null);
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

/** Hook para acceder al contexto de autenticación. Lanza si se usa fuera de AuthProvider. */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

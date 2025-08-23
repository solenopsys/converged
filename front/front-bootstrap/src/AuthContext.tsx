import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// Флаг для включения/отключения хардкодированной авторизации
const USE_HARDCODED_AUTH = true; // Изменить на false, чтобы отключить

// Хардкодированные данные пользователя (используются только если USE_HARDCODED_AUTH = true)
const HARDCODED_USER = {
  id: "user-123",
  email: "user@example.com",
  name: "Тестовый Пользователь"
};
const HARDCODED_TOKEN = "fake-jwt-token-123456789";

interface User {
  id: string;
  email: string;
  name?: string;
  // Add any other user properties you need
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  socialLogin: (provider: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(USE_HARDCODED_AUTH ? HARDCODED_USER : null);
  const [token, setToken] = useState<string | null>(USE_HARDCODED_AUTH ? HARDCODED_TOKEN : null);
  const [loading, setLoading] = useState(!USE_HARDCODED_AUTH);

  // Check for existing token and fetch user data on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Если используем хардкод, просто сохраняем токен и выходим
      if (USE_HARDCODED_AUTH) {
        localStorage.setItem("authToken", HARDCODED_TOKEN);
        setLoading(false);
        return;
      }
      
      const storedToken = localStorage.getItem("authToken");
      
      if (storedToken) {
        setToken(storedToken);
        try {
          // Make a request to your backend to get user details
          const response = await fetch("/auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token might be invalid or expired
            localStorage.removeItem("authToken");
            setToken(null);
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          localStorage.removeItem("authToken");
          setToken(null);
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Handle URL parameters for OAuth callbacks
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Пропускаем обработку OAuth, если используем хардкод
      if (USE_HARDCODED_AUTH) return;
      
      // Check if we're on a callback URL
      if (window.location.pathname.includes('/auth/callback/')) {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const error = urlParams.get("error");
        
        if (error) {
          console.error("OAuth error:", error);
          // Redirect to login page
          window.location.href = "/login";
          return;
        }
        
        if (token) {
          localStorage.setItem("authToken", token);
          setToken(token);
          
          try {
            // Fetch user data with the new token
            const response = await fetch("/auth/me", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const userData = await response.json();
              setUser(userData);
              
              // Redirect to dashboard
              window.location.href = "/dashboard";
            }
          } catch (error) {
            console.error("Failed to fetch user data:", error);
            window.location.href = "/login";
          }
        }
      }
    };

    if (!loading) {
      handleOAuthCallback();
    }
  }, [loading]);

  const login = async (email: string, password: string) => {
    // Если используем хардкод, симулируем успешный вход
    if (USE_HARDCODED_AUTH) {
      console.log("Using hardcoded auth, login simulation successful");
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        throw new Error("Login failed");
      }
      
      const data = await response.json();
      
      if (data.token) {
        localStorage.setItem("authToken", data.token);
        setToken(data.token);
        setUser(data.user);
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Если используем хардкод, просто логируем и ничего не меняем
    if (USE_HARDCODED_AUTH) {
      console.log("Using hardcoded auth, logout simulation (auth state remains unchanged)");
      return;
    }
    
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
  };

  const socialLogin = (provider: string) => {
    // Если используем хардкод, логируем и никуда не переходим
    if (USE_HARDCODED_AUTH) {
      console.log(`Using hardcoded auth, ${provider} login simulation successful`);
      return;
    }
    
    // Redirect to the backend OAuth route
    window.location.href = `/auth/connect/${provider}`;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    socialLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}
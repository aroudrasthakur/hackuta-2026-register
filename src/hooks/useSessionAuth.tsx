import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { convexClient } from "../convex/client";
import { useMockAuth } from "./useMockAuth";

type SessionAuthValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionKey: string;
  signOut: () => Promise<void>;
};

const SessionAuthContext = createContext<SessionAuthValue | null>(null);

function ConvexSessionBridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut: convexSignOut } = useAuthActions();

  const signOut = useCallback(async () => {
    await convexSignOut();
    convexClient?.clearAuth();
  }, [convexSignOut]);

  return (
    <SessionAuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        sessionKey: isAuthenticated ? "authenticated" : "signed-out",
        signOut,
      }}
    >
      {children}
    </SessionAuthContext.Provider>
  );
}

function MockSessionBridge({ children }: { children: ReactNode }) {
  const mock = useMockAuth();

  return (
    <SessionAuthContext.Provider
      value={{
        isLoading: mock.isLoading,
        isAuthenticated: mock.isAuthenticated,
        sessionKey: mock.verifiedEmail ?? "signed-out",
        signOut: async () => {
          mock.signOut();
        },
      }}
    >
      {children}
    </SessionAuthContext.Provider>
  );
}

export function SessionAuthProvider({ children }: { children: ReactNode }) {
  const mock = useMockAuth();
  if (mock.enabled) {
    return <MockSessionBridge>{children}</MockSessionBridge>;
  }
  return <ConvexSessionBridge>{children}</ConvexSessionBridge>;
}

export function useSessionAuth() {
  const context = useContext(SessionAuthContext);
  if (!context) {
    throw new Error("useSessionAuth must be used within SessionAuthProvider");
  }
  return context;
}

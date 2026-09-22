import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSessionAuth } from "../hooks/useSessionAuth";

function AuthLoadingScreen() {
  return (
    <main className="register-page flex min-h-screen items-center justify-center bg-(--clay)">
      <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
        Loading…
      </p>
    </main>
  );
}

/** Every full page load starts signed out; sessions do not carry over from prior visits. */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, signOut } = useSessionAuth();
  const [sessionReady, setSessionReady] = useState(false);
  const bootstrappingRef = useRef(false);

  useEffect(() => {
    if (sessionReady || bootstrappingRef.current) return;
    if (isLoading) return;

    bootstrappingRef.current = true;
    void (async () => {
      try {
        if (isAuthenticated) {
          await signOut();
        }
      } finally {
        setSessionReady(true);
        bootstrappingRef.current = false;
      }
    })();
  }, [isAuthenticated, isLoading, sessionReady, signOut]);

  // Only block the initial auth read. Do not unmount the tree when isLoading
  // flips during sign-in actions — that would reset SignInPage step state.
  if (!sessionReady) {
    return <AuthLoadingScreen />;
  }

  return children;
}

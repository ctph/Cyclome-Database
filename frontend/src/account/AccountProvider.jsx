import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createGuestSession, getSession, loginUrl, logoutSession } from "./accountApi";

const AccountContext = createContext(null);

export function AccountProvider({ children }) {
  const [session, setSession] = useState({
    mode: "loading",
    user: null,
    guest: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const current = await getSession();
      if (current.mode === "anonymous") {
        const guest = await createGuestSession();
        setSession({
          mode: guest.mode,
          user: guest.user || null,
          guest: guest.guest || null,
        });
      } else {
        setSession({
          mode: current.mode,
          user: current.user || null,
          guest: current.guest || null,
        });
      }
      setError("");
    } catch (err) {
      setSession({ mode: "offline", user: null, guest: null });
      setError(err?.message || "Account service unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    const onFocus = () => {
      refreshSession();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshSession]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutSession();
      await refreshSession();
    } catch (err) {
      setError(err?.message || "Logout failed");
      setLoading(false);
    }
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      session,
      error,
      loading,
      loginHref: loginUrl(),
      logout,
      refreshSession,
    }),
    [error, loading, logout, refreshSession, session],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used inside AccountProvider");
  }
  return context;
}

import { createContext, useContext } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ElectionContext = createContext(undefined);

export function ElectionProvider({ children }) {
  const { profile } = useAuth();

  // Section is kept for Grade Representative filtering
  const currentSection = profile?.section || null;

  return (
    <ElectionContext.Provider value={{ currentSection }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error("useElection must be used within ElectionProvider");
  return ctx;
}

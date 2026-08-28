import { createContext, useContext, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ElectionContext = createContext(undefined);

export function ElectionProvider({ children }) {
  const { profile } = useAuth();
  const [activeSchoolYear, setActiveSchoolYear] = useState(null);

  // Section is kept for Grade Representative filtering
  const currentSection = profile?.section || null;

  return (
    <ElectionContext.Provider value={{ currentSection, activeSchoolYear, setActiveSchoolYear }}>
      {children}
    </ElectionContext.Provider>
  );
}

export function useElection() {
  const ctx = useContext(ElectionContext);
  if (!ctx) throw new Error("useElection must be used within ElectionProvider");
  return ctx;
}

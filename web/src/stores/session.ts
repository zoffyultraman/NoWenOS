import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  token: string | null;
  username: string | null;
  role: string | null;
  setSession: (token: string, username: string, role: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      role: null,
      setSession: (token, username, role) => set({ token, username, role }),
      clearSession: () => set({ token: null, username: null, role: null }),
    }),
    {
      name: "nowenos-session",
    }
  )
);

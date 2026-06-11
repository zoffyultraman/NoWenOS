import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PermissionState {
  role: string;
  username: string;
  setUserInfo: (username: string, role: string) => void;
  clear: () => void;
  isAdmin: () => boolean;
  canWrite: () => boolean;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      role: "user",
      username: "",
      setUserInfo: (username: string, role: string) => set({ username, role }),
      clear: () => set({ role: "user", username: "" }),
      isAdmin: () => get().role === "admin",
      canWrite: () => get().role !== "viewer",
    }),
    { name: "nowenos-permissions" },
  ),
);

import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning" | "chat" | "announcement";

export interface Toast {
  msg: string;
  type?: ToastType;
  ok: boolean;
}

interface ToastStore {
  toast: Toast | null;
  showToast: (msg: string, type?: ToastType, ok?: boolean) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  showToast: (msg, type = "success", ok = true) => {
    set({ toast: { msg, type, ok } });
    setTimeout(() => {
      set((state) => {
        if (state.toast?.msg === msg) {
          return { toast: null };
        }
        return state;
      });
    }, 5000);
  },
  hideToast: () => set({ toast: null }),
}));

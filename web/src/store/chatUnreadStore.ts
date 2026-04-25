import { create } from "zustand";

/**
 * Global chat unread count — written by RestChat, read by Header.
 * Not persisted (resets on page load; RestChat rehydrates from server).
 */
interface ChatUnreadStore {
  totalUnread: number;
  setTotalUnread: (n: number) => void;
}

export const useChatUnreadStore = create<ChatUnreadStore>()((set) => ({
  totalUnread: 0,
  setTotalUnread: (n) => set({ totalUnread: n }),
}));

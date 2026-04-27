import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TermStore {
  selectedTermId: string | null;
  selectedTermName: string | null;
  setSelectedTerm: (id: string | null, name: string | null) => void;
  clearSelectedTerm: () => void;
}

export const useTermStore = create<TermStore>()(
  persist(
    (set) => ({
      selectedTermId: null,
      selectedTermName: null,
      setSelectedTerm: (id, name) =>
        set({ selectedTermId: id, selectedTermName: name }),
      clearSelectedTerm: () =>
        set({ selectedTermId: null, selectedTermName: null }),
    }),
    { name: "trilink-term-v1" }
  )
);

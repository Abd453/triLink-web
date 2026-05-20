import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTermStore } from "./termStore";

/** Legacy seed list; admin header year dropdown uses GET /api/academic-years instead. */
export const ACADEMIC_YEARS = [
    "2021/2022",
    "2022/2023",
    "2023/2024",
    "2024/2025"
];

interface AcademicYearStore {
    years: string[];
    currentSystemYear: string;
    adminSelectedYear: string;
    setAdminSelectedYear: (year: string) => void;
    setCurrentSystemYear: (year: string) => void;
    addYear: (year: string) => void;
}

export const useAcademicYearStore = create<AcademicYearStore>()(
    persist(
        (set) => ({
            years: ACADEMIC_YEARS,
            currentSystemYear: "2024/2025",
            adminSelectedYear: "2024/2025",

            setAdminSelectedYear: (year) => {
                // Clear selected term whenever the academic year changes
                useTermStore.getState().clearSelectedTerm();
                set({ adminSelectedYear: year });
            },
            setCurrentSystemYear: (year) => {
                // Clear selected term whenever the system year changes
                useTermStore.getState().clearSelectedTerm();
                set((state) => ({
                    currentSystemYear: year,
                    // Optionally move admin to the new year as well to avoid confusion
                    adminSelectedYear: year
                }));
            },
            addYear: (year) => set((state) => {
                if (state.years.includes(year)) return state;
                return { years: [...state.years, year] };
            }),
        }),
        { name: "trilink-academic-year-v1" }
    )
);

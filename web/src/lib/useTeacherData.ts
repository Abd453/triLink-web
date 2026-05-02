/**
 * Shared hook for teacher pages.
 * Caches: active academic year, class offerings, exams, questions.
 * Uses stale-while-revalidate so pages show data instantly on revisit.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { cachedFetch, invalidateCachePrefix } from "./cache";
import {
  getActiveAcademicYear,
  listMyClassOfferings,
  listExams as apiListExams,
  type ClassOffering,
  type Exam,
} from "./admin-api";

export interface TeacherBaseData {
  yearId: string;
  offerings: ClassOffering[];
  exams: Exam[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useTeacherBaseData(subject?: string | null): TeacherBaseData {
  const [yearId, setYearId] = useState("");
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch year + offerings in parallel where possible
      const year = await cachedFetch(
        "active-year",
        () => getActiveAcademicYear(),
        120_000, // 2 min TTL
        (fresh) => { if (mountedRef.current && fresh?.id) setYearId(fresh.id); },
      );

      if (!year?.id) {
        if (mountedRef.current) {
          setError("No active academic year. Ask an admin to activate one.");
          setLoading(false);
        }
        return;
      }

      if (mountedRef.current) setYearId(year.id);

      // Fetch offerings + exams in parallel
      const [mine, examList] = await Promise.all([
        cachedFetch(
          `offerings:${year.id}`,
          () => listMyClassOfferings(year.id),
          60_000,
          (fresh) => { if (mountedRef.current) setOfferings(fresh); },
        ),
        cachedFetch(
          `exams:${year.id}`,
          () => apiListExams(year.id),
          30_000,
          (fresh) => { if (mountedRef.current) setExams(fresh); },
        ),
      ]);

      if (mountedRef.current) {
        setOfferings(mine);
        setExams(examList);
      }
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reload = useCallback(() => {
    invalidateCachePrefix("active-year");
    invalidateCachePrefix("offerings:");
    invalidateCachePrefix("exams:");
    void load();
  }, [load]);

  return { yearId, offerings, exams, loading, error, reload };
}

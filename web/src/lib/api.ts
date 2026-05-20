/**
 * Central API base URL for TriLink NestJS backend.
 * All authenticated calls should use authFetch from ./auth.
 */
export function getApiBase(): string {
  const envBase =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "")) || "";
  if (envBase) return envBase;
  // Always use the deployed production backend as requested
  return "https://trilink-backend-ms68.onrender.com";
}

/**
 * Robust helper to get a file download URL.
 * Handles cases where getApiBase might be empty or relative.
 */
export function getFileUrl(fileId: string | null | undefined): string {
  if (!fileId) return "";
  const base = getApiBase();
  // If base is empty (should not happen now with our default), fallback to the production backend
  const safeBase = base || "https://trilink-backend-ms68.onrender.com";
  return `${safeBase}/api/files/${fileId}/download`;
}

/** Paths are relative to API host (include /api prefix). */
export const apiPath = {
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  me: "/api/auth/me",
  changePassword: "/api/auth/change-password",
  register: "/api/auth/register",
} as const;

/** Get current user ID from localStorage session */
export function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = localStorage.getItem("auth_session");
    if (!session) return null;
    const parsed = JSON.parse(session);
    return parsed?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Opens a file in a new tab using the direct Cloudinary URL.
 * Use this for documents (PDF, DOCX, etc.) to avoid browser zip issues.
 * Falls back to the /download redirect if the /url endpoint fails.
 */
export async function openFile(fileId: string | null | undefined): Promise<void> {
  if (!fileId) return;
  try {
    const base = getApiBase() || "http://localhost:4000";
    console.log("base", base)
    const { authFetch } = await import("./auth");
    const res = await authFetch(`${base}/api/files/${fileId}/url`);
    if (res.ok) {
      const data = await res.json() as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
      return;
    }
  } catch { /* fall through */ }
  // Fallback: use the redirect endpoint
  window.open(getFileUrl(fileId), "_blank", "noopener,noreferrer");
}

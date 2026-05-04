/**
 * Central API base URL for TriLink NestJS backend.
 * All authenticated calls should use authFetch from ./auth.
 *
 * NEXT_PUBLIC_API_BASE_URL is required — set it in .env.local for dev
 * and in your deployment environment for prod. We refuse to silently
 * point at a hardcoded backend.
 */
export function getApiBase(): string {
  const raw = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined;
  const envBase = raw?.replace(/\/$/, "") ?? "";
  if (!envBase) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Add it to .env.local (e.g. http://localhost:3001) or your deployment environment.",
    );
  }
  return envBase;
}

export function getFileUrl(fileId: string | null | undefined): string {
  if (!fileId) return "";
  return `${getApiBase()}/api/files/${fileId}/download`;
}

/** Paths are relative to API host (include /api prefix). */
export const apiPath = {
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  me: "/api/auth/me",
  changePassword: "/api/auth/change-password",
  register: "/api/auth/register",
} as const;

/**
 * Opens a file in a new tab using the direct Cloudinary URL.
 * Use this for documents (PDF, DOCX, etc.) to avoid browser zip issues.
 * Falls back to the /download redirect if the /url endpoint fails.
 */
export async function openFile(fileId: string | null | undefined): Promise<void> {
  if (!fileId) return;
  try {
    const base = getApiBase() || "http://localhost:4000";
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

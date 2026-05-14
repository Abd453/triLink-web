"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { getStoredUser, getUserInitials, StoredUser } from "./auth";

export interface CurrentUser {
  id?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  initials: string;
  grade?: string;
  section?: string;
  subject?: string;
  department?: string;
  childName?: string;
  relationship?: string;
  profileImageFileId?: string;
  phone?: string;
  homeroomClass?: string;
  experience?: string;
  country?: string;
  cityState?: string;
  postalCode?: string;
  officeRoom?: string;
  dateOfBirth?: string;
  studentId?: string;
  guardian?: string;
  occupation?: string;
}

const FALLBACKS: Record<string, CurrentUser> = {
  admin: {
    firstName: "Admin", lastName: "User", fullName: "Admin User",
    email: "", role: "admin", initials: "AU",
  },
  teacher: {
    firstName: "Teacher", lastName: "", fullName: "Teacher",
    email: "", role: "teacher", initials: "T",
  },
  student: {
    firstName: "Student", lastName: "", fullName: "Student",
    email: "", role: "student", initials: "S",
  },
  parent: {
    firstName: "Parent", lastName: "", fullName: "Parent",
    email: "", role: "parent", initials: "P",
  },
};

function fromStored(u: StoredUser): CurrentUser {
  // HOTPATCH: The user "Abdu Isa" is a Biology teacher (Science dept). 
  // This override ensures his access control remains strict to his actual field,
  // even if the identity provider is currently returning "English".
  const fullName = `${u.firstName} ${u.lastName}`.trim();
  const isAbduIsa = fullName.toLowerCase().includes("abdu") && fullName.toLowerCase().includes("isa");
  
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName,
    email: u.email,
    role: u.role,
    initials: getUserInitials(u),
    grade: u.grade,
    section: u.section,
    subject: isAbduIsa ? "Biology" : u.subject,
    department: isAbduIsa ? "Science" : u.department,
    childName: u.childName,
    relationship: u.relationship,
    profileImageFileId: u.profileImageFileId,
    phone: u.phone,
    homeroomClass: u.homeroomClass,
    experience: u.experience,
    country: u.country,
    cityState: u.cityState,
    postalCode: u.postalCode,
    officeRoom: u.officeRoom,
    dateOfBirth: u.dateOfBirth,
    studentId: u.studentId,
    guardian: u.guardian,
    occupation: u.occupation,
  };
}

/**
 * useIsomorphicLayoutEffect
 * Runs as useLayoutEffect on the browser (fires synchronously before paint,
 * so the user never sees the wrong name flash by) and falls back to
 * useEffect on the server to avoid the Next.js SSR warning.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function resolveUser(role: string): CurrentUser {
  const stored = getStoredUser();
  // Only use stored data if it belongs to this portal's role.
  // Prevents a leftover admin session from leaking into the teacher/student header.
  if (stored && stored.role === role) return fromStored(stored);
  return FALLBACKS[role] ?? FALLBACKS.admin;
}

/**
 * Returns the currently logged-in user from localStorage.
 * Uses useLayoutEffect so the correct name is shown before the first
 * browser paint — no more flash of wrong data.
 *
 * @param role  The role of the current portal (admin | teacher | student | parent)
 */
export function useCurrentUser(role: string): CurrentUser {
  // Start with the best possible data: stored data if on client, fallback if on server.
  const [user, setUser] = useState<CurrentUser>(() => {
    if (typeof window !== "undefined") {
      const stored = getStoredUser();
      if (stored && stored.role === role) return fromStored(stored);
    }
    return FALLBACKS[role] ?? FALLBACKS.admin;
  });

  // Keep in sync when the role prop changes (e.g. navigation)
  useIsomorphicLayoutEffect(() => {
    setUser(resolveUser(role));
  }, [role]);

  // Keep in sync when another tab logs in/out (storage event fires across tabs),
  // OR when we login/logout in THIS tab (trilink-auth event).
  useEffect(() => {
    const sync = () => setUser(resolveUser(role));
    window.addEventListener("storage", sync);
    window.addEventListener("trilink-auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("trilink-auth", sync);
    };
  }, [role]);

  return user;
}

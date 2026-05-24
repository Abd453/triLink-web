"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Select from "@/components/Select";
import {
  activateAcademicYear,
  getSchoolSettings,
  getUserSettings,
  listAcademicYears,
  patchSchoolSettings,
  patchUserSettings,
  type AcademicYear,
} from "@/lib/admin-api";

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const o = JSON.parse(raw && raw.trim() ? raw : "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default function AdminSettings() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [schoolDisplayName, setSchoolDisplayName] = useState("");
  const [schoolTimezone, setSchoolTimezone] = useState("");
  const [schoolSupportEmail, setSchoolSupportEmail] = useState("");
  const [schoolDateFormat, setSchoolDateFormat] = useState("mdy");
  const [schoolBlob, setSchoolBlob] = useState<Record<string, unknown>>({});

  const [prefTheme, setPrefTheme] = useState<"light" | "dark" | "system">("system");
  const [prefCompactTables, setPrefCompactTables] = useState(false);
  const [userBlob, setUserBlob] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setErr(null);
    try {
      const [school, me, y] = await Promise.all([getSchoolSettings(), getUserSettings(), listAcademicYears()]);
      const s = school as { settingsJson?: string };
      const m = me as { settingsJson?: string };
      const sObj = parseJsonObject(s.settingsJson ?? "{}");
      setSchoolBlob(sObj);
      setSchoolDisplayName(String(sObj.displayName ?? sObj.schoolName ?? ""));
      setSchoolTimezone(String(sObj.timezone ?? ""));
      setSchoolSupportEmail(String(sObj.supportEmail ?? ""));
      setSchoolDateFormat(String(sObj.dateFormat ?? "mdy") === "dmy" ? "dmy" : "mdy");

      const uObj = parseJsonObject(m.settingsJson ?? "{}");
      setUserBlob(uObj);
      const th = uObj.theme;
      setPrefTheme(th === "dark" || th === "light" ? th : "system");
      setPrefCompactTables(Boolean(uObj.compactTables));

      setYears(y);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSchool = async () => {
    setErr(null);
    setMsg(null);
    try {
      const next: Record<string, unknown> = { ...schoolBlob };
      const dn = schoolDisplayName.trim();
      const tz = schoolTimezone.trim();
      const se = schoolSupportEmail.trim();
      if (dn) next.displayName = dn;
      else delete next.displayName;
      if (tz) next.timezone = tz;
      else delete next.timezone;
      if (se) next.supportEmail = se;
      else delete next.supportEmail;
      next.dateFormat = schoolDateFormat;
      await patchSchoolSettings(JSON.stringify(next));
      setSchoolBlob(next);
      setMsg("School settings saved successfully.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const saveMe = async () => {
    setErr(null);
    setMsg(null);
    try {
      const next = {
        ...userBlob,
        theme: prefTheme,
        compactTables: prefCompactTables,
      };
      await patchUserSettings(JSON.stringify(next));
      setUserBlob(next);
      setMsg("Your preferences saved successfully.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  const activate = async (id: string) => {
    try {
      await activateAcademicYear(id);
      setYears(await listAcademicYears());
      setMsg("Active year updated successfully.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Activate failed");
    }
  };

  if (isLoading) {
    return (
      <div className="page-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: "1rem", color: "var(--gray-500)", fontWeight: 500 }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">School-wide defaults, your preferences, and the active academic year</p>
        </div>
      </div>

      {err && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#dc2626", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxWidth: 340 }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "var(--success, #22c55e)", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: 10, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
          {msg}
        </div>
      )}

      {/* Academic Year Selector Panel */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 className="card-title" style={{ marginBottom: "0.75rem" }}>
          Academic year
        </h3>
        <p style={{ fontSize: "0.9rem", color: "var(--gray-600)", marginBottom: "1rem" }}>
          Create years, terms, grades, and subjects under{" "}
          <Link href="/admin/school-setup" style={{ color: "var(--primary-600)", fontWeight: 600, textDecoration: "none" }}>
            School setup
          </Link>
          . Choose which year is active for day-to-day work.
        </p>
        <div className="table-wrapper" style={{ border: "1px solid var(--gray-100)", borderRadius: 12, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {years.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ color: "var(--gray-500)", textAlign: "center", padding: "1.5rem" }}>
                    No academic years yet.
                  </td>
                </tr>
              ) : (
                years.map((y) => (
                  <tr key={y.id}>
                    <td style={{ fontWeight: 600, color: "var(--gray-800)" }}>{y.label}</td>
                    <td>
                      {y.isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.25rem 0.6rem", background: "var(--primary-50)", color: "var(--primary-700)", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary-600)" }} />
                          Yes
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.25rem 0.6rem", background: "var(--gray-50)", color: "var(--gray-500)", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600 }}>
                          No
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => activate(y.id)} style={{ borderRadius: 8 }}>
                        Set active
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Container for Side-by-Side School Profile and Admin Preferences */}
      <div className="settings-grid">
        
        {/* School Profile Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: "0.5rem" }}>
              School profile
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "1.5rem", lineHeight: 1.4 }}>
              Shown in communications and reports. Only administrators can change these.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <label className="settings-label">
                School name
                <input
                  value={schoolDisplayName}
                  onChange={(e) => setSchoolDisplayName(e.target.value)}
                  placeholder="e.g. Lincoln High School"
                  className="settings-input"
                />
              </label>
              <label className="settings-label">
                Support email (optional)
                <input
                  type="email"
                  value={schoolSupportEmail}
                  onChange={(e) => setSchoolSupportEmail(e.target.value)}
                  placeholder="office@school.edu"
                  className="settings-input"
                />
              </label>
              <label className="settings-label">
                Timezone (optional)
                <Select
                  value={schoolTimezone}
                  onChange={(e) => setSchoolTimezone(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "0.6rem 1rem",
                    borderRadius: "20px",
                    border: "1px solid var(--primary-200)",
                    background: "var(--primary-50)",
                    color: schoolTimezone ? "var(--primary-800)" : "var(--gray-400)",
                    fontWeight: 600,
                  }}
                >
                  <option value="">— Select timezone —</option>
                  {Intl.supportedValuesOf("timeZone").map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </label>
              <label className="settings-label">
                Date format
                <Select
                  value={schoolDateFormat}
                  onChange={(e) => setSchoolDateFormat(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "0.6rem 1rem",
                    borderRadius: "20px",
                    border: "1px solid var(--primary-200)",
                    background: "var(--primary-50)",
                    color: "var(--primary-800)",
                    fontWeight: 600,
                  }}
                >
                  <option value="mdy">Month / day / year (US-style)</option>
                  <option value="dmy">Day / month / year</option>
                </Select>
              </label>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={saveSchool} style={{ marginTop: "2rem", width: "100%", borderRadius: 10 }}>
            Save school profile
          </button>
        </div>

        {/* Your Admin Preferences Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: "0.5rem" }}>
              Your admin preferences
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--gray-500)", marginBottom: "1.5rem", lineHeight: 1.4 }}>
              These apply only to your account in this browser experience.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--gray-700)", marginBottom: "0.6rem" }}>Theme</legend>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {(
                    [
                      ["light", "Light Mode"],
                      ["dark", "Dark Mode"],
                      ["system", "Match Device settings"],
                    ] as const
                  ).map(([v, label]) => {
                    const isSelected = prefTheme === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setPrefTheme(v)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          padding: "0.75rem 1rem",
                          borderRadius: "12px",
                          border: isSelected ? "1.5px solid var(--primary-400)" : "1.5px solid var(--gray-200)",
                          background: isSelected ? "var(--primary-50)" : "#ffffff",
                          color: isSelected ? "var(--primary-800)" : "var(--gray-700)",
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: "0.85rem",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            border: isSelected ? "3.5px solid var(--primary-600)" : "1px solid var(--gray-400)",
                            background: "#ffffff",
                            boxSizing: "border-box",
                            transition: "all 0.15s ease",
                            flexShrink: 0,
                          }}
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--gray-700)", display: "block", marginBottom: "0.6rem" }}>Table layout</span>
                <button
                  type="button"
                  onClick={() => setPrefCompactTables(!prefCompactTables)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                    border: prefCompactTables ? "1.5px solid var(--primary-400)" : "1.5px solid var(--gray-200)",
                    background: prefCompactTables ? "var(--primary-50)" : "#ffffff",
                    color: prefCompactTables ? "var(--primary-800)" : "var(--gray-700)",
                    fontWeight: prefCompactTables ? 600 : 500,
                    fontSize: "0.85rem",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={prefCompactTables}
                    readOnly
                    style={{
                      cursor: "pointer",
                      accentColor: "var(--primary-600)",
                      width: 16,
                      height: 16,
                      margin: 0,
                      flexShrink: 0,
                    }}
                  />
                  Use compact tables (smaller rows in lists)
                </button>
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={saveMe} style={{ marginTop: "2rem", width: "100%", borderRadius: 10 }}>
            Save preferences
          </button>
        </div>

      </div>
    </div>
  );
}

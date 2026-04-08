import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export interface RegistrationEmailPayload {
    emailType?: "registration" | "reset-password";
    to: string;
    firstName?: string;
    lastName?: string;
    role: "student" | "teacher" | "parent" | "admin";
    tempPassword?: string;
    resetLink?: string;
    // role-specific extras
    grade?: string;
    section?: string;
    subject?: string;
    department?: string;
    childName?: string;
    relationship?: string;
}

function roleColor(role: string) {
    if (role === "student") return { primary: "#4f46e5", light: "#eef2ff", icon: "🎓" };
    if (role === "teacher") return { primary: "#0891b2", light: "#ecfeff", icon: "📚" };
    return { primary: "#7c3aed", light: "#f5f3ff", icon: "👨‍👩‍👧" };
}

function buildRoleDetails(payload: RegistrationEmailPayload): string {
    const rows: [string, string][] = [];

    if (payload.role === "student") {
        if (payload.grade) rows.push(["Grade", payload.grade]);
        if (payload.section) rows.push(["Section", payload.section]);
    } else if (payload.role === "teacher") {
        if (payload.subject) rows.push(["Subject", payload.subject]);
        if (payload.department) rows.push(["Department", payload.department]);
    } else if (payload.role === "parent") {
        if (payload.childName) rows.push(["Child's Name", payload.childName]);
        if (payload.relationship) rows.push(["Relationship", payload.relationship]);
    }

    return rows
        .map(
            ([label, value]) => `
        <tr>
          <td style="padding:10px 16px;color:#64748b;font-size:14px;font-weight:600;width:140px;">${label}</td>
          <td style="padding:10px 16px;color:#1e293b;font-size:14px;">${value}</td>
        </tr>`
        )
        .join("");
}

function buildEmailHtml(payload: RegistrationEmailPayload): string {
    const { primary, light, icon } = roleColor(payload.role);
    const roleLabel = payload.role.charAt(0).toUpperCase() + payload.role.slice(1);
    const roleDetails = buildRoleDetails(payload);

    if (payload.emailType === "reset-password") {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,${primary},${primary}dd);padding:40px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">TriLink</span>
                    </div>
                  </td>
                  <td align="right" style="font-size:48px;">🔒</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${light};padding:32px 40px;border-bottom:1px solid #e2e8f0;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#0f172a;">Reset Your Password</h1>
              <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">
                We received a request to reset the password for the TriLink ${roleLabel} account associated with <strong>${payload.to}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Click the button below to reset your password. This link will expire in 30 minutes.
              </p>
              <a href="${payload.resetLink || '#'}"
                 style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
                Reset Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not change until you create a new one.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // Default: Registration Email
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Welcome to TriLink</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${primary},${primary}dd);padding:40px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">TriLink</span>
                      <span style="background:rgba(255,255,255,0.2);color:#fff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">SCHOOL SYSTEM</span>
                    </div>
                    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Educational Management Platform</p>
                  </td>
                  <td align="right" style="font-size:48px;">${icon}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome Banner -->
          <tr>
            <td style="background:${light};padding:24px 40px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:13px;font-weight:700;color:${primary};letter-spacing:1px;text-transform:uppercase;">Account Created</p>
              <h1 style="margin:6px 0 0;font-size:26px;font-weight:800;color:#0f172a;line-height:1.3;">
                Welcome, ${payload.firstName}! 👋
              </h1>
              <p style="margin:10px 0 0;font-size:15px;color:#475569;line-height:1.6;">
                Your <strong>${roleLabel}</strong> account has been successfully registered on TriLink. 
                Below are your account details and temporary login credentials.
              </p>
            </td>
          </tr>

          <!-- Account Details -->
          <tr>
            <td style="padding:32px 40px 0;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Account Information</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px 16px;color:#64748b;font-size:14px;font-weight:600;width:140px;">Full Name</td>
                  <td style="padding:10px 16px;color:#1e293b;font-size:14px;font-weight:600;">${payload.firstName} ${payload.lastName}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px 16px;color:#64748b;font-size:14px;font-weight:600;">Email</td>
                  <td style="padding:10px 16px;color:#1e293b;font-size:14px;">${payload.to}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px 16px;color:#64748b;font-size:14px;font-weight:600;">Role</td>
                  <td style="padding:10px 16px;">
                    <span style="background:${light};color:${primary};font-size:13px;font-weight:700;padding:3px 12px;border-radius:20px;">${roleLabel}</span>
                  </td>
                </tr>
                ${roleDetails ? `<tr style="border-top:1px solid #e2e8f0;">${roleDetails}</tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- Credentials Box -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">Login Credentials</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,${primary}18,${primary}08);border:2px dashed ${primary}55;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Email / Username</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#1e293b;">${payload.to}</p>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Temporary Password</p>
                          <div style="display:inline-block;background:${primary};color:#ffffff;font-size:20px;font-weight:800;padding:10px 24px;border-radius:8px;letter-spacing:3px;font-family:monospace;">
                            ${payload.tempPassword}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                      ⚠️ <strong>Important:</strong> This is a temporary password. You will be prompted to change it upon your first login. Please keep your credentials secure and do not share them.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Login Button -->
          <tr>
            <td style="padding:28px 40px 0;text-align:center;">
              <a href="${(process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "")}/${payload.role}/login"
                 style="display:inline-block;background:linear-gradient(135deg,${primary},${primary}cc);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
                Log In to Your Account →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px;text-align:center;border-top:1px solid #e2e8f0;margin-top:32px;">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;">
                This email was sent automatically by the TriLink School System.
              </p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;">
                If you did not expect this account, please contact your school administrator.
              </p>
              <p style="margin:16px 0 0;font-size:14px;font-weight:700;color:${primary};">TriLink • Educational Excellence</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
    try {
        const payload: RegistrationEmailPayload = await req.json();

        if (payload.emailType === "reset-password") {
            if (!payload.to) return NextResponse.json({ error: "Missing email" }, { status: 400 });
        } else {
            if (!payload.to || !payload.firstName || !payload.tempPassword) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            }
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST ?? "smtp.gmail.com",
            port: Number(process.env.SMTP_PORT ?? 465),
            secure: process.env.SMTP_SECURE !== "false",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const title = payload.emailType === "reset-password"
            ? `🔒 Reset Your Password - TriLink Security`
            : `🎉 Welcome to TriLink – Your ${payload.role.charAt(0).toUpperCase() + payload.role.slice(1)} Account is Ready`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM ?? `"TriLink School System" <${process.env.SMTP_USER}>`,
            to: payload.to,
            subject: title,
            html: buildEmailHtml(payload),
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[send-email] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to send email" },
            { status: 500 }
        );
    }
}

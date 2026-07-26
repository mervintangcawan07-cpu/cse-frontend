import { Resend } from "resend";

/**
 * Gets a clean, sanitized 'from' address without quotes
 */
function getFromEmail() {
  const envFrom = process.env.EMAIL_FROM?.replace(/['"]/g, "").trim();
  return envFrom || "onboarding@resend.dev";
}

/**
 * Safely initialize Resend client on demand
 */
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * 📧 Send Account Email Verification Link via Resend
 */
export async function sendVerificationEmail(toEmail: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/verify-email?token=${token}`;
  const resend = getResendClient();

  if (!resend) {
    console.log("------------------------------------");
    console.log(`[DEV MODE - NO RESEND KEY] Verification Link for ${toEmail}:`);
    console.log(verifyLink);
    console.log("------------------------------------");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject: "Verify Your Email Address - CSE Reviewer",
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; color: #0f172a; border-radius: 16px;">
          <h2 style="color: #2563eb; margin-top: 0;">Verify Your Email Address</h2>
          <p style="font-size: 14px; color: #334155;">Thank you for registering for the Civil Service Exam Reviewer! Please click the button below to verify your email address and activate your account:</p>
          <div style="margin: 24px 0;">
            <a href="${verifyLink}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px;">Verify Email Address</a>
          </div>
          <p style="font-size: 12px; color: #64748b;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Verification Email Error:", error);
    } else {
      console.log(`Verification email sent via Resend to ${toEmail} (ID: ${data?.id})`);
    }
  } catch (err) {
    console.error("Failed to dispatch verification email via Resend:", err);
  }
}

/**
 * 🔒 Send Password Reset Link via Resend
 */
export async function sendPasswordResetEmail(toEmail: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  const resend = getResendClient();

  if (!resend) {
    console.log("------------------------------------");
    console.log(`[DEV MODE - NO RESEND KEY] Reset Password Link for ${toEmail}:`);
    console.log(resetLink);
    console.log("------------------------------------");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: toEmail,
      subject: "Password Reset Request - CSE Reviewer",
      html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; color: #0f172a; border-radius: 16px;">
          <h2 style="color: #2563eb; margin-top: 0;">Password Reset Request</h2>
          <p style="font-size: 14px; color: #334155;">You requested a password reset for your Civil Service Exam Reviewer account. Click the button below to set a new password:</p>
          <div style="margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 12px; font-size: 14px;">Reset Password</a>
          </div>
          <p style="font-size: 12px; color: #64748b;">This security link expires in 1 hour. If you didn't request this, no action is needed.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend Password Reset Error:", error);
    } else {
      console.log(`Password reset email sent via Resend to ${toEmail} (ID: ${data?.id})`);
    }
  } catch (err) {
    console.error("Failed to dispatch password reset email via Resend:", err);
  }
}
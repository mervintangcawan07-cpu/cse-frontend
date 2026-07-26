import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "CSE Reviewer ";

/**
 * 📧 Send Account Email Verification Link via Resend
 */
export async function sendVerificationEmail(toEmail: string, token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/verify-email?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log("------------------------------------");
    console.log(`[DEV MODE - NO RESEND KEY] Verification Link for ${toEmail}:`);
    console.log(verifyLink);
    console.log("------------------------------------");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Verify Your Email Address - CSE Reviewer",
      html: `
        
          Verify Your Email Address
          Thank you for registering for the Civil Service Exam Reviewer! Please click the button below to verify your email address and activate your account:
          
            Verify Email Address
          
          If you didn't create an account, you can safely ignore this email.
        
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

  if (!process.env.RESEND_API_KEY) {
    console.log("------------------------------------");
    console.log(`[DEV MODE - NO RESEND KEY] Reset Password Link for ${toEmail}:`);
    console.log(resetLink);
    console.log("------------------------------------");
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Password Reset Request - CSE Reviewer",
      html: `
        
          Password Reset Request
          You requested a password reset for your Civil Service Exam Reviewer account. Click the button below to set a new password:
          
            Reset Password
          
          This security link expires in 1 hour. If you didn't request this, no action is needed.
        
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
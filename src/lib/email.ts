import { Resend } from "resend";

/**
 * Cleans the base URL to strip any accidental Markdown formatting or quotes
 */
function getBaseUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return rawUrl.replace(/\[.*?\]|\(|\)|['"]/g, "").trim() || "http://localhost:3000";
}

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
  const verifyLink = `${getBaseUrl()}/verify-email?token=${token}`;
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
          <p style="font-size: 12px; color: #64748b; word-break: break-all;">
            If the button above doesn't work, copy and paste this link into your browser:<br/>
            <a href="${verifyLink}" style="color: #2563eb;">${verifyLink}</a>
          </p>
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
  const resetLink = `${getBaseUrl()}/reset-password?token=${token}`;
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
          <p style="font-size: 12px; color: #64748b; word-break: break-all;">
            If the button above doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
          </p>
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

/**
 * 🎉 Send Real-Time Commission Alert to Partner
 */
export async function sendPartnerCommissionAlertEmail(params: {
  toEmail: string;
  partnerName: string;
  commissionPesos: string;
  purchasePesos: string;
  planType: string;
  campaignSource?: string;
  dashboardUrl?: string;
}) {
  const resend = getResendClient();
  const dashboardUrl = params.dashboardUrl || `${getBaseUrl()}/partner/dashboard`;
  const cleanCommission = params.commissionPesos.replace(/^₱\s*/, "");
  const cleanPurchase = params.purchasePesos.replace(/^₱\s*/, "");
  const channelLabel =
    params.campaignSource === "youtube"
      ? "📹 YouTube"
      : params.campaignSource === "tiktok"
      ? "📱 TikTok / Reels"
      : params.campaignSource === "fbgroup"
      ? "👥 Facebook Group"
      : params.campaignSource === "messenger"
      ? "💬 Messenger"
      : params.campaignSource === "email"
      ? "📧 Email"
      : "🌐 Direct";

  const html = `
    <div style="font-family: sans-serif; padding: 24px; background-color: #0f172a; color: #f1f5f9; border-radius: 16px; max-width: 560px;">
      <div style="background: linear-gradient(135deg, #059669, #0d9488); padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900;">💰 New Commission Earned!</h2>
        <p style="margin: 6px 0 0; color: #d1fae5; font-size: 13px;">GovStudyX Partner Program</p>
      </div>
      <p style="font-size: 14px; color: #cbd5e1;">Hi <strong>${params.partnerName}</strong>,</p>
      <p style="font-size: 14px; color: #94a3b8;">A student just upgraded their GovStudyX account through your referral! Here are your real-time earnings:</p>
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Plan Purchased</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-weight: bold; border-bottom: 1px solid #334155;">${params.planType.replace("_", " ")}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Student Payment</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-weight: bold; border-bottom: 1px solid #334155;">₱${cleanPurchase}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Traffic Source</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-weight: bold; border-bottom: 1px solid #334155;">${channelLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #34d399; font-weight: 900; font-size: 15px;">Your Commission</td>
            <td style="padding: 8px 0; color: #34d399; text-align: right; font-weight: 900; font-size: 22px;">₱${cleanCommission}</td>
          </tr>
        </table>
      </div>
      <div style="margin: 24px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #059669, #0d9488); color: #ffffff; text-decoration: none; font-weight: 900; border-radius: 12px; font-size: 14px;">View Your Earnings Dashboard</a>
      </div>
      <p style="font-size: 11px; color: #475569;">Commissions are held for your configured holding period before becoming eligible for withdrawal. Minimum payout threshold applies.</p>
    </div>
  `;

  if (!resend) {
    console.log(`[DEV MODE - PARTNER COMMISSION ALERT] Partner: ${params.partnerName}, Commission: ₱${cleanCommission}`);
    return;
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.toEmail,
      subject: `💰 You earned ₱${cleanCommission} commission — GovStudyX Partner`,
      html,
    });
  } catch (err) {
    console.error("Failed to send partner commission alert email:", err);
  }
}

/**
 * 🎓 Send Partner Application Approved & Welcome Onboarding Email
 */
export async function sendPartnerApplicationApprovedEmail(params: {
  toEmail: string;
  applicantName: string;
  organizationName: string;
  partnerCode: string;
  partnerSlug?: string | null;
  loginUrl?: string;
  initialPassword: string;
}) {
  const resend = getResendClient();
  const loginUrl = params.loginUrl || `${getBaseUrl()}/partner/login`;
  const referralLink = `${getBaseUrl()}/p/${params.partnerSlug || params.partnerCode}`;

  const html = `
    <div style="font-family: sans-serif; padding: 24px; background-color: #0f172a; color: #f1f5f9; border-radius: 16px; max-width: 560px;">
      <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900;">🎉 Welcome to the GovStudyX Partner Program!</h2>
        <p style="margin: 6px 0 0; color: #e0e7ff; font-size: 13px;">Official Educational Partner — Philippines Civil Service Exam</p>
      </div>
      <p style="font-size: 14px; color: #cbd5e1;">Hi <strong>${params.applicantName}</strong>,</p>
      <p style="font-size: 14px; color: #94a3b8;">Congratulations! Your application for <strong style="color: #a78bfa;">${params.organizationName}</strong> has been reviewed and officially approved.</p>

      <div style="background: #1e293b; border: 1px solid #4f46e5; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #c4b5fd; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em;">Your Partner Portal Credentials</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Partner Code</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-weight: 900; font-family: monospace; border-bottom: 1px solid #334155;">${params.partnerCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Your Referral Link</td>
            <td style="padding: 8px 0; color: #34d399; text-align: right; font-family: monospace; font-size: 12px; border-bottom: 1px solid #334155;">${referralLink}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Login Email</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; border-bottom: 1px solid #334155;">${params.toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Initial Password</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-family: monospace; font-weight: bold;">${params.initialPassword}</td>
          </tr>
        </table>
      </div>

      <div style="margin: 24px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; text-decoration: none; font-weight: 900; border-radius: 12px; font-size: 14px;">Access Your Partner Dashboard</a>
      </div>
      <p style="font-size: 11px; color: #475569;">Please change your password immediately after your first login. Your partner referral link is already active and tracked automatically.</p>
    </div>
  `;

  if (!resend) {
    console.log(`[DEV MODE - PARTNER APPROVAL] Partner: ${params.organizationName}, Code: ${params.partnerCode}`);
    return;
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.toEmail,
      subject: `🎉 You're Approved! Welcome to GovStudyX Partner Program — ${params.organizationName}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send partner approval email:", err);
  }
}

/**
 * 💸 Send Partner Payout Processed Confirmation Email
 */
export async function sendPartnerPayoutProcessedEmail(params: {
  toEmail: string;
  partnerName: string;
  amountPesos: string;
  payoutMethod: string;
  transactionRef?: string;
  dashboardUrl?: string;
}) {
  const resend = getResendClient();
  const dashboardUrl = params.dashboardUrl || `${getBaseUrl()}/partner/dashboard`;
  const cleanAmount = params.amountPesos.replace(/^₱\s*/, "");
  const methodLabel =
    params.payoutMethod === "GCASH"
      ? "GCash"
      : params.payoutMethod === "MAYA"
      ? "Maya"
      : "Bank Transfer";

  const html = `
    <div style="font-family: sans-serif; padding: 24px; background-color: #0f172a; color: #f1f5f9; border-radius: 16px; max-width: 560px;">
      <div style="background: linear-gradient(135deg, #0891b2, #0284c7); padding: 20px 24px; border-radius: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 900;">💸 Payout Processed!</h2>
        <p style="margin: 6px 0 0; color: #e0f2fe; font-size: 13px;">GovStudyX Partner Program — Commission Payout</p>
      </div>
      <p style="font-size: 14px; color: #cbd5e1;">Hi <strong>${params.partnerName}</strong>,</p>
      <p style="font-size: 14px; color: #94a3b8;">Great news! Your commission payout request has been processed and disbursed.</p>
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Payout Amount</td>
            <td style="padding: 8px 0; color: #38bdf8; text-align: right; font-weight: 900; font-size: 22px; border-bottom: 1px solid #334155;">₱${cleanAmount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #334155;">Payout Method</td>
            <td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-weight: bold; border-bottom: 1px solid #334155;">${methodLabel}</td>
          </tr>
          ${params.transactionRef ? `<tr><td style="padding: 8px 0; color: #64748b;">Reference No.</td><td style="padding: 8px 0; color: #f1f5f9; text-align: right; font-family: monospace;">${params.transactionRef}</td></tr>` : ""}
        </table>
      </div>
      <div style="margin: 24px 0;">
        <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0891b2, #0284c7); color: #ffffff; text-decoration: none; font-weight: 900; border-radius: 12px; font-size: 14px;">View Payout History</a>
      </div>
      <p style="font-size: 11px; color: #475569;">Allow 1–3 business days for the amount to fully reflect on your ${methodLabel} account. Contact us if you have not received it within 5 business days.</p>
    </div>
  `;

  if (!resend) {
    console.log(`[DEV MODE - PARTNER PAYOUT] Partner: ${params.partnerName}, Amount: ₱${cleanAmount}`);
    return;
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to: params.toEmail,
      subject: `💸 Your ₱${cleanAmount} commission payout has been sent — GovStudyX`,
      html,
    });
  } catch (err) {
    console.error("Failed to send partner payout email:", err);
  }
}
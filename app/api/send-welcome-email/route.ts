import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WelcomeEmailPayload {
  name: string;
  account: string;
  tempPassword: string;
  email: string;
  role?: string;
  specializations?: string[];
  specializationRoles?: Record<string, string>;
  cccd?: string;
  bankAccount?: string;
  phone?: string;
  technologies?: string;
  birthDate?: string | number;
  siteUrl?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Escape special HTML characters to prevent injection inside email templates.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format role & specialization assignments into a readable summary string.
 */
function formatRoleSummary(
  role?: string,
  specializations?: string[],
  specializationRoles?: Record<string, string>
): string {
  const specs = Array.isArray(specializations) ? specializations.filter(Boolean) : [];
  if (role === 'Admin') {
    return specs.length > 0 ? `Admin (Quản trị hệ thống) • ${specs.join(', ')}` : 'Admin (Quản trị hệ thống)';
  }
  if (specs.length > 0) {
    return specs
      .map((spec) => {
        const specRole = specializationRoles?.[spec] || role || 'Member';
        return `${spec} (${specRole})`;
      })
      .join(', ');
  }
  return role || 'Member';
}

/**
 * Build subject, HTML body, and plain-text body in a clean human-written format
 * to minimize spam filtering while keeping account & profile details easy to read.
 */
function buildWelcomeEmailContent(payload: WelcomeEmailPayload, appUrl: string, senderName: string) {
  const roleSummary = formatRoleSummary(payload.role, payload.specializations, payload.specializationRoles);
  const candidateRows: Array<{ label: string; value: string }> = [
    { label: 'Họ và tên', value: payload.name.trim() },
    { label: 'Email', value: payload.email.trim() },
    { label: 'Số điện thoại', value: (payload.phone || '').trim() },
    { label: 'Năm sinh', value: payload.birthDate ? String(payload.birthDate).trim() : '' },
    { label: 'Số CCCD', value: (payload.cccd || '').trim() },
    { label: 'TK ngân hàng', value: (payload.bankAccount || '').trim() },
    { label: 'Công nghệ / Kỹ năng', value: (payload.technologies || '').trim() },
  ];
  const profileRows = candidateRows.filter((row) => row.value !== '');

  const profileRowsHtml = profileRows
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;width:36%;vertical-align:top;">
            ${escapeHtml(label)}
          </td>
          <td style="padding:7px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;font-weight:600;vertical-align:top;">
            ${escapeHtml(value)}
          </td>
        </tr>`
    )
    .join('');

  const safeName = escapeHtml(payload.name.trim());
  const safeAccount = escapeHtml(payload.account.trim());
  const safeTempPass = escapeHtml(payload.tempPassword);
  const safeRoleSummary = escapeHtml(roleSummary);
  const safeAppUrl = escapeHtml(appUrl);
  const safeSenderName = escapeHtml(senderName);

  const subject = `Tài khoản làm việc Saho Task của ${payload.name.trim()} (${payload.account.trim()})`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;">
  <div style="max-width:580px;">
    <p style="margin:0 0 12px;">Chào ${safeName},</p>

    <p style="margin:0 0 14px;">
      Mình gửi bạn thông tin tài khoản vừa tạo trên hệ thống quản lý công việc <strong>Saho Task</strong> để bạn truy cập và nhận task cùng team:
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d1d5db;border-radius:8px;border-collapse:collapse;margin:0 0 18px;background-color:#fafafa;">
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;width:36%;">Trang truy cập</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;">
          <a href="${safeAppUrl}" style="color:#4f46e5;text-decoration:underline;">${safeAppUrl}</a>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;">Staff Code</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:700;font-family:Consolas,monospace;">
          ${safeAccount}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-size:13px;">Mật khẩu lần đầu</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:700;font-family:Consolas,monospace;">
          ${safeTempPass}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 12px;color:#4b5563;font-size:13px;">Vai trò &amp; Chuyên môn</td>
        <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:600;">
          ${safeRoleSummary}
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-weight:600;color:#111827;">Thông tin cá nhân đã ghi nhận để đối chiếu:</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;margin:0 0 18px;">
      ${profileRowsHtml}
    </table>

    <p style="margin:0 0 6px;font-weight:600;color:#111827;">Hướng dẫn kích hoạt nhanh:</p>
    <p style="margin:0 0 16px;">
      1. Bạn truy cập <a href="${safeAppUrl}" style="color:#4f46e5;">${safeAppUrl}</a> và đăng nhập bằng Staff Code cùng mật khẩu lần đầu ở trên.<br />
      2. Sau khi vào hệ thống, bạn đổi sang mật khẩu cá nhân của riêng mình.<br />
      3. Nếu thông tin nhân sự ở bảng trên có điểm nào cần chỉnh sửa, bạn cứ phản hồi (reply) lại email này cho mình nhé.
    </p>

    <p style="margin:0;color:#374151;">
      Trân trọng,<br />
      <strong>${safeSenderName}</strong>
    </p>
  </div>
</body>
</html>`.trim();

  const text = [
    `Chào ${payload.name.trim()},`,
    ``,
    `Mình gửi bạn thông tin tài khoản vừa tạo trên hệ thống quản lý công việc Saho Task để bạn truy cập và nhận task cùng team:`,
    `- Trang truy cập: ${appUrl}`,
    `- Staff Code: ${payload.account.trim()}`,
    `- Mật khẩu lần đầu: ${payload.tempPassword}`,
    `- Vai trò & Chuyên môn: ${roleSummary}`,
    ``,
    `Thông tin cá nhân đã ghi nhận để đối chiếu:`,
    ...profileRows.map((row) => `- ${row.label}: ${row.value}`),
    ``,
    `Hướng dẫn kích hoạt nhanh:`,
    `1. Bạn truy cập ${appUrl} và đăng nhập bằng Staff Code cùng mật khẩu lần đầu ở trên.`,
    `2. Sau khi vào hệ thống, bạn đổi sang mật khẩu cá nhân của riêng mình.`,
    `3. Nếu thông tin nhân sự trên có điểm nào cần chỉnh sửa, bạn cứ phản hồi (reply) lại email này cho mình nhé.`,
    ``,
    `Trân trọng,`,
    senderName,
  ].join('\n');

  return { subject, html, text };
}

/**
 * Create a reusable Nodemailer SMTP transporter from environment variables.
 */
function createMailTransporter(smtpUser: string, smtpPass: string) {
  const cleanPass = smtpPass.replace(/\s+/g, '');
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;

  if (smtpHost) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 465,
      secure: (smtpPort || 465) === 465,
      auth: {
        user: smtpUser,
        pass: cleanPass,
      },
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<WelcomeEmailPayload> | null;
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu gửi lên không hợp lệ.' },
        { status: 400 }
      );
    }

    const name = String(body.name || '').trim();
    const account = String(body.account || '').trim();
    const tempPassword = String(body.tempPassword || '').trim();
    const email = String(body.email || '').trim();

    if (!name || !account || !tempPassword) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin tài khoản hoặc mật khẩu tạm để gửi email.' },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Địa chỉ email thành viên không hợp lệ.' },
        { status: 400 }
      );
    }

    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        {
          success: false,
          code: 'SMTP_NOT_CONFIGURED',
          error: 'Chưa cấu hình mail gốc (SMTP_USER và SMTP_PASS) trong biến môi trường.',
        },
        { status: 503 }
      );
    }

    const appUrl =
      (body.siteUrl && String(body.siteUrl).trim()) ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://gmm-task.vercel.app';

    const rawSenderName = process.env.SMTP_FROM_NAME || 'Admin Saho Task';
    const senderName = rawSenderName.replace(/[\r\n"]/g, '').trim() || 'Admin Saho Task';

    const { subject, html, text } = buildWelcomeEmailContent(
      {
        name,
        account,
        tempPassword,
        email,
        role: body.role,
        specializations: body.specializations,
        specializationRoles: body.specializationRoles,
        cccd: body.cccd,
        bankAccount: body.bankAccount,
        phone: body.phone,
        technologies: body.technologies,
        birthDate: body.birthDate,
      },
      appUrl,
      senderName
    );

    const transporter = createMailTransporter(smtpUser, smtpPass);
    const info = await transporter.sendMail({
      from: `"${senderName}" <${smtpUser}>`,
      replyTo: smtpUser,
      to: email,
      subject,
      text,
      html,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (err: unknown) {
    console.error('[send-welcome-email Error]', err);
    const errCode = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
    const message =
      errCode === 'EAUTH'
        ? 'Xác thực Gmail gốc thất bại. Vui lòng kiểm tra lại SMTP_USER và App Password (SMTP_PASS).'
        : 'Không thể gửi email thông báo lúc này. Vui lòng kiểm tra cấu hình SMTP hoặc thử lại sau.';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

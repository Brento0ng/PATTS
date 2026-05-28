// Vercel Serverless Function — Email Sender via Gmail SMTP
// Vercel has no outbound port restrictions unlike Render free tier

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const secret = req.headers['x-patts-secret'];
  if (secret !== process.env.PATTS_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const {
    studentEmail, studentName, studentNumber,
    violationType, category, recordedBy,
    timestamp, description, course
  } = req.body;

  if (!studentEmail || !studentEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'Invalid email' });
  }

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_PASS;

  if (!GMAIL_USER || !GMAIL_PASS) {
    return res.status(500).json({ success: false, message: 'Email not configured' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  const categoryColor = category === 'Major' ? '#dc2626' : '#d97706';
  const categoryBg    = category === 'Major' ? '#fef2f2' : '#fffbeb';
  const dateStr = new Date(timestamp).toLocaleString('en-PH', {
    dateStyle: 'long', timeStyle: 'short'
  });

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f4f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f9;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
      <tr>
        <td style="background:#1e3a8a;padding:28px 32px;text-align:center;">
          <div style="color:white;font-size:20px;font-weight:700;">PATTS College of Aeronautics</div>
          <div style="color:rgba(255,255,255,0.70);font-size:13px;margin-top:4px;">Student Violation Notification</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <p style="font-size:15px;color:#374151;margin:0 0 6px 0;">Dear <strong>${studentName}</strong>,</p>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px 0;">A violation has been recorded against your student record.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-left:4px solid #1e3a8a;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;">Student Number</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${studentNumber}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Course</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${course || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Violation Type</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${violationType}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Category</td>
                  <td style="padding:6px 0;">
                    <span style="background:${categoryBg};color:${categoryColor};font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;display:inline-block;">${category}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Recorded By</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${recordedBy}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Date & Time</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${dateStr}</td>
                </tr>
                ${description ? `<tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;vertical-align:top;">Description</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${description}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;">
              <div style="font-size:13px;color:#92400e;"><strong>⚠ Status: Pending</strong> — Under review by school administration.</div>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0;">
            If you believe this was recorded in error, visit the Dean's Office within <strong>3 working days</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8faff;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
          <div style="font-size:12px;color:#9ca3af;">Automated message — PATTS Violation Monitoring System. Do not reply.</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"PATTS Violations" <${GMAIL_USER}>`,
      to:      studentEmail,
      subject: `[PATTS] Violation Notice — ${violationType} (${category})`,
      html
    });
    console.log(`📧 Email sent to ${studentEmail}`);
    return res.status(200).json({ success: true, message: `Email sent to ${studentEmail}` });
  } catch (err) {
    console.error(`❌ Email error:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

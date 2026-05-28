// Vercel Serverless Function — Email Sender
// This runs on Vercel's servers which have no outbound restrictions
// Called by your Render server whenever a violation is recorded

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Simple secret key check — prevents anyone else from using your email function
  const secret = req.headers['x-patts-secret'];
  if (secret !== process.env.PATTS_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { studentEmail, studentName, studentNumber, violationType, category, recordedBy, timestamp, description, course } = req.body;

  if (!studentEmail || !studentEmail.includes('@')) {
    return res.status(400).json({ success: false, message: 'Invalid email address' });
  }

  const MAILJET_API_KEY    = process.env.MAILJET_API_KEY;
  const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
  const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'brent.lawrence08@gmail.com';
  const EMAIL_FROM_NAME    = process.env.EMAIL_FROM_NAME    || 'PATTS Violations';

  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    return res.status(500).json({ success: false, message: 'Email service not configured' });
  }

  const categoryColor = category === 'Major' ? '#dc2626' : '#d97706';
  const categoryBg    = category === 'Major' ? '#fef2f2' : '#fffbeb';
  const dateStr = new Date(timestamp).toLocaleString('en-PH', {
    dateStyle: 'long', timeStyle: 'short'
  });

  const html = `
<!DOCTYPE html>
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
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px 0;">
            A violation has been recorded against your student record. Please review the details below.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-left:4px solid #1e3a8a;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Violation Details</div>
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
                    <span style="display:inline-block;background:${categoryBg};color:${categoryColor};font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;">${category}</span>
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
                ${description ? `
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;vertical-align:top;">Description</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${description}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:14px 20px;">
              <div style="font-size:13px;color:#92400e;">
                <strong>⚠ Current Status:</strong> Pending — This violation is under review by school administration.
              </div>
            </td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0 0 8px 0;">
            If you believe this violation was recorded in error, please visit the Dean's Office or contact your class adviser within <strong>3 working days</strong>.
          </p>
          <p style="font-size:13px;color:#6b7280;line-height:1.7;margin:0;">
            Please note that accumulation of violations may affect your academic standing and enrollment eligibility.
          </p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8faff;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
          <div style="font-size:12px;color:#9ca3af;">This is an automated message from the PATTS Violation Monitoring System.</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:4px;">PATTS College of Aeronautics — Do not reply to this email.</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    const credentials = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        Messages: [{
          From: { Email: EMAIL_FROM_ADDRESS, Name: EMAIL_FROM_NAME },
          To:   [{ Email: studentEmail, Name: studentName }],
          Subject: `[PATTS] Violation Notice — ${violationType} (${category})`,
          HTMLPart: html
        }]
      })
    });

    const result = await response.json();
    if (response.ok) {
      console.log(`📧 Email sent to ${studentEmail}`);
      return res.status(200).json({ success: true, message: `Email sent to ${studentEmail}` });
    } else {
      console.error(`❌ Mailjet error:`, JSON.stringify(result));
      return res.status(500).json({ success: false, message: JSON.stringify(result) });
    }
  } catch (err) {
    console.error(`❌ Email error:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

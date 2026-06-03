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

  // ── Violation → Handbook mapping ──
  const violationMap = {
    'Improper Uniform':       { code: 'MINOR 3', desc: 'Not adhering to the Dress and Grooming Guidelines for students' },
    'Haircut/Haircolor':      { code: 'MINOR 3', desc: 'Not adhering to the Dress and Grooming Guidelines for students' },
    'Improper ID':            { code: 'MINOR 2', desc: 'Not wearing the school ID properly or failure to present ID' },
    'No ID Presented':        { code: 'MINOR 2', desc: 'Failure to present valid school ID when required' },
    'Tardiness':              { code: 'MINOR 1', desc: 'Tardiness or unauthorized late arrival to class or school premises' },
    'Unauthorized Phone Use': { code: 'MINOR 4', desc: 'Use of mobile phone or electronic devices without permission' },
    'Prohibited Item':        { code: 'MAJOR 1', desc: 'Possession of prohibited items within school premises' },
    'Unauthorized Absence':   { code: 'MAJOR 2', desc: 'Unauthorized absence from class or school activity' },
    'Disruptive Behavior':    { code: 'MAJOR 3', desc: 'Disruptive or disorderly conduct within school premises' },
    'Academic Dishonesty':    { code: 'MAJOR 4', desc: 'Academic dishonesty including cheating, plagiarism, or falsification' },
    'Vandalism':              { code: 'MAJOR 5', desc: 'Vandalism or destruction of school property' },
  };

  const vInfo = violationMap[violationType] || {
    code: category === 'Major' ? 'MAJOR' : 'MINOR',
    desc: violationType
  };

  // Last name only for "Dear Mx. [LastName]"
  const lastName = studentName ? studentName.trim().split(' ').pop() : 'Student';

  // Date format: 12/3/2025 10:28:04
  const d = new Date(timestamp);
  const formattedDate = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;font-size:15px;color:#000000;line-height:1.7;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

  <p style="margin:0 0 20px 0;"><strong>Dear Mx. ${lastName},</strong></p>

  <p style="margin:0 0 16px 0;">
    The Discipline Formation Office received a report regarding your <strong>possible noncompliance</strong>
    with our <a href="https://patts.edu.ph/student-handbook" style="color:#1155cc;">Student Handbook</a>, particularly on:
  </p>

  <ul style="margin:0 0 20px 0;padding-left:24px;">
    <li style="margin-bottom:6px;"><strong>${vInfo.code}. ${vInfo.desc};</strong></li>
    <li>${formattedDate}</li>
  </ul>

  <p style="margin:0 0 16px 0;">
    <strong>To help us understand and address this matter appropriately, please reply to the
    following questions. The use of AI is strictly prohibited and, if detected, will be treated as a
    major offense.</strong>
  </p>

  <ol style="margin:0 0 20px 0;padding-left:24px;">
    <li style="margin-bottom:8px;">What specific noncompliance occurred?</li>
    <li style="margin-bottom:8px;">What factors influenced your noncompliance?</li>
    <li style="margin-bottom:8px;">How do you think your actions affect others and the learning environment?</li>
  </ol>

  <p style="margin:0 0 16px 0;">
    Please take the time to carefully consider your responses and provide thoughtful and detailed
    answers to each question as this will be required to determine your formation based on the new
    <a href="https://patts.edu.ph/code-of-conduct" style="color:#1155cc;font-weight:700;">Student Code of Conduct and Discipline</a>:
  </p>

  <!-- Offense tier table -->
  <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="border:1px solid #000000;padding:6px 14px;font-size:12px;font-weight:700;background:#000000;color:#ffffff;">OFFENSES</td>
      <td style="border:1px solid #000000;padding:6px 14px;font-size:12px;font-weight:700;background:#000000;color:#ffffff;">FIRST</td>
      <td style="border:1px solid #000000;padding:6px 14px;font-size:12px;font-weight:700;background:#000000;color:#ffffff;">SECOND</td>
      <td style="border:1px solid #000000;padding:6px 14px;font-size:12px;font-weight:700;background:#000000;color:#ffffff;">THIRD</td>
      <td style="border:1px solid #000000;padding:6px 14px;font-size:12px;font-weight:700;background:#000000;color:#ffffff;">MORE</td>
    </tr>
    <tr>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;font-weight:600;">Minor</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Verbal Warning</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Written Warning</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Community Service</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Suspension</td>
    </tr>
    <tr>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;font-weight:600;">Major</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Suspension</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Exclusion</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Dismissal</td>
      <td style="border:1px solid #cccccc;padding:6px 14px;font-size:12px;">Expulsion</td>
    </tr>
  </table>

  <p style="margin:0;font-size:13px;color:#555555;">
    This is an automated notification from the PATTS Violation Monitoring System.
    Please reply directly to this email with your responses.
  </p>

</div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"Discipline Formation Office" <${GMAIL_USER}>`,
      to:      studentEmail,
      subject: `Discipline Report — ${formattedDate}`,
      html
    });
    console.log(`📧 Email sent to ${studentEmail}`);
    return res.status(200).json({ success: true, message: `Email sent to ${studentEmail}` });
  } catch (err) {
    console.error(`❌ Email error:`, err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

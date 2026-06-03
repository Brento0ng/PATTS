const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
// Email via Mailjet REST API (no extra package needed — uses built-in fetch)

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pattsadmin:pattsadmin123@patts.fkwf4kz.mongodb.net/pattsdb?appName=PATTS';

// ─────────────────────────────────────────────────────────────
//  EMAIL CONFIGURATION
//  Uses Gmail SMTP via Nodemailer
//  Set these in your Render environment variables:
//    EMAIL_USER = your Gmail address (e.g. patts.violations@gmail.com)
//    EMAIL_PASS = your Gmail App Password (not your regular password)
//  To get App Password: Google Account → Security → 2FA → App Passwords
// ─────────────────────────────────────────────────────────────
// Email is sent via Vercel serverless function — no outbound restrictions
const VERCEL_EMAIL_URL = process.env.VERCEL_EMAIL_URL || '';
const PATTS_SECRET     = process.env.PATTS_SECRET     || '';

if (VERCEL_EMAIL_URL) {
  console.log('✅ Email service ready via Vercel:', VERCEL_EMAIL_URL);
} else {
  console.warn('⚠️  VERCEL_EMAIL_URL not set — email notifications disabled');
}

// ─────────────────────────────────────────────────────────────
//  SEND VIOLATION EMAIL
// ─────────────────────────────────────────────────────────────
async function sendViolationEmail(student, violation) {
  if (!VERCEL_EMAIL_URL) {
    console.log('📧 Email skipped — no Vercel email URL set');
    return;
  }
  if (!student.email || !student.email.includes('@')) {
    console.log(`📧 Email skipped — no valid email for ${student.studentNumber}`);
    return;
  }

  const categoryColor = violation.category === 'Major' ? '#dc2626' : '#d97706';
  const categoryBg    = violation.category === 'Major' ? '#fef2f2' : '#fffbeb';
  const dateStr = new Date(violation.timestamp).toLocaleString('en-PH', {
    dateStyle: 'long', timeStyle: 'short'
  });


  // Map violation type to handbook category description
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
  const vInfo = violationMap[violation.violationType] || {
    code: violation.category === 'Major' ? 'MAJOR' : 'MINOR',
    desc: violation.violationType
  };
  const lastName = student.name ? student.name.split(' ').pop() : 'Student';
  const formattedDate = new Date(violation.timestamp).toLocaleString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:#1e3a8a;padding:24px 32px;text-align:center;">
          <div style="color:white;font-size:18px;font-weight:700;">PATTS College of Aeronautics</div>
          <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Discipline Formation Office</div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;color:#222222;font-size:14px;line-height:1.8;">

          <p style="margin:0 0 18px 0;"><strong>Dear Mx. \${lastName},</strong></p>

          <p style="margin:0 0 18px 0;">
            The Discipline Formation Office received a report regarding your <strong>possible noncompliance</strong>
            with our <a href="https://patts.edu.ph/student-handbook" style="color:#1e3a8a;">Student Handbook</a>, particularly on:
          </p>

          <ul style="margin:0 0 20px 0;padding-left:20px;">
            <li style="margin-bottom:6px;"><strong>\${vInfo.code}. \${vInfo.desc};</strong></li>
            <li style="color:#555555;">\${formattedDate}</li>
          </ul>

          <p style="margin:0 0 18px 0;">
            <strong>To help us understand and address this matter appropriately, please reply to the
            following questions. The use of AI is strictly prohibited and, if detected, will be treated
            as a major offense.</strong>
          </p>

          <ol style="margin:0 0 24px 0;padding-left:20px;line-height:2;">
            <li>What specific noncompliance occurred?</li>
            <li>What factors influenced your noncompliance?</li>
            <li>How do you think your actions affect others and the learning environment?</li>
          </ol>

          <p style="margin:0 0 10px 0;">
            Please take the time to carefully consider your responses and provide thoughtful and detailed
            answers to each question as this will be required to determine your formation based on the new
            <a href="https://patts.edu.ph/code-of-conduct" style="color:#1e3a8a;font-weight:700;">Student Code of Conduct and Discipline</a>:
          </p>

          <!-- Offense tier table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 28px 0;border-collapse:collapse;">
            <tr>
              <td style="background:#1e3a8a;color:white;font-size:11px;font-weight:700;padding:8px 12px;text-align:center;border:1px solid #1e3a8a;">OFFENSES</td>
              <td style="background:#1e3a8a;color:white;font-size:11px;font-weight:700;padding:8px 12px;text-align:center;border:1px solid #1e3a8a;">FIRST</td>
              <td style="background:#1e3a8a;color:white;font-size:11px;font-weight:700;padding:8px 12px;text-align:center;border:1px solid #1e3a8a;">SECOND</td>
              <td style="background:#1e3a8a;color:white;font-size:11px;font-weight:700;padding:8px 12px;text-align:center;border:1px solid #1e3a8a;">THIRD</td>
              <td style="background:#1e3a8a;color:white;font-size:11px;font-weight:700;padding:8px 12px;text-align:center;border:1px solid #1e3a8a;">MORE</td>
            </tr>
            <tr>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">Minor</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Verbal Warning</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Written Warning</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Community Service</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Suspension</td>
            </tr>
            <tr>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;">Major</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Suspension</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Exclusion</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Dismissal</td>
              <td style="font-size:12px;padding:8px 12px;border:1px solid #e5e7eb;text-align:center;color:#555;">Expulsion</td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;color:#555555;">
            This is an automated notification from the PATTS Violation Monitoring System. Please reply directly to this email with your responses.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8f8f8;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
          <div style="font-size:11px;color:#999999;">PATTS College of Aeronautics — Discipline Formation Office</div>
          <div style="font-size:11px;color:#999999;margin-top:2px;">This is an automated message from the PATTS Violation Monitoring System.</div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    // Call Vercel serverless function to send email
    // Vercel has no outbound restrictions unlike Render free tier
    const response = await fetch(VERCEL_EMAIL_URL, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-patts-secret':  PATTS_SECRET
      },
      body: JSON.stringify({
        studentEmail:   student.email,
        studentName:    student.name,
        studentNumber:  student.studentNumber,
        violationType:  violation.violationType,
        category:       violation.category,
        recordedBy:     violation.recordedBy,
        timestamp:      violation.timestamp,
        description:    violation.description,
        course:         student.course
      })
    });
    const result = await response.json();
    if (result.success) {
      console.log(`📧 Email sent to ${student.email} for ${student.studentNumber}`);
    } else {
      console.error(`❌ Email failed for ${student.email}:`, result.message);
    }
  } catch (err) {
    console.error(`❌ Email failed for ${student.email}:`, err.message);
    // Don't throw — email failure should never block violation recording
  }
}

// ─────────────────────────────────────────────────────────────
//  CONNECT TO MONGODB
// ─────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ─────────────────────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─────────────────────────────────────────────────────────────
//  SCHEMAS & MODELS
// ─────────────────────────────────────────────────────────────
const studentSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true, unique: true },
  name:          { type: String, default: 'Unknown' },
  faceId:        { type: String, required: true },
  section:       { type: String, default: 'N/A' },
  course:        { type: String, default: 'N/A' },
  year:          { type: String, default: 'N/A' },
  email:         { type: String, default: '' },
  contact:       { type: String, default: '' },
  registeredAt:  { type: Date, default: Date.now }
});

const violationSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true },
  studentName:   { type: String, default: 'Unknown' },
  section:       { type: String, default: 'N/A' },
  course:        { type: String, default: 'N/A' },
  faceId:        { type: String, required: true },
  violationType: { type: String, default: 'General Violation' },
  category:      { type: String, enum: ['Minor', 'Major'], default: 'Minor' },
  description:   { type: String, default: '' },
  recordedBy:    { type: String, default: 'ESP32 Device' },
  status:        { type: String, default: 'Pending' },
  emailSent:     { type: Boolean, default: false },   // tracks if email was sent
  timestamp:     { type: Date, default: Date.now }
});

const enrollmentSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true },
  studentName:   { type: String, default: 'Unknown' },
  faceId:        { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'enrolled', 'cancelled'],
    default: 'pending'
  },
  paid:          { type: Boolean, default: false },
  requestedAt:   { type: Date, default: Date.now },
  paidAt:        { type: Date, default: null },
  enrolledAt:    { type: Date, default: null },
  cancelledAt:   { type: Date, default: null }
});

const Student    = mongoose.model('Student',    studentSchema);
const Violation  = mongoose.model('Violation',  violationSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ─────────────────────────────────────────────────────────────
//  AUTO CATEGORY
// ─────────────────────────────────────────────────────────────
function getCategory(violationType) {
  const minor = ['Improper Uniform', 'Haircut/Haircolor', 'Tardiness', 'Unauthorized Phone Use'];
  const major = ['Prohibited Item', 'Unauthorized Absence', 'Disruptive Behavior', 'Academic Dishonesty', 'Vandalism'];
  if (minor.includes(violationType)) return 'Minor';
  if (major.includes(violationType)) return 'Major';
  return 'Minor';
}

// ─────────────────────────────────────────────────────────────
//  STUDENT ROUTES
// ─────────────────────────────────────────────────────────────
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ registeredAt: -1 });
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/students/:studentNumber/violations', async (req, res) => {
  try {
    const total      = await Violation.countDocuments({ studentNumber: req.params.studentNumber });
    const unresolved = await Violation.countDocuments({ studentNumber: req.params.studentNumber, status: { $ne: 'Resolved' } });
    res.json({ success: true, total, unresolvedCount: unresolved, canEnroll: unresolved === 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/students/:studentNumber', async (req, res) => {
  try {
    const student = await Student.findOne({ studentNumber: req.params.studentNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { studentNumber, name, faceId, section, course, year, email, contact } = req.body;
  if (!studentNumber || !faceId)
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  if (!email || !email.includes('@'))
    return res.status(400).json({ success: false, message: 'A valid email address is required for violation notifications' });
  try {
    const existing = await Student.findOne({ studentNumber });
    if (existing) return res.status(409).json({ success: false, message: 'Student already registered' });
    const newStudent = new Student({ studentNumber, name: name||'Unknown', faceId, section: section||'N/A', course: course||'N/A', year: year||'N/A', email: email||'', contact: contact||'' });
    await newStudent.save();
    console.log(`✅ Registered: ${studentNumber} - ${name}`);
    res.json({ success: true, message: 'Student registered successfully', data: newStudent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  VIOLATION ROUTES
// ─────────────────────────────────────────────────────────────

// POST No-ID violation — student refused to show ID
// Records without student lookup or face verification
// studentNumber = "NOID-[millis]", faceId = "0"
app.post('/api/violation/noid', async (req, res) => {
  const { studentNumber, faceId, violationType, description, recordedBy } = req.body;
  try {
    const newViolation = new Violation({
      studentNumber: studentNumber || 'UNKNOWN',
      studentName:   'Unknown — No ID Presented',
      section:       'N/A',
      course:        'N/A',
      faceId:        faceId || '0',
      violationType: violationType || 'No ID Presented',
      category:      getCategory(violationType),
      description:   description  || 'Student did not present valid ID',
      recordedBy:    recordedBy   || 'PATTS Guard System',
      status:        'Pending',
      emailSent:     false,
      timestamp:     new Date()
    });
    await newViolation.save();
    console.log(`🚨 No-ID Violation: ${studentNumber} | ${violationType}`);
    res.json({ success: true, message: 'No-ID violation recorded', data: newViolation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/violations', async (req, res) => {
  try {
    const violations = await Violation.find().sort({ timestamp: -1 });
    res.json({ success: true, data: violations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST violation — auto-sends email to student
app.post('/api/violation', async (req, res) => {
  const { studentNumber, faceId, violationType, description, recordedBy, status, timestamp } = req.body;
  if (!studentNumber || !faceId)
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  try {
    const student = await Student.findOne({ studentNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found. Please register first.' });
    if (student.faceId !== faceId) return res.status(403).json({ success: false, message: 'Face verification failed. Identity mismatch.' });

    const newViolation = new Violation({
      studentNumber,
      studentName:   student.name,
      section:       student.section,
      course:        student.course,
      faceId,
      violationType: violationType || 'General Violation',
      category:      getCategory(violationType),
      description:   description  || '',
      recordedBy:    recordedBy   || 'ESP32 Device',
      status:        status       || 'Pending',
      emailSent:     false,
      timestamp:     timestamp ? new Date(timestamp) : new Date()
    });

    await newViolation.save();
    console.log(`🚨 Violation: ${studentNumber} - ${student.name} | ${newViolation.category}`);

    // ── AUTO EMAIL — fire and forget (non-blocking) ──
    sendViolationEmail(student, newViolation).then(async () => {
      if (student.email && student.email.includes('@')) {
        await Violation.findByIdAndUpdate(newViolation._id, { emailSent: true });
      }
    });

    res.json({ success: true, message: 'Violation recorded successfully', data: newViolation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH resend email for a violation (admin manual resend)
app.patch('/api/violations/:id/resend-email', async (req, res) => {
  try {
    const violation = await Violation.findById(req.params.id);
    if (!violation) return res.status(404).json({ success: false, message: 'Violation not found' });
    const student = await Student.findOne({ studentNumber: violation.studentNumber });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!student.email || !student.email.includes('@'))
      return res.status(400).json({ success: false, message: 'Student has no email address on file' });
    await sendViolationEmail(student, violation);
    await Violation.findByIdAndUpdate(violation._id, { emailSent: true });
    res.json({ success: true, message: `Email resent to ${student.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/violations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Violation.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Violation not found' });
    res.json({ success: true, message: 'Status updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/violations/:id', async (req, res) => {
  try {
    await Violation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Violation deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  VERIFY ROUTE
// ─────────────────────────────────────────────────────────────
app.post('/api/verify', async (req, res) => {
  const { studentNumber, faceId } = req.body;
  try {
    const student = await Student.findOne({ studentNumber });
    if (!student) return res.status(404).json({ success: false, verified: false, message: 'Student not registered' });
    if (student.faceId !== faceId) return res.status(403).json({ success: false, verified: false, message: 'Face does not match' });
    res.json({ success: true, verified: true, message: 'Identity verified', data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const totalStudents   = await Student.countDocuments();
    const totalViolations = await Violation.countDocuments();
    const todayViolations = await Violation.countDocuments({ timestamp: { $gte: today } });
    res.json({ success: true, data: { totalStudents, totalViolations, todayViolations } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  ENROLLMENT ROUTES
// ─────────────────────────────────────────────────────────────
app.get('/api/enrollment/all', async (req, res) => {
  try {
    const enrollments = await Enrollment.find().sort({ requestedAt: -1 });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/enrollment/request', async (req, res) => {
  const { studentNumber, faceId, studentName } = req.body;
  if (!studentNumber || !faceId)
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  try {
    const student = await Student.findOne({ studentNumber });
    const resolvedName = studentName || (student ? student.name : 'Unknown');
    const existing = await Enrollment.findOne({ studentNumber, status: { $in: ['pending', 'paid'] } });
    if (existing) return res.json({ success: true, message: 'Enrollment already pending', data: existing });
    const newEnrollment = new Enrollment({ studentNumber, studentName: resolvedName, faceId, status: 'pending', paid: false, requestedAt: new Date() });
    await newEnrollment.save();
    console.log(`🎓 Enrollment requested: ${studentNumber}`);
    res.json({ success: true, message: 'Enrollment request received.', data: newEnrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/enrollment/payment-status/:studentNumber', async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ studentNumber: req.params.studentNumber, status: { $in: ['pending', 'paid'] } }).sort({ requestedAt: -1 });
    if (!enrollment) return res.status(404).json({ success: false, paid: false, message: 'No pending enrollment found' });
    res.json({ success: true, paid: enrollment.paid, status: enrollment.status });
  } catch (err) {
    res.status(500).json({ success: false, paid: false, message: err.message });
  }
});

app.patch('/api/enrollment/mark-paid/:id', async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    if (enrollment.status === 'enrolled')   return res.status(400).json({ success: false, message: 'Already enrolled' });
    if (enrollment.status === 'cancelled')  return res.status(400).json({ success: false, message: 'Enrollment was cancelled' });
    const unresolvedCount = await Violation.countDocuments({ studentNumber: enrollment.studentNumber, status: { $ne: 'Resolved' } });
    if (unresolvedCount > 0) return res.status(400).json({ success: false, message: `Cannot process payment. Student has ${unresolvedCount} unresolved violation(s).` });
    enrollment.paid = true; enrollment.status = 'paid'; enrollment.paidAt = new Date();
    await enrollment.save();
    console.log(`💳 Payment confirmed: ${enrollment.studentNumber}`);
    res.json({ success: true, message: 'Payment confirmed.', data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/enrollment/confirm', async (req, res) => {
  const { studentNumber, faceId } = req.body;
  if (!studentNumber || !faceId) return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  try {
    const enrollment = await Enrollment.findOne({ studentNumber, status: 'paid' }).sort({ requestedAt: -1 });
    if (!enrollment) return res.status(404).json({ success: false, message: 'No paid enrollment found' });
    if (enrollment.faceId !== faceId) return res.status(403).json({ success: false, message: 'Face ID mismatch' });
    enrollment.status = 'enrolled'; enrollment.enrolledAt = new Date();
    await enrollment.save();
    console.log(`✅ ENROLLED: ${studentNumber}`);
    res.json({ success: true, message: 'Student successfully enrolled!', data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/enrollment/:id', async (req, res) => {
  try {
    const deleted = await Enrollment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.json({ success: true, message: 'Enrollment record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.patch('/api/enrollment/cancel/:id', async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    if (enrollment.status === 'enrolled') return res.status(400).json({ success: false, message: 'Cannot cancel a completed enrollment' });
    enrollment.status = 'cancelled'; enrollment.paid = false; enrollment.cancelledAt = new Date();
    await enrollment.save();
    res.json({ success: true, message: 'Enrollment cancelled', data: enrollment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  SERVE FRONTEND
// ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ─────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📧 Auto-email on violation: ${VERCEL_EMAIL_URL ? 'ENABLED via Vercel' : 'DISABLED (set VERCEL_EMAIL_URL)'}`);
});

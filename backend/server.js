const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
// Email via Resend REST API (no extra package needed — uses built-in fetch)

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
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM    = process.env.EMAIL_FROM    || 'PATTS Violations <onboarding@resend.dev>';

if (RESEND_API_KEY) {
  console.log('✅ Email service ready via Resend API');
} else {
  console.warn('⚠️  RESEND_API_KEY not set — email notifications disabled');
}

// ─────────────────────────────────────────────────────────────
//  SEND VIOLATION EMAIL
// ─────────────────────────────────────────────────────────────
async function sendViolationEmail(student, violation) {
  if (!RESEND_API_KEY) {
    console.log('📧 Email skipped — no Resend API key');
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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f4f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f9;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

      <!-- Header -->
      <tr>
        <td style="background:#1e3a8a;padding:28px 32px;text-align:center;">
          <div style="color:white;font-size:20px;font-weight:700;letter-spacing:0.5px;">PATTS College of Aeronautics</div>
          <div style="color:rgba(255,255,255,0.70);font-size:13px;margin-top:4px;">Student Violation Notification</div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px;">

          <p style="font-size:15px;color:#374151;margin:0 0 6px 0;">Dear <strong>${student.name}</strong>,</p>
          <p style="font-size:14px;color:#6b7280;margin:0 0 24px 0;">
            A violation has been recorded against your student record. Please review the details below.
          </p>

          <!-- Violation details box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #dbeafe;border-left:4px solid #1e3a8a;border-radius:8px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Violation Details</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;width:140px;">Student Number</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${student.studentNumber}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Course</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${student.course || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Violation Type</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${violation.violationType}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Category</td>
                  <td style="padding:6px 0;">
                    <span style="display:inline-block;background:${categoryBg};color:${categoryColor};font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;">${violation.category}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Recorded By</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${violation.recordedBy}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;">Date & Time</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${dateStr}</td>
                </tr>
                ${violation.description ? `
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#6b7280;vertical-align:top;">Description</td>
                  <td style="padding:6px 0;font-size:13px;color:#111827;">${violation.description}</td>
                </tr>` : ''}
              </table>
            </td></tr>
          </table>

          <!-- Status -->
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

      <!-- Footer -->
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
    const response = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        from:    EMAIL_FROM,
        to:      [student.email],
        subject: `[PATTS] Violation Notice — ${violation.violationType} (${violation.category})`,
        html
      })
    });
    const result = await response.json();
    if (response.ok) {
      console.log(`📧 Email sent to ${student.email} for ${student.studentNumber}`);
    } else {
      console.error(`❌ Email failed for ${student.email}:`, result.message || JSON.stringify(result));
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
  console.log(`📧 Auto-email on violation: ${RESEND_API_KEY ? 'ENABLED via Resend API' : 'DISABLED (set RESEND_API_KEY)'}`);
});

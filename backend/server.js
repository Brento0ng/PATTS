const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pattsadmin:pattsadmin123@patts.fkwf4kz.mongodb.net/pattsdb?appName=PATTS';

// ─────────────────────────────────────────────────────────────
//  CONNECT TO MONGODB
// ─────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas! Data is now persistent.'))
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
  timestamp:     { type: Date, default: Date.now }
});

// ─────────────────────────────────────────────────────────────
//  ENROLLMENT SCHEMA
//  status flow: pending → paid → enrolled
//               pending → cancelled
// ─────────────────────────────────────────────────────────────
const enrollmentSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true },
  studentName:   { type: String, default: 'Unknown' },
  faceId:        { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'paid', 'enrolled', 'cancelled'],
    default: 'pending'
  },
  paid:          { type: Boolean, default: false },  // ESP32 polls this field
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

// GET all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ registeredAt: -1 });
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single student by studentNumber (used by ESP32 keypad mode)
app.get('/api/students/:studentNumber', async (req, res) => {
  try {
    const student = await Student.findOne({ studentNumber: req.params.studentNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST register student (called by ESP32 or manual)
app.post('/api/register', async (req, res) => {
  const { studentNumber, name, faceId, section, course, year, email, contact } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  try {
    const existing = await Student.findOne({ studentNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Student already registered' });
    }

    const newStudent = new Student({
      studentNumber,
      name:    name    || 'Unknown',
      faceId,
      section: section || 'N/A',
      course:  course  || 'N/A',
      year:    year    || 'N/A',
      email:   email   || '',
      contact: contact || ''
    });

    await newStudent.save();
    console.log(`✅ Registered: ${studentNumber} - ${name}`);
    res.json({ success: true, message: 'Student registered successfully', data: newStudent });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE student
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

// GET all violations
app.get('/api/violations', async (req, res) => {
  try {
    const violations = await Violation.find().sort({ timestamp: -1 });
    res.json({ success: true, data: violations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST record violation (called by ESP32 or manual)
app.post('/api/violation', async (req, res) => {
  const { studentNumber, faceId, violationType, description, recordedBy, status, timestamp } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  try {
    const student = await Student.findOne({ studentNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found. Please register first.' });
    }

    if (student.faceId !== faceId) {
      return res.status(403).json({ success: false, message: 'Face verification failed. Identity mismatch.' });
    }

    const newViolation = new Violation({
      studentNumber,
      studentName:   student.name,
      section:       student.section,
      course:        student.course,
      faceId,
      violationType: violationType || 'General Violation',
      category:      getCategory(violationType),
      description:   description   || '',
      recordedBy:    recordedBy    || 'ESP32 Device',
      status:        status        || 'Pending',
      timestamp:     timestamp ? new Date(timestamp) : new Date()
    });

    await newViolation.save();
    console.log(`🚨 Violation: ${studentNumber} - ${student.name} | ${newViolation.category}`);
    res.json({ success: true, message: 'Violation recorded successfully', data: newViolation });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH update violation status
app.patch('/api/violations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Violation.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Violation not found' });
    res.json({ success: true, message: 'Status updated successfully', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE violation
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

// GET all enrollments (website admin page)
app.get('/api/enrollment/all', async (req, res) => {
  try {
    const enrollments = await Enrollment.find().sort({ requestedAt: -1 });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST enrollment request (called by ESP32 after face verified)
// Creates a new enrollment record with status = 'pending'
app.post('/api/enrollment/request', async (req, res) => {
  const { studentNumber, faceId, studentName } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  try {
    // Check if student exists
    const student = await Student.findOne({ studentNumber });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found. Register first.' });
    }

    // Check if there's already a pending enrollment for this student
    const existing = await Enrollment.findOne({
      studentNumber,
      status: { $in: ['pending', 'paid'] }
    });
    if (existing) {
      // Return the existing one so ESP32 can poll its payment status
      console.log(`⚠️  Enrollment already pending for: ${studentNumber}`);
      return res.json({ success: true, message: 'Enrollment already pending', data: existing });
    }

    const newEnrollment = new Enrollment({
      studentNumber,
      studentName: studentName || student.name || 'Unknown',
      faceId,
      status:      'pending',
      paid:        false,
      requestedAt: new Date()
    });

    await newEnrollment.save();
    console.log(`🎓 Enrollment requested: ${studentNumber} - ${newEnrollment.studentName}`);
    res.json({ success: true, message: 'Enrollment request received. Awaiting payment.', data: newEnrollment });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET payment status (polled by ESP32 every 3 seconds)
// Returns { success, paid } so ESP32 knows when admin has confirmed payment
app.get('/api/enrollment/payment-status/:studentNumber', async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({
      studentNumber: req.params.studentNumber,
      status: { $in: ['pending', 'paid'] }
    }).sort({ requestedAt: -1 });

    if (!enrollment) {
      return res.status(404).json({ success: false, paid: false, message: 'No pending enrollment found' });
    }

    console.log(`📡 ESP32 polled payment status: ${req.params.studentNumber} → paid=${enrollment.paid}`);
    res.json({ success: true, paid: enrollment.paid, status: enrollment.status });

  } catch (err) {
    res.status(500).json({ success: false, paid: false, message: err.message });
  }
});

// PATCH mark as paid (called by website admin clicking "Mark as Paid")
// Sets paid=true and status='paid' so ESP32 poll detects it
app.patch('/api/enrollment/mark-paid/:id', async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    if (enrollment.status === 'enrolled') {
      return res.status(400).json({ success: false, message: 'Already enrolled' });
    }
    if (enrollment.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Enrollment was cancelled' });
    }

    enrollment.paid   = true;
    enrollment.status = 'paid';
    enrollment.paidAt = new Date();
    await enrollment.save();

    console.log(`💳 Payment confirmed by admin: ${enrollment.studentNumber}`);
    res.json({ success: true, message: 'Payment confirmed. ESP32 will complete enrollment.', data: enrollment });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST enrollment confirm (called by ESP32 after detecting paid=true)
// Finalizes the enrollment — sets status='enrolled'
app.post('/api/enrollment/confirm', async (req, res) => {
  const { studentNumber, faceId } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  try {
    const enrollment = await Enrollment.findOne({
      studentNumber,
      status: 'paid'
    }).sort({ requestedAt: -1 });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'No paid enrollment found for this student' });
    }

    // Verify face ID matches
    if (enrollment.faceId !== faceId) {
      return res.status(403).json({ success: false, message: 'Face ID mismatch during enrollment confirm' });
    }

    enrollment.status     = 'enrolled';
    enrollment.enrolledAt = new Date();
    await enrollment.save();

    console.log(`✅ ENROLLED: ${studentNumber} - ${enrollment.studentName}`);
    res.json({ success: true, message: 'Student successfully enrolled!', data: enrollment });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH cancel enrollment (called by website admin)
app.patch('/api/enrollment/cancel/:id', async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    if (enrollment.status === 'enrolled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed enrollment' });
    }

    enrollment.status      = 'cancelled';
    enrollment.paid        = false;
    enrollment.cancelledAt = new Date();
    await enrollment.save();

    console.log(`❌ Enrollment cancelled: ${enrollment.studentNumber}`);
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
  console.log(`📡 ESP32 can connect to: https://patts.onrender.com`);
  console.log(`\nAvailable API endpoints:`);
  console.log(`  POST   /api/register                        - Register student`);
  console.log(`  POST   /api/violation                       - Record violation`);
  console.log(`  POST   /api/verify                          - Verify identity`);
  console.log(`  GET    /api/students                        - Get all students`);
  console.log(`  GET    /api/students/:studentNumber         - Get single student`);
  console.log(`  GET    /api/violations                      - Get all violations`);
  console.log(`  GET    /api/stats                           - Dashboard stats`);
  console.log(`  PATCH  /api/violations/:id/status           - Update violation status`);
  console.log(`  DELETE /api/students/:id                    - Delete student`);
  console.log(`  DELETE /api/violations/:id                  - Delete violation`);
  console.log(`  --- ENROLLMENT ---`);
  console.log(`  GET    /api/enrollment/all                  - Get all enrollments`);
  console.log(`  POST   /api/enrollment/request              - ESP32: request enrollment`);
  console.log(`  GET    /api/enrollment/payment-status/:sn   - ESP32: poll payment`);
  console.log(`  PATCH  /api/enrollment/mark-paid/:id        - Admin: confirm payment`);
  console.log(`  POST   /api/enrollment/confirm              - ESP32: confirm enrollment`);
  console.log(`  PATCH  /api/enrollment/cancel/:id           - Admin: cancel enrollment\n`);
});

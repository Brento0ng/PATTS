const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Simple JSON file database (no need for MySQL for beginners)
const DB_PATH = path.join(__dirname, 'database.json');

// Initialize database if not exists
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ students: [], violations: [] }, null, 2));
  }
}

function readDB() {
  initDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ==================== STUDENT ROUTES ====================

// GET all students
app.get('/api/students', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.students });
});

// POST register student (called by ESP32 after barcode + face scan)
app.post('/api/register', (req, res) => {
  const { studentNumber, name, faceId, section, course } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  const db = readDB();

  // Check if already registered
  const existing = db.students.find(s => s.studentNumber === studentNumber);
  if (existing) {
    return res.status(409).json({ success: false, message: 'Student already registered' });
  }

  const newStudent = {
    id: Date.now().toString(),
    studentNumber,
    name: name || 'Unknown',
    faceId,
    section: section || 'N/A',
    course: course || 'N/A',
    registeredAt: new Date().toISOString()
  };

  db.students.push(newStudent);
  writeDB(db);

  console.log(`✅ Registered: ${studentNumber} - ${name}`);
  res.json({ success: true, message: 'Student registered successfully', data: newStudent });
});

// DELETE student
app.delete('/api/students/:id', (req, res) => {
  const db = readDB();
  db.students = db.students.filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'Student deleted' });
});

// ==================== VIOLATION ROUTES ====================

// GET all violations
app.get('/api/violations', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.violations });
});

// POST record violation (called by ESP32 after barcode + face verification)
app.post('/api/violation', (req, res) => {
  const { studentNumber, faceId, violationType, description, recordedBy } = req.body;

  if (!studentNumber || !faceId) {
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  }

  const db = readDB();

  // Verify student exists
  const student = db.students.find(s => s.studentNumber === studentNumber);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found. Please register first.' });
  }

  // Verify face ID matches
  if (student.faceId !== faceId) {
    return res.status(403).json({ success: false, message: 'Face verification failed. Identity mismatch.' });
  }

  const newViolation = {
    id: Date.now().toString(),
    studentNumber,
    studentName: student.name,
    section: student.section,
    course: student.course,
    faceId,
    violationType: violationType || 'General Violation',
    description: description || '',
    recordedBy: recordedBy || 'ESP32 Device',
    timestamp: new Date().toISOString()
  };

  db.violations.push(newViolation);
  writeDB(db);

  console.log(`🚨 Violation recorded: ${studentNumber} - ${student.name}`);
  res.json({ success: true, message: 'Violation recorded successfully', data: newViolation });
});

// DELETE violation
app.delete('/api/violations/:id', (req, res) => {
  const db = readDB();
  db.violations = db.violations.filter(v => v.id !== req.params.id);
  writeDB(db);
  res.json({ success: true, message: 'Violation deleted' });
});

// ==================== VERIFY ROUTE ====================

// POST verify student (barcode + face check without recording violation)
app.post('/api/verify', (req, res) => {
  const { studentNumber, faceId } = req.body;

  const db = readDB();
  const student = db.students.find(s => s.studentNumber === studentNumber);

  if (!student) {
    return res.status(404).json({ success: false, verified: false, message: 'Student not registered' });
  }

  if (student.faceId !== faceId) {
    return res.status(403).json({ success: false, verified: false, message: 'Face does not match' });
  }

  res.json({ success: true, verified: true, message: 'Identity verified', data: student });
});

// ==================== DASHBOARD STATS ====================

app.get('/api/stats', (req, res) => {
  const db = readDB();
  const today = new Date().toDateString();

  const todayViolations = db.violations.filter(v =>
    new Date(v.timestamp).toDateString() === today
  );

  res.json({
    success: true,
    data: {
      totalStudents: db.students.length,
      totalViolations: db.violations.length,
      todayViolations: todayViolations.length
    }
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 ESP32 can connect to: http://YOUR_PC_IP:${PORT}`);
  console.log(`\nAvailable API endpoints:`);
  console.log(`  POST /api/register     - Register student`);
  console.log(`  POST /api/violation    - Record violation`);
  console.log(`  POST /api/verify       - Verify identity`);
  console.log(`  GET  /api/students     - Get all students`);
  console.log(`  GET  /api/violations   - Get all violations`);
  console.log(`  GET  /api/stats        - Dashboard stats\n`);
});

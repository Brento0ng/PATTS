const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://pattsadmin:pattsadmin123@patts.fkwf4kz.mongodb.net/pattsdb?appName=PATTS';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend/public')));

const studentSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true, unique: true },
  name:          { type: String, default: 'Unknown' },
  faceId:        { type: String, required: true },
  section:       { type: String, default: 'N/A' },
  course:        { type: String, default: 'N/A' },
  registeredAt:  { type: Date, default: Date.now }
});

const violationSchema = new mongoose.Schema({
  studentNumber: { type: String, required: true },
  studentName:   { type: String, default: 'Unknown' },
  section:       { type: String, default: 'N/A' },
  course:        { type: String, default: 'N/A' },
  faceId:        { type: String, required: true },
  violationType: { type: String, default: 'General Violation' },
  description:   { type: String, default: '' },
  recordedBy:    { type: String, default: 'ESP32 Device' },
  timestamp:     { type: Date, default: Date.now }
});

const Student   = mongoose.model('Student', studentSchema);
const Violation = mongoose.model('Violation', violationSchema);

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ registeredAt: -1 });
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { studentNumber, name, faceId, section, course } = req.body;
  if (!studentNumber || !faceId)
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  try {
    const existing = await Student.findOne({ studentNumber });
    if (existing)
      return res.status(409).json({ success: false, message: 'Student already registered' });
    const newStudent = new Student({ studentNumber, name: name || 'Unknown', faceId, section: section || 'N/A', course: course || 'N/A' });
    await newStudent.save();
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

app.get('/api/violations', async (req, res) => {
  try {
    const violations = await Violation.find().sort({ timestamp: -1 });
    res.json({ success: true, data: violations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/violation', async (req, res) => {
  const { studentNumber, faceId, violationType, description, recordedBy } = req.body;
  if (!studentNumber || !faceId)
    return res.status(400).json({ success: false, message: 'studentNumber and faceId are required' });
  try {
    const student = await Student.findOne({ studentNumber });
    if (!student)
      return res.status(404).json({ success: false, message: 'Student not found. Please register first.' });
    if (student.faceId !== faceId)
      return res.status(403).json({ success: false, message: 'Face verification failed.' });
    const newViolation = new Violation({
      studentNumber, studentName: student.name, section: student.section,
      course: student.course, faceId, violationType: violationType || 'General Violation',
      description: description || '', recordedBy: recordedBy || 'ESP32 Device'
    });
    await newViolation.save();
    res.json({ success: true, message: 'Violation recorded successfully', data: newViolation });
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

app.post('/api/verify', async (req, res) => {
  const { studentNumber, faceId } = req.body;
  try {
    const student = await Student.findOne({ studentNumber });
    if (!student)
      return res.status(404).json({ success: false, verified: false, message: 'Student not registered' });
    if (student.faceId !== faceId)
      return res.status(403).json({ success: false, verified: false, message: 'Face does not match' });
    res.json({ success: true, verified: true, message: 'Identity verified', data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

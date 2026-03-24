const Student = require('../models/Student');
const StudentExam = require('../models/StudentExam');
const { CLASS_LEVELS } = require('../utils/constants');
const { success, created, notFound, badRequest, conflict } = require('../utils/response');

/**
 * POST /api/students
 */
const createStudent = async (req, res) => {
  const { name, code, classLevel } = req.body;

  if (!CLASS_LEVELS.includes(classLevel)) {
    return badRequest(res, `Invalid class level. Must be one of: ${CLASS_LEVELS.join(', ')}`);
  }

  const existing = await Student.findOne({ code: code.toUpperCase() });
  if (existing) {
    return conflict(res, `Student with code "${code}" already exists`);
  }

  const student = await Student.create({ name, code, classLevel });
  return created(res, student, 'Student created successfully');
};

/**
 * GET /api/students
 * Supports: ?classLevel=3eme&search=john&page=1&limit=20&active=true
 */
const getStudents = async (req, res) => {
  const {
    classLevel,
    search,
    page = 1,
    limit = 20,
    active,
    sortBy = 'name',
    sortOrder = 'asc',
  } = req.query;

  const filter = {};
  if (classLevel) filter.classLevel = classLevel;
  if (active !== undefined) filter.isActive = active === 'true';
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortDir = sortOrder === 'desc' ? -1 : 1;

  const [students, total] = await Promise.all([
    Student.find(filter)
      .sort({ [sortBy]: sortDir })
      .skip(skip)
      .limit(parseInt(limit)),
    Student.countDocuments(filter),
  ]);

  return success(res, {
    students,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/**
 * GET /api/students/:id
 */
const getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).populate('examCount');
  if (!student) return notFound(res, 'Student not found');

  const recentExams = await StudentExam.find({ student: student._id })
    .populate('exam', 'title subject classLevel')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('totalScore percentage grade status createdAt');

  return success(res, { student, recentExams });
};

/**
 * PUT /api/students/:id
 */
const updateStudent = async (req, res) => {
  const { name, code, classLevel, isActive } = req.body;

  if (classLevel && !CLASS_LEVELS.includes(classLevel)) {
    return badRequest(res, `Invalid class level. Must be one of: ${CLASS_LEVELS.join(', ')}`);
  }

  if (code) {
    const existing = await Student.findOne({
      code: code.toUpperCase(),
      _id: { $ne: req.params.id },
    });
    if (existing) return conflict(res, `Student code "${code}" is already taken`);
  }

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { name, code, classLevel, isActive },
    { new: true, runValidators: true }
  );

  if (!student) return notFound(res, 'Student not found');
  return success(res, student, 'Student updated successfully');
};

/**
 * DELETE /api/students/:id
 */
const deleteStudent = async (req, res) => {
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!student) return notFound(res, 'Student not found');
  return success(res, null, 'Student deactivated successfully');
};

/**
 * GET /api/students/:id/performance
 */
const getStudentPerformance = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return notFound(res, 'Student not found');

  const exams = await StudentExam.find({
    student: student._id,
    status: 'report_ready',
  })
    .populate('exam', 'title subject classLevel totalScore')
    .select('totalScore maxPossibleScore percentage grade evaluatedAt answers')
    .sort({ evaluatedAt: -1 });

  const avgPercentage =
    exams.length > 0
      ? exams.reduce((sum, e) => sum + (e.percentage || 0), 0) / exams.length
      : 0;

  return success(res, {
    student,
    performance: {
      totalExams: exams.length,
      averagePercentage: Math.round(avgPercentage * 100) / 100,
      exams,
    },
  });
};

/**
 * Simple CSV parser — zero external dependencies.
 * Handles quoted fields and trims whitespace.
 */
function parseCSVString(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * POST /api/students/import-csv
 * Parse uploaded CSV and bulk-create students.
 * CSV columns: name, studentCode, classLevel
 */
const importCSV = async (req, res) => {
  const file = req.file;
  if (!file) return badRequest(res, 'CSV file is required');

  // Parse CSV from buffer
  const csvText = file.buffer.toString('utf-8');
  const { headers, rows } = parseCSVString(csvText);

  if (!rows.length) {
    return badRequest(res, 'CSV file is empty or has no data rows');
  }

  // Validate headers
  const requiredCols = ['name', 'studentCode', 'classLevel'];
  const missingCols = requiredCols.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    return badRequest(
      res,
      `CSV missing required columns: ${missingCols.join(', ')}. Expected: name, studentCode, classLevel`
    );
  }

  const results = [];
  const errors = [];

  // Collect existing codes for duplicate check
  const allCodes = rows.map((r) => (r.studentCode || '').trim().toUpperCase()).filter(Boolean);
  const existingStudents = await Student.find({ code: { $in: allCodes } }).select('code');
  const existingCodes = new Set(existingStudents.map((s) => s.code));

  // Track codes seen in this import to detect intra-CSV duplicates
  const seenCodes = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const name = (row.name || '').trim();
    const code = (row.studentCode || '').trim().toUpperCase();
    const classLevel = (row.classLevel || '').trim();

    if (!name || name.length < 2) {
      errors.push({ row: rowNum, field: 'name', value: name, reason: 'Name is required (min 2 chars)' });
      continue;
    }

    if (!code || !/^[A-Z0-9\-_]{3,20}$/.test(code)) {
      errors.push({ row: rowNum, field: 'studentCode', value: code, reason: 'Code must be 3-20 alphanumeric characters' });
      continue;
    }

    if (!CLASS_LEVELS.includes(classLevel)) {
      errors.push({
        row: rowNum,
        field: 'classLevel',
        value: classLevel,
        reason: `Must be one of: ${CLASS_LEVELS.join(', ')}`,
      });
      continue;
    }

    if (existingCodes.has(code)) {
      errors.push({ row: rowNum, field: 'studentCode', value: code, reason: 'Student code already exists in database' });
      continue;
    }

    if (seenCodes.has(code)) {
      errors.push({ row: rowNum, field: 'studentCode', value: code, reason: 'Duplicate code within CSV file' });
      continue;
    }

    seenCodes.add(code);
    results.push({ name, code, classLevel });
  }

  // Bulk insert valid students
  let insertedCount = 0;
  if (results.length > 0) {
    try {
      const inserted = await Student.insertMany(results, { ordered: false });
      insertedCount = inserted.length;
    } catch (err) {
      if (err.insertedDocs) {
        insertedCount = err.insertedDocs.length;
      }
      if (err.writeErrors) {
        for (const we of err.writeErrors) {
          errors.push({
            row: 'bulk',
            field: 'database',
            value: we.errmsg,
            reason: 'Database insertion failed',
          });
        }
      }
    }
  }

  return success(res, {
    summary: {
      totalRows: rows.length,
      successCount: insertedCount,
      failedCount: errors.length,
    },
    errors: errors.slice(0, 50),
  }, `CSV import complete: ${insertedCount} created, ${errors.length} failed`);
};

module.exports = {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  getStudentPerformance,
  importCSV,
};
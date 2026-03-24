const Student = require('../models/Student');
const StudentExam = require('../models/StudentExam');
const { success, created, notFound, badRequest, conflict } = require('../utils/response');

/**
 * POST /api/students
 */
const createStudent = async (req, res) => {
  const { name, code, class: studentClass } = req.body;

  const existing = await Student.findOne({ code: code.toUpperCase() });
  if (existing) {
    return conflict(res, `Student with code "${code}" already exists`);
  }

  const student = await Student.create({ name, code, class: studentClass });
  return created(res, student, 'Student created successfully');
};

/**
 * GET /api/students
 * Supports: ?class=3&search=john&page=1&limit=20&active=true
 */
const getStudents = async (req, res) => {
  const {
    class: studentClass,
    search,
    page = 1,
    limit = 20,
    active,
    sortBy = 'name',
    sortOrder = 'asc',
  } = req.query;

  const filter = {};
  if (studentClass) filter.class = parseInt(studentClass);
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

  // Get recent exams
  const recentExams = await StudentExam.find({ student: student._id })
    .populate('exam', 'title subject class')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('totalScore percentage grade status createdAt');

  return success(res, { student, recentExams });
};

/**
 * PUT /api/students/:id
 */
const updateStudent = async (req, res) => {
  const { name, code, class: studentClass, isActive } = req.body;

  // Check code uniqueness if being changed
  if (code) {
    const existing = await Student.findOne({
      code: code.toUpperCase(),
      _id: { $ne: req.params.id },
    });
    if (existing) return conflict(res, `Student code "${code}" is already taken`);
  }

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { name, code, class: studentClass, isActive },
    { new: true, runValidators: true }
  );

  if (!student) return notFound(res, 'Student not found');
  return success(res, student, 'Student updated successfully');
};

/**
 * DELETE /api/students/:id
 * Soft delete (deactivate)
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
    .populate('exam', 'title subject class totalScore')
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

module.exports = {
  createStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  getStudentPerformance,
};

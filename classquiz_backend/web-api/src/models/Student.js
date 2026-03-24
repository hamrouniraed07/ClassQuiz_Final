const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Student code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9\-_]{3,20}$/, 'Code must be alphanumeric (3-20 chars)'],
    },
    class: {
      type: Number,
      required: [true, 'Class is required'],
      min: [1, 'Class must be between 1 and 6'],
      max: [6, 'Class must be between 1 and 6'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: total exams count
studentSchema.virtual('examCount', {
  ref: 'StudentExam',
  localField: '_id',
  foreignField: 'student',
  count: true,
});

studentSchema.index({ code: 1 });
studentSchema.index({ class: 1 });
studentSchema.index({ name: 'text' });

module.exports = mongoose.model('Student', studentSchema);

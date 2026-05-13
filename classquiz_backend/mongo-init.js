
db = db.getSiblingDB("classquiz");

print("ClassQuiz: Initializing MongoDB...");

   
db.admins.createIndex({ email: 1 }, { unique: true });

   
db.students.createIndex({ code: 1 }, { unique: true });
db.students.createIndex({ class: 1 });
db.students.createIndex({ name: "text" });
db.students.createIndex({ isActive: 1 });

 
db.exams.createIndex({ class: 1, status: 1 });
db.exams.createIndex({ subject: 1 });
db.exams.createIndex({ createdAt: -1 });

  
db.studentexams.createIndex({ student: 1, exam: 1 }, { unique: true });
db.studentexams.createIndex({ exam: 1, status: 1 });
db.studentexams.createIndex({ student: 1 });
db.studentexams.createIndex({ createdAt: -1 });

  
db.validations.createIndex({ studentExam: 1 }, { unique: true });
db.validations.createIndex({ status: 1 });
db.validations.createIndex({ exam: 1 });
   
db.batchuploads.createIndex({ exam: 1 });
db.batchuploads.createIndex({ status: 1 });

print("ClassQuiz: MongoDB initialization complete.");

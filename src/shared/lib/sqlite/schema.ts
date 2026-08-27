export const DB_NAME = 'questions.db';
export const DB_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  subHeading TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  version INTEGER DEFAULT 1,
  deletedAt TEXT
);

-- 2. Subcategories Table
CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  parentCategory TEXT NOT NULL,
  parentCategoryId TEXT,
  date TEXT,
  subHeading TEXT,
  text TEXT,
  details TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  version INTEGER DEFAULT 1,
  deletedAt TEXT
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  optionA TEXT NOT NULL,
  optionB TEXT NOT NULL,
  optionC TEXT NOT NULL,
  optionD TEXT NOT NULL,
  correct TEXT NOT NULL,
  explanation TEXT,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  categoriesJson TEXT,
  subcategoriesJson TEXT,
  csvCategory TEXT,
  csvSubcategory TEXT,
  examCategory TEXT,
  examSubcategory TEXT,
  examPathJson TEXT,
  subjectCategory TEXT,
  subjectSubcategory TEXT,
  subjectPathJson TEXT,
  commentsJson TEXT,
  userExplanationsJson TEXT,
  createdAt TEXT,
  date TEXT,
  updatedAt TEXT,
  version INTEGER DEFAULT 1,
  deletedAt TEXT
);

-- 4. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  category TEXT,
  startDate TEXT,
  endDate TEXT,
  price REAL,
  originalPrice REAL,
  couponsJson TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  version INTEGER DEFAULT 1,
  deletedAt TEXT
);

-- 5. Exams Table (Live Exams & Routines)
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'live', -- 'live' | 'routine' | 'scheduled'
  qLimit INTEGER DEFAULT 0,
  timeLimit INTEGER DEFAULT 0,
  category TEXT,
  startTime TEXT,
  expiryTime TEXT,
  totalMarks REAL,
  passMarks REAL,
  questionSelection TEXT,
  questionIdsJson TEXT,
  routineId TEXT,
  courseId TEXT,
  courseName TEXT,
  details TEXT,
  selectedCategoriesJson TEXT,
  selectedSubcategoriesJson TEXT,
  selectedLeafCategoriesJson TEXT,
  examConfigJson TEXT,
  examDate TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  version INTEGER DEFAULT 1,
  deletedAt TEXT
);

-- 6. Sync Metadata Table
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_subcategory ON questions(subcategory);
CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(date);
CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version);
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON subcategories(parentCategory);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_exams_type ON exams(type);
CREATE INDEX IF NOT EXISTS idx_exams_startTime ON exams(startTime);
`;

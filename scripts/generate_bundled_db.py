import sqlite3
import os
import json

# Ensure directories exist
os.makedirs('public/assets/databases', exist_ok=True)
os.makedirs('public', exist_ok=True)
os.makedirs('assets/databases', exist_ok=True)
os.makedirs('assets', exist_ok=True)

db_paths = [
    'public/assets/databases/questions.db',
    'public/questions.db',
    'assets/databases/questions.db',
    'assets/questions.db'
]

# Remove existing files if present
for p in db_paths:
    if os.path.exists(p):
        try:
            os.remove(p)
        except Exception:
            pass

# Create database and populate tables
conn = sqlite3.connect('public/assets/databases/questions.db')
cursor = conn.cursor()

# 1. Schema Creation
cursor.executescript('''
-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  subHeading TEXT,
  createdAt TEXT,
  updatedAt TEXT
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
  updatedAt TEXT
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
  updatedAt TEXT
);

-- 4. Courses Table (Empty in bundle)
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
  updatedAt TEXT
);

-- 5. Exams Table (Live Exams & Routines - Empty in bundle)
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'live',
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
  updatedAt TEXT
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_subcategory ON questions(subcategory);
CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(date);
CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON subcategories(parentCategory);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_exams_type ON exams(type);
CREATE INDEX IF NOT EXISTS idx_exams_startTime ON exams(startTime);
''')

# 2. Bundled Categories
categories = [
    ('cat-1', 'বিষয়ভিত্তিক প্রস্তুতি', 'বাংলা, ইংরেজি, গণিত ও সাধারণ জ্ঞান', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('cat-2', 'জব সলিউশন পরীক্ষা', 'বিসিএস ও অন্যান্য সরকারি চাকরির বিগত প্রশ্ন', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('cat-3', 'সাল ভিত্তিক জব সলিউশন', 'সাল অনুযায়ী সমাধানকৃত পরীক্ষার প্রশ্নব্যাংক', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('cat-4', 'সাম্প্রতিক বিষয়াবলী', 'সাম্প্রতিক দেশীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ ঘটনাবলি', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')
]
cursor.executemany('INSERT INTO categories (id, name, subHeading, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', categories)

# 3. Bundled Subcategories
subcategories = [
    ('sub_bcs_52', '৫২তম বিসিএস', 'জব সলিউশন পরীক্ষা', 'cat-2', '2026-08-10', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bcs_46', '৪৬তম বিসিএস', 'জব সলিউশন পরীক্ষা', 'cat-2', '2026-06-15', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bcs_45', '৪৫তম বিসিএস', 'জব সলিউশন পরীক্ষা', 'cat-2', '2023-05-19', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bcs_44', '৪৪তম বিসিএস', 'জব সলিউশন পরীক্ষা', 'cat-2', '2022-05-27', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bcs_38', '৩৮তম বিসিএস', 'জব সলিউশন পরীক্ষা', 'cat-2', '2017-12-29', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_primary_2023', 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩', 'জব সলিউশন পরীক্ষা', 'cat-2', '2023-12-08', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bank_2024', 'ব্যাংক রিক্রুটমেন্ট ২০২৪', 'জব সলিউশন পরীক্ষা', 'cat-2', '2024-03-01', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bb_2026', 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ২০২৬', 'জব সলিউশন পরীক্ষা', 'cat-2', '2026-07-20', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_bangla', 'বাংলা', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_english', 'ইংরেজি', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_gk', 'সাধারণ জ্ঞান', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_math', 'গণিত', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_science', 'সাধারণ বিজ্ঞান', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_ict', 'কম্পিউটার ও তথ্যপ্রযুক্তি', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_geo', 'ভূগোল ও পরিবেশ', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_mental', 'মানসিক দক্ষতা', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_ethics', 'নৈতিকতা ও মূল্যবোধ', 'বিষয়ভিত্তিক প্রস্তুতি', 'cat-1', '', '', '', '', '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
    ('sub_ca_18aug', '১৮ আগস্ট ২০২৬', 'সাম্প্রতিক বিষয়াবলী', 'cat-4', '2026-08-18', '', '', '', '2026-08-18T00:00:00Z', '2026-08-18T00:00:00Z'),
    ('sub_ca_15aug', '১৫ আগস্ট ২০২৬', 'সাম্প্রতিক বিষয়াবলী', 'cat-4', '2026-08-15', '', '', '', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z')
]
cursor.executemany('''
INSERT INTO subcategories (id, name, parentCategory, parentCategoryId, date, subHeading, text, details, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', subcategories)

# 4. Bundled Questions
questions = [
    (
        'q_bcs52_1',
        '৫২তম বিসিএস প্রিলিমিনারি: "ইউনেস্কো" কর্তৃক ঘোষিত বাংলাদেশের সর্বশেষ বিশ্ব ঐতিহ্য বা ইনট্যাঞ্জিবল কালচারাল হেরিটেজ কোনটি?',
        'সুন্দরবন', 'শীতলপাটি বুনন', 'ঢাকার রিকশা ও রিকশাচিত্র', 'বাউল গান',
        'Option C',
        '২০২৩ সালের ডিসেম্বরে ইউনেস্কোর ইনট্যাঞ্জিবল কালচারাল হেরিটেজ হিসেবে "ঢাকার রিকশা ও রিকশাচিত্র" তালিকাভুক্ত হয়।',
        'সাধারণ জ্ঞান', '৫২তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-08-10T00:00:00Z', '2026-08-10', '2026-08-10T00:00:00Z'
    ),
    (
        'q_bcs52_2',
        '৫২তম বিসিএস: Choose the correct preposition: "He has a great passion ___ classical literature."',
        'for', 'in', 'with', 'to',
        'Option A',
        '"Passion for" একটি উপযুক্ত prepositional phrase যার অর্থ কোনো কিছুর প্রতি প্রবল অনুরাগ বা আকর্ষণ।',
        'ইংরেজি', '৫২তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-08-10T00:00:00Z', '2026-08-10', '2026-08-10T00:00:00Z'
    ),
    (
        'q_bb2026_1',
        'বাংলাদেশ ব্যাংক এডি ২০২৬: বাংলাদেশের কেন্দ্রীয় ব্যাংকের বৈদেশিক মুদ্রার রিজার্ভ সুরক্ষায় ব্যবহৃত বর্তমান হিসাব পদ্ধতির নাম কী?',
        'Gross Reserves', 'BPM6 (Balance of Payments and International Investment Position Manual 6th edition)', 'IMF SDR Method', 'Forex Net Assets',
        'Option B',
        'আইএমএফ (IMF)-এর নীতিমালা অনুযায়ী বাংলাদেশ ব্যাংক BPM6 হিসাব পদ্ধতি অনুসরণ করে প্রকৃত বা নিট বৈদেশিক মুদ্রার রিজার্ভ প্রকাশ করে।',
        'সাধারণ জ্ঞান', 'বাংলাদেশ ব্যাংক সহকারী পরিচালক ২০২৬',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-20T00:00:00Z', '2026-07-20', '2026-07-20T00:00:00Z'
    ),
    (
        'q_bcs46_1',
        '৪৬তম বিসিএস: চর্যাপদের কোন কবি সর্বাধিক পদ রচনা করেছেন?',
        'লুইপা', 'ভুসুকুপা', 'কাহ্নপা', 'শবরপা',
        'Option C',
        'চর্যাপদের পদকর্তাদের মধ্যে কাহ্নপা সর্বাধিক ১৩টি পদ (মতান্তরে ১২টি) রচনা করেছেন। ভুসুকুপা রচনা করেন ৮টি পদ।',
        'বাংলা', '৪৬তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-06-15T00:00:00Z', '2026-06-15', '2026-06-15T00:00:00Z'
    ),
    (
        'q1',
        'বাংলাদেশের স্বাধীনতা সুবর্ণজয়ন্তী বা ৫০ বছর পূর্তি কোন বছর পালিত হয়?',
        '২০২০', '২০২১', '২০২২', '২০২৩',
        'Option B',
        'বাংলাদেশ ১৯৭১ সালের ২৬শে মার্চ স্বাধীনতা ঘোষণা করে। এর সুবর্ণজয়ন্তী ৫০ বছর পূর্তি ২০২১ সালে উদযাপন করা হয়।',
        'সাধারণ জ্ঞান', '৪৫তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2023-05-19', '2026-07-15T00:00:00Z'
    ),
    (
        'q2',
        'Which is the correct spelling?',
        'Lieutenant', 'Lieutanent', 'Leiutenant', 'Lieutennant',
        'Option A',
        'সঠিক বানান হল Lieutenant (লেফটেন্যান্ট)। এটি ফরাসি ভাষা থেকে আগত একটি শব্দ যার অর্থ প্রতিনিধি বা সহকারী।',
        'ইংরেজি', 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2023-12-08', '2026-07-15T00:00:00Z'
    ),
    (
        'q3',
        'বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস কোনটি?',
        'পদ্মরাগ', 'কপালকুণ্ডলা', 'দুর্গেশনন্দিনী', 'বিষবৃক্ষ',
        'Option C',
        'বঙ্কিমচন্দ্র চট্টোপাধ্যায় রচিত "দুর্গেশনন্দিনী" (১৮৬৫) বাংলা সাহিত্যের প্রথম সার্থক উপন্যাস হিসেবে স্বীকৃত।',
        'বাংলা', '৪৪তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2022-05-27', '2026-07-15T00:00:00Z'
    ),
    (
        'q4',
        'পদ্মা সেতুর দৈর্ঘ্য কত কিলোমিটার?',
        '৬.১৫ কিলোমিটার', '৫.১৫ কিলোমিটার', '৭.১৫ কিলোমিটার', '৬.৫০ কিলোমিটার',
        'Option A',
        'পদ্মা বহুমুখী সেতুর মোট দৈর্ঘ্য ৬.১৫ কিলোমিটার (৬,১৫০ মিটার)। এটি মুন্সীগঞ্জের লৌহজংয়ের সাথে শরীয়তপুর ও মাদারীপুরকে সংযুক্ত করেছে।',
        'সাধারণ জ্ঞান', 'ব্যাংক রিক্রুটমেন্ট ২০২৪',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2024-03-01', '2026-07-15T00:00:00Z'
    ),
    (
        'q5',
        'Change the voice: "Who is calling me?"',
        'By whom am I called?', 'By whom was I called?', 'By whom am I being called?', 'By whom are you called?',
        'Option C',
        'Present continuous tense-এর "Who" যুক্ত Active voice-কে Passive করতে হলে: By whom + auxiliary verb (am) + object-এর subject (I) + being + verb-এর past participle (called) + ?',
        'ইংরেজি', '৪৫তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2023-05-19', '2026-07-15T00:00:00Z'
    ),
    (
        'q6',
        'বাংলা বর্ণমালায় অর্ধমাত্রার বর্ণ কয়টি?',
        '৩২টি', '৮টি', '১০টি', '৬টি',
        'Option B',
        'বাংলা বর্ণমালায় মোট অর্ধমাত্রার বর্ণ ৮টি (ঋ, খ, গ, ণ, থ, ধ, প, শ)। পূর্ণমাত্রার বর্ণ ৩২টি এবং মাত্রাহীন বর্ণ ১০টি।',
        'বাংলা', 'প্রাথমিক শিক্ষক নিয়োগ ২০২৩',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2023-12-08', '2026-07-15T00:00:00Z'
    ),
    (
        'q7',
        'একনেক (ECNEC) এর সভাপতি কে?',
        'অর্থন্ত্রী', 'পরিকল্পনামন্ত্রী', 'প্রধানমন্ত্রী', 'রাষ্ট্রপতি',
        'Option C',
        'জাতীয় অর্থনৈতিক পরিষদের নির্বাহী কমিটি (ECNEC)-এর সভাপতি হলেন গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের মাননীয় প্রধানমন্ত্রী।',
        'সাধারণ জ্ঞান', '৪৪তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2022-05-27', '2026-07-15T00:00:00Z'
    ),
    (
        'q8',
        'What is the synonym of "Adjourn"?',
        'Postpone', 'Continue', 'Begin', 'Accelerate',
        'Option A',
        'Adjourn অর্থ মূলত স্থগিত রাখা বা মুলতুবি করা। এর সঠিক সমার্থক শব্দ হলো Postpone (স্থগিত করা)।',
        'ইংরেজি', 'ব্যাংক রিক্রুটমেন্ট ২০২৪',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2024-03-01', '2026-07-15T00:00:00Z'
    ),
    (
        'q9',
        '"গীতাঞ্জলি" কাব্যের জন্য রবীন্দ্রনাথ ঠাকুর কত সালে নোবেল পুরস্কার লাভ করেন?',
        '১৯১১', '১৯১২', '১৯১৩', '১৯১৪',
        'Option C',
        'রবীন্দ্রনাথ ঠাকুর ১৯১৩ সালে সাহিত্য নোবেল পুরস্কার লাভ করেন। তিনি এশীয়দের মধ্যে প্রথম এই গৌরব অর্জন করেন।',
        'বাংলা', '৩৮তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2017-12-29', '2026-07-15T00:00:00Z'
    ),
    (
        'q10',
        'বাংলাদেশের একমাত্র প্রবাল দ্বীপ কোনটি?',
        'সন্দ্বীপ', 'হাতিয়া', 'সেন্টমার্টিন', 'কুতুবদিয়া',
        'Option C',
        'সেন্টমার্টিন দ্বীপ বাংলাদেশের একমাত্র সামুদ্রিক প্রবাল দ্বীপ (Coral Island)। এটি টেকনাফ উপজেলার অন্তর্গত বঙ্গোপসাগরের বুকে অবস্থিত।',
        'সাধারণ জ্ঞান', '৩৮তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-28T00:00:00Z', '2026-07-28', '2026-07-28T00:00:00Z'
    ),
    (
        'q11',
        'Identify the noun of the word "Beautiful":',
        'Beautify', 'Beauty', 'Beautifully', 'Beauties',
        'Option B',
        'Beautiful হল Adjective, এর Noun ফর্ম হল Beauty। Beautify হল Verb এবং Beautifully হল Adverb।',
        'ইংরেজি', '৪৪তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2022-05-27', '2026-07-15T00:00:00Z'
    ),
    (
        'q12',
        'কবর নাটকটি কার রচনা?',
        'জসীমউদ্দীন', 'মুনীর চৌধুরী', 'রবীন্দ্রনাথ ঠাকুর', 'নজরুল ইসলাম',
        'Option B',
        'ভাষা আন্দোলনের পটভূমিতে মুনীর চৌধুরী ১৯৫৩ সালে ঢাকা কেন্দ্রীয় কারাগারে বন্দি অবস্থায় "কবর" নাটকটি রচনা করেন। উল্লেখ্য, কবর কবিতাটি রচনা করেন জসীমউদ্দীন।',
        'বাংলা', '৪৫তম বিসিএস',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-07-15T00:00:00Z', '2023-05-19', '2026-07-15T00:00:00Z'
    ),
    (
        'ca_q1',
        'সাম্প্রতিক সময়ে বাংলাদেশ ব্যাংকের নীতি অনুযায়ী নতুন রেপো রেট কত শতাংশ নির্ধারণ করা হয়েছে?',
        '৮.৫০%', '৯.০০%', '১০.০০%', '৭.৫০%',
        'Option C',
        'মুদ্রাস্ফীতি নিয়ন্ত্রণ ও ঋণ প্রবাহ স্থিতিশীল করতে বাংলাদেশ ব্যাংক সাম্প্রতিক মুদ্রানীতিতে পলিসি রেট বা রেপো হার ১০ শতাংশে উন্নীত করেছে।',
        'সাম্প্রতিক বিষয়াবলী', '১৮ আগস্ট ২০২৬',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-08-18T00:00:00Z', '2026-08-18', '2026-08-18T00:00:00Z'
    ),
    (
        'ca_q2',
        'আন্তর্জাতিক সৌর জোট (International Solar Alliance - ISA)-এর সদর দপ্তর কোন দেশে অবস্থিত?',
        'ফ্রান্স', 'ভারত (গুরুগ্রাম)', 'সুইজারল্যান্ড', 'যুক্তরাষ্ট্র',
        'Option B',
        'আন্তর্জাতিক সৌর জোট (ISA)-এর সদর দপ্তর ভারতের হরিয়ানা রাজ্যের গুরুগ্রামে (Gurugram) অবস্থিত। এটি বাংলাদেশসহ বিশ্বব্যাপী নবায়নযোগ্য সৌর শক্তি সম্প্রসারণে কাজ করছে।',
        'সাম্প্রতিক বিষয়াবলী', '১৮ আগস্ট ২০২৬',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-08-18T00:00:00Z', '2026-08-18', '2026-08-18T00:00:00Z'
    ),
    (
        'ca_q3',
        'বঙ্গবন্ধু শেখ মুজিবুর রহমান টানেল কোন নদীর তলদেশে নির্মিত হয়েছে?',
        'মেঘনা নদী', 'পদ্মা নদী', 'কর্ণফুলী নদী', 'যমুনা নদী',
        'Option C',
        'বঙ্গবন্ধু টানেল চট্টগ্রামের কর্ণফুলী নদীর তলদেশে নির্মিত দক্ষিণ এশিয়ার প্রথম আন্ডারওয়াটার রোড টানেল।',
        'সাম্প্রতিক বিষয়াবলী', '১৫ আগস্ট ২০২৬',
        '[]', '[]', '', '', '', '', '[]', '', '', '[]', '[]', '[]',
        '2026-08-15T00:00:00Z', '2026-08-15', '2026-08-15T00:00:00Z'
    )
]

cursor.executemany('''
INSERT INTO questions (
  id, text, optionA, optionB, optionC, optionD, correct, explanation,
  category, subcategory, categoriesJson, subcategoriesJson,
  csvCategory, csvSubcategory, examCategory, examSubcategory,
  examPathJson, subjectCategory, subjectSubcategory, subjectPathJson,
  commentsJson, userExplanationsJson, createdAt, date, updatedAt
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', questions)

conn.commit()
conn.close()

# Copy to all target paths
import shutil
src = 'public/assets/databases/questions.db'
for p in db_paths:
    if p != src:
        shutil.copyfile(src, p)

print('✅ Bundled SQLite database generated successfully at:')
for p in db_paths:
    print(f'   - {p} ({os.path.getsize(p)} bytes)')

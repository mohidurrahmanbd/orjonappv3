import { 
  CategoryItem, 
  SubcategoryItem, 
  Question, 
  Course, 
  LiveExam, 
  Routine 
} from '../../types';
import { getSQLiteDatabase } from './sqliteConnection';

// ==========================================
// 1. CATEGORIES CRUD
// ==========================================

export async function getAllCategories(): Promise<CategoryItem[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM categories WHERE (deletedAt IS NULL OR deletedAt = "") ORDER BY id ASC;');
    const rows = res?.values || [];
    return rows.map(mapRowToCategory);
  } catch (err) {
    console.error('[SQLite] getAllCategories error:', err);
    return [];
  }
}

export async function getCategoryById(id: string): Promise<CategoryItem | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM categories WHERE id = ? AND (deletedAt IS NULL OR deletedAt = "");', [id]);
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToCategory(row);
  } catch (err) {
    console.error('[SQLite] getCategoryById error:', err);
    return null;
  }
}

export async function insertCategory(cat: CategoryItem): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO categories (id, name, subHeading, createdAt, updatedAt, version, deletedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        cat.id,
        cat.name,
        cat.subHeading || '',
        cat.createdAt || now,
        cat.updatedAt || now,
        cat.version !== undefined ? cat.version : 1,
        cat.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertCategory error:', err);
    return false;
  }
}

export async function insertCategories(cats: CategoryItem[]): Promise<boolean> {
  if (!cats || cats.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    for (const cat of cats) {
      await db.run(
        `INSERT OR REPLACE INTO categories (id, name, subHeading, createdAt, updatedAt, version, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          cat.id,
          cat.name,
          cat.subHeading || '',
          cat.createdAt || now,
          cat.updatedAt || now,
          cat.version !== undefined ? cat.version : 1,
          cat.deletedAt || null
        ]
      );
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertCategories error:', err);
    return false;
  }
}

export async function updateCategory(id: string, partial: Partial<CategoryItem>): Promise<boolean> {
  try {
    const current = await getCategoryById(id);
    if (!current) return false;
    const merged: CategoryItem = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertCategory(merged);
  } catch (err) {
    console.error('[SQLite] updateCategory error:', err);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM categories WHERE id = ?;', [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteCategory error:', err);
    return false;
  }
}

export async function clearCategories(): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM categories;');
    return true;
  } catch (err) {
    console.error('[SQLite] clearCategories error:', err);
    return false;
  }
}

function mapRowToCategory(r: any): CategoryItem {
  return {
    id: r.id,
    name: r.name,
    subHeading: r.subHeading || r.subheading || undefined,
    createdAt: r.createdAt || r.createdat || undefined,
    updatedAt: r.updatedAt || r.updatedat || undefined,
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

// ==========================================
// 2. SUBCATEGORIES CRUD
// ==========================================

export async function getAllSubcategories(): Promise<SubcategoryItem[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM subcategories WHERE (deletedAt IS NULL OR deletedAt = "") ORDER BY id ASC;');
    const rows = res?.values || [];
    return rows.map(mapRowToSubcategory);
  } catch (err) {
    console.error('[SQLite] getAllSubcategories error:', err);
    return [];
  }
}

export async function getSubcategoriesByParent(parentCategory: string): Promise<SubcategoryItem[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM subcategories WHERE parentCategory = ? AND (deletedAt IS NULL OR deletedAt = "");',
      [parentCategory]
    );
    const rows = res?.values || [];
    return rows.map(mapRowToSubcategory);
  } catch (err) {
    console.error('[SQLite] getSubcategoriesByParent error:', err);
    return [];
  }
}

export async function getSubcategoryById(id: string): Promise<SubcategoryItem | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM subcategories WHERE id = ? AND (deletedAt IS NULL OR deletedAt = "");',
      [id]
    );
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToSubcategory(row);
  } catch (err) {
    console.error('[SQLite] getSubcategoryById error:', err);
    return null;
  }
}

export async function insertSubcategory(sub: SubcategoryItem): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO subcategories (
        id, name, parentCategory, parentCategoryId, date, subHeading, text, details, createdAt, updatedAt, version, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        sub.id,
        sub.name,
        sub.parentCategory || '',
        sub.parentCategoryId || '',
        sub.date || '',
        sub.subHeading || '',
        sub.text || '',
        sub.details || '',
        sub.createdAt || now,
        sub.updatedAt || now,
        sub.version !== undefined ? sub.version : 1,
        sub.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertSubcategory error:', err);
    return false;
  }
}

export async function insertSubcategories(subs: SubcategoryItem[]): Promise<boolean> {
  if (!subs || subs.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    for (const sub of subs) {
      await db.run(
        `INSERT OR REPLACE INTO subcategories (
          id, name, parentCategory, parentCategoryId, date, subHeading, text, details, createdAt, updatedAt, version, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          sub.id,
          sub.name,
          sub.parentCategory || '',
          sub.parentCategoryId || '',
          sub.date || '',
          sub.subHeading || '',
          sub.text || '',
          sub.details || '',
          sub.createdAt || now,
          sub.updatedAt || now,
          sub.version !== undefined ? sub.version : 1,
          sub.deletedAt || null
        ]
      );
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertSubcategories error:', err);
    return false;
  }
}

export async function updateSubcategory(id: string, partial: Partial<SubcategoryItem>): Promise<boolean> {
  try {
    const current = await getSubcategoryById(id);
    if (!current) return false;
    const merged: SubcategoryItem = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertSubcategory(merged);
  } catch (err) {
    console.error('[SQLite] updateSubcategory error:', err);
    return false;
  }
}

export async function deleteSubcategory(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM subcategories WHERE id = ?;', [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteSubcategory error:', err);
    return false;
  }
}

export async function clearSubcategories(): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM subcategories;');
    return true;
  } catch (err) {
    console.error('[SQLite] clearSubcategories error:', err);
    return false;
  }
}

function mapRowToSubcategory(r: any): SubcategoryItem {
  return {
    id: r.id,
    name: r.name,
    parentCategory: r.parentCategory || r.parentcategory || '',
    parentCategoryId: r.parentCategoryId || r.parentcategoryid || undefined,
    date: r.date || undefined,
    subHeading: r.subHeading || r.subheading || undefined,
    text: r.text || undefined,
    details: r.details || undefined,
    createdAt: r.createdAt || r.createdat || undefined,
    updatedAt: r.updatedAt || r.updatedat || undefined,
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

// ==========================================
// 3. QUESTIONS CRUD
// ==========================================

export async function getAllQuestions(limit: number = 5000, offset: number = 0): Promise<Question[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM questions WHERE (deletedAt IS NULL OR deletedAt = "") ORDER BY date DESC, id DESC LIMIT ? OFFSET ?;',
      [limit, offset]
    );
    const rows = res?.values || [];
    return rows.map(mapRowToQuestion);
  } catch (err) {
    console.error('[SQLite] getAllQuestions error:', err);
    return [];
  }
}

export async function getQuestionById(id: string): Promise<Question | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM questions WHERE id = ? AND (deletedAt IS NULL OR deletedAt = "");',
      [id]
    );
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToQuestion(row);
  } catch (err) {
    console.error('[SQLite] getQuestionById error:', err);
    return null;
  }
}

export async function getQuestionsByCategory(category: string, limit: number = 1000, offset: number = 0): Promise<Question[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM questions WHERE category = ? AND (deletedAt IS NULL OR deletedAt = "") ORDER BY date DESC, id DESC LIMIT ? OFFSET ?;',
      [category, limit, offset]
    );
    const rows = res?.values || [];
    return rows.map(mapRowToQuestion);
  } catch (err) {
    console.error('[SQLite] getQuestionsByCategory error:', err);
    return [];
  }
}

export async function getQuestionsBySubcategory(subcategory: string, limit: number = 1000, offset: number = 0): Promise<Question[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query(
      'SELECT * FROM questions WHERE subcategory = ? AND (deletedAt IS NULL OR deletedAt = "") ORDER BY date DESC, id DESC LIMIT ? OFFSET ?;',
      [subcategory, limit, offset]
    );
    const rows = res?.values || [];
    return rows.map(mapRowToQuestion);
  } catch (err) {
    console.error('[SQLite] getQuestionsBySubcategory error:', err);
    return [];
  }
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids || ids.length === 0) return [];
  try {
    const db = await getSQLiteDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const res = await db.query(
      `SELECT * FROM questions WHERE id IN (${placeholders}) AND (deletedAt IS NULL OR deletedAt = "");`,
      ids
    );
    const rows = res?.values || [];
    return rows.map(mapRowToQuestion);
  } catch (err) {
    console.error('[SQLite] getQuestionsByIds error:', err);
    return [];
  }
}

export async function searchQuestions(searchQuery: string, limit: number = 100): Promise<Question[]> {
  if (!searchQuery || !searchQuery.trim()) return [];
  try {
    const db = await getSQLiteDatabase();
    const pattern = `%${searchQuery.trim()}%`;
    const res = await db.query(
      `SELECT * FROM questions 
       WHERE (text LIKE ? OR category LIKE ? OR subcategory LIKE ? OR explanation LIKE ?)
       AND (deletedAt IS NULL OR deletedAt = "")
       LIMIT ?;`,
      [pattern, pattern, pattern, pattern, limit]
    );
    const rows = res?.values || [];
    return rows.map(mapRowToQuestion);
  } catch (err) {
    console.error('[SQLite] searchQuestions error:', err);
    return [];
  }
}

export async function getQuestionsCount(filter?: { category?: string; subcategory?: string }): Promise<number> {
  try {
    const db = await getSQLiteDatabase();
    let sql = 'SELECT COUNT(*) as count FROM questions WHERE (deletedAt IS NULL OR deletedAt = "")';
    const params: any[] = [];

    if (filter?.category && filter?.subcategory) {
      sql += ' AND category = ? AND subcategory = ?';
      params.push(filter.category, filter.subcategory);
    } else if (filter?.category) {
      sql += ' AND category = ?';
      params.push(filter.category);
    } else if (filter?.subcategory) {
      sql += ' AND subcategory = ?';
      params.push(filter.subcategory);
    }

    const res = await db.query(sql, params);
    const count = res?.values?.[0]?.count || 0;
    return Number(count);
  } catch (err) {
    console.error('[SQLite] getQuestionsCount error:', err);
    return 0;
  }
}

export async function insertQuestion(q: Question): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO questions (
        id, text, optionA, optionB, optionC, optionD, correct, explanation,
        category, subcategory, categoriesJson, subcategoriesJson,
        csvCategory, csvSubcategory, examCategory, examSubcategory,
        examPathJson, subjectCategory, subjectSubcategory, subjectPathJson,
        commentsJson, userExplanationsJson, createdAt, date, updatedAt, version, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        q.id,
        q.text || '',
        q.optionA || '',
        q.optionB || '',
        q.optionC || '',
        q.optionD || '',
        q.correct || 'Option A',
        q.explanation || '',
        q.category || '',
        q.subcategory || '',
        JSON.stringify(q.categories || []),
        JSON.stringify(q.subcategories || []),
        q.csvCategory || '',
        q.csvSubcategory || '',
        q.examCategory || '',
        q.examSubcategory || '',
        JSON.stringify(q.examPath || []),
        q.subjectCategory || '',
        q.subjectSubcategory || '',
        JSON.stringify(q.subjectPath || []),
        JSON.stringify(q.comments || []),
        JSON.stringify(q.userExplanations || []),
        q.createdAt || now,
        q.date || '',
        q.updatedAt || now,
        q.version !== undefined ? q.version : 1,
        q.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertQuestion error:', err);
    return false;
  }
}

export async function insertQuestions(questions: Question[]): Promise<boolean> {
  if (!questions || questions.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();

    const CHUNK_SIZE = 100;
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      for (const q of chunk) {
        await db.run(
          `INSERT OR REPLACE INTO questions (
            id, text, optionA, optionB, optionC, optionD, correct, explanation,
            category, subcategory, categoriesJson, subcategoriesJson,
            csvCategory, csvSubcategory, examCategory, examSubcategory,
            examPathJson, subjectCategory, subjectSubcategory, subjectPathJson,
            commentsJson, userExplanationsJson, createdAt, date, updatedAt, version, deletedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            q.id,
            q.text || '',
            q.optionA || '',
            q.optionB || '',
            q.optionC || '',
            q.optionD || '',
            q.correct || 'Option A',
            q.explanation || '',
            q.category || '',
            q.subcategory || '',
            JSON.stringify(q.categories || []),
            JSON.stringify(q.subcategories || []),
            q.csvCategory || '',
            q.csvSubcategory || '',
            q.examCategory || '',
            q.examSubcategory || '',
            JSON.stringify(q.examPath || []),
            q.subjectCategory || '',
            q.subjectSubcategory || '',
            JSON.stringify(q.subjectPath || []),
            JSON.stringify(q.comments || []),
            JSON.stringify(q.userExplanations || []),
            q.createdAt || now,
            q.date || '',
            q.updatedAt || now,
            q.version !== undefined ? q.version : 1,
            q.deletedAt || null
          ]
        );
      }
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertQuestions error:', err);
    return false;
  }
}

export async function updateQuestion(id: string, partial: Partial<Question>): Promise<boolean> {
  try {
    const current = await getQuestionById(id);
    if (!current) return false;
    const merged: Question = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertQuestion(merged);
  } catch (err) {
    console.error('[SQLite] updateQuestion error:', err);
    return false;
  }
}

export async function deleteQuestion(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM questions WHERE id = ?;', [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteQuestion error:', err);
    return false;
  }
}

export async function deleteQuestions(ids: string[]): Promise<boolean> {
  if (!ids || ids.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.run(`DELETE FROM questions WHERE id IN (${placeholders});`, ids);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteQuestions error:', err);
    return false;
  }
}

export async function clearQuestions(): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM questions;');
    return true;
  } catch (err) {
    console.error('[SQLite] clearQuestions error:', err);
    return false;
  }
}

function mapRowToQuestion(r: any): Question {
  const parseJson = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  return {
    id: r.id,
    text: r.text || '',
    optionA: r.optionA || r.optiona || '',
    optionB: r.optionB || r.optionb || '',
    optionC: r.optionC || r.optionc || '',
    optionD: r.optionD || r.optiond || '',
    correct: r.correct || 'Option A',
    explanation: r.explanation || '',
    category: r.category || '',
    subcategory: r.subcategory || '',
    categories: parseJson(r.categoriesJson || r.categoriesjson, undefined),
    subcategories: parseJson(r.subcategoriesJson || r.subcategoriesjson, undefined),
    csvCategory: r.csvCategory || r.csvcategory || undefined,
    csvSubcategory: r.csvSubcategory || r.csvsubcategory || undefined,
    examCategory: r.examCategory || r.examcategory || undefined,
    examSubcategory: r.examSubcategory || r.examsubcategory || undefined,
    examPath: parseJson(r.examPathJson || r.exampathjson, undefined),
    subjectCategory: r.subjectCategory || r.subjectcategory || undefined,
    subjectSubcategory: r.subjectSubcategory || r.subjectsubcategory || undefined,
    subjectPath: parseJson(r.subjectPathJson || r.subjectpathjson, undefined),
    comments: parseJson(r.commentsJson || r.commentsjson, undefined),
    userExplanations: parseJson(r.userExplanationsJson || r.userexplanationsjson, undefined),
    createdAt: r.createdAt || r.createdat || undefined,
    date: r.date || undefined,
    updatedAt: r.updatedAt || r.updatedat || undefined,
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

// ==========================================
// 4. COURSES CRUD
// ==========================================

export async function getAllCourses(): Promise<Course[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM courses WHERE (deletedAt IS NULL OR deletedAt = "") ORDER BY createdAt DESC, id DESC;');
    const rows = res?.values || [];
    return rows.map(mapRowToCourse);
  } catch (err) {
    console.error('[SQLite] getAllCourses error:', err);
    return [];
  }
}

export async function getCourseById(id: string): Promise<Course | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM courses WHERE id = ? AND (deletedAt IS NULL OR deletedAt = "");', [id]);
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToCourse(row);
  } catch (err) {
    console.error('[SQLite] getCourseById error:', err);
    return null;
  }
}

export async function getCoursesByStatus(status: 'active' | 'upcoming' | 'completed'): Promise<Course[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query('SELECT * FROM courses WHERE status = ? AND (deletedAt IS NULL OR deletedAt = "");', [status]);
    const rows = res?.values || [];
    return rows.map(mapRowToCourse);
  } catch (err) {
    console.error('[SQLite] getCoursesByStatus error:', err);
    return [];
  }
}

export async function insertCourse(course: Course): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO courses (
        id, title, description, status, category, startDate, endDate, price, originalPrice, couponsJson, createdAt, updatedAt, version, deletedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        course.id,
        course.title || '',
        course.description || '',
        course.status || 'active',
        course.category || '',
        course.startDate || '',
        course.endDate || '',
        course.price !== undefined ? course.price : 0,
        course.originalPrice !== undefined ? course.originalPrice : 0,
        JSON.stringify(course.coupons || []),
        course.createdAt || now,
        course.updatedAt || now,
        course.version !== undefined ? course.version : 1,
        course.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertCourse error:', err);
    return false;
  }
}

export async function insertCourses(courses: Course[]): Promise<boolean> {
  if (!courses || courses.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    for (const course of courses) {
      await db.run(
        `INSERT OR REPLACE INTO courses (
          id, title, description, status, category, startDate, endDate, price, originalPrice, couponsJson, createdAt, updatedAt, version, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          course.id,
          course.title || '',
          course.description || '',
          course.status || 'active',
          course.category || '',
          course.startDate || '',
          course.endDate || '',
          course.price !== undefined ? course.price : 0,
          course.originalPrice !== undefined ? course.originalPrice : 0,
          JSON.stringify(course.coupons || []),
          course.createdAt || now,
          course.updatedAt || now,
          course.version !== undefined ? course.version : 1,
          course.deletedAt || null
        ]
      );
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertCourses error:', err);
    return false;
  }
}

export async function updateCourse(id: string, partial: Partial<Course>): Promise<boolean> {
  try {
    const current = await getCourseById(id);
    if (!current) return false;
    const merged: Course = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertCourse(merged);
  } catch (err) {
    console.error('[SQLite] updateCourse error:', err);
    return false;
  }
}

export async function deleteCourse(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM courses WHERE id = ?;', [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteCourse error:', err);
    return false;
  }
}

export async function clearCourses(): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM courses;');
    return true;
  } catch (err) {
    console.error('[SQLite] clearCourses error:', err);
    return false;
  }
}

function mapRowToCourse(r: any): Course {
  let coupons: any[] = [];
  try {
    if (r.couponsJson || r.couponsjson) {
      coupons = JSON.parse(r.couponsJson || r.couponsjson);
    }
  } catch {}

  return {
    id: r.id,
    title: r.title || '',
    description: r.description || '',
    status: r.status || 'active',
    category: r.category || undefined,
    startDate: r.startDate || r.startdate || undefined,
    endDate: r.endDate || r.enddate || undefined,
    price: r.price !== undefined && r.price !== null ? Number(r.price) : undefined,
    originalPrice: r.originalPrice !== undefined && r.originalPrice !== null ? Number(r.originalPrice) : undefined,
    coupons: coupons.length > 0 ? coupons : undefined,
    createdAt: r.createdAt || r.createdat || new Date().toISOString(),
    updatedAt: r.updatedAt || r.updatedat || undefined,
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

// ==========================================
// 5. EXAMS (LIVE EXAMS & ROUTINES) CRUD
// ==========================================

export async function getAllLiveExams(): Promise<LiveExam[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query("SELECT * FROM exams WHERE type = 'live' AND (deletedAt IS NULL OR deletedAt = '') ORDER BY startTime DESC, id DESC;");
    const rows = res?.values || [];
    return rows.map(mapRowToLiveExam);
  } catch (err) {
    console.error('[SQLite] getAllLiveExams error:', err);
    return [];
  }
}

export async function getLiveExamById(id: string): Promise<LiveExam | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query("SELECT * FROM exams WHERE id = ? AND type = 'live' AND (deletedAt IS NULL OR deletedAt = '');", [id]);
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToLiveExam(row);
  } catch (err) {
    console.error('[SQLite] getLiveExamById error:', err);
    return null;
  }
}

export async function insertLiveExam(exam: LiveExam): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO exams (
        id, title, type, qLimit, timeLimit, category, startTime, expiryTime,
        totalMarks, passMarks, questionSelection, questionIdsJson,
        routineId, courseId, courseName, selectedCategoriesJson,
        selectedSubcategoriesJson, selectedLeafCategoriesJson,
        createdAt, updatedAt, version, deletedAt
      ) VALUES (?, ?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        exam.id,
        exam.title || '',
        exam.qLimit || 0,
        exam.timeLimit || 0,
        exam.category || 'ALL',
        exam.startTime || '',
        exam.expiryTime || '',
        exam.totalMarks || 0,
        exam.passMarks || 0,
        exam.questionSelection || 'auto',
        JSON.stringify(exam.questionIds || []),
        exam.routineId || '',
        exam.courseId || '',
        exam.courseName || '',
        JSON.stringify(exam.selectedCategories || []),
        JSON.stringify(exam.selectedSubcategories || []),
        JSON.stringify(exam.selectedLeafCategories || []),
        exam.createdAt || now,
        exam.updatedAt || now,
        exam.version !== undefined ? exam.version : 1,
        exam.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertLiveExam error:', err);
    return false;
  }
}

export async function insertLiveExams(exams: LiveExam[]): Promise<boolean> {
  if (!exams || exams.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    for (const exam of exams) {
      await db.run(
        `INSERT OR REPLACE INTO exams (
          id, title, type, qLimit, timeLimit, category, startTime, expiryTime,
          totalMarks, passMarks, questionSelection, questionIdsJson,
          routineId, courseId, courseName, selectedCategoriesJson,
          selectedSubcategoriesJson, selectedLeafCategoriesJson,
          createdAt, updatedAt, version, deletedAt
        ) VALUES (?, ?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          exam.id,
          exam.title || '',
          exam.qLimit || 0,
          exam.timeLimit || 0,
          exam.category || 'ALL',
          exam.startTime || '',
          exam.expiryTime || '',
          exam.totalMarks || 0,
          exam.passMarks || 0,
          exam.questionSelection || 'auto',
          JSON.stringify(exam.questionIds || []),
          exam.routineId || '',
          exam.courseId || '',
          exam.courseName || '',
          JSON.stringify(exam.selectedCategories || []),
          JSON.stringify(exam.selectedSubcategories || []),
          JSON.stringify(exam.selectedLeafCategories || []),
          exam.createdAt || now,
          exam.updatedAt || now,
          exam.version !== undefined ? exam.version : 1,
          exam.deletedAt || null
        ]
      );
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertLiveExams error:', err);
    return false;
  }
}

export async function updateLiveExam(id: string, partial: Partial<LiveExam>): Promise<boolean> {
  try {
    const current = await getLiveExamById(id);
    if (!current) return false;
    const merged: LiveExam = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertLiveExam(merged);
  } catch (err) {
    console.error('[SQLite] updateLiveExam error:', err);
    return false;
  }
}

export async function deleteLiveExam(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run("DELETE FROM exams WHERE id = ? AND type = 'live';", [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteLiveExam error:', err);
    return false;
  }
}

// ------------------------------------------
// Routines CRUD
// ------------------------------------------

export async function getAllRoutines(): Promise<Routine[]> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query("SELECT * FROM exams WHERE type = 'routine' AND (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC, id DESC;");
    const rows = res?.values || [];
    return rows.map(mapRowToRoutine);
  } catch (err) {
    console.error('[SQLite] getAllRoutines error:', err);
    return [];
  }
}

export async function getRoutineById(id: string): Promise<Routine | null> {
  try {
    const db = await getSQLiteDatabase();
    const res = await db.query("SELECT * FROM exams WHERE id = ? AND type = 'routine' AND (deletedAt IS NULL OR deletedAt = '');", [id]);
    const row = res?.values?.[0];
    if (!row) return null;
    return mapRowToRoutine(row);
  } catch (err) {
    console.error('[SQLite] getRoutineById error:', err);
    return null;
  }
}

export async function insertRoutine(routine: Routine): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    await db.run(
      `INSERT OR REPLACE INTO exams (
        id, title, type, details, courseId, courseName,
        selectedCategoriesJson, selectedSubcategoriesJson, selectedLeafCategoriesJson,
        examConfigJson, examDate, createdAt, updatedAt, version, deletedAt
      ) VALUES (?, ?, 'routine', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        routine.id,
        routine.title || '',
        routine.details || '',
        routine.courseId || '',
        routine.courseName || '',
        JSON.stringify(routine.selectedCategories || []),
        JSON.stringify(routine.selectedSubcategories || []),
        JSON.stringify(routine.selectedLeafCategories || []),
        JSON.stringify(routine.examConfig || null),
        routine.examDate || '',
        routine.createdAt || now,
        routine.updatedAt || now,
        routine.version !== undefined ? routine.version : 1,
        routine.deletedAt || null
      ]
    );
    return true;
  } catch (err) {
    console.error('[SQLite] insertRoutine error:', err);
    return false;
  }
}

export async function insertRoutines(routines: Routine[]): Promise<boolean> {
  if (!routines || routines.length === 0) return true;
  try {
    const db = await getSQLiteDatabase();
    const now = new Date().toISOString();
    for (const routine of routines) {
      await db.run(
        `INSERT OR REPLACE INTO exams (
          id, title, type, details, courseId, courseName,
          selectedCategoriesJson, selectedSubcategoriesJson, selectedLeafCategoriesJson,
          examConfigJson, examDate, createdAt, updatedAt, version, deletedAt
        ) VALUES (?, ?, 'routine', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          routine.id,
          routine.title || '',
          routine.details || '',
          routine.courseId || '',
          routine.courseName || '',
          JSON.stringify(routine.selectedCategories || []),
          JSON.stringify(routine.selectedSubcategories || []),
          JSON.stringify(routine.selectedLeafCategories || []),
          JSON.stringify(routine.examConfig || null),
          routine.examDate || '',
          routine.createdAt || now,
          routine.updatedAt || now,
          routine.version !== undefined ? routine.version : 1,
          routine.deletedAt || null
        ]
      );
    }
    return true;
  } catch (err) {
    console.error('[SQLite] insertRoutines error:', err);
    return false;
  }
}

export async function updateRoutine(id: string, partial: Partial<Routine>): Promise<boolean> {
  try {
    const current = await getRoutineById(id);
    if (!current) return false;
    const merged: Routine = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    return insertRoutine(merged);
  } catch (err) {
    console.error('[SQLite] updateRoutine error:', err);
    return false;
  }
}

export async function deleteRoutine(id: string): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run("DELETE FROM exams WHERE id = ? AND type = 'routine';", [id]);
    return true;
  } catch (err) {
    console.error('[SQLite] deleteRoutine error:', err);
    return false;
  }
}

export async function clearExams(): Promise<boolean> {
  try {
    const db = await getSQLiteDatabase();
    await db.run('DELETE FROM exams;');
    return true;
  } catch (err) {
    console.error('[SQLite] clearExams error:', err);
    return false;
  }
}

function mapRowToLiveExam(r: any): LiveExam {
  const parseJson = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  return {
    id: r.id,
    title: r.title || '',
    qLimit: Number(r.qLimit || r.qlimit || 0),
    timeLimit: Number(r.timeLimit || r.timelimit || 0),
    category: r.category || 'ALL',
    startTime: r.startTime || r.starttime || '',
    expiryTime: r.expiryTime || r.expirytime || '',
    createdAt: r.createdAt || r.createdat || new Date().toISOString(),
    updatedAt: r.updatedAt || r.updatedat || undefined,
    questionIds: parseJson(r.questionIdsJson || r.questionidsjson, undefined),
    routineId: r.routineId || r.routineid || undefined,
    courseId: r.courseId || r.courseid || undefined,
    courseName: r.courseName || r.coursename || undefined,
    selectedCategories: parseJson(r.selectedCategoriesJson || r.selectedcategoriesjson, undefined),
    selectedSubcategories: parseJson(r.selectedSubcategoriesJson || r.selectedsubcategoriesjson, undefined),
    selectedLeafCategories: parseJson(r.selectedLeafCategoriesJson || r.selectedleafcategoriesjson, undefined),
    totalMarks: r.totalMarks !== undefined ? Number(r.totalMarks || r.totalmarks) : undefined,
    passMarks: r.passMarks !== undefined ? Number(r.passMarks || r.passmarks) : undefined,
    questionSelection: (r.questionSelection || r.questionselection) as ('auto' | 'manual' | undefined),
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

function mapRowToRoutine(r: any): Routine {
  const parseJson = (val: any, fallback: any) => {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  };

  return {
    id: r.id,
    title: r.title || '',
    details: r.details || '',
    createdAt: r.createdAt || r.createdat || new Date().toISOString(),
    updatedAt: r.updatedAt || r.updatedat || undefined,
    courseId: r.courseId || r.courseid || undefined,
    courseName: r.courseName || r.coursename || undefined,
    selectedCategories: parseJson(r.selectedCategoriesJson || r.selectedcategoriesjson, undefined),
    selectedSubcategories: parseJson(r.selectedSubcategoriesJson || r.selectedsubcategoriesjson, undefined),
    selectedLeafCategories: parseJson(r.selectedLeafCategoriesJson || r.selectedleafcategoriesjson, undefined),
    examConfig: parseJson(r.examConfigJson || r.examconfigjson, undefined),
    examDate: r.examDate || r.examdate || undefined,
    version: r.version !== undefined ? Number(r.version) : 1,
    deletedAt: r.deletedAt || r.deletedat || null
  };
}

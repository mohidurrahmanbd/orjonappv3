import sqlite3
import os
import json
import shutil
import urllib.request
import urllib.error
import datetime

# Public Firestore Config (No private secrets or service account keys)
API_KEY = "AIzaSyDXwoEuyzm8FG0vG9VfpgfkBEbT4whs3Mg"
PROJECT_ID = "orjonapp"
BASE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents"

# Target output paths expected by Mobile APK and Vite build
db_paths = [
    'public/assets/databases/questions.db',
    'public/questions.db',
    'assets/databases/questions.db',
    'assets/questions.db'
]

# Ensure output directories exist
for p in db_paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)

# Also check for Android native assets directory if present
android_asset_dirs = [
    'android/app/src/main/assets/public/assets/databases',
    'android/app/src/main/assets/databases'
]
for ad in android_asset_dirs:
    if os.path.exists(os.path.dirname(os.path.dirname(ad))):
        os.makedirs(ad, exist_ok=True)
        db_paths.append(os.path.join(ad, 'questions.db'))

def decode_val(val):
    if not isinstance(val, dict):
        return val
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        return int(val["integerValue"])
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return val["booleanValue"]
    if "timestampValue" in val:
        return val["timestampValue"]
    if "nullValue" in val:
        return None
    if "arrayValue" in val:
        return [decode_val(x) for x in val["arrayValue"].get("values", [])]
    if "mapValue" in val:
        return {k: decode_val(v) for k, v in val["mapValue"].get("fields", {}).items()}
    return None

def decode_doc(doc_obj):
    res = {}
    fields = doc_obj.get("fields", {})
    for k, v in fields.items():
        res[k] = decode_val(v)
    name = doc_obj.get("name", "")
    doc_id = name.split("/")[-1] if name else ""
    if "id" not in res or not res["id"]:
        res["id"] = doc_id
    return res

def fetch_firestore_collection(col_name):
    docs = []
    page_token = ""
    print(f"📡 Fetching live public '{col_name}' from Firestore...")
    while True:
        url = f"{BASE_URL}/{col_name}?key={API_KEY}&pageSize=300"
        if page_token:
            url += f"&pageToken={page_token}"
        req = urllib.request.Request(url, headers={"User-Agent": "OrjonAPKBuildScript/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for d in data.get("documents", []):
                    decoded = decode_doc(d)
                    docs.append(decoded)
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
        except Exception as e:
            print(f"⚠️ Notice while fetching '{col_name}': {e}")
            break
    print(f"   Fetched {len(docs)} documents for '{col_name}'.")
    return docs

def fetch_meta_versions():
    print("📡 Fetching 'meta/versions' from Firestore...")
    url = f"{BASE_URL}/meta/versions?key={API_KEY}"
    req = urllib.request.Request(url, headers={"User-Agent": "OrjonAPKBuildScript/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            decoded = decode_doc(data)
            print(f"   Firestore baseline versions: {decoded}")
            return {
                "categoryVersion": int(decoded.get("categoryVersion", 1)),
                "subcategoryVersion": int(decoded.get("subcategoryVersion", 1)),
                "questionVersion": int(decoded.get("questionVersion", 1))
            }
    except Exception as e:
        print(f"⚠️ Notice while fetching meta/versions (using defaults): {e}")
        return {
            "categoryVersion": 1,
            "subcategoryVersion": 1,
            "questionVersion": 1
        }

def generate_database():
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # 1. Fetch live public data from Firestore
    versions = fetch_meta_versions()
    raw_cats = fetch_firestore_collection("categories")
    raw_subs = fetch_firestore_collection("subcategories")
    raw_qs = fetch_firestore_collection("questions")

    # 2. Filter out soft-deleted / tombstoned items
    active_cats = [c for c in raw_cats if not c.get("isDeleted") and not c.get("deletedAt")]
    active_subs = [s for s in raw_subs if not s.get("isDeleted") and not s.get("deletedAt")]
    active_qs = [q for q in raw_qs if not q.get("isDeleted") and not q.get("deletedAt")]

    print(f"📊 Active records to bundle:")
    print(f"   - Categories: {len(active_cats)} (baseline v{versions['categoryVersion']})")
    print(f"   - Subcategories: {len(active_subs)} (baseline v{versions['subcategoryVersion']})")
    print(f"   - Questions: {len(active_qs)} (baseline v{versions['questionVersion']})")
    print(f"   - Courses: 0 (on-demand only, excluded from APK bundle)")
    print(f"   - Routines & Live Exams: 0 (on-demand only, excluded from APK bundle)")

    primary_db_path = 'public/assets/databases/questions.db'
    if os.path.exists(primary_db_path):
        try:
            os.remove(primary_db_path)
        except Exception:
            pass

    conn = sqlite3.connect(primary_db_path)
    cursor = conn.cursor()

    # 3. Create exact SQLite Schema (matching src/shared/lib/sqlite/schema.ts)
    cursor.executescript('''
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

    -- 4. Courses Table (Empty in bundle, on-demand sync)
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

    -- 5. Exams Table (Empty in bundle, on-demand sync)
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
      updatedAt TEXT,
      version INTEGER DEFAULT 1,
      deletedAt TEXT
    );

    -- 6. Sync Metadata Table (stores baseline versions)
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    -- Indices
    CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
    CREATE INDEX IF NOT EXISTS idx_questions_subcategory ON questions(subcategory);
    CREATE INDEX IF NOT EXISTS idx_questions_date ON questions(date);
    CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version);
    CREATE INDEX IF NOT EXISTS idx_subcategories_parent ON subcategories(parentCategory);
    CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
    CREATE INDEX IF NOT EXISTS idx_exams_type ON exams(type);
    CREATE INDEX IF NOT EXISTS idx_exams_startTime ON exams(startTime);
    ''')

    # 4. Insert Categories
    cat_rows = []
    for c in active_cats:
        c_id = str(c.get("id") or "")
        name = str(c.get("name") or "")
        sub_heading = c.get("subHeading")
        created_at = str(c.get("createdAt") or now_iso)
        updated_at = str(c.get("updatedAt") or now_iso)
        ver = int(c.get("version") or versions["categoryVersion"])
        cat_rows.append((c_id, name, sub_heading, created_at, updated_at, ver, None))

    cursor.executemany('''
    INSERT OR REPLACE INTO categories (id, name, subHeading, createdAt, updatedAt, version, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', cat_rows)

    # 5. Insert Subcategories
    sub_rows = []
    for s in active_subs:
        s_id = str(s.get("id") or "")
        name = str(s.get("name") or "")
        parent_cat = str(s.get("parentCategory") or "")
        parent_cat_id = s.get("parentCategoryId")
        date_val = s.get("date")
        sub_heading = s.get("subHeading")
        text_val = s.get("text")
        details_val = s.get("details")
        created_at = str(s.get("createdAt") or now_iso)
        updated_at = str(s.get("updatedAt") or now_iso)
        ver = int(s.get("version") or versions["subcategoryVersion"])
        sub_rows.append((
            s_id, name, parent_cat, parent_cat_id, date_val, sub_heading,
            text_val, details_val, created_at, updated_at, ver, None
        ))

    cursor.executemany('''
    INSERT OR REPLACE INTO subcategories (
      id, name, parentCategory, parentCategoryId, date, subHeading,
      text, details, createdAt, updatedAt, version, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', sub_rows)

    # 6. Insert Questions
    q_rows = []
    for q in active_qs:
        q_id = str(q.get("id") or "")
        text_val = str(q.get("text") or "")
        opt_a = str(q.get("optionA") or "")
        opt_b = str(q.get("optionB") or "")
        opt_c = str(q.get("optionC") or "")
        opt_d = str(q.get("optionD") or "")
        correct = str(q.get("correct") or "Option A")
        explanation = q.get("explanation")
        cat = str(q.get("category") or "")
        subcat = str(q.get("subcategory") or "")

        def to_json_str(field_val):
            if isinstance(field_val, list):
                return json.dumps(field_val)
            if isinstance(field_val, str) and field_val.strip().startswith("["):
                return field_val
            return json.dumps([])

        cats_json = to_json_str(q.get("categories"))
        subs_json = to_json_str(q.get("subcategories"))
        csv_cat = q.get("csvCategory") or ""
        csv_subcat = q.get("csvSubcategory") or ""
        exam_cat = q.get("examCategory") or ""
        exam_subcat = q.get("examSubcategory") or ""
        exam_path_json = to_json_str(q.get("examPath"))
        subj_cat = q.get("subjectCategory") or ""
        subj_subcat = q.get("subjectSubcategory") or ""
        subj_path_json = to_json_str(q.get("subjectPath"))
        comments_json = to_json_str(q.get("comments"))
        user_expl_json = to_json_str(q.get("userExplanations"))

        created_at = str(q.get("createdAt") or now_iso)
        date_val = str(q.get("date") or "")
        updated_at = str(q.get("updatedAt") or now_iso)
        ver = int(q.get("version") or versions["questionVersion"])

        q_rows.append((
            q_id, text_val, opt_a, opt_b, opt_c, opt_d, correct, explanation,
            cat, subcat, cats_json, subs_json,
            csv_cat, csv_subcat, exam_cat, exam_subcat,
            exam_path_json, subj_cat, subj_subcat, subj_path_json,
            comments_json, user_expl_json, created_at, date_val, updated_at,
            ver, None
        ))

    cursor.executemany('''
    INSERT OR REPLACE INTO questions (
      id, text, optionA, optionB, optionC, optionD, correct, explanation,
      category, subcategory, categoriesJson, subcategoriesJson,
      csvCategory, csvSubcategory, examCategory, examSubcategory,
      examPathJson, subjectCategory, subjectSubcategory, subjectPathJson,
      commentsJson, userExplanationsJson, createdAt, date, updatedAt,
      version, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', q_rows)

    # 7. Insert Baseline Versions into sync_meta
    cursor.executemany('''
    INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)
    ''', [
        ('categoryVersion', str(versions["categoryVersion"])),
        ('subcategoryVersion', str(versions["subcategoryVersion"])),
        ('questionVersion', str(versions["questionVersion"])),
        ('updatedAt', now_iso)
    ])

    conn.commit()
    conn.close()

    # 8. Copy to all required asset locations
    for p in db_paths:
        if p != primary_db_path:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            shutil.copyfile(primary_db_path, p)

    print('✅ Bundled SQLite database generated successfully from live Firestore data.')
    print('📦 Output locations:')
    for p in db_paths:
        if os.path.exists(p):
            print(f'   - {p} ({os.path.getsize(p)} bytes)')

if __name__ == '__main__':
    generate_database()

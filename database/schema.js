import { openDatabaseAsync } from 'expo-sqlite';

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDatabaseAsync('attendance.db');
  await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
  await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  await initSchema(dbInstance);
  return dbInstance;
}

async function initSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course TEXT NOT NULL,
      subject_code TEXT NOT NULL,
      schedule_code TEXT NOT NULL,
      UNIQUE(subject_code, schedule_code)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      section_name TEXT NOT NULL,
      UNIQUE(subject_id, section_name)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,                -- Student Number, e.g. 202403189
      full_name TEXT NOT NULL,
      psk BLOB NOT NULL                   -- 256-bit (32 byte) PSK, generated at import
    );

    CREATE TABLE IF NOT EXISTS section_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      UNIQUE(student_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
      session_date TEXT NOT NULL,         -- ISO date
      status TEXT NOT NULL CHECK(status IN ('Active','Cancelled','Event')) DEFAULT 'Active',
      remarks TEXT,
      started_at INTEGER,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present','Late','Absent','Excused')),
      UNIQUE(student_id, session_id)
    );

    CREATE INDEX IF NOT EXISTS idx_logs_session ON attendance_logs(session_id);
    CREATE INDEX IF NOT EXISTS idx_enroll_section ON section_enrollments(section_id);
  `);
}

export async function wipeLibrary() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS attendance_logs;
    DROP TABLE IF EXISTS class_sessions;
    DROP TABLE IF EXISTS section_enrollments;
    DROP TABLE IF EXISTS students;
    DROP TABLE IF EXISTS sections;
    DROP TABLE IF EXISTS subjects;
    PRAGMA foreign_keys = ON;
  `);
  await initSchema(db);
}
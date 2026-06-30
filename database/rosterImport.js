import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';
import * as FileSystem from 'expo-file-system';
import { randomBytes } from '@noble/hashes/utils';
import { getDb } from './schema';
import { parseScheduleWindow } from '../utils/scheduleTime';

// Expected CSV columns: Course, Subject Code, Schedule Code, Section, Student Name, Student Number
export async function importRosterFromCsv() {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled || !picked.assets?.length) {
    return { imported: 0, skipped: 0 };
  }

  const csvText = await FileSystem.readAsStringAsync(picked.assets[0].uri);
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  if (parsed.errors.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const db = await getDb();
  let imported = 0;
  let skipped = 0;

  await db.withTransactionAsync(async () => {
    for (const row of parsed.data) {
      const course = (row['Course'] || '').trim();
      const subjectCode = (row['Subject Code'] || '').trim();
      const scheduleCode = (row['Schedule Code'] || '').trim();
      const sectionName = (row['Section'] || '').trim();
      const studentName = (row['Student Name'] || '').trim();
      const studentNumber = (row['Student Number'] || '').trim();

      if (!subjectCode || !sectionName || !studentNumber) {
        skipped++;
        continue;
      }

      await db.runAsync(
        `INSERT INTO subjects (course, subject_code, schedule_code)
         VALUES (?, ?, ?)
         ON CONFLICT(subject_code, schedule_code) DO NOTHING;`,
        [course, subjectCode, scheduleCode]
      );

      const subjectRow = await db.getFirstAsync(
        `SELECT id FROM subjects WHERE subject_code = ? AND schedule_code = ?`,
        [subjectCode, scheduleCode]
      );
      const { startTime, endTime } = parseScheduleWindow(scheduleCode);

      await db.runAsync(
        `INSERT INTO sections (subject_id, section_name, start_time, end_time)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(subject_id, section_name) DO UPDATE SET start_time = excluded.start_time, end_time = excluded.end_time;`,
        [subjectRow.id, sectionName, startTime, endTime]
      );

      const sectionRow = await db.getFirstAsync(
        `SELECT id FROM sections WHERE subject_id = ? AND section_name = ?`,
        [subjectRow.id, sectionName]
      );

      const existingStudent = await db.getFirstAsync(
        `SELECT id FROM students WHERE id = ?`,
        [studentNumber]
      );

      if (!existingStudent) {
        const psk = randomBytes(32); // 256-bit PSK, generated once per student
        await db.runAsync(
          `INSERT INTO students (id, full_name, psk) VALUES (?, ?, ?);`,
          [studentNumber, studentName, psk]
        );
      }

      await db.runAsync(
        `INSERT INTO section_enrollments (student_id, section_id)
         VALUES (?, ?)
         ON CONFLICT(student_id, section_id) DO NOTHING;`,
        [studentNumber, sectionRow.id]
      );

      imported++;
    }
  });

  return { imported, skipped };
}
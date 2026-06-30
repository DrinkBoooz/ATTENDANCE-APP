import { getDb } from '../database/schema';

export async function startSession(sectionId, sessionDate) {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO class_sessions (section_id, session_date, status, started_at)
     VALUES (?, ?, 'Active', ?);`,
    [sectionId, sessionDate, Math.floor(Date.now() / 1000)]
  );
  return result.lastInsertRowId;
}

/**
 * Ends a session and, in a single INSERT...SELECT transaction, marks every
 * enrolled student who has no attendance_logs row for this session as 'Absent'.
 */
export async function endSession(sessionId) {
  const db = await getDb();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE class_sessions SET ended_at = ? WHERE id = ?;`,
        [Math.floor(Date.now() / 1000), sessionId]
      );

      await db.runAsync(
        `INSERT INTO attendance_logs (student_id, session_id, timestamp, status)
         SELECT se.student_id, ?, ?, 'Absent'
         FROM section_enrollments se
         JOIN class_sessions cs ON cs.section_id = se.section_id
         WHERE cs.id = ?
           AND se.student_id NOT IN (
             SELECT student_id FROM attendance_logs WHERE session_id = ?
           );`,
        [sessionId, Math.floor(Date.now() / 1000), sessionId, sessionId]
      );
    });
  } catch (err) {
    throw new Error(`Auto-absent sweep failed: ${err.message}`);
  }
}
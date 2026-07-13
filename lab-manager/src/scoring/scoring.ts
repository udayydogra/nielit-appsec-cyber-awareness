// Server-side scoring. Client submits ANSWERS; server grades against a held key
// (quiz_keys, never sent to client). {"score":100} from the client is meaningless.
import { query, one } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

export interface GradeResult {
  score: number;
  maxScore: number;
  correct: Record<string, boolean>;
  passed: boolean;
}

const PASS_RATIO = 0.7;

export async function gradeQuiz(
  userId: string,
  labId: string,
  answers: Record<string, string>,
): Promise<GradeResult> {
  const keyRows = await query<{ question_id: string; correct: unknown; points: number }>(
    `SELECT question_id, correct, points FROM quiz_keys WHERE lab_id = $1`,
    [labId],
  );
  if (keyRows.rows.length === 0) {
    return { score: 0, maxScore: 0, correct: {}, passed: false };
  }

  let score = 0;
  let maxScore = 0;
  const correct: Record<string, boolean> = {};

  for (const row of keyRows.rows) {
    maxScore += row.points;
    const expected = row.correct; // JSONB: string or array
    const given = answers[row.question_id];
    const isCorrect = Array.isArray(expected)
      ? expected.includes(given)
      : expected === given;
    correct[row.question_id] = isCorrect;
    if (isCorrect) score += row.points;

    await emit({
      userId,
      labId,
      type: 'quiz_answered',
      payload: { questionId: row.question_id, correct: isCorrect },
      outcome: isCorrect ? 'success' : 'fail',
    });
  }

  await query(
    `INSERT INTO scores (user_id, lab_id, score, max_score, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, lab_id)
     DO UPDATE SET score = GREATEST(scores.score, EXCLUDED.score),
                   max_score = EXCLUDED.max_score, updated_at = now()`,
    [userId, labId, score, maxScore],
  );

  return { score, maxScore, correct, passed: maxScore > 0 && score / maxScore >= PASS_RATIO };
}

export async function getScore(userId: string, labId: string) {
  return one<{ score: number; max_score: number }>(
    `SELECT score, max_score FROM scores WHERE user_id = $1 AND lab_id = $2`,
    [userId, labId],
  );
}

import { useState } from 'react';
import { api, type LocalizedString } from '../api/client';
import { L, useLang, useT } from '../i18n';

export interface QuizQuestion {
  id: string;
  prompt: LocalizedString;
  choices: { id: string; label: LocalizedString }[];
}

// Client submits ANSWERS only; the server grades against a held key and, on a pass,
// re-verifies and issues an HMAC-signed certificate. {score:100} from here is meaningless.
export function Quiz({ labId, questions }: { labId: string; questions: QuizQuestion[] }) {
  const { locale } = useLang();
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.quiz>> | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try { setResult(await api.quiz(labId, answers)); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h2>{t('quiz')}</h2>
      {questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 600 }}>{L(q.prompt, locale)}</p>
          {q.choices.map((c) => {
            const chosen = answers[q.id] === c.id;
            const graded = result?.correct[q.id];
            const showState = result && chosen;
            return (
              <label key={c.id} className="row" style={{ marginBottom: 6, cursor: 'pointer' }}>
                <input
                  type="radio" name={q.id} checked={chosen} style={{ width: 'auto' }}
                  disabled={!!result}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                />
                <span className={showState ? (graded ? 'result-good' : 'result-bad') : ''}>
                  {L(c.label, locale)}
                </span>
              </label>
            );
          })}
        </div>
      ))}
      {!result && (
        <button className="primary" disabled={busy || Object.keys(answers).length < questions.length} onClick={submit}>
          {t('submit')}
        </button>
      )}
      {result && (
        <div className={result.passed ? 'result-good' : 'result-bad'} style={{ marginTop: 8 }}>
          <strong>{result.passed ? t('passed') : t('failed')}</strong>
          <span className="muted"> — {result.score}/{result.maxScore}</span>
          {result.certificate && (
            <div className="muted" style={{ marginTop: 6 }}>
              <a href={`/verify/${result.certificate.id}`} target="_blank" rel="noreferrer">
                {t('verifyCert')} →
              </a>
            </div>
          )}
          {!result.passed && (
            <div><button style={{ marginTop: 8 }} onClick={() => setResult(null)}>{t('back')}</button></div>
          )}
        </div>
      )}
    </div>
  );
}

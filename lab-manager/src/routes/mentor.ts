// Mentor route — SSE stream. The widget talks to THIS backend, never the model
// host directly. The backend enforces the queue, injects context, fences untrusted
// input, and rate-limits. Locale comes from the session user (perfect Hindi via
// the pre-authored path).
import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../authz/requirePermission.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ah } from '../middleware/asyncHandler.js';
import { mentorService } from '../mentor/MentorService.js';
import { emit } from '../telemetry/pipeline.js';
import { config } from '../config.js';

export const mentorRouter = Router();

mentorRouter.get('/provider', requireAuth, (_req, res) => {
  res.json({ provider: mentorService.providerName });
});

mentorRouter.post(
  '/ask',
  requireAuth,
  requirePermission('mentor:chat'),
  rateLimit('mentor', config.rateLimits.mentorPerMin),
  ah(async (req, res) => {
    const { labId, question, locale } = req.body ?? {};
    if (typeof labId !== 'string' || typeof question !== 'string') {
      return res.status(400).json({ error: 'labId and question required' });
    }
    // Honour the explicitly requested locale (the UI language toggle); fall back
    // to the user's stored default only when the request doesn't specify one.
    const loc: 'en' | 'hi' = locale === 'hi' ? 'hi' : locale === 'en' ? 'en' : req.user!.locale;

    await emit({ userId: req.user!.id, labId, type: 'hint_requested', outcome: 'neutral' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const token of mentorService.ask(req.user!.id, labId, question, loc)) {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
    } finally {
      res.end();
    }
  }),
);

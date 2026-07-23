// The master content schema (§17) as TypeScript. AppSec manifests and awareness
// scenario graphs share ONE envelope — locale-aware, animation-aware, media-aware.

export interface LocalizedString {
  en: string;
  hi: string;
}

export type Module = 'appsec' | 'awareness';
export type ExecutionTier = 0 | 1 | 2 | 3;

// ── Awareness scenario-graph node types (5 cover every scenario) ──────────────
export type NodeType =
  | 'narration'
  | 'decision'
  | 'consequence'
  | 'feedback'
  | 'checklist';

export interface RedFlag {
  at: number;
  flag: string;
  note?: LocalizedString;
}

export interface Choice {
  label: LocalizedString;
  goto: string;
}

export interface ScenarioNode {
  type: NodeType;
  channel?: 'sms' | 'chat' | 'videocall' | 'payment' | 'email';
  anim?: string;
  content?: LocalizedString;
  prompt?: LocalizedString;
  title?: LocalizedString;
  choices?: Choice[];
  media?: { clip: string; poster?: string };
  redFlags?: RedFlag[];
  outcome?: 'positive' | 'negative' | 'neutral';
  technique?: LocalizedString;
  items?: LocalizedString[];
  next?: string;
}

// ── Quiz (choices only — the correct key is held server-side, never shipped) ──
export interface QuizChoice {
  id: string;
  label: LocalizedString;
}
export interface QuizQuestion {
  id: string;
  prompt: LocalizedString;
  choices: QuizChoice[];
}

// ── AppSec lifecycle sections ─────────────────────────────────────────────────
export interface LifecycleSection {
  id: string;
  type: 'content' | 'objectives' | 'interactive' | 'code';
  title: LocalizedString;
  body?: LocalizedString;
  items?: LocalizedString[];
  hints?: LocalizedString[];
  widget?: string;
  anim?: string;
  language?: string;
  insecure?: string;
  secure?: string;
}

export interface ResourceLink {
  label: LocalizedString;
  value: string;
}

// ── The unified manifest ──────────────────────────────────────────────────────
export interface LabManifest {
  id: string;
  module: Module;
  executionTier: ExecutionTier;
  category: string;
  title: LocalizedString;
  summary: LocalizedString;
  quiz: QuizQuestion[];

  // AppSec-only
  difficultyTiers?: string[];
  owasp?: string[];
  mitre?: string[];
  cves?: string[];
  target?: { kind: string; resetRoute?: string; queryRoute?: string };
  lifecycle?: LifecycleSection[];
  interviewQuestions?: LocalizedString[];

  // Awareness-only
  start?: string;
  nodes?: Record<string, ScenarioNode>;
  reportingResources?: ResourceLink[];
}

// ── Telemetry envelope (the spine — one shape for both modules) ───────────────
export type EventType =
  | 'lab_started'
  | 'exploit_attempt'
  | 'exploit_success'
  | 'decision_made'
  | 'quiz_answered'
  | 'node_completed'
  | 'lab_completed'
  | 'hint_requested';

export interface AuthedUser {
  id: string;
  email: string;
  username?: string | null;
  displayName: string;
  locale: 'en' | 'hi';
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}

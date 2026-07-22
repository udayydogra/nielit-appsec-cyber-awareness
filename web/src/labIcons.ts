// A distinctive, on-theme icon per lab (not a generic terminal/shield). Authored
// modules with no mapping fall back to a sensible per-module default.
import {
  // appsec
  Webhook, Fingerprint, FileKey, ShoppingCart, Cloud, SquareTerminal, MousePointerClick,
  PackageOpen, FileUp, FileSearch, Siren, BrainCircuit, FolderTree, Timer, Radar,
  SearchCode, Cookie, DatabaseZap, Network, Workflow, Braces, FileCode,
  // awareness
  CreditCard, Truck, SprayCan, ScanFace, Gavel, EyeOff, Headset, Briefcase, ScanLine,
  Smartphone, MessageSquareLock, KeyRound, MailWarning, QrCode, AtSign, IndianRupee,
  // fallbacks
  Lock, Terminal, ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

const LAB_ICONS: Record<string, LucideIcon> = {
  // ── AppSec ──
  'api-security': Webhook,
  'auth': Fingerprint,
  'bola': FileKey,
  'business-logic': ShoppingCart,
  'cloud-security': Cloud,
  'command-injection': SquareTerminal,
  'csrf': MousePointerClick,
  'deserialization': PackageOpen,
  'file-upload': FileUp,
  'idor': FileSearch,
  'incident-response': Siren,
  'llm-security': BrainCircuit,
  'path-traversal': FolderTree,
  'race-condition': Timer,
  'recon': Radar,
  'secure-code-review': SearchCode,
  'session': Cookie,
  'sqli': DatabaseZap,
  'ssrf': Network,
  'threat-modeling': Workflow,
  'xss': Braces,
  'xxe': FileCode,
  // ── Awareness ──
  'banking-fraud': CreditCard,
  'courier-customs': Truck,
  'cyber-hygiene': SprayCan,
  'deepfake-ai-scams': ScanFace,
  'digital-arrest': Gavel,
  'digital-privacy': EyeOff,
  'fake-customer-care': Headset,
  'fake-job-offer': Briefcase,
  'kyc-scam': ScanLine,
  'mobile-security': Smartphone,
  'otp-sim-swap': MessageSquareLock,
  'password-security': KeyRound,
  'phishing': MailWarning,
  'qr-scam': QrCode,
  'social-media-safety': AtSign,
  'upi-fraud': IndianRupee,
};

export function labIcon(id: string, module: 'appsec' | 'awareness', tier: number): LucideIcon {
  return LAB_ICONS[id] ?? (module === 'appsec' ? (tier === 3 ? Lock : Terminal) : ShieldAlert);
}

// A themed [from, to] gradient per lab, so each card icon reads like a distinct
// app tile rather than a monochrome library glyph. Colours nod to the topic —
// data=indigo/blue, money=green, danger/scam=red/orange, AI=pink/violet, cloud=sky.
const LAB_GRAD: Record<string, [string, string]> = {
  // ── AppSec ──
  'sqli': ['#4f46e5', '#0ea5e9'],
  'api-security': ['#6366f1', '#8b5cf6'],
  'auth': ['#f59e0b', '#ef4444'],
  'bola': ['#0ea5e9', '#6366f1'],
  'business-logic': ['#f97316', '#f43f5e'],
  'cloud-security': ['#38bdf8', '#2563eb'],
  'command-injection': ['#10b981', '#059669'],
  'csrf': ['#f43f5e', '#f59e0b'],
  'deserialization': ['#8b5cf6', '#6366f1'],
  'file-upload': ['#f59e0b', '#f97316'],
  'idor': ['#06b6d4', '#3b82f6'],
  'incident-response': ['#ef4444', '#f97316'],
  'llm-security': ['#ec4899', '#8b5cf6'],
  'path-traversal': ['#14b8a6', '#0ea5e9'],
  'race-condition': ['#f59e0b', '#eab308'],
  'recon': ['#22c55e', '#14b8a6'],
  'secure-code-review': ['#3b82f6', '#6366f1'],
  'session': ['#f97316', '#ef4444'],
  'ssrf': ['#6366f1', '#0ea5e9'],
  'threat-modeling': ['#0ea5e9', '#8b5cf6'],
  'xss': ['#8b5cf6', '#ec4899'],
  'xxe': ['#14b8a6', '#6366f1'],
  // ── Awareness ──
  'banking-fraud': ['#16a34a', '#22c55e'],
  'courier-customs': ['#f97316', '#f59e0b'],
  'cyber-hygiene': ['#06b6d4', '#22c55e'],
  'deepfake-ai-scams': ['#ec4899', '#8b5cf6'],
  'digital-arrest': ['#dc2626', '#7c3aed'],
  'digital-privacy': ['#0ea5e9', '#14b8a6'],
  'fake-customer-care': ['#f43f5e', '#f97316'],
  'fake-job-offer': ['#f59e0b', '#eab308'],
  'kyc-scam': ['#3b82f6', '#06b6d4'],
  'mobile-security': ['#6366f1', '#22c55e'],
  'otp-sim-swap': ['#f97316', '#ef4444'],
  'password-security': ['#4f46e5', '#7c3aed'],
  'phishing': ['#ef4444', '#f59e0b'],
  'qr-scam': ['#334155', '#0ea5e9'],
  'social-media-safety': ['#3b82f6', '#8b5cf6'],
  'upi-fraud': ['#16a34a', '#84cc16'],
};

export function labGrad(id: string, module: 'appsec' | 'awareness', tier: number): [string, string] {
  return LAB_GRAD[id] ?? (module === 'appsec'
    ? (tier === 3 ? ['#7c3aed', '#4f46e5'] : ['#3b82f6', '#6366f1'])
    : ['#0ea5e9', '#14b8a6']);
}

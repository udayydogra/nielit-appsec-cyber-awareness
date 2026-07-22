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

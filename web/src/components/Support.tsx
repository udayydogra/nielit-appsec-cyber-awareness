import { MapPin, Phone, Mail, Clock, ExternalLink, LifeBuoy } from 'lucide-react';
import { useLang } from '../i18n';

// Official brand marks, inlined as single-path SVGs (no external requests — works
// on the air-gapped VM). Paths from the simple-icons set (CC0). X uses the current
// mark, not the retired Twitter bird.
const BRAND: Record<string, { color: string; path: string }> = {
  facebook: { color: '#1877F2', path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  x: { color: '#000000', path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
  youtube: { color: '#FF0000', path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  linkedin: { color: '#0A66C2', path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  whatsapp: { color: '#25D366', path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' },
};

function BrandIcon({ name, size = 20 }: { name: keyof typeof BRAND | string; size?: number }) {
  const b = BRAND[name];
  if (!b) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={b.color} aria-hidden focusable="false">
      <path d={b.path} />
    </svg>
  );
}

// Support / contact — NIELIT Haridwar centre details (public info from
// nielit.in). Language-neutral facts (address, phones, emails) are shown as-is;
// headings follow the app locale.
const EMAILS: { label: { en: string; hi: string }; addr: string }[] = [
  { label: { en: 'General enquiries', hi: 'सामान्य पूछताछ' }, addr: 'haridwar@nielit.gov.in' },
  { label: { en: 'Director-in-Charge', hi: 'निदेशक प्रभारी' }, addr: 'dir-haridwar@nielit.gov.in' },
  { label: { en: 'Academics', hi: 'शैक्षणिक' }, addr: 'sanyam.rathor@nielit.gov.in' },
  { label: { en: 'Training', hi: 'प्रशिक्षण' }, addr: 'trg.haridwar@nielit.gov.in' },
  { label: { en: 'Examinations', hi: 'परीक्षा' }, addr: 'exam.haridwar@nielit.gov.in' },
  { label: { en: 'Projects', hi: 'परियोजनाएँ' }, addr: 'prj.haridwar@nielit.gov.in' },
  { label: { en: 'Vigilance', hi: 'सतर्कता' }, addr: 'ashish@nielit.gov.in' },
];
const SOCIAL: { key: string; label: string; url: string }[] = [
  { key: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/nielithdw' },
  { key: 'x', label: 'X', url: 'https://x.com/nielithdw' },
  { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/channel/UC66qLwuGEjwc2t-Ek_LSPAw' },
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/nielithdw/' },
];
const ADDRESS = 'NIELIT Haridwar, 2nd Floor, Government Polytechnic Building, Plot No - 6C, Sector - 11, Near Pentagon Mall, SIDCUL, Haridwar, Uttarakhand - 249403';
const MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('NIELIT Haridwar SIDCUL')}`;

export function Support() {
  const { locale } = useLang();
  const hi = locale === 'hi';

  return (
    <div>
      <div className="row" style={{ alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <LifeBuoy size={26} style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontSize: 34, margin: 0 }}>{hi ? 'सहायता एवं संपर्क' : 'Support & Contact'}</h1>
      </div>
      <p className="muted" style={{ margin: '0 0 18px' }}>
        {hi ? 'NIELIT हरिद्वार केंद्र से संपर्क करें।' : 'Reach the NIELIT Haridwar centre for help with this platform, training, or examinations.'}
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ marginTop: 0 }}><MapPin size={17} style={{ verticalAlign: '-3px', color: 'var(--accent)' }} /> {hi ? 'पता' : 'Address'}</h2>
          <p style={{ marginTop: 0, lineHeight: 1.5 }}>{ADDRESS}</p>
          <a href={MAPS} target="_blank" rel="noreferrer" className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13 }}>
            {hi ? 'मानचित्र पर देखें' : 'View on map'} <ExternalLink size={13} />
          </a>
          <h2 style={{ marginBottom: 6 }}><Clock size={16} style={{ verticalAlign: '-3px', color: 'var(--accent)' }} /> {hi ? 'कार्यालय समय' : 'Office hours'}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{hi ? 'सोमवार–शुक्रवार, प्रातः 9:00 – सायं 5:30 (अवकाश को छोड़कर)' : 'Monday – Friday, 9:00 AM – 5:30 PM (except holidays)'}</p>
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ marginTop: 0 }}><Phone size={17} style={{ verticalAlign: '-3px', color: 'var(--accent)' }} /> {hi ? 'फ़ोन' : 'Phone'}</h2>
          <Row label={hi ? 'मुख्य' : 'Main'} value="01334-235617" href="tel:01334235617" />
          <Row label={hi ? 'निदेशक कार्यालय' : "Director's office"} value="01334-235054" href="tel:01334235054" />
          <h2 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}><BrandIcon name="whatsapp" size={18} /> {hi ? 'मोबाइल / व्हाट्सऐप' : 'Mobile / WhatsApp'}</h2>
          <Row label="" value="+91 93683 49990" href="tel:+919368349990" />
          <Row label="" value="+91 81717 10289" href="tel:+918171710289" />
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}><Mail size={17} style={{ verticalAlign: '-3px', color: 'var(--accent)' }} /> {hi ? 'ईमेल निर्देशिका' : 'Email directory'}</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {EMAILS.map((e) => (
            <a key={e.addr} href={`mailto:${e.addr}`} className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none' }}>
              <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{hi ? e.label.hi : e.label.en}</span>
              <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>{e.addr}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{hi ? 'सोशल मीडिया' : 'Follow NIELIT Haridwar'}</h2>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          {SOCIAL.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.label} aria-label={s.label}
              style={{ width: 46, height: 46, borderRadius: 12, background: '#fff', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', boxShadow: '0 1px 2px rgba(2,6,23,.06)' }}>
              <BrandIcon name={s.key} size={22} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
      {label && <span className="muted" style={{ fontSize: 12 }}>{label}</span>}
      <a href={href} style={{ fontWeight: 700, marginLeft: 'auto' }}>{value}</a>
    </div>
  );
}

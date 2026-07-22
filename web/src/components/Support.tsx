import { MapPin, Phone, Mail, Clock, MessageCircle, ExternalLink, LifeBuoy } from 'lucide-react';
import { useLang } from '../i18n';

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
const SOCIAL: { label: string; url: string }[] = [
  { label: 'Facebook', url: 'https://www.facebook.com/nielithdw' },
  { label: 'Twitter / X', url: 'https://twitter.com/nielithdw' },
  { label: 'YouTube', url: 'https://www.youtube.com/channel/UC66qLwuGEjwc2t-Ek_LSPAw' },
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/nielithdw/' },
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
          <h2 style={{ marginBottom: 6 }}><MessageCircle size={16} style={{ verticalAlign: '-3px', color: 'var(--good)' }} /> {hi ? 'मोबाइल / व्हाट्सऐप' : 'Mobile / WhatsApp'}</h2>
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
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {SOCIAL.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="chip" style={{ textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {s.label} <ExternalLink size={12} />
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

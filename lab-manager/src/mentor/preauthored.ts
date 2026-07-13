// Deterministic bilingual explanations. Known beats ("why did this exploit work /
// why is this a scam") serve a pre-authored LocalizedString — instant, correct,
// perfect Hindi, zero model load. The model only ever carries PHRASING, never facts
// (small models hallucinate CVE numbers). Seeded here; extendable from lab files.
import type { LocalizedString } from '../types.js';

interface PreAuthored {
  labId: string;
  key: string; // matched against last-action context or intent
  answer: LocalizedString;
}

const TABLE: PreAuthored[] = [
  {
    labId: 'sqli',
    key: 'auth-bypass',
    answer: {
      en: "You bypassed the login with a tautology. `' OR '1'='1` closes the username string and adds a condition that is always true, so the WHERE clause matches every row. The database can't tell your input apart from the query's own code — because it was concatenated in as text. The fix is a parameterized query, which binds your input as DATA the engine never parses as SQL.",
      hi: "आपने एक टॉटोलॉजी से लॉगिन बायपास किया। `' OR '1'='1` यूज़रनेम स्ट्रिंग बंद करके एक ऐसी शर्त जोड़ता है जो हमेशा सत्य है, इसलिए WHERE हर पंक्ति से मेल खाता है। डेटाबेस आपके इनपुट को क्वेरी के कोड से अलग नहीं पहचान पाता। समाधान पैरामीटराइज़्ड क्वेरी है, जो इनपुट को डेटा के रूप में बांधती है।",
    },
  },
  {
    labId: 'sqli',
    key: 'union',
    answer: {
      en: "Nice — a UNION-based extraction. `UNION SELECT` appends a second result set to the first. It works only when your injected SELECT returns the same number of columns with compatible types as the original query. That's how you pulled `password`/`secret_note` from rows the login was never meant to return. Parameterization kills this too: the `UNION` keyword arrives as data, not syntax.",
      hi: "बढ़िया — एक UNION-आधारित निष्कर्षण। `UNION SELECT` पहले परिणाम में दूसरा जोड़ता है। यह तभी काम करता है जब इंजेक्टेड SELECT में मूल क्वेरी जितने ही कॉलम और संगत प्रकार हों। इसी से आपने वे `password`/`secret_note` निकाले जिन्हें लॉगिन कभी नहीं लौटाता। पैरामीटराइज़ेशन इसे भी रोकता है।",
    },
  },
  {
    labId: 'digital-arrest',
    key: 'negative',
    answer: {
      en: "That was the trap. 'Digital arrest' does not exist in Indian law — no agency arrests you over a video call or asks for money to 'prove innocence'. The pressure to stay on the line and not tell anyone IS the scam. The correct move is always: disconnect, verify independently, and report to 1930 or cybercrime.gov.in.",
      hi: "यही जाल था। भारतीय कानून में 'डिजिटल अरेस्ट' नहीं है — कोई एजेंसी वीडियो कॉल पर गिरफ़्तार नहीं करती और बेगुनाही साबित करने के लिए पैसे नहीं माँगती। कॉल पर बने रहने और किसी को न बताने का दबाव ही ठगी है। सही कदम: कॉल काटें, स्वतंत्र सत्यापन करें, 1930 या cybercrime.gov.in पर रिपोर्ट करें।",
    },
  },
  {
    labId: 'digital-arrest',
    key: 'positive',
    answer: {
      en: "Exactly right. You disconnected and verified independently. Real law enforcement never conducts arrests or collects 'verification' payments over a call. Reporting the number to 1930 / cybercrime.gov.in also helps others.",
      hi: "बिल्कुल सही। आपने कॉल काटकर स्वतंत्र रूप से सत्यापन किया। असली कानून-प्रवर्तन कभी कॉल पर गिरफ़्तारी या 'सत्यापन' भुगतान नहीं लेता। नंबर को 1930 / cybercrime.gov.in पर रिपोर्ट करना दूसरों की भी मदद करता है।",
    },
  },
];

export function findPreAuthored(labId: string, key: string | null | undefined): LocalizedString | null {
  if (!key) return null;
  const hit = TABLE.find((e) => e.labId === labId && e.key === key);
  return hit?.answer ?? null;
}

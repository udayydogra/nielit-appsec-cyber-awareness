// Two i18n layers, kept separate (§8):
//  1. UI chrome (nav, buttons) → key→string files, THIS file.
//  2. Lab/scenario content → LocalizedString at the leaf, resolved by `L()`.
// Localize the leaves, never fork the graph.
import { createContext, useContext } from 'react';
import type { Locale, LocalizedString } from '../api/client';

export const UI: Record<string, LocalizedString> = {
  appTitle:      { en: 'NIELIT Security Training', hi: 'NIELIT सुरक्षा प्रशिक्षण' },
  appsec:        { en: 'AppSec Labs', hi: 'ऐपसेक लैब्स' },
  awareness:     { en: 'Cyber Awareness', hi: 'साइबर जागरूकता' },
  login:         { en: 'Log in', hi: 'लॉग इन' },
  logout:        { en: 'Log out', hi: 'लॉग आउट' },
  email:         { en: 'Email', hi: 'ईमेल' },
  password:      { en: 'Password', hi: 'पासवर्ड' },
  start:         { en: 'Start lab', hi: 'लैब शुरू करें' },
  reset:         { en: 'Reset', hi: 'रीसेट' },
  submit:        { en: 'Submit', hi: 'जमा करें' },
  next:          { en: 'Next', hi: 'आगे' },
  back:          { en: 'Back', hi: 'वापस' },
  runQuery:      { en: 'Run', hi: 'चलाएँ' },
  hint:          { en: 'Hint', hi: 'संकेत' },
  quiz:          { en: 'Quiz', hi: 'क्विज़' },
  passed:        { en: 'Passed! Certificate issued', hi: 'पास! प्रमाणपत्र जारी' },
  failed:        { en: 'Not yet — review and retry', hi: 'अभी नहीं — समीक्षा करें और पुनः प्रयास' },
  mentor:        { en: 'AI Mentor', hi: 'एआई मेंटर' },
  askMentor:     { en: 'Ask the mentor…', hi: 'मेंटर से पूछें…' },
  redFlags:      { en: 'Red flags', hi: 'रेड फ्लैग्स' },
  pickUp:        { en: 'Pick up', hi: 'उठाएँ' },
  decline:       { en: 'Decline', hi: 'अस्वीकार' },
  simulation:    { en: 'SIMULATION / TRAINING', hi: 'सिमुलेशन / प्रशिक्षण' },
  tier:          { en: 'Tier', hi: 'टियर' },
  report:        { en: 'Report to', hi: 'रिपोर्ट करें' },
  yourScore:     { en: 'Your score', hi: 'आपका स्कोर' },
  verifyCert:    { en: 'Verify certificate', hi: 'प्रमाणपत्र सत्यापित करें' },
  collectRequest:{ en: 'Collect request', hi: 'कलेक्ट रिक्वेस्ट' },
  paymentRequest:{ en: 'Payment request', hi: 'भुगतान अनुरोध' },
  enterPin:      { en: 'Enter UPI PIN', hi: 'UPI PIN डालें' },
  unknownSender: { en: 'Unknown sender · not in contacts', hi: 'अज्ञात प्रेषक · संपर्कों में नहीं' },
  incomingCall:  { en: 'Incoming video call', hi: 'इनकमिंग वीडियो कॉल' },
  connecting:    { en: 'Connecting…', hi: 'कनेक्ट हो रहा है…' },
  tapReply:      { en: 'Text message', hi: 'संदेश' },
  calledBack:    { en: 'They called back from a new number.', hi: 'उन्होंने नए नंबर से वापस कॉल किया।' },
  unknownCaller: { en: 'Unknown caller', hi: 'अज्ञात कॉलर' },
  endCall:       { en: 'End call', hi: 'कॉल समाप्त करें' },
  seedLogins:    { en: 'Dev logins (password: password123)', hi: 'डेव लॉगिन (पासवर्ड: password123)' },
};

// Content leaf resolver.
export function L(s: LocalizedString | undefined, locale: Locale): string {
  if (!s) return '';
  return s[locale] ?? s.en;
}

export interface LangCtx { locale: Locale; setLocale: (l: Locale) => void; }
export const LanguageContext = createContext<LangCtx>({ locale: 'en', setLocale: () => {} });
export const useLang = () => useContext(LanguageContext);

// UI string helper bound to current locale.
export function useT() {
  const { locale } = useLang();
  return (key: keyof typeof UI) => L(UI[key], locale);
}

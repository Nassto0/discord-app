import { create } from 'zustand';
import { Language } from '@/lib/i18n';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: (localStorage.getItem('language') as Language) || 'en',
  setLanguage: (language) => {
    localStorage.setItem('language', language);
    // Apply RTL for Arabic
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    set({ language });
  },
}));

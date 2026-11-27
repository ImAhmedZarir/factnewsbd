"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Language } from "@/lib/types";

interface LanguageContextValue {
  lang: Language;
  setLang: (next: Language) => void;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "bn",
  setLang: () => {},
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("bn");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sb_lang");
      if (saved === "bn" || saved === "en") {
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      // ignore storage failure
    }
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem("sb_lang", next);
    } catch {
      // ignore
    }
    document.documentElement.lang = next;
  };

  const toggleLang = () => setLang(lang === "bn" ? "en" : "bn");

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

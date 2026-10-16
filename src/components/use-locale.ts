"use client";

import { useEffect, useState } from "react";
import { messages, type Locale } from "@/i18n/messages";

const STORAGE_KEY = "journal-locale";

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>("uk");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "uk") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      document.title = messages[saved].title;
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
    document.title = messages[next].title;
  }

  return { locale, setLocale, t: messages[locale] };
}

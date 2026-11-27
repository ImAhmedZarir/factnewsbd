import type { Language, NewsCategory } from "./types";

export const SITE_BRAND = {
  bn: {
    name: "ফ্যাক্টনিউজ বাংলাদেশ",
    shortLeft: "ফ্যাক্টনিউজ",
    shortRight: "বাংলাদেশ",
    edition: "ঢাকা সংস্করণ",
  },
  en: {
    name: "FactNews Bangladesh",
    shortLeft: "FactNews",
    shortRight: "Bangladesh",
    edition: "Dhaka Edition",
  },
} as const;

export const CATEGORIES: { id: NewsCategory; bn: string; en: string }[] = [
  { id: "all", bn: "সর্বশেষ", en: "Latest" },
  { id: "national", bn: "বাংলাদেশ", en: "Bangladesh" },
  { id: "politics", bn: "রাজনীতি", en: "Politics" },
  { id: "economy", bn: "অর্থনীতি", en: "Economy" },
  { id: "international", bn: "আন্তর্জাতিক", en: "World" },
  { id: "sports", bn: "খেলা", en: "Sports" },
  { id: "tech", bn: "প্রযুক্তি", en: "Tech" },
  { id: "entertainment", bn: "বিনোদন", en: "Culture" },
  { id: "regional", bn: "সারাদেশ", en: "Nationwide" },
];

export const UI_COPY = {
  bn: {
    searchPlaceholder: "খবর খুঁজুন...",
    latestTab: "সর্বশেষ",
    popularTab: "সর্বাধিক পঠিত",
    verifiedBy: "যাচাইকৃত সূত্র:",
    sourceLabel: "সূত্র:",
    readFullAt: "মূল প্রতিবেদন পড়ুন",
    shareLabel: "শেয়ার করুন",
    copyLink: "লিংক কপি",
    copied: "কপি হয়েছে!",
    backHome: "প্রচ্ছদ",
    relatedStories: "এই বিভাগের আরও খবর",
    noArticles: "এই বিভাগে এখনো কোনো সংবাদ প্রকাশিত হয়নি।",
    resetFilter: "সব সংবাদ দেখুন",
    fontSmaller: "অ-",
    fontLarger: "অ+",
    printArticle: "প্রিন্ট",
    newsDesk: "নিজস্ব প্রতিবেদক, ঢাকা",
    publishedLabel: "প্রকাশিত:",
    trendingLabel: "ট্রেন্ডিং:",
    moreNews: "আরও খবর",
  },
  en: {
    searchPlaceholder: "Search news...",
    latestTab: "Latest",
    popularTab: "Most Read",
    verifiedBy: "Verified by:",
    sourceLabel: "Source:",
    readFullAt: "Read original report",
    shareLabel: "Share",
    copyLink: "Copy link",
    copied: "Copied!",
    backHome: "Home",
    relatedStories: "More in this section",
    noArticles: "No news reports found in this section.",
    resetFilter: "Show all news",
    fontSmaller: "A-",
    fontLarger: "A+",
    printArticle: "Print",
    newsDesk: "Staff Correspondent, Dhaka",
    publishedLabel: "Published:",
    trendingLabel: "Trending:",
    moreNews: "More News",
  },
} as const;

export function formatNewsTime(isoDate: string, lang: Language): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return lang === "bn" ? "সদ্য প্রকাশিত" : "Just now";
  const d = new Date(ts);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

export function formatFullDate(isoDate: string, lang: Language): string {
  const ts = Date.parse(isoDate);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

export function toBengaliDigits(value: number | string): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/\d/g, (d) => map[Number(d)] ?? d);
}

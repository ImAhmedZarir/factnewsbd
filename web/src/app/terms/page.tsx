import type { Metadata } from "next";
import { PolicyPageShell } from "@/components/policy-page-shell";

export const metadata: Metadata = {
  title: "ব্যবহারের শর্তাবলি | Terms of Service — ফ্যাক্টনিউজ বাংলাদেশ",
  description:
    "ফ্যাক্টনিউজ বাংলাদেশে প্রকাশিত সংবাদ প্রতিবেদন, সূত্রের ব্যবহার এবং পাঠকদের জন্য প্রযোজ্য শর্তাবলি।",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PolicyPageShell
      titleBn="ব্যবহারের শর্তাবলি (Terms of Service)"
      titleEn="Terms of Service"
      sections={[
        {
          headingBn: "তথ্য ব্যবহারের শর্ত",
          headingEn: "Use of Information",
          bodyBn:
            "ফ্যাক্টনিউজ বাংলাদেশে প্রকাশিত সকল সংবাদ প্রতিবেদন ও তথ্যসূত্র শুধুমাত্র তথ্যমূলক ও শিক্ষামূলক উদ্দেশ্যে পরিবেশিত হয়। চূড়ান্ত তথ্যের জন্য সংযুক্ত মূল সূত্র যাচাই করার পরামর্শ দেওয়া হলো।",
          bodyEn:
            "All news reports and cited sources on FactNews Bangladesh are provided for informational purposes. Readers are encouraged to consult the linked primary newsroom dispatches for full context.",
        },
      ]}
    />
  );
}

import { PolicyPageShell } from "@/components/policy-page-shell";

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
            "ফ্যাক্টনিউজ বাংলাদেশে প্রকাশিত সকল সংবাদ সারাংশ ও ফ্যাক্ট-চেক শুধুমাত্র তথ্যমূলক ও শিক্ষামূলক উদ্দেশ্যে পরিবেশিত হয়। চূড়ান্ত তথ্যের জন্য সংযুক্ত মূল সূত্র যাচাই করার পরামর্শ দেওয়া হলো।",
          bodyEn:
            "All news summaries and verification scores on FactNews Bangladesh are provided for informational purposes. Readers are encouraged to consult the linked primary newsroom dispatches for full context.",
        },
      ]}
    />
  );
}

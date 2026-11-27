import { PolicyPageShell } from "@/components/policy-page-shell";

export default function ContactPage() {
  return (
    <PolicyPageShell
      titleBn="যোগাযোগ ও সংশোধনী ডেস্ক"
      titleEn="Contact & Corrections Desk"
      sections={[
        {
          headingBn: "সংশোধনী বা টেকডাউন অনুরোধ",
          headingEn: "Corrections & Publisher Inquiries",
          bodyBn:
            "কোনো প্রতিবেদনের তথ্য সংশোধন, নতুন আঞ্চলিক পত্রিকা যুক্ত করা, অথবা প্রকাশকের কোনো অনুরোধের জন্য আমাদের সম্পাদকীয় ডেস্কে ইমেইল করুন: desk@factnewsbd.com (কনফিগারযোগ্য)।",
          bodyEn:
            "For factual corrections, regional newspaper onboarding, or publisher attribution inquiries, contact our editorial desk at: desk@factnewsbd.com (configure your domain email before launch).",
        },
      ]}
    />
  );
}

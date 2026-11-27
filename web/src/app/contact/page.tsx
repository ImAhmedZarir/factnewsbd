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
            "কোনো প্রতিবেদনের তথ্য সংশোধন, নতুন আঞ্চলিক পত্রিকা যুক্ত করা, বিজ্ঞাপন বা সম্পাদকীয় যোগাযোগের জন্য আমাদের ইমেইল করুন: contact@factnewsbangladesh.bond।",
          bodyEn:
            "For factual corrections, regional newspaper onboarding, advertising, or editorial inquiries, contact us at: contact@factnewsbangladesh.bond.",
        },
      ]}
    />
  );
}

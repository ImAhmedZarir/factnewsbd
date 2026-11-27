import { PolicyPageShell } from "@/components/policy-page-shell";

export default function PrivacyPage() {
  return (
    <PolicyPageShell
      titleBn="গোপনীয়তা নীতি"
      titleEn="Privacy Policy"
      sections={[
        {
          headingBn: "তথ্য সুরক্ষা",
          headingEn: "Information Privacy",
          bodyBn:
            "ফ্যাক্টনিউজ বাংলাদেশ পাঠকদের ব্যক্তিগত তথ্য, মন্তব্য বা অপ্রয়োজনীয় ট্র্যাকিং ডেটা সংগ্রহ করে না। শুধুমাত্র ভাষা ও ডার্ক/লাইট থিম পছন্দ আপনার ব্রাউজারে সংরক্ষিত থাকে।",
          bodyEn:
            "FactNews Bangladesh respects reader privacy and does not require account registration or store comment profiles. Only language and theme preferences are stored locally in your browser.",
        },
        {
          headingBn: "বিজ্ঞাপন ও তৃতীয় পক্ষের লিংক",
          headingEn: "Advertising & External Links",
          bodyBn:
            "আমাদের সাইটে প্রদর্শিত বিজ্ঞাপন এবং সংযুক্ত বহিঃস্থ সংবাদ সূত্রের ওয়েবসাইটসমূহ সংশ্লিষ্ট প্রতিষ্ঠানের নিজস্ব গোপনীয়তা নীতি দ্বারা পরিচালিত হয়।",
          bodyEn:
            "Advertising partners and linked external newsroom pages are governed by their respective privacy policies.",
        },
      ]}
    />
  );
}

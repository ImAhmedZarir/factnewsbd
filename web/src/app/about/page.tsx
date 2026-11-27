import { PolicyPageShell } from "@/components/policy-page-shell";

export default function AboutPage() {
  return (
    <PolicyPageShell
      titleBn="আমাদের সম্পর্কে — ফ্যাক্টনিউজ বাংলাদেশ"
      titleEn="About Us — FactNews Bangladesh"
      sections={[
        {
          headingBn: "আমাদের লক্ষ্য",
          headingEn: "Our Mission",
          bodyBn:
            "ফ্যাক্টনিউজ বাংলাদেশ একটি স্বাধীন ও দায়িত্বশীল বাংলা ও ইংরেজি ডিজিটাল সংবাদমাধ্যম। বাংলাদেশ ও আন্তর্জাতিক অঙ্গনের গুরুত্বপূর্ণ ঘটনাগুলো একাধিক বিশ্বস্ত সূত্র থেকে যাচাই করে পাঠকদের কাছে নির্ভরযোগ্য সংবাদ পৌঁছে দেওয়াই আমাদের অঙ্গীকার।",
          bodyEn:
            "FactNews Bangladesh is an independent bilingual digital newspaper dedicated to delivering accurate, verified national and global news reporting to readers in Bangladesh and worldwide.",
        },
        {
          headingBn: "সংবাদ মানদণ্ড",
          headingEn: "Editorial Standards",
          bodyBn:
            "আমাদের নিউজ ডেস্কে প্রকাশিত প্রতিটি প্রতিবেদন একাধিক সংবাদ সূত্রের তথ্যের সাথে মিলিয়ে যাচাই করা হয় এবং প্রতিটি প্রতিবেদনে সংশ্লিষ্ট সূত্রের সরাসরি রেফারেন্স যুক্ত থাকে।",
          bodyEn:
            "Every report published by our editorial desk is cross-checked against multiple trusted reporting outlets and linked directly to corroborated sources.",
        },
      ]}
    />
  );
}

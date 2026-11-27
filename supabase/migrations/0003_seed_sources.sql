-- ============================================================================
-- 0003_seed_sources.sql
-- Seed 30 Bangladeshi National, Regional & Fact-Checking News Outlets
-- ============================================================================

insert into public.sources (id, name_en, name_bn, domain, lang, tier, region, rss_url, sitemap_url)
values
  ('prothomalo', 'Prothom Alo', 'প্রথম আলো', 'prothomalo.com', 'bn', 1, 'national', 'https://www.prothomalo.com/feed', 'https://www.prothomalo.com/news-sitemap.xml'),
  ('bdnews24-bn', 'bdnews24 Bangla', 'বিডিনিউজ২৪ বাংলা', 'bangla.bdnews24.com', 'bn', 1, 'national', 'https://bangla.bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true', null),
  ('samakal', 'Samakal', 'সমকাল', 'samakal.com', 'bn', 1, 'national', 'https://samakal.com/rss.xml', null),
  ('jugantor', 'Jugantor', 'যুগান্তর', 'jugantor.com', 'bn', 1, 'national', 'https://www.jugantor.com/feed/rss.xml', 'https://www.jugantor.com/news-sitemap.xml'),
  ('ittefaq', 'Daily Ittefaq', 'দৈনিক ইত্তেফাক', 'ittefaq.com.bd', 'bn', 1, 'national', 'https://www.ittefaq.com.bd/feed', null),
  ('kalerkantho', 'Kaler Kantho', 'কালের কণ্ঠ', 'kalerkantho.com', 'bn', 2, 'national', 'https://www.kalerkantho.com/rss.xml', null),
  ('bd-pratidin', 'Bangladesh Pratidin', 'বাংলাদেশ প্রতিদিন', 'bd-pratidin.com', 'bn', 2, 'national', 'https://www.bd-pratidin.com/rss.xml', null),
  ('bonikbarta', 'Bonik Barta', 'বণিক বার্তা', 'bonikbarta.com', 'bn', 1, 'national', 'https://bonikbarta.com/rss.xml', null),
  ('banglatribune', 'Bangla Tribune', 'বাংলা ট্রিবিউন', 'banglatribune.com', 'bn', 2, 'national', 'https://www.banglatribune.com/feed', null),
  ('dhakapost', 'Dhaka Post', 'ঢাকা পোস্ট', 'dhakapost.com', 'bn', 2, 'national', 'https://www.dhakapost.com/rss.xml', 'https://www.dhakapost.com/sitemap.xml'),
  ('jagonews24', 'Jagonews24', 'জাগোনিউজ২৪', 'jagonews24.com', 'bn', 2, 'national', 'https://www.jagonews24.com/rss/rss.xml', null),
  ('somoynews', 'Somoy News', 'সময় টিভি', 'somoynews.tv', 'bn', 2, 'national', 'https://www.somoynews.tv/rss.xml', null),
  ('jamunatv', 'Jamuna TV', 'যমুনা টিভি', 'jamuna.tv', 'bn', 2, 'national', 'https://jamuna.tv/feed', null),
  ('kalbela', 'Kalbela', 'কালবেলা', 'kalbela.com', 'bn', 2, 'national', 'https://www.kalbela.com/feed', null),
  ('deshrupantor', 'Desh Rupantor', 'দেশ রূপান্তর', 'deshrupantor.com', 'bn', 2, 'national', 'https://www.deshrupantor.com/feed', null),
  ('ajkerpatrika', 'Ajker Patrika', 'আজকের পত্রিকা', 'ajkerpatrika.com', 'bn', 2, 'national', 'https://www.ajkerpatrika.com/feed', null),
  ('mzamin', 'Manab Zamin', 'মানবজমিন', 'mzamin.com', 'bn', 2, 'national', 'https://mzamin.com/feed', null),
  ('nayadiganta', 'Naya Diganta', 'নয়া দিগন্ত', 'dailynayadiganta.com', 'bn', 2, 'national', 'https://www.dailynayadiganta.com/rss.xml', null),
  ('inqilab', 'Daily Inqilab', 'দৈনিক ইনকিলাব', 'dailyinqilab.com', 'bn', 2, 'national', 'https://dailyinqilab.com/feed', null),
  ('risingbd', 'RisingBD', 'রাইজিংবিডি', 'risingbd.com', 'bn', 2, 'national', 'https://www.risingbd.com/rss/rss.xml', null),
  ('dailystar', 'The Daily Star', 'দ্য ডেইলি স্টার', 'thedailystar.net', 'en', 1, 'national', 'https://www.thedailystar.net/frontpage/rss.xml', null),
  ('bdnews24-en', 'bdnews24.com', 'বিডিনিউজ২৪ ইংরেজি', 'bdnews24.com', 'en', 1, 'national', 'https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true', null),
  ('dhakatribune', 'Dhaka Tribune', 'ঢাকা ট্রিবিউন', 'dhakatribune.com', 'en', 1, 'national', 'https://www.dhakatribune.com/feed', null),
  ('tbsnews', 'The Business Standard', 'দ্য বিজনেস স্ট্যান্ডার্ড', 'tbsnews.net', 'en', 1, 'national', 'https://www.tbsnews.net/top-news/rss.xml', null),
  ('financialexpress', 'The Financial Express', 'ফাইন্যান্সিয়াল এক্সপ্রেস', 'thefinancialexpress.com.bd', 'en', 1, 'national', 'https://thefinancialexpress.com.bd/feed', null),
  ('newage', 'New Age', 'নিউ এজ', 'newagebd.net', 'en', 2, 'national', 'https://www.newagebd.net/rss', null),
  ('dainikazadi', 'Dainik Azadi (Chattogram)', 'দৈনিক আজাদী (চট্টগ্রাম)', 'dainikazadi.net', 'bn', 3, 'chattogram', 'https://dainikazadi.net/feed/', null),
  ('purbokone', 'Dainik Purbokone (Chattogram)', 'দৈনিক পূর্বকোণ (চট্টগ্রাম)', 'dainikpurbokone.net', 'bn', 3, 'chattogram', 'https://dainikpurbokone.net/feed/', null),
  ('rumorscanner', 'Rumor Scanner BD', 'রিউমর স্ক্যানার', 'rumorscanner.com', 'bn', 4, 'factcheck', 'https://rumorscanner.com/feed/', null),
  ('dismislab', 'Dismislab', 'ডিসমিসল্যাব', 'dismislab.com', 'bn', 4, 'factcheck', 'https://dismislab.com/feed/', null)
on conflict (id) do update set
  name_en = excluded.name_en,
  name_bn = excluded.name_bn,
  rss_url = excluded.rss_url,
  sitemap_url = excluded.sitemap_url;

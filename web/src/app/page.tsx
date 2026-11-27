import { NewsFrontpage } from "@/components/news-frontpage";
import { getArticles } from "@/lib/store";

export const dynamic = "force-static";

export default async function HomePage() {
  const articles = await getArticles(60);
  return <NewsFrontpage articles={articles} />;
}

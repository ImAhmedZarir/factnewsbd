import { NewsFrontpage } from "@/components/news-frontpage";
import { getArticles } from "@/lib/store";

export const revalidate = 120;

export default async function HomePage() {
  const articles = await getArticles(60);
  return <NewsFrontpage articles={articles} />;
}

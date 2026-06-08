import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { FeedClient } from "./FeedClient";

function findCategoryBySlug(slug: string): CategoryId | null {
  const match = Object.values(CATEGORIES).find((c) => c.slug === slug);
  return match ? match.id : null;
}

export async function generateMetadata(
  props: PageProps<"/feed/[category]">,
): Promise<Metadata> {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  return {
    title: id
      ? `${CATEGORIES[id].label} · Noetrix`
      : "Feed · Noetrix",
  };
}

export default async function FeedPage(props: PageProps<"/feed/[category]">) {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  if (!id) notFound();
  return <FeedClient categoryId={id} />;
}

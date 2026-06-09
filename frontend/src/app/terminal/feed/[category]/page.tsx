import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { FeedClient } from "./FeedClient";

type Props = {
  params: Promise<{ category: string }>;
};

function findCategoryBySlug(slug: string): CategoryId | null {
  const match = Object.values(CATEGORIES).find((c) => c.slug === slug);
  return match ? match.id : null;
}

export async function generateMetadata(
  props: Props,
): Promise<Metadata> {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  return {
    title: id
      ? `${CATEGORIES[id].label} — Noetrix`
      : "Feed — Noetrix",
  };
}

export default async function FeedPage(props: Props) {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  if (!id) notFound();
  return <FeedClient categoryId={id} />;
}

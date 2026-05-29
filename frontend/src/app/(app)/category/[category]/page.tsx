import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { CategoryClient } from "./CategoryClient";

function findCategoryBySlug(slug: string): CategoryId | null {
  const match = Object.values(CATEGORIES).find((c) => c.slug === slug);
  return match ? match.id : null;
}

export async function generateMetadata(
  props: PageProps<"/category/[category]">,
): Promise<Metadata> {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  return {
    title: id ? `${CATEGORIES[id].label} — Predictor Index` : "Category — Predictor Index",
  };
}

export default async function CategoryPage(props: PageProps<"/category/[category]">) {
  const { category } = await props.params;
  const id = findCategoryBySlug(category);
  if (!id) notFound();
  return <CategoryClient categoryId={id} />;
}

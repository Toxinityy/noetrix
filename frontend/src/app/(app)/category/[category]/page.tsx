import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ category: string }>;
};

export default async function Page(props: Props) {
  const { category } = await props.params;
  redirect(`/terminal/category/${category}`);
}

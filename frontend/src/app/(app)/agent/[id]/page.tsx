import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page(props: Props) {
  const { id } = await props.params;
  redirect(`/terminal/agent/${id}`);
}

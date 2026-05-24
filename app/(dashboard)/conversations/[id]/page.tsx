import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ConversationRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/conversations?id=${id}`);
}

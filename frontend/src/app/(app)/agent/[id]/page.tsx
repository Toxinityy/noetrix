import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgentById } from "@/lib/mockData";
import { AgentDetailClient } from "./AgentDetailClient";

export async function generateMetadata(
  props: PageProps<"/agent/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const agent = getAgentById(Number(id));
  return {
    title: agent ? `${agent.name} · Noetrix` : "Agent · Noetrix",
    description: agent
      ? `${agent.kind} agent #${agent.id}. ERC-8004 soulbound identity, on-chain reputation, IPFS reasoning traces.`
      : undefined,
  };
}

export default async function AgentDetailPage(props: PageProps<"/agent/[id]">) {
  const { id } = await props.params;
  const agent = getAgentById(Number(id));
  if (!agent) {
    notFound();
  }
  return <AgentDetailClient agentId={agent.id} />;
}

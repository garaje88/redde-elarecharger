import { ChevronLeft, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getConversation, listConversations, usageSummary } from "@/server/services/ai";
import { getSession } from "@/server/session";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Asistente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AssistantPage({ searchParams }: PageProps<"/assistant">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 md:max-w-2xl">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Volver al inicio"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <span className="flex size-10 items-center justify-center rounded-xl bg-inverse">
          <Sparkles aria-hidden="true" className="size-5 text-brand-bright" strokeWidth={1.75} />
        </span>
        <div className="flex flex-1 flex-col">
          <h1 className="font-heading text-[22px] leading-tight font-semibold">Asistente</h1>
          <span className="text-[13px] text-muted-foreground">Usa tus vehículos y cargadores</span>
        </div>
        <Link
          href="/assistant"
          aria-label="Nueva conversación"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Plus aria-hidden="true" className="size-5" />
        </Link>
      </header>
      <AssistantContent searchParams={searchParams} />
    </main>
  );
}

async function AssistantContent({ searchParams }: Pick<PageProps<"/assistant">, "searchParams">) {
  const { c } = await searchParams;
  const { supabase } = await getSession();
  const id = typeof c === "string" && UUID.test(c) ? c : null;
  const [usage, conversations, initial] = await Promise.all([
    usageSummary(supabase),
    listConversations(supabase),
    id ? getConversation(supabase, id).catch(() => null) : Promise.resolve(null),
  ]);
  const available = usage.available && usage.messages_today < usage.messages_limit;

  return (
    <>
      {conversations.length > 0 && (
        <details className="rounded-2xl bg-card px-4 py-2 text-sm">
          <summary className="min-h-9 cursor-pointer content-center font-semibold">
            Conversaciones recientes
          </summary>
          <ul className="flex flex-col pb-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/assistant?c=${conversation.id}`}
                  aria-current={conversation.id === id ? "page" : undefined}
                  className="block truncate rounded-lg py-2 hover:underline aria-[current=page]:font-semibold"
                >
                  {conversation.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <AssistantChat key={id ?? "new"} initial={initial} available={available} />
    </>
  );
}

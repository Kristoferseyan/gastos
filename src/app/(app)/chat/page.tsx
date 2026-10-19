import { aiEnabled, aiImages } from "@/lib/ai";
import { listMemory, listMessages } from "@/lib/chat";
import { ChatView } from "@/components/ChatView";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="fit-screen flex flex-col gap-3">
      {aiEnabled() ? (
        <ChatView initialMessages={listMessages()} initialMemory={listMemory()} canAttach={aiImages()} />
      ) : (
        <>
          <h1 className="text-xl font-semibold">Ask</h1>
          <p className="card p-5 text-sm text-muted">AI is not configured on this server (AI_API_KEY).</p>
        </>
      )}
    </div>
  );
}

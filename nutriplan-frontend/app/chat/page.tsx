// app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { sendChatMessage, getChatHistory } from "@/lib/api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await getChatHistory();
      setMessages(data);
    } catch (err) {
      // no history yet is fine, just show empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setSending(true);

    try {
      const data = await sendChatMessage(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      // roll back the optimistic user message since it wasn't actually saved
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBF9F4] flex flex-col">
      <div className="border-b border-[#1B3A2F]/10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#1B3A2F]">Ask NutriPlan</h1>
          <Link href="/dashboard" className="text-sm text-[#1B3A2F]/60 hover:text-[#1B3A2F]">
            Back to plan
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {loading && <p className="text-[#1B3A2F]/60 text-sm">Loading...</p>}

          {!loading && messages.length === 0 && (
            <div className="text-center py-16 text-[#1B3A2F]/50 text-sm">
              Ask a question, request an ingredient swap, or ask to replace a whole meal.
              <br />
              e.g. &quot;I don&apos;t have basil&quot; or &quot;swap Monday dinner&quot;
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-[#1B3A2F] text-white px-4 py-2 text-sm"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-white border border-[#1B3A2F]/10 text-[#1B3A2F] px-4 py-2 text-sm"
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white border border-[#1B3A2F]/10 text-[#1B3A2F]/50 px-4 py-2 text-sm">
                Thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <div className="px-4">
          <p className="max-w-2xl mx-auto text-sm text-red-600 mb-2">{error}</p>
        </div>
      )}

      <form onSubmit={handleSend} className="border-t border-[#1B3A2F]/10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 rounded-lg border border-[#1B3A2F]/15 bg-white px-3 py-2 text-sm text-[#1B3A2F] focus:outline-none focus:ring-2 focus:ring-[#E8935C] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-lg bg-[#1B3A2F] text-white px-4 py-2 text-sm font-medium hover:bg-[#1B3A2F]/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}
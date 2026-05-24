"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { aiChat, getChatHistory, type ChatResponse } from "@/lib/ai-api";
import { getStoredUser } from "@/lib/auth";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: any[];
}

export default function AiTutorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = getStoredUser();

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function loadHistory() {
    if (!user?.id) return;
    try {
      const history = await getChatHistory(user.id);
      if (history && history.history) {
        const mapped = history.history.map((h: any) => ([
          {
            id: `u-${h.timestamp}`,
            role: "user",
            content: h.message,
            timestamp: new Date(h.timestamp)
          },
          {
            id: `a-${h.timestamp}`,
            role: "assistant",
            content: h.answer,
            timestamp: new Date(h.timestamp),
            sources: h.sources
          }
        ])).flat();
        setMessages(mapped);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }

  async function handleSend() {
    if (!input.trim() || !user?.id || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await aiChat({
        student_id: user.id,
        message: input,
        grade_level: user.grade ? parseInt(user.grade) : 9
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.answer,
        timestamp: new Date(),
        sources: res.sources
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("AI Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: "err",
          role: "assistant",
          content: "Sorry, I'm having trouble connecting to my brain right now. Please try again later.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-tutor-container">
      <div className="ai-tutor-header">
        <div className="flex items-center gap-3">
          <div className="ai-bot-avatar">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">TriLink AI Tutor</h2>
            <p className="text-xs text-blue-500 font-medium">Always online to help you learn</p>
          </div>
        </div>
      </div>

      <div className="ai-messages-area" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-empty-state">
            <Bot size={48} className="text-blue-200 mb-4" />
            <h3>Hi {user?.firstName}!</h3>
            <p>I'm your personal AI tutor. Ask me anything about your lessons, or help with a specific topic!</p>
            <div className="ai-suggestions">
              <button onClick={() => setInput("Can you explain photosynthesis?")}>Explain photosynthesis</button>
              <button onClick={() => setInput("Give me a study plan for math")}>Math study plan</button>
              <button onClick={() => setInput("How do I improve my writing?")}>Writing tips</button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`ai-message-row ${m.role}`}>
            <div className="ai-message-avatar">
              {m.role === "assistant" ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className="ai-message-bubble">
              <div className="ai-message-content">{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <div className="ai-message-sources">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Sources</p>
                  {m.sources.map((s: any, i: number) => (
                    <div key={i} className="ai-source-tag">
                      {s.title || "Reference"}
                    </div>
                  ))}
                </div>
              )}
              <div className="ai-message-time">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-message-row assistant">
            <div className="ai-message-avatar">
              <Bot size={18} />
            </div>
            <div className="ai-message-bubble loading">
              <Loader2 className="animate-spin" size={18} />
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="ai-input-area">
        <div className="ai-input-wrapper">
          <input
            type="text"
            placeholder="Ask your tutor something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button 
            className={`ai-send-btn ${input.trim() ? 'active' : ''}`}
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .ai-tutor-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 120px);
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          overflow: hidden;
          border: 1px solid var(--gray-200);
        }
        .ai-tutor-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--gray-100);
          background: linear-gradient(to right, #fff, #f8faff);
        }
        .ai-bot-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }
        .ai-messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          background: #fdfdfd;
        }
        .ai-message-row {
          display: flex;
          gap: 12px;
          max-width: 85%;
        }
        .ai-message-row.user {
          flex-direction: row-reverse;
          align-self: flex-end;
        }
        .ai-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--gray-100);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 4px;
        }
        .ai-message-row.assistant .ai-message-avatar {
          background: #eff6ff;
          color: #3b82f6;
        }
        .ai-message-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 0.95rem;
          line-height: 1.5;
          position: relative;
        }
        .ai-message-row.assistant .ai-message-bubble {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-top-left-radius: 4px;
          color: #1f2937;
        }
        .ai-message-row.user .ai-message-bubble {
          background: #3b82f6;
          color: #fff;
          border-top-right-radius: 4px;
        }
        .ai-message-time {
          font-size: 0.7rem;
          margin-top: 4px;
          opacity: 0.6;
        }
        .ai-message-row.user .ai-message-time {
          text-align: right;
        }
        .ai-message-bubble.loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
        }
        .ai-input-area {
          padding: 1.25rem 1.5rem;
          background: #fff;
          border-top: 1px solid var(--gray-100);
        }
        .ai-input-wrapper {
          display: flex;
          gap: 12px;
          background: #f3f4f6;
          padding: 8px 8px 8px 16px;
          border-radius: 12px;
          align-items: center;
          transition: all 0.2s;
        }
        .ai-input-wrapper:focus-within {
          background: #fff;
          box-shadow: 0 0 0 2px #3b82f633;
          border: 1px solid #3b82f6;
        }
        .ai-input-wrapper input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 0.95rem;
          padding: 8px 0;
        }
        .ai-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gray-200);
          color: #fff;
          border: none;
          cursor: not-allowed;
          transition: all 0.2s;
        }
        .ai-send-btn.active {
          background: #3b82f6;
          cursor: pointer;
        }
        .ai-send-btn.active:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        .ai-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
        }
        .ai-empty-state h3 {
          font-size: 1.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
          color: #111827;
        }
        .ai-empty-state p {
          color: #6b7280;
          max-width: 320px;
          margin-bottom: 2rem;
        }
        .ai-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }
        .ai-suggestions button {
          padding: 8px 16px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          font-size: 0.85rem;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ai-suggestions button:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background: #eff6ff;
        }
        .ai-message-sources {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed #e5e7eb;
        }
        .ai-source-tag {
          display: inline-block;
          padding: 2px 8px;
          background: #f9fafb;
          border: 1px solid #f3f4f6;
          border-radius: 4px;
          font-size: 11px;
          color: #6b7280;
          margin-right: 4px;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
}

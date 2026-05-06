"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ChatMessage,
  type Conversation,
  createConversation,
  listConversations,
  listMessages,
  searchUsers,
  postMessage,
  type PublicUser,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth";
import { chatRealtime } from "@/lib/chat-realtime";
import AuthenticatedAvatar from "@/components/AuthenticatedAvatar";

// ── helpers ───────────────────────────────────────────────────────────────────
function toLabel(u: PublicUser) { return `${u.firstName} ${u.lastName}`.trim() || u.email; }
function initials(name: string) {
  const p = name.split(" ").filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
function fmtTime(ts?: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function roleColor(role: string) {
  if (role === "teacher") return "#2563eb";
  if (role === "admin") return "#7c3aed";
  if (role === "parent") return "#059669";
  return "#64748b";
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, online = false, fileId }: { name: string; size?: number; online?: boolean; fileId?: string }) {
  const bg = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4"][name.charCodeAt(0) % 6];
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {fileId ? (
        <AuthenticatedAvatar fileId={fileId} initials={initials(name)} size={size} alt={name} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.38 }}>
          {initials(name)}
        </div>
      )}
      {online && <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff" }} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RestChat() {
  const me = getStoredUser();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = useMemo(() => convs.find(c => c.id === activeId), [convs, activeId]);
  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter(c => c.title.toLowerCase().includes(q));
  }, [convs, search]);

  // Load conversations
  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const list = await listConversations();
      setConvs(list);
      if (!activeId && list.length) setActiveId(list[0].id);
    } catch { /* ignore */ }
    finally { setLoadingConvs(false); }
  }, [activeId]);

  useEffect(() => { void loadConvs(); }, [loadConvs]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeId) return;
    setLoadingMsgs(true);
    setMsgs([]);
    listMessages(activeId, 50)
      .then(m => setMsgs([...m].reverse()))
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
  }, [activeId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Realtime
  useEffect(() => {
    if (!activeId) return;
    const unsub = chatRealtime.on("message:new", (payload) => {
      const msg = payload.message;
      if (payload.conversationId === activeId) {
        setMsgs(prev => [...prev, { id: msg.id, conversationId: msg.conversationId, senderId: msg.senderId, text: msg.text, createdAt: msg.createdAt } as any]);
      } else {
        void loadConvs();
      }
    });
    return unsub;
  }, [activeId, loadConvs]);

  // User search for new chat
  useEffect(() => {
    if (!userSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchUsers(undefined, userSearch);
        setSearchResults(res.filter(u => u.id !== me?.id));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, me?.id]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const msg = await postMessage(activeId, text);
      setMsgs(prev => [...prev, msg]);
      void loadConvs();
    } catch { setDraft(text); }
    finally { setSending(false); }
  };

  const startDirectChat = async (user: PublicUser) => {
    setShowNewChat(false);
    setUserSearch("");
    try {
      // Check if DM already exists
      const existing = convs.find(c => c.type === "private" && c.title.includes(user.firstName));
      if (existing) { setActiveId(existing.id); setShowSidebar(false); return; }
      const conv = await createConversation({ type: "private", title: `${me?.firstName} & ${user.firstName}`, memberIds: [user.id], parentVisible: false });
      if (conv) {
        await loadConvs();
        setActiveId(conv.id);
      }
    } catch { /* ignore */ }
    setShowSidebar(false);
  };

  const selectConv = (id: string) => {
    setActiveId(id);
    setShowSidebar(false);
  };

  // Group messages by date
  const groupedMsgs = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of msgs) {
      const d = fmtDate(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last?.date === d) last.messages.push(msg);
      else groups.push({ date: d, messages: [msg] });
    }
    return groups;
  }, [msgs]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="tg-shell" style={{ display: "flex", height: "calc(100vh - 112px)", overflow: "hidden", fontFamily: "inherit" }}>
      <style>{`
        .tg-shell { margin: 1.5rem; border: 1px solid var(--line-soft); border-radius: 30px; background: rgba(255,255,255,0.9); box-shadow: var(--shadow-premium), var(--shadow-inner-line); backdrop-filter: blur(18px); }
        .tg-sidebar { width: 350px; min-width: 310px; max-width: 390px; background: rgba(255,255,255,0.94); border-right: 1px solid var(--line-soft); display: flex; flex-direction: column; flex-shrink: 0; }
        .tg-sidebar > div:first-child { padding: 1rem !important; border-bottom: 1px solid var(--line-faint) !important; background: linear-gradient(180deg, var(--role-accent-50, #eef2ff), #fff); }
        .tg-sidebar input { color: var(--text-strong) !important; font-weight: 650; }
        .tg-sidebar button[title="New chat"] { border-radius: 15px !important; background: linear-gradient(135deg, var(--role-accent-500, #6366f1), var(--role-accent-700, #4338ca)) !important; box-shadow: 0 14px 30px color-mix(in srgb, var(--role-accent-600, #4f46e5) 24%, transparent); }
        .tg-conv-item { display: flex; align-items: center; gap: 12px; margin: 0.35rem 0.75rem; padding: 0.72rem 0.75rem; cursor: pointer; transition: background 0.16s, transform 0.16s, box-shadow 0.16s; border-radius: 18px; }
        .tg-conv-item:hover { background: #f8fafc; transform: translateY(-1px); }
        .tg-conv-item.active { background: var(--role-accent-50, #eef2ff); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--role-accent-500, #6366f1) 18%, transparent); }
        .tg-main { background: linear-gradient(180deg, #fbfdff 0%, #f4f7fe 100%) !important; }
        .tg-main > div:first-child:not(:only-child) { border-bottom: 1px solid var(--line-soft) !important; background: rgba(255,255,255,0.9) !important; padding: 0.95rem 1.1rem !important; }
        .tg-msg-bubble { max-width: 72%; padding: 0.72rem 0.9rem; border-radius: 19px; font-size: 0.92rem; line-height: 1.5; word-break: break-word; font-weight: 560; }
        .tg-msg-mine { background: linear-gradient(135deg, var(--role-accent-500, #6366f1), var(--role-accent-700, #4338ca)); color: #fff; border-bottom-right-radius: 6px; margin-left: auto; box-shadow: 0 12px 28px color-mix(in srgb, var(--role-accent-600, #4f46e5) 18%, transparent); }
        .tg-msg-other { background: #fff; color: var(--text-strong); border: 1px solid var(--line-faint); border-bottom-left-radius: 6px; box-shadow: 0 12px 28px rgba(15,23,42,0.055); }
        .tg-input { resize: none; border: none; outline: none; background: transparent; font-family: inherit; font-size: 0.92rem; width: 100%; max-height: 120px; overflow-y: auto; line-height: 1.5; color: var(--text-strong); font-weight: 650; }
        @media (max-width: 767px) {
          .tg-shell { height: calc(100vh - 76px) !important; margin: 0; border-radius: 0; border-left: 0; border-right: 0; }
          .tg-sidebar { position: absolute; left: 0; top: 0; bottom: 0; z-index: 10; transform: translateX(-100%); transition: transform 0.25s; width: 100% !important; max-width: 100% !important; }
          .tg-sidebar.open { transform: translateX(0); }
          .tg-main { width: 100% !important; }
        }
      `}</style>

      {/* ── Sidebar ── */}
      <div className={`tg-sidebar${showSidebar ? " open" : ""}`}>
        {/* Sidebar header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#f3f4f6", borderRadius: 20, padding: "6px 12px" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.88rem", width: "100%", color: "#111" }} />
          </div>
          <button onClick={() => setShowNewChat(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563eb", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title="New chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>

        {/* New chat search */}
        {showNewChat && (
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#374151" }}>New Chat</span>
              <button onClick={() => { setShowNewChat(false); setUserSearch(""); setSearchResults([]); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search people…" style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} autoFocus />
            {searchResults.length > 0 && (
              <div style={{ marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
                {searchResults.map(u => (
                  <div key={u.id} onClick={() => startDirectChat(u)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", cursor: "pointer", borderRadius: 8 }} onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <Avatar name={toLabel(u)} size={32} fileId={u.profileImageFileId ?? undefined} />
                    <div>
                      <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{toLabel(u)}</div>
                      <div style={{ fontSize: "0.72rem", color: roleColor(u.role), fontWeight: 600 }}>{u.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingConvs ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, background: "#e5e7eb", borderRadius: 6, marginBottom: 6, width: "60%" }} />
                  <div style={{ height: 10, background: "#f3f4f6", borderRadius: 6, width: "80%" }} />
                </div>
              </div>
            ))
          ) : filteredConvs.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
              {search ? "No conversations match your search." : "No conversations yet. Start a new chat!"}
            </div>
          ) : filteredConvs.map(c => {
            const isActive = c.id === activeId;
            const isGroup = c.type !== "private";
            return (
              <div key={c.id} className={`tg-conv-item${isActive ? " active" : ""}`} onClick={() => selectConv(c.id)}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: isGroup ? "#7c3aed" : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1rem", flexShrink: 0 }}>
                  {isGroup ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> : initials(c.title)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111" }}>{c.title}</span>
                    <span style={{ fontSize: "0.7rem", color: "#9ca3af", flexShrink: 0, marginLeft: 6 }}>{fmtTime(c.updatedAt)}</span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {isGroup ? "Group conversation" : "Direct message"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="tg-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af", gap: "1rem" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>Select a conversation</div>
            <div style={{ fontSize: "0.85rem" }}>Choose from the list or start a new chat</div>
            <button onClick={() => setShowSidebar(true)} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              Open conversations
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <button onClick={() => setShowSidebar(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6b7280", display: "flex" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: activeConv.type !== "private" ? "#7c3aed" : "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                {activeConv.type !== "private" ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> : initials(activeConv.title)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeConv.title}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{activeConv.type === "private" ? "Direct message" : "Group"}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 2 }}>
              {loadingMsgs ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem", color: "#9ca3af" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : msgs.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "0.85rem" }}>No messages yet. Say hello!</div>
              ) : groupedMsgs.map(group => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 8px" }}>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600, background: "#f0f2f5", padding: "2px 10px", borderRadius: 10 }}>{group.date}</span>
                    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  </div>
                  {group.messages.map((msg, i) => {
                    const isMe = msg.senderId === me?.id;
                    const showSender = !isMe && activeConv.type !== "private";
                    const prevMsg = group.messages[i - 1];
                    const sameSender = prevMsg?.senderId === msg.senderId;
                    return (
                      <div key={msg.id} style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, marginTop: sameSender ? 2 : 8 }}>
                        {!isMe && !sameSender && (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0, marginBottom: 2 }}>
                            {initials(msg.senderId.slice(0, 4))}
                          </div>
                        )}
                        {!isMe && sameSender && <div style={{ width: 28, flexShrink: 0 }} />}
                        <div>
                          {showSender && !sameSender && (
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2563eb", marginBottom: 2, marginLeft: 4 }}>
                              {msg.senderId.slice(0, 8)}
                            </div>
                          )}
                          <div className={`tg-msg-bubble ${isMe ? "tg-msg-mine" : "tg-msg-other"}`}>
                            {msg.text}
                            <div style={{ fontSize: "0.65rem", opacity: 0.7, marginTop: 3, textAlign: "right" }}>{fmtTime(msg.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", padding: "10px 16px", display: "flex", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "flex-end", gap: 8 }}>
                <textarea
                  ref={inputRef}
                  className="tg-input"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Message…"
                  rows={1}
                  style={{ resize: "none", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "0.92rem", width: "100%", maxHeight: 120, overflowY: "auto", lineHeight: 1.5 }}
                />
              </div>
              <button
                onClick={() => void sendMessage()}
                disabled={!draft.trim() || sending}
                style={{ width: 42, height: 42, borderRadius: "50%", background: draft.trim() ? "#2563eb" : "#e5e7eb", border: "none", cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={draft.trim() ? "#fff" : "#9ca3af"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

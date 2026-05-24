"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowDown,
  BellOff,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Copy as CopyIcon,
  CornerUpRight,
  Mic,
  MoreHorizontal,
  MessageSquareText,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Reply as ReplyIcon,
  Search,
  Send,
  SmilePlus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  type ChatMessage,
  type Conversation,
  type PublicUser,
  createConversation,
  blockConversation,
  deleteChatMessage,
  editChatMessage,
  forwardChatMessage,
  initiateDirectChat,
  listConversations,
  listMessages,
  postChatMessage,
  toggleChatMessageReaction,
  unblockConversation,
  uploadChatFile,
  searchUsers,
} from "@/lib/admin-api";
import { chatRealtime, type RealtimeStatus } from "@/lib/chat-realtime";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useChatUnreadStore } from "@/store/chatUnreadStore";

type PortalRole = "admin" | "teacher" | "student" | "parent";
type ComposeMode = "direct" | "group";

type ChatMessageView = ChatMessage & {
  senderName?: string;
  senderRole?: string;
  senderInitials?: string;
};

interface RestChatProps {
  role?: PortalRole;
}

const ROLE_META: Record<PortalRole, { title: string; kicker: string; summary: string; accent: string; allowGroups: boolean }> = {
  admin: {
    title: "School-wide chat command center",
    kicker: "Admin Communication",
    summary: "Coordinate staff, classes, and parent outreach from one clean inbox.",
    accent: "#2563eb",
    allowGroups: true,
  },
  teacher: {
    title: "Classroom and parent conversations",
    kicker: "Teacher Messenger",
    summary: "Handle student support, class threads, and direct parent follow-ups.",
    accent: "#7c3aed",
    allowGroups: true,
  },
  student: {
    title: "Student support inbox",
    kicker: "Student Chat",
    summary: "Reach teachers and classmates with a focused chat experience.",
    accent: "#0ea5e9",
    allowGroups: false,
  },
  parent: {
    title: "Parent follow-up desk",
    kicker: "Parent Chat",
    summary: "Stay in touch with your child’s teachers and the school office.",
    accent: "#8b5cf6",
    allowGroups: false,
  },
};

function toRole(pathRole?: string): PortalRole {
  if (pathRole === "admin" || pathRole === "teacher" || pathRole === "student" || pathRole === "parent") return pathRole;
  return "teacher";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "?")
      .join("") || "?"
  );
}

function relative(iso?: string | null) {
  if (!iso) return "just now";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sortByActivity(a: Conversation, b: Conversation) {
  const aTs = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime();
  const bTs = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime();
  return bTs - aTs;
}

// Render a message text with auto-linked URLs.
function linkifyText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const raw = m[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    parts.push(
      <a key={`l-${m.index}`} href={href} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
        {raw}
      </a>
    );
    lastIndex = m.index + raw.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

// Heuristic: a message is "emoji-only" when it contains 1-3 emoji glyphs and no letters/digits.
function isEmojiOnly(text?: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[A-Za-z0-9]/.test(trimmed)) return false;
  // Count user-perceived characters using Intl.Segmenter when available
  let count = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Seg: any = (Intl as any).Segmenter;
    if (Seg) {
      const seg = new Seg(undefined, { granularity: "grapheme" });
      for (const _ of seg.segment(trimmed)) count++;
      if (count === 0) count = Array.from(trimmed).length;
    } else {
      count = Array.from(trimmed).length;
    }
  } catch {
    count = Array.from(trimmed).length;
  }
  return count > 0 && count <= 4;
}

function mapSeedConversation(_conv: unknown): Conversation { return {} as Conversation; }
function mapSeedMessages(_convId: string, _conv: unknown): ChatMessageView[] { return []; }

function deriveAuthor(message: ChatMessageView, meId?: string, fallbackTitle?: string) {
  if (meId && message.senderId === meId) return { label: "You", role: "You", initials: "YOU" };
  const label = message.senderName?.trim() || fallbackTitle || `User ${message.senderId.slice(0, 6)}`;
  return { label, role: message.senderRole || "participant", initials: message.senderInitials || initials(label) };
}

export default function RestChat({ role: forcedRole }: RestChatProps) {
  const pathname = usePathname();
  const role = toRole(forcedRole ?? pathname.split("/").filter(Boolean)[0]);
  const meta = ROLE_META[role];
  const user = useCurrentUser(role);

  const [status, setStatus] = useState<RealtimeStatus>(chatRealtime.getStatus());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessageView[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "direct" | "group" | "parent-visible">("all");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, boolean>>({});
  const [lastSeenByUserId, setLastSeenByUserId] = useState<Record<string, string | null>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  // pendingIds: message IDs that are optimistically shown but not yet confirmed by server
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // seenIds: message IDs that have been read by the other party (from read receipts)
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const [showCompose, setShowCompose] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [composeMode, setComposeMode] = useState<ComposeMode>(meta.allowGroups ? "direct" : "direct");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeParentVisible, setComposeParentVisible] = useState(role === "admin" || role === "teacher");
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<PublicUser[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<PublicUser[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<{ id: string; filename: string; mime: string; path: string } | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // New: message edit / delete / forward / in-conv search / hover menus
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [openReactPickerId, setOpenReactPickerId] = useState<string | null>(null);
  const [inConvSearch, setInConvSearch] = useState("");
  const [inConvSearchOpen, setInConvSearchOpen] = useState(false);
  const [composeRoleTab, setComposeRoleTab] = useState<"all" | "student" | "teacher" | "parent" | "admin">("all");
  const [mutedConvIds, setMutedConvIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set<string>(JSON.parse(localStorage.getItem("chat:mutedConvs") ?? "[]")); }
    catch { return new Set(); }
  });
  const [pinnedConvIds, setPinnedConvIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set<string>(JSON.parse(localStorage.getItem("chat:pinnedConvs") ?? "[]")); }
    catch { return new Set(); }
  });
  // Image lightbox, scroll-to-bottom, drag-drop, voice recording
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string | null } | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const lastReadRef = useRef<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const meName = user.fullName || `${user.firstName} ${user.lastName}`.trim() || meta.kicker;
  const meId = user.id;
  const setTotalUnread = useChatUnreadStore((s) => s.setTotalUnread);

  const sortedConversations = useMemo(() => {
    const base = [...conversations].sort(sortByActivity);
    const pinned = base.filter((c) => pinnedConvIds.has(c.id));
    const rest = base.filter((c) => !pinnedConvIds.has(c.id));
    return [...pinned, ...rest];
  }, [conversations, pinnedConvIds]);
  const activeConversation = useMemo(
    () => sortedConversations.find((conv) => conv.id === activeConversationId) ?? null,
    [sortedConversations, activeConversationId]
  );
  const isBlockedByMe = !!activeConversation?.blockedByMe;
  const isBlockedMe = !!activeConversation?.blockedMe;
  const conversationIsBlocked = isBlockedByMe || isBlockedMe;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const activeTyping = activeConversationId ? typingUsers[activeConversationId] ?? [] : [];

  const visibleMessages = useMemo(() => activeMessages, [activeMessages]);
  const searchedMessages = useMemo(() => {
    const q = inConvSearch.trim().toLowerCase();
    if (!q) return visibleMessages;
    return visibleMessages.filter((m) => (m.text ?? "").toLowerCase().includes(q));
  }, [visibleMessages, inConvSearch]);
  const messageById = useMemo(() => new Map(visibleMessages.map((message) => [message.id, message])), [visibleMessages]);
  const replyTarget = replyToMessageId ? messageById.get(replyToMessageId) ?? null : null;

  const activeRoster = useMemo(() => {
    const roster = new Map<string, { id: string; name: string; role: string; initials: string; online: boolean }>();
    if (meId) {
      roster.set(meId, { id: meId, name: meName, role: role === "parent" ? "Parent" : role === "student" ? "Student" : role === "admin" ? "Admin" : "Teacher", initials: user.initials, online: true });
    }
    visibleMessages.forEach((message) => {
      if (!roster.has(message.senderId)) {
        const author = deriveAuthor(message, meId, activeConversation?.title);
        roster.set(message.senderId, {
          id: message.senderId,
          name: author.label,
          role: author.role,
          initials: author.initials,
          online: activeTyping.includes(message.senderId),
        });
      }
    });
    if (activeConversation && activeConversation.type === "direct" && activeConversation.title && ![...roster.values()].some((item) => item.name === activeConversation.title)) {
      roster.set(`conversation-${activeConversation.id}`, {
        id: `conversation-${activeConversation.id}`,
        name: activeConversation.title,
        role: "Direct chat",
        initials: initials(activeConversation.title),
        online: activeTyping.length > 0,
      });
    }
    return [...roster.values()].slice(0, 8);
  }, [activeConversation, activeMessages, activeTyping, meId, meName, role, user.initials, visibleMessages]);

  const fileStats = useMemo(() => {
    const photos = visibleMessages.filter((message) => message.imageUrl || message.mediaType === "image").length;
    const videos = visibleMessages.filter((message) => message.mediaType === "video").length;
    const audio = visibleMessages.filter((message) => message.mediaType === "audio").length;
    const files = visibleMessages.filter((message) => message.mediaFileId && !["image", "video", "audio"].includes(message.mediaType ?? "")).length;
    const links = visibleMessages.filter((message) => /https?:\/\//i.test(message.text ?? "")).length;
    return { photos, videos, audio, files, links, total: visibleMessages.length };
  }, [visibleMessages]);

  const latestConversationLabel = activeConversation?.type === "group" ? "Group chat" : activeConversation ? "Direct message" : "No chat selected";

  function getOtherDirectMember(conv: Conversation) {
    if (conv.type !== "direct" || !meId) return null;
    const members = conv.members ?? [];
    return members.find((member) => member.userId !== meId) ?? null;
  }

  function isConversationOnline(conv: Conversation): boolean {
    const peer = getOtherDirectMember(conv);
    if (!peer) return false;
    if (typeof presenceByUserId[peer.userId] === "boolean") return presenceByUserId[peer.userId];
    return !!peer.isOnline;
  }

  function getLastSeenLabel(userId?: string | null) {
    if (!userId) return null;
    const lastSeen = lastSeenByUserId[userId];
    if (!lastSeen) return null;
    return relative(lastSeen);
  }

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedConversations.filter((conv) => {
      if (filter === "direct" && conv.type !== "direct") return false;
      if (filter === "group" && conv.type !== "group") return false;
      if (filter === "parent-visible" && !conv.parentVisible) return false;
      if (!q) return true;
      return [conv.title, conv.description ?? "", conv.lastMessageText ?? "", conv.id, conv.type].join(" ").toLowerCase().includes(q);
    });
  }, [sortedConversations, search, filter]);

  const conversationCounts = useMemo(() => {
    return {
      all: conversations.length,
      direct: conversations.filter((conv) => conv.type === "direct").length,
      group: conversations.filter((conv) => conv.type === "group").length,
      parentVisible: conversations.filter((conv) => conv.parentVisible).length,
      unread: Object.values(unreadCounts).reduce((sum, value) => sum + value, 0),
    };
  }, [conversations, unreadCounts]);

  async function loadConversations(keepActive = false) {
    setLoadingConvs(true);
    setError(null);
    try {
      const list = await listConversations();
      setConversations(list.sort(sortByActivity));
      if (!keepActive || !list.some((c) => c.id === activeConversationRef.current)) {
        setActiveConversationId(list[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations.");
    } finally {
      setLoadingConvs(false);
    }
  }

  async function loadMessages(conversationId: string, force = false) {
    if (!force && (messagesByConversation[conversationId]?.length ?? 0) > 0) return;
    setLoadingMsgs(true);
    setError(null);
    try {
      const messages = await listMessages(conversationId, 80);
      const sorted = [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ) as ChatMessageView[];
      setMessagesByConversation((prev) => ({ ...prev, [conversationId]: sorted }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load messages.");
    } finally {
      setLoadingMsgs(false);
    }
  }

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!meId) return;
    chatRealtime.connect({ id: meId, name: meName });
    const offStatus = chatRealtime.on("status", (s) => setStatus(s));
    const offMessage = chatRealtime.on("message:new", (payload) => {
      const raw = payload.message as ChatMessageView;
      // Ignore messages sent by me — already handled optimistically in sendMessage
      if (meId && raw.senderId === meId) return;
      // Build a full ChatMessageView from whatever the backend sends
      const message: ChatMessageView = {
        id: raw.id,
        conversationId: raw.conversationId ?? payload.conversationId,
        senderId: raw.senderId,
        text: raw.text ?? null,
        createdAt: raw.createdAt,
        replyToId: raw.replyToId ?? null,
        mediaFileId: raw.mediaFileId ?? null,
        mediaType: raw.mediaType ?? null,
        mediaName: raw.mediaName ?? null,
        mediaMimeType: raw.mediaMimeType ?? null,
        mediaSize: raw.mediaSize ?? null,
        editedAt: raw.editedAt ?? null,
        deletedAt: raw.deletedAt ?? null,
        reactions: raw.reactions ?? null,
        imageUrl: raw.imageUrl,
        type: raw.type ?? "text",
        senderName: (raw as any).senderName ?? (raw as any).sender?.firstName
          ? `${(raw as any).sender?.firstName ?? ""} ${(raw as any).sender?.lastName ?? ""}`.trim()
          : undefined,
        senderRole: (raw as any).senderRole ?? (raw as any).sender?.role,
        senderInitials: (raw as any).senderInitials,
      };
      setConversations((prev) =>
        prev
          .map((conv) =>
            conv.id === payload.conversationId
              ? {
                  ...conv,
                  lastMessageText: message.text?.trim() || message.mediaName || conv.lastMessageText,
                  lastMessageAt: message.createdAt,
                  lastMessageSenderId: message.senderId,
                  updatedAt: message.createdAt,
                }
              : conv
          )
          .sort(sortByActivity)
      );
      setMessagesByConversation((prev) => {
        const existing = prev[payload.conversationId] ?? [];
        if (existing.some((item) => item.id === message.id)) return prev;
        return {
          ...prev,
          [payload.conversationId]: [...existing, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        };
      });
      if (payload.conversationId !== activeConversationRef.current) {
        setUnreadCounts((prev) => ({ ...prev, [payload.conversationId]: (prev[payload.conversationId] ?? 0) + 1 }));
        // Notify (desktop + chime) only if the conversation isn't muted
        if (!mutedConvIds.has(payload.conversationId)) {
          const senderLabel = message.senderName?.trim() || "New message";
          const previewText = (message.text?.trim() || message.mediaName || "Sent an attachment").slice(0, 120);
          notifyDesktop(senderLabel, previewText);
          playChime();
        }
      } else if (scrolledUp && message.senderId !== meId) {
        setNewSinceScroll((n) => n + 1);
      }
    });
    const offUpdate = chatRealtime.on("message:update", (payload) => {
      const m = payload.message as ChatMessageView | undefined;
      if (!m) return;
      setMessagesByConversation((prev) => {
        const list = prev[payload.conversationId] ?? [];
        return { ...prev, [payload.conversationId]: list.map((existing) => existing.id === m.id ? { ...existing, text: m.text, editedAt: m.editedAt } : existing) };
      });
    });
    const offDelete = chatRealtime.on("message:delete", (payload) => {
      if (!payload?.messageId) return;
      setMessagesByConversation((prev) => {
        const list = prev[payload.conversationId] ?? [];
        return { ...prev, [payload.conversationId]: list.map((existing) => existing.id === payload.messageId ? { ...existing, deletedAt: new Date().toISOString() } : existing) };
      });
    });
    const offTyping = chatRealtime.on("typing:update", (payload) => {
      setTypingUsers((prev) => {
        const set = new Set(prev[payload.conversationId] ?? []);
        if (payload.isTyping) set.add(payload.userId);
        else set.delete(payload.userId);
        return { ...prev, [payload.conversationId]: [...set] };
      });
    });
    const offPresence = chatRealtime.on("presence:update", (payload) => {
      if (!payload.userId) return;
      const isOnline = payload.isOnline ?? payload.status === "online";
      setPresenceByUserId((prev) => ({ ...prev, [payload.userId]: !!isOnline }));
      setLastSeenByUserId((prev) => ({
        ...prev,
        [payload.userId]: payload.lastSeenAt ?? (!isOnline ? prev[payload.userId] ?? new Date().toISOString() : prev[payload.userId] ?? null),
      }));
    });
    const offConversation = chatRealtime.on("conversation:update", () => {
      void loadConversations(true);
    });
    return () => {
      offStatus();
      offMessage();
      offUpdate();
      offDelete();
      offTyping();
      offPresence();
      offConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, meName]);

  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, value) => sum + value, 0);
    setTotalUnread(total);
  }, [setTotalUnread, unreadCounts]);

  // Ask for desktop notification permission once.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  // Track scroll position to show the floating "scroll-to-bottom" button.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      const up = distFromBottom > 120;
      setScrolledUp(up);
      if (!up) setNewSinceScroll(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !meId) return;
    activeConversationRef.current = activeConversationId;
    setUnreadCounts((prev) => ({ ...prev, [activeConversationId]: 0 }));
    void loadMessages(activeConversationId);
    chatRealtime.joinConversation(activeConversationId, meId);
    return () => {
      chatRealtime.leaveConversation(activeConversationId, meId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, meId]);

  useEffect(() => {
    const latest = activeMessages.at(-1);
    if (!activeConversationId || !meId || !latest || latest.senderId === meId) return;
    if (lastReadRef.current[activeConversationId] === latest.id) return;
    lastReadRef.current[activeConversationId] = latest.id;
    chatRealtime.sendReadReceipt(activeConversationId, meId, latest.id);
  }, [activeConversationId, meId, activeMessages]);

  // Track read receipts from the other party to mark our messages as seen
  useEffect(() => {
    if (!meId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offRead = chatRealtime.on("read:update", (payload) => {
      if (!payload || payload.userId === meId) return;
      const msgs = messagesByConversation[payload.conversationId] ?? [];
      const readMessageId = payload.messageId ?? payload.lastReadMessageId;
      if (!readMessageId) return;
      const idx = msgs.findIndex((m) => m.id === readMessageId);
      const toMark = idx >= 0 ? msgs.slice(0, idx + 1) : msgs;
      const myMsgIds = toMark.filter((m) => m.senderId === meId).map((m) => m.id);
      if (myMsgIds.length > 0) {
        setSeenIds((prev) => {
          const next = new Set(prev);
          myMsgIds.forEach((id) => next.add(id));
          return next;
        });
      }
    });
    return () => offRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, messagesByConversation]);

  useEffect(() => {
    if (!showCompose) return;
    const q = composeQuery.trim();
    // Allow empty query when a role tab is selected to browse the directory
    if (q.length < 2 && composeRoleTab === "all") {
      setComposeResults([]);
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        const roleArg = composeRoleTab === "all" ? undefined : composeRoleTab;
        const res = await searchUsers(roleArg, q || undefined);
        if (alive) setComposeResults(res.filter((u) => u.id !== meId));
      } catch {
        if (alive) setComposeResults([]);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [showCompose, composeQuery, composeRoleTab, meId]);

  useEffect(() => {
    if (!meId || !activeConversationId) return;
    if (typingTimerRef.current != null) window.clearTimeout(typingTimerRef.current);
    const hasText = (drafts[activeConversationId] ?? "").trim().length > 0;
    if (!hasText) {
      chatRealtime.sendTyping(activeConversationId, meId, false);
      return;
    }
    chatRealtime.sendTyping(activeConversationId, meId, true);
    typingTimerRef.current = window.setTimeout(() => {
      chatRealtime.sendTyping(activeConversationId, meId, false);
    }, 1300);
    return () => {
      if (typingTimerRef.current != null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [activeConversationId, drafts, meId]);

  // Scroll to bottom on conversation switch or when the user is already near the bottom.
  // Avoid yanking the view if the user has scrolled up to read history.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    if (!scrolledUp || distFromBottom < 200) {
      const raf = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      return () => cancelAnimationFrame(raf);
    }
  }, [activeConversationId, activeMessages.length, scrolledUp]);

  function setDraft(conversationId: string, value: string) {
    setDrafts((prev) => ({ ...prev, [conversationId]: value }));
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    activeConversationRef.current = id;
    setReplyToMessageId(null);
    setEmojiPickerOpen(false);
  }

  async function sendMessage() {
    if (!activeConversationId || !meId) return;
    const text = (drafts[activeConversationId] ?? "").trim();
    if (!text && !pendingAttachment) return;
    if (conversationIsBlocked) {
      setError(isBlockedByMe ? "Unblock this conversation before sending messages." : "You are blocked in this conversation.");
      return;
    }
    setSending(true);
    // Optimistic: add a temp message immediately
    const tempId = `pending-${Date.now()}`;
    const attachment = pendingAttachment;
    const optimistic: ChatMessageView = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: meId,
      text: text || (attachment ? `Attachment: ${attachment.filename}` : ""),
      createdAt: new Date().toISOString(),
      mediaFileId: attachment?.id ?? null,
      mediaType: null,
      mediaName: attachment?.filename ?? null,
      mediaMimeType: null,
      mediaSize: null,
      editedAt: null,
      deletedAt: null,
      reactions: null,
      imageUrl: attachment?.mime.startsWith("image/") ? attachment.path : undefined,
      type: "text",
      senderName: meName,
      senderRole: role,
      senderInitials: user.initials,
      replyToId: replyToMessageId ?? null,
    };
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] ?? []), optimistic],
    }));
    setPendingIds((prev) => new Set(prev).add(tempId));
    setDraft(activeConversationId, "");
    setPendingAttachment(null);
    setReplyToMessageId(null);
    chatRealtime.sendTyping(activeConversationId, meId, false);
    try {
      const sent = await postChatMessage(activeConversationId, { text: text || null, mediaFileId: attachment?.id ?? null, replyToId: replyToMessageId ?? null });
      const view: ChatMessageView = {
        ...sent,
        senderName: meName,
        senderRole: role,
        senderInitials: user.initials,
      };
      // Replace optimistic with real message
      setMessagesByConversation((prev) => {
        const existing = (prev[activeConversationId] ?? []).filter((m) => m.id !== tempId);
        return {
          ...prev,
          [activeConversationId]: [...existing, view].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        };
      });
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setConversations((prev) =>
        prev
          .map((conv) =>
            conv.id === activeConversationId
              ? { ...conv, lastMessageText: sent.text?.trim() || sent.mediaName || conv.lastMessageText, lastMessageAt: sent.createdAt, lastMessageSenderId: sent.senderId, updatedAt: sent.createdAt }
              : conv
          )
          .sort(sortByActivity)
      );
      lastReadRef.current[activeConversationId] = sent.id;
    } catch (err) {
      // Remove optimistic on failure
      setMessagesByConversation((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] ?? []).filter((m) => m.id !== tempId),
      }));
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(tempId);
        return next;
      });
      setError(err instanceof Error ? err.message : "Unable to send message.");
      if (attachment) setPendingAttachment(attachment);
      setReplyToMessageId(replyToMessageId);
    } finally {
      setSending(false);
    }
  }

  function persistMutes(next: Set<string>) {
    setMutedConvIds(new Set(next));
    try { localStorage.setItem("chat:mutedConvs", JSON.stringify([...next])); } catch { /* ignore */ }
  }
  function toggleMute(conversationId: string) {
    const next = new Set(mutedConvIds);
    if (next.has(conversationId)) next.delete(conversationId);
    else next.add(conversationId);
    persistMutes(next);
  }

  function togglePin(conversationId: string) {
    const next = new Set(pinnedConvIds);
    if (next.has(conversationId)) next.delete(conversationId);
    else next.add(conversationId);
    setPinnedConvIds(new Set(next));
    try { localStorage.setItem("chat:pinnedConvs", JSON.stringify([...next])); } catch { /* ignore */ }
  }

  function scrollToMessage(messageId: string) {
    const el = messageRefs.current[messageId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId((cur) => cur === messageId ? null : cur), 1800);
  }

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewSinceScroll(0);
  }

  function playChime() {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctor) return;
      const ctx = new Ctor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => ctx.close().catch(() => undefined);
    } catch { /* ignore */ }
  }

  function notifyDesktop(title: string, body: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(title, { body, silent: true, tag: `chat:${activeConversationRef.current ?? ""}` });
      n.onclick = () => { window.focus(); n.close(); };
      window.setTimeout(() => n.close(), 6000);
    } catch { /* ignore */ }
  }

  async function startVoiceRecord() {
    if (isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimerRef.current != null) { window.clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setIsRecording(false);
        setRecordingSeconds(0);
        if (blob.size < 800) return; // discard near-empty
        const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        try {
          setAttachmentUploading(true);
          const uploaded = await uploadChatFile(file);
          setPendingAttachment({ id: uploaded.id, filename: uploaded.filename, mime: uploaded.mime, path: uploaded.path });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to upload voice clip.");
        } finally {
          setAttachmentUploading(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission denied.");
    }
  }

  function stopVoiceRecord(send: boolean) {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (!send) recordChunksRef.current = [];
    try { mr.stop(); } catch { /* ignore */ }
    mediaRecorderRef.current = null;
  }

    async function handleEditMessage(messageId: string, conversationId: string) {
    const trimmed = editingText.trim();
    if (!trimmed) { setEditingMessageId(null); return; }
    try {
        const updated = await editChatMessage(messageId, trimmed);
      setMessagesByConversation((prev) => {
        const list = prev[updated.conversationId] ?? [];
        return {
          ...prev,
          [updated.conversationId]: list.map((m) => m.id === messageId ? { ...m, text: updated.text, editedAt: updated.editedAt } : m),
        };
      });
      setEditingMessageId(null);
      setEditingText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to edit message.");
    }
  }

    async function handleDeleteMessage(messageId: string, conversationId: string) {
    if (!confirm("Delete this message?")) return;
    try {
        await deleteChatMessage(messageId);
      setMessagesByConversation((prev) => {
        const list = prev[conversationId] ?? [];
        return {
          ...prev,
          [conversationId]: list.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete message.");
    }
  }

  async function handleForward(targetConversationId: string) {
    if (!forwardingMessageId) return;
    const source = messageById.get(forwardingMessageId);
    if (!source) { setForwardingMessageId(null); return; }
    try {
      await forwardChatMessage(targetConversationId, { text: source.text, mediaFileId: source.mediaFileId });
      setForwardingMessageId(null);
      selectConversation(targetConversationId);
      void loadMessages(targetConversationId, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to forward message.");
    }
  }

  function copyMessageText(text?: string | null) {
    if (!text) return;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  async function startDirectChat(person: PublicUser) {
    setShowCompose(false);
    setComposeQuery("");
    setComposeResults([]);
    setSelectedPeople([]);
    try {
      const existing = conversations.find((conv) => conv.type === "direct" && conv.title.toLowerCase().includes(`${person.firstName} ${person.lastName}`.trim().toLowerCase()));
      if (existing) {
        selectConversation(existing.id);
        return;
      }
      const result = await initiateDirectChat(person.id);
      await loadConversations(true);
      selectConversation(result.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start chat.");
    }
  }

  async function createGroupChat() {
    const selectedIds = selectedPeople.map((p) => p.id);
    const title = composeTitle.trim();
    if (!title) {
      setError("Group title is required.");
      return;
    }
    try {
      const result = await createConversation({
        type: "group",
        title,
        memberIds: selectedIds,
        parentVisible: composeParentVisible,
      });
      setShowCompose(false);
      setComposeTitle("");
      setSelectedPeople([]);
      setComposeResults([]);
      setComposeQuery("");
      if (result) {
        await loadConversations(true);
        selectConversation(result.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create conversation.");
    }
  }

  function toggleSelected(person: PublicUser) {
    setSelectedPeople((prev) => {
      const exists = prev.some((item) => item.id === person.id);
      if (composeMode === "direct") return exists ? [] : [person];
      return exists ? prev.filter((item) => item.id !== person.id) : [...prev, person];
    });
  }

  // Avatar color palette
  const AVATAR_COLORS = [
    "linear-gradient(135deg,#7c3aed,#6366f1)",
    "linear-gradient(135deg,#ec4899,#f43f5e)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#10b981,#06b6d4)",
    "linear-gradient(135deg,#3b82f6,#6366f1)",
    "linear-gradient(135deg,#8b5cf6,#ec4899)",
  ];

  function avatarColor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  // For direct chats, strip the current user's name and show only the other person
  function conversationDisplayName(conv: Conversation): string {
    if (conv.type !== "direct") return conv.title;

    const otherMember = getOtherDirectMember(conv);
    if (otherMember?.displayName?.trim()) {
      return otherMember.displayName.trim();
    }

    if (!meName) return conv.title;
    const title = conv.title ?? "";
    // Common patterns: "Alice and Bob", "Alice & Bob"
    const parts = title.split(/\s+(?:and|&)\s+/i);
    if (parts.length === 2) {
      const meTokens = new Set(
        meName
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
      );
      const other = parts.find((p) => {
        const candidateTokens = p
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        return !candidateTokens.every((token) => meTokens.has(token));
      });
      if (other) return other.trim();
    }
    return title;
  }

  const iconBtnStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    width: 26,
    height: 26,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#475569",
    transition: "background 0.15s",
  };

  function renderMessages(messages: ChatMessageView[]) {
    if (!messages.length) {
      return (
        <div className="chat-empty-state">
          <strong style={{ color: "#1a1a2e", fontSize: "0.9rem" }}>No messages yet</strong>
          <span style={{ fontSize: "0.8rem" }}>Start the conversation below.</span>
        </div>
      );
    }

    let lastDay = "";
    return messages.map((message) => {
      const day = new Date(message.createdAt).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      const author = deriveAuthor(message, meId, activeConversation?.title);
      const mine = !!meId && message.senderId === meId;
      const showDay = day !== lastDay;
      lastDay = day;

      // Telegram-style status for my messages
      const isPending = pendingIds.has(message.id);
      const isSeen = seenIds.has(message.id);

      const msgStatus = mine ? (
        <span className="chat-msg-status" aria-label={isPending ? "Sending" : isSeen ? "Seen" : "Delivered"}>
          {isPending
            ? <Clock size={11} />
            : isSeen
            ? <CheckCheck size={12} style={{ color: "#7c3aed" }} />
            : <Check size={12} />}
        </span>
      ) : null;

      const isDeleted = !!message.deletedAt;
      const isEditing = editingMessageId === message.id;
      const isMenuOpen = openMenuMessageId === message.id;
      const isReactOpen = openReactPickerId === message.id;

      async function applyReaction(emoji: string) {
        try {
          const updated = await toggleChatMessageReaction(message.id, emoji);
          setMessagesByConversation((prev) => ({
            ...prev,
            [activeConversationId ?? ""]: (prev[activeConversationId ?? ""] ?? []).map((item) => item.id === updated.id ? { ...item, reactions: updated.reactions ?? null } : item),
          }));
          setOpenReactPickerId(null);
        } catch (reactionError) {
          setError(reactionError instanceof Error ? reactionError.message : "Unable to update reaction.");
        }
      }

      const emojiOnly = !isDeleted && isEmojiOnly(message.text);
      const isHighlighted = highlightedMessageId === message.id;

      return (
        <div key={message.id}>
          {showDay && <div className="chat-day-divider">{day}</div>}
          <div
            className={`chat-bubble-wrap ${mine ? "mine" : "other"} chat-bubble-row`}
            ref={(el) => { messageRefs.current[message.id] = el; }}
            style={isHighlighted ? { transition: "background 0.4s", background: "rgba(124,58,237,0.12)", borderRadius: 14 } : undefined}
          >
            {!mine && (
              <div className="chat-bubble-avatar-slot">
                <div className="chat-participant-avatar" style={{ background: avatarColor(message.senderId) }}>
                  {author.initials}
                </div>
              </div>
            )}
            <div className={`chat-bubble ${mine ? "mine" : "other"} ${isPending ? "pending" : ""}`} style={isDeleted ? { opacity: 0.6, fontStyle: "italic" } : emojiOnly ? { background: "transparent", boxShadow: "none", padding: "0.15rem 0.25rem" } : undefined}>
              {!mine && !isDeleted && !emojiOnly && (
                <div className="chat-bubble-sender-name">{author.label}</div>
              )}
              {!isDeleted && message.replyToId && messageById.get(message.replyToId) && (
                <button
                  type="button"
                  onClick={() => scrollToMessage(message.replyToId!)}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "0.45rem 0.65rem", borderRadius: 12, background: mine ? "rgba(255,255,255,0.14)" : "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.12)", fontSize: "0.78rem", cursor: "pointer", color: "inherit" }}
                >
                  <div style={{ fontWeight: 700, opacity: 0.8, marginBottom: 2 }}>{deriveAuthor(messageById.get(message.replyToId)!, meId, activeConversation?.title).label}</div>
                  <div style={{ opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{messageById.get(message.replyToId)!.text || messageById.get(message.replyToId)!.mediaName || "Attachment"}</div>
                </button>
              )}
              {isDeleted ? (
                <div className="chat-bubble-text">This message was deleted</div>
              ) : isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={2}
                    style={{ width: "100%", minWidth: 200, padding: "0.5rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.4)", background: mine ? "rgba(255,255,255,0.18)" : "#fff", color: mine ? "#fff" : "inherit", fontFamily: "inherit", fontSize: "0.85rem", resize: "vertical" }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleEditMessage(message.id, message.conversationId); }
                      if (e.key === "Escape") { setEditingMessageId(null); setEditingText(""); }
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingMessageId(null); setEditingText(""); }} style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleEditMessage(message.id, message.conversationId)} style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}>Save</button>
                  </div>
                </div>
              ) : message.text ? (
                <div className="chat-bubble-text" style={emojiOnly ? { fontSize: "2.6rem", lineHeight: 1.1 } : undefined}>
                  {linkifyText(message.text)}
                </div>
              ) : null}
              {!isDeleted && !isEditing && message.imageUrl && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setLightboxImage({ url: message.imageUrl!, name: message.mediaName })}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "zoom-in" }}
                    aria-label="Open image"
                  >
                    <img src={message.imageUrl} alt={message.mediaName ?? "attachment"} style={{ maxWidth: 280, width: "100%", borderRadius: 12, display: "block" }} />
                  </button>
                </div>
              )}
              {!isDeleted && !isEditing && !message.imageUrl && message.mediaFileId && (message.mediaType === "audio" || message.mediaMimeType?.startsWith("audio/")) && (
                <div style={{ marginTop: 8 }}>
                  <audio controls src={(message as any).mediaUrl || (message as any).imageUrl || undefined} style={{ maxWidth: 260, width: "100%" }} />
                  <div style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: 2 }}>Voice message</div>
                </div>
              )}
              {!isDeleted && !isEditing && !message.imageUrl && message.mediaFileId && !(message.mediaType === "audio" || message.mediaMimeType?.startsWith("audio/")) && (
                <div style={{ marginTop: 8, padding: "0.5rem 0.75rem", borderRadius: 12, background: "rgba(124,58,237,0.08)", fontSize: "0.8rem", fontWeight: 600 }}>
                  📎 {message.mediaName ?? "Attachment"}
                </div>
              )}
              {!isDeleted && message.reactions && Object.keys(message.reactions).length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {Object.entries(message.reactions).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => void applyReaction(emoji)}
                      style={{ borderRadius: 999, padding: "0.1rem 0.5rem", fontSize: "0.78rem", background: mine ? "rgba(255,255,255,0.2)" : "rgba(124,58,237,0.12)", color: mine ? "#fff" : "#5b21b6", border: "none", cursor: "pointer", fontWeight: 700 }}
                    >
                      {emoji} {users.length}
                    </button>
                  ))}
                </div>
              )}
              <div className="chat-bubble-footer">
                <span className="chat-bubble-time">{fmtTime(message.createdAt)}{message.editedAt && !isDeleted ? " · edited" : ""}</span>
                {!isDeleted && msgStatus}
              </div>

              {/* Hover action menu */}
              {!isDeleted && !isEditing && (
                <div className="chat-bubble-actions" style={{ position: "absolute", top: -14, [mine ? "right" : "left"]: 8, display: "flex", gap: 2, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "2px", boxShadow: "0 4px 14px rgba(15,23,42,0.12)", opacity: 0, pointerEvents: "none", transition: "opacity 0.15s", zIndex: 40 } as any}>
                  <button type="button" title="React" onClick={() => setOpenReactPickerId(isReactOpen ? null : message.id)} style={iconBtnStyle}><SmilePlus size={14} /></button>
                  <button type="button" title="Reply" onClick={() => setReplyToMessageId(message.id)} style={iconBtnStyle}><ReplyIcon size={14} /></button>
                  <button type="button" title="Forward" onClick={() => setForwardingMessageId(message.id)} style={iconBtnStyle}><CornerUpRight size={14} /></button>
                  <button type="button" title="Copy" onClick={() => copyMessageText(message.text)} style={iconBtnStyle}><CopyIcon size={14} /></button>
                  {mine && (
                    <>
                      <button type="button" title="Edit" onClick={() => { setEditingMessageId(message.id); setEditingText(message.text ?? ""); }} style={iconBtnStyle}><Pencil size={14} /></button>
                      <button type="button" title="Delete" onClick={() => void handleDeleteMessage(message.id, message.conversationId)} style={{ ...iconBtnStyle, color: "#dc2626" }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              )}
              {isReactOpen && (
                <div style={{ position: "absolute", top: -48, [mine ? "right" : "left"]: 8, display: "flex", gap: 4, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 999, padding: "4px 6px", boxShadow: "0 6px 20px rgba(15,23,42,0.18)", zIndex: 50 } as any}>
                  {["👍", "❤️", "😂", "😮", "😢", "🎉", "🙏"].map((emoji) => (
                    <button key={emoji} type="button" onClick={() => void applyReaction(emoji)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "1.05rem", padding: "0 4px" }}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }

  return (
    <div className="chat-layout" style={showInfo ? undefined : { gridTemplateColumns: "clamp(230px, 21vw, 280px) minmax(0, 1fr)" }}>
      {/* Left sidebar — conversation list */}
      <aside className="chat-list-card" style={{ background: "#fff", display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "0.9rem", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="chat-list-head">
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a1a2e" }}>Messages</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {status === "open" ? (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} title="Connected" />
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} title="Connecting…" />
              )}
              <button
                type="button"
                className="chat-stage-icon-btn"
                style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-600)", color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setShowCompose(true)}
                aria-label="New conversation"
                title="New conversation"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="chat-tools-row">
            <div className="chat-search-wrap">
              <Search size={13} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
              />
            </div>
          </div>

          <div className="chat-filter-row">
            {(["all", "direct", "group"] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`chat-filter-chip ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? `All (${conversationCounts.all})` : f === "direct" ? `DMs (${conversationCounts.direct})` : `Groups (${conversationCounts.group})`}
              </button>
            ))}
          </div>

          {error && <div className="chat-alert">{error}</div>}

          <div className="chat-conv-scroll">
            {loadingConvs ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="chat-conv-skeleton shimmer" />
              ))
            ) : filteredConversations.length === 0 ? (
              <div className="chat-empty-state" style={{ padding: "2rem 1rem", fontSize: "0.82rem" }}>
                {conversations.length === 0 ? "No conversations yet. Start one with the + button." : "No matches for your search."}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const unread = unreadCounts[conv.id] ?? 0;
                const typing = typingUsers[conv.id] ?? [];
                const isPinned = pinnedConvIds.has(conv.id);
                const displayName = conversationDisplayName(conv);
                const lastText = typing.length > 0 ? "typing…" : conv.lastMessageText ?? "";

                return (
                  <button
                    key={conv.id}
                    type="button"
                    className={`chat-conv-card ${isActive ? "active" : ""}`}
                    onClick={() => setActiveConversationId(conv.id)}
                  >
                    <div className="chat-conv-avatar-shell">
                      <div className={`chat-conv-avatar-large ${conv.type}`}>
                        {initials(displayName)}
                      </div>
                      {conv.type === "direct" && (
                        <span className={`chat-avatar-dot ${isConversationOnline(conv) ? "online" : "offline"}`} />
                      )}
                    </div>
                    <div className="chat-conv-copy">
                      <div className="chat-conv-card-title">
                        {isPinned && <Pin size={10} style={{ marginRight: 3, opacity: 0.5 }} />}
                        {displayName}
                      </div>
                      <div className={`chat-conv-card-sub ${typing.length > 0 ? "typing" : ""}`}>
                        {lastText || <span style={{ opacity: 0.4 }}>No messages yet</span>}
                      </div>
                    </div>
                    <div className="chat-conv-meta">
                      {conv.lastMessageAt && (
                        <span>{relative(conv.lastMessageAt)}</span>
                      )}
                      {unread > 0 && <strong>{unread > 99 ? "99+" : unread}</strong>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Message Area */}
      <main className="chat-stage" style={{ borderRadius: 16, overflow: "hidden" }}>
          {activeConversation ? (
            <>
              <div className="chat-stage-head">
                <div className="chat-stage-contact">
                  <div className="chat-stage-contact-avatar" style={{ background: avatarColor(activeConversation.id) }}>
                    {initials(conversationDisplayName(activeConversation))}
                  </div>
                  <div>
                    <div className="chat-stage-title">{conversationDisplayName(activeConversation)}</div>
                    <div className={`chat-stage-subtitle ${status !== "open" ? "offline" : ""}`}>
                      {activeTyping.length > 0
                        ? "typing…"
                        : status === "connecting"
                        ? "Connecting…"
                        : activeConversation.type === "direct"
                        ? isConversationOnline(activeConversation)
                          ? "Online"
                          : `Last seen ${getLastSeenLabel(getOtherDirectMember(activeConversation)?.userId) ?? "recently"}`
                        : status === "open"
                        ? "Connected"
                        : "Offline"}
                    </div>
                  </div>
                </div>
              <div className="chat-stage-actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {inConvSearchOpen ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.3rem 0.6rem", background: "#f1f5f9", borderRadius: 999 }}>
                    <Search size={14} style={{ color: "#64748b" }} />
                    <input
                      autoFocus
                      value={inConvSearch}
                      onChange={(e) => setInConvSearch(e.target.value)}
                      placeholder="Search in chat…"
                      style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.82rem", width: 160 }}
                    />
                    <button type="button" onClick={() => { setInConvSearch(""); setInConvSearchOpen(false); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }} aria-label="Close search"><X size={14} /></button>
                  </div>
                ) : (
                  <button type="button" className="chat-stage-icon-btn" aria-label="Search messages" title="Search in chat" onClick={() => setInConvSearchOpen(true)}>
                    <Search size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="chat-stage-icon-btn"
                  aria-label={mutedConvIds.has(activeConversation.id) ? "Unmute" : "Mute"}
                  title={mutedConvIds.has(activeConversation.id) ? "Unmute notifications" : "Mute notifications"}
                  onClick={() => toggleMute(activeConversation.id)}
                  style={{ color: mutedConvIds.has(activeConversation.id) ? "#dc2626" : undefined }}
                >
                  {mutedConvIds.has(activeConversation.id) ? <BellOff size={16} /> : <Bell size={16} />}
                </button>
                <button
                  type="button"
                  className="chat-stage-icon-btn"
                  aria-label={showInfo ? "Hide info" : "Show info"}
                  title={showInfo ? "Hide details" : "Show details"}
                  onClick={() => setShowInfo((v) => !v)}
                  style={{ color: showInfo ? "#7c3aed" : undefined }}
                >
                  <ChevronRight size={18} style={{ transform: showInfo ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }} />
                </button>
              </div>
            </div>

            <div
              className="chat-message-stack"
              ref={listRef}
              onDragOver={(e) => { e.preventDefault(); if (!isDragging) setIsDragging(true); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer?.files?.[0];
                if (!file) return;
                try {
                  setAttachmentUploading(true);
                  const uploaded = await uploadChatFile(file);
                  setPendingAttachment({ id: uploaded.id, filename: uploaded.filename, mime: uploaded.mime, path: uploaded.path });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to upload file.");
                } finally {
                  setAttachmentUploading(false);
                }
              }}
              style={{ position: "relative" }}
            >
              {loadingMsgs
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`chat-bubble-wrap ${i % 2 === 0 ? "other" : "mine"}`}>
                      <div className="chat-conv-skeleton shimmer" style={{ width: i % 2 === 0 ? "55%" : "45%", height: 52, borderRadius: 16, margin: "4px 0" }} />
                    </div>
                  ))
                : renderMessages(searchedMessages)}

              {isDragging && (
                <div style={{ position: "absolute", inset: 12, border: "2px dashed #7c3aed", borderRadius: 16, background: "rgba(237,233,254,0.85)", display: "flex", alignItems: "center", justifyContent: "center", color: "#5b21b6", fontWeight: 800, fontSize: "1rem", pointerEvents: "none" }}>
                  Drop file to attach
                </div>
              )}

              {scrolledUp && (
                <button
                  type="button"
                  onClick={scrollToBottom}
                  aria-label="Scroll to latest"
                  style={{ position: "absolute", right: 16, bottom: 12, width: 42, height: 42, borderRadius: "50%", background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}
                >
                  <ArrowDown size={18} />
                  {newSinceScroll > 0 && (
                    <span style={{ position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#7c3aed", color: "#fff", fontSize: "0.65rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {newSinceScroll > 99 ? "99+" : newSinceScroll}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="chat-compose-bar">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setAttachmentUploading(true);
                    const uploaded = await uploadChatFile(file);
                    setPendingAttachment({ id: uploaded.id, filename: uploaded.filename, mime: uploaded.mime, path: uploaded.path });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to upload file.");
                  } finally {
                    setAttachmentUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              <button
                type="button"
                className="chat-compose-icon-btn"
                aria-label="Emoji picker"
                onClick={() => setEmojiPickerOpen((value) => !value)}
                disabled={conversationIsBlocked}
              >
                🙂
              </button>
              <button
                type="button"
                className="chat-compose-icon-btn"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachmentUploading || conversationIsBlocked}
              >
                <Paperclip size={18} />
              </button>
              {isRecording ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.4rem 0.7rem", borderRadius: 999, background: "#fee2e2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 700, fontSize: "0.82rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", animation: "pulse 1.5s ease-in-out infinite" }} />
                  Recording {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                  <button type="button" onClick={() => stopVoiceRecord(false)} aria-label="Cancel recording" style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b91c1c" }}><X size={14} /></button>
                  <button type="button" onClick={() => stopVoiceRecord(true)} aria-label="Send voice" style={{ border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Square size={12} fill="#fff" /></button>
                </div>
              ) : (
                <button
                  type="button"
                  className="chat-compose-icon-btn"
                  aria-label="Record voice message"
                  title="Record voice"
                  onClick={() => void startVoiceRecord()}
                  disabled={attachmentUploading || conversationIsBlocked}
                >
                  <Mic size={18} />
                </button>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {replyTarget && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0.5rem 0.75rem", borderRadius: 14, background: "#eef2ff", border: "1px solid #c7d2fe", fontSize: "0.8rem" }}>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontWeight: 700, color: "#4338ca" }}>Replying to {deriveAuthor(replyTarget, meId, activeConversation?.title).label}</div>
                      <div style={{ color: "#4f46e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyTarget.text || replyTarget.mediaName || "Attachment"}</div>
                    </div>
                    <button type="button" onClick={() => setReplyToMessageId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#4338ca", fontWeight: 700 }}>Cancel</button>
                  </div>
                )}
                {pendingAttachment && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "0.5rem 0.75rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.8rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {pendingAttachment.mime.startsWith("image/") ? (
                        <img src={pendingAttachment.path} alt={pendingAttachment.filename} style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "#ede9fe", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>FILE</div>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingAttachment.filename}</span>
                    </div>
                    <button type="button" onClick={() => setPendingAttachment(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#7c3aed" }}>Remove</button>
                  </div>
                )}
                {emojiPickerOpen && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0.45rem 0.65rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    {["😀", "😊", "👍", "❤️", "🎉", "🙏"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          if (activeConversationId) {
                            setDraft(activeConversationId, `${drafts[activeConversationId] ?? ""}${drafts[activeConversationId] ? " " : ""}${emoji}`);
                          }
                          setEmojiPickerOpen(false);
                        }}
                        style={{ borderRadius: 999, padding: "0.2rem 0.5rem" }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              <textarea
                value={drafts[activeConversationId ?? ""] ?? ""}
                onChange={(e) => activeConversationId && setDraft(activeConversationId, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
                }}
                placeholder={conversationIsBlocked ? (isBlockedByMe ? "Unblock to send a message…" : "You are blocked…") : "Type a message…"}
                rows={1}
                disabled={conversationIsBlocked}
              />
              </div>
              <button type="button" className="chat-send-btn" onClick={() => void sendMessage()} disabled={sending || attachmentUploading || conversationIsBlocked || (!((drafts[activeConversationId ?? ""] ?? "").trim()) && !pendingAttachment)} aria-label="Send">
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="chat-empty-state chat-stage-empty">
            <div className="chat-stage-empty-mark">TL</div>
            <strong style={{ color: "#1a1a2e", fontSize: "0.95rem" }}>No conversation selected</strong>
            <span style={{ fontSize: "0.82rem" }}>Choose a thread from the list or start a new one.</span>
          </div>
        )}
      </main>

      {/* Right Info Panel — conditionally rendered */}
      {showInfo && (
        <aside className="chat-info">
          <div className="chat-info-head">
            <div>
              <div className="chat-info-title">{activeConversation ? conversationDisplayName(activeConversation) : "Chat Info"}</div>
              {activeConversation && <div className="chat-info-subtitle">{activeConversation.type} thread</div>}
            </div>
            <button type="button" className="chat-stage-icon-btn" aria-label="Close info" onClick={() => setShowInfo(false)}>
              <X size={16} />
            </button>
          </div>

          {activeConversation ? (
            <>
              <div className="chat-info-card">
                <div className="chat-info-card-hero">
                  <div className="chat-info-avatar" style={{ background: avatarColor(activeConversation.id) }}>{initials(conversationDisplayName(activeConversation))}</div>
                  <div className="chat-info-name">{conversationDisplayName(activeConversation)}</div>
                  <div className="chat-info-role">{activeConversation.type} thread</div>
                </div>
              </div>

              {activeConversation.type === "direct" && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={async () => {
                      try {
                        setIsBlocking(true);
                        const result = isBlockedByMe ? await unblockConversation(activeConversation.id) : await blockConversation(activeConversation.id);
                        setConversations((prev) => prev.map((conv) => conv.id === activeConversation.id ? { ...conv, blockedByMe: result.blockedByMe, blockedMe: result.blockedMe } : conv));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Unable to update block status.");
                      } finally {
                        setIsBlocking(false);
                      }
                    }}
                    disabled={isBlocking}
                  >
                    {isBlockedByMe ? "Unblock user" : "Block user"}
                  </button>
                </div>
              )}

              {/* Notifications row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 12, fontSize: "0.82rem", fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#475569" }}>
                  {mutedConvIds.has(activeConversation.id) ? <BellOff size={15} /> : <Bell size={15} />}
                  {mutedConvIds.has(activeConversation.id) ? "Muted" : "Notifications on"}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleMute(activeConversation.id)} style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}>
                  {mutedConvIds.has(activeConversation.id) ? "Unmute" : "Mute"}
                </button>
              </div>

              <div className="chat-info-section-title">Shared media</div>
              {(() => {
                const photos = visibleMessages.filter((m) => !m.deletedAt && m.imageUrl);
                if (photos.length === 0) {
                  return <div className="chat-empty-note" style={{ marginBottom: 12 }}>No photos shared yet.</div>;
                }
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 12 }}>
                    {photos.slice(-9).reverse().map((m) => (
                      <a key={m.id} href={m.imageUrl} target="_blank" rel="noreferrer" style={{ display: "block", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <img src={m.imageUrl} alt={m.mediaName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </a>
                    ))}
                  </div>
                );
              })()}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
                {[
                  { label: "Photos", value: fileStats.photos },
                  { label: "Files", value: fileStats.files },
                  { label: "Links", value: fileStats.links },
                ].map((item) => (
                  <div key={item.label} className="chat-file-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="chat-info-section-title">Members</div>
              <div className="chat-member-list">
                {activeRoster.map((person) => (
                  <div key={person.id} className="chat-member-item">
                    <div className="chat-member-avatar" style={{ background: avatarColor(person.id) }}>{person.initials}</div>
                    <div className="chat-member-copy">
                      <div className="chat-member-name">{person.name}</div>
                      <div className="chat-member-role">{person.role}</div>
                    </div>
                    <span className={`chat-member-state ${person.online ? "online" : "offline"}`}>{person.online ? "●" : "○"}</span>
                  </div>
                ))}
                {activeRoster.length === 0 && <div className="chat-empty-note">No members resolved yet.</div>}
              </div>

              <div className="chat-info-section-title">Details</div>
              <div className="chat-info-stats">
                <div><span>Last activity</span><strong>{relative(activeConversation.lastMessageAt ?? activeConversation.updatedAt ?? activeConversation.createdAt)}</strong></div>
                <div><span>Visibility</span><strong>{activeConversation.parentVisible ? "Parent visible" : "Private"}</strong></div>
                <div><span>Thread ID</span><strong>{activeConversation.id.slice(0, 8)}</strong></div>
                {activeConversation.type === "direct" && getOtherDirectMember(activeConversation) && (
                  <div><span>Last seen</span><strong>{isConversationOnline(activeConversation) ? "Online now" : getLastSeenLabel(getOtherDirectMember(activeConversation)?.userId) ?? "Unknown"}</strong></div>
                )}
              </div>

              <div className="chat-info-note">Realtime sync active via backend socket.</div>
            </>
          ) : (
            <div className="chat-empty-note">Open a thread to see details, files, and members.</div>
          )}
        </aside>
      )}

      {/* Forward Modal */}
      {forwardingMessageId && (
        <div className="chat-compose-overlay" onClick={() => setForwardingMessageId(null)}>
          <div className="chat-compose-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="chat-compose-head">
              <div className="chat-compose-title">Forward to…</div>
              <button className="chat-stage-icon-btn" type="button" onClick={() => setForwardingMessageId(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {sortedConversations.filter((c) => c.id !== activeConversationId).map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  className="chat-member-option-row"
                  onClick={() => void handleForward(conv.id)}
                >
                  <div className="chat-member-avatar" style={{ background: avatarColor(conv.id) }}>{initials(conversationDisplayName(conv))}</div>
                  <div className="chat-member-copy">
                    <div className="chat-member-name">{conversationDisplayName(conv)}</div>
                    <div className="chat-member-role">{conv.type === "direct" ? "Direct message" : "Group"}</div>
                  </div>
                  <span className="chat-member-action">Send</span>
                </button>
              ))}
              {sortedConversations.filter((c) => c.id !== activeConversationId).length === 0 && (
                <div className="chat-empty-note">No other conversations available.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            aria-label="Close"
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.16)", color: "#fff", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name ?? "image"}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8 }}
          />
          {lightboxImage.name && (
            <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: "0.85rem" }}>{lightboxImage.name}</div>
          )}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="chat-compose-overlay" onClick={() => setShowCompose(false)}>
          <div className="chat-compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-compose-head">
              <div className="chat-compose-title">New Conversation</div>
              <button className="chat-stage-icon-btn" type="button" onClick={() => setShowCompose(false)} aria-label="Close"><X size={16} /></button>
            </div>

            <div className="chat-compose-type-row">
              <button className={`chat-compose-type-btn ${composeMode === "direct" ? "active" : ""}`} type="button" onClick={() => setComposeMode("direct")}>Direct</button>
              {meta.allowGroups && (
                <button className={`chat-compose-type-btn ${composeMode === "group" ? "active" : ""}`} type="button" onClick={() => setComposeMode("group")}>Group</button>
              )}
            </div>

            {composeMode === "group" && (
              <input className="chat-compose-input" value={composeTitle} onChange={(e) => setComposeTitle(e.target.value)} placeholder="Group name" />
            )}

            <div className="chat-search-pill chat-search-pill-modal">
              <Search size={15} />
              <input value={composeQuery} onChange={(e) => setComposeQuery(e.target.value)} placeholder="Search staff, students, or parents" />
            </div>

            {/* Role tabs: directory grouped by role */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "0.5rem 0 0.75rem" }}>
              {(["all", "student", "teacher", "parent", "admin"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setComposeRoleTab(tab)}
                  style={{
                    padding: "0.3rem 0.85rem",
                    borderRadius: 999,
                    border: "1px solid " + (composeRoleTab === tab ? "#7c3aed" : "#e5e7eb"),
                    background: composeRoleTab === tab ? "#ede9fe" : "#fff",
                    color: composeRoleTab === tab ? "#5b21b6" : "#475569",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "all" ? "All" : `${tab}s`}
                </button>
              ))}
            </div>

            {composeMode === "group" && (role === "teacher" || role === "admin") && (
              <label className="chat-parent-visible-toggle">
                <input type="checkbox" checked={composeParentVisible} onChange={(e) => setComposeParentVisible(e.target.checked)} />
                Parent visible
              </label>
            )}

            <div className="chat-compose-grid">
              <div>
                <div className="chat-info-section-title">People</div>
                <div className="chat-member-picker">
                  {composeResults.length ? (
                    composeResults.map((person) => {
                      const selected = selectedPeople.some((entry) => entry.id === person.id);
                      const label = `${person.firstName} ${person.lastName}`.trim() || person.email;
                      const metaLabel = [person.role, person.subject, person.grade && person.section ? `${person.grade}-${person.section}` : person.grade, person.childName].filter(Boolean).join(" · ");
                      return (
                        <button key={person.id} type="button" className={`chat-member-option-row ${selected ? "selected" : ""}`} onClick={() => toggleSelected(person)}>
                          <div className="chat-member-avatar" style={{ background: avatarColor(person.id) }}>{initials(label)}</div>
                          <div className="chat-member-copy">
                            <div className="chat-member-name">{label}</div>
                            <div className="chat-member-role">{metaLabel || "User"}</div>
                          </div>
                          <span className="chat-member-action">{selected ? "✓" : "Add"}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="chat-empty-note">Search for people to add them here.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="chat-info-section-title">Selected</div>
                <div className="chat-selected-list">
                  {selectedPeople.length ? (
                    selectedPeople.map((person) => (
                      <div key={person.id} className="chat-selected-chip">
                        <span>{`${person.firstName} ${person.lastName}`.trim() || person.email}</span>
                        <button type="button" onClick={() => setSelectedPeople((prev) => prev.filter((item) => item.id !== person.id))} aria-label={`Remove ${person.firstName}`}><X size={10} /></button>
                      </div>
                    ))
                  ) : (
                    <div className="chat-empty-note">No one selected yet.</div>
                  )}
                </div>

                <div className="chat-compose-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setShowCompose(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void (composeMode === "direct" ? startDirectChat(selectedPeople[0]!) : createGroupChat())}
                    disabled={selectedPeople.length === 0 || (composeMode === "group" && !composeTitle.trim())}
                  >
                    {composeMode === "direct" ? "Start chat" : "Create group"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

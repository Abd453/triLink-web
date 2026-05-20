import { getApiBase } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { io, type Socket } from "socket.io-client";

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed" | "error";

type BaseEnvelope<T = unknown> = {
  event?: string;
  type?: string;
  payload?: T;
  data?: T;
};

export type PresencePayload = {
  userId: string;
  status: "online" | "offline";
  isOnline?: boolean;
  lastSeenAt?: string;
};

export type TypingPayload = {
  conversationId: string;
  userId: string;
  isTyping: boolean;
};

export type ReadPayload = {
  conversationId: string;
  userId: string;
  messageId?: string;
  lastReadMessageId?: string;
};

export type MessagePayload = {
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    createdAt: string;
  };
};

export type RealtimeEventMap = {
  status: RealtimeStatus;
  "message:new": MessagePayload;
  "message:update": MessagePayload;
  "message:delete": { conversationId: string; messageId: string };
  "notification:new": any;
  "announcement:new": any;
  "typing:update": TypingPayload;
  "presence:update": PresencePayload;
  "read:update": ReadPayload;
  "conversation:update": { conversationId?: string };
  "connection:error": { message: string };
  "attempt:control": { attemptId: string; action: "force_submit" | "warn" | "allow_rejoin" | string; message: string };
  "attempt:violation": { attemptId: string; examId: string; studentId: string; reason: string; timestamp: string; violationCount: number };
  "attempt:activity": {
    attemptId: string;
    examId: string;
    studentId: string;
    kind: "start" | "resume" | "submit" | "force_submit" | "warn" | "violation" | "locked" | "allow_rejoin" | string;
    status: "in_progress" | "submitted" | string;
    reason?: string;
    violationCount?: number;
    timestamp: string;
  };
};

type EventKey = keyof RealtimeEventMap;
type Handler<K extends EventKey> = (payload: RealtimeEventMap[K]) => void;

type HandlerMap = {
  [K in EventKey]: Set<Handler<K>>;
};

function deriveWsUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
  if (envUrl) return envUrl;
  return getApiBase();
}

class ChatRealtimeClient {
  private socket: Socket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private reconnectMs = 1800;
  private status: RealtimeStatus = "idle";
  private userInfo: { id: string; name: string } | null = null;

  private handlers: HandlerMap = {
    status: new Set(),
    "message:new": new Set(),
    "message:update": new Set(),
    "message:delete": new Set(),
    "notification:new": new Set(),
    "announcement:new": new Set(),
    "typing:update": new Set(),
    "presence:update": new Set(),
    "read:update": new Set(),
    "conversation:update": new Set(),
    "connection:error": new Set(),
    "attempt:control": new Set(),
    "attempt:violation": new Set(),
    "attempt:activity": new Set(),
  };

  getStatus() {
    return this.status;
  }

  connect(user?: { id: string; name: string }) {
    if (typeof window === "undefined") return;
    if (user) this.userInfo = user;
    if (this.socket?.connected) {
      console.log("[ChatRealtime] Already connected");
      return;
    }
    if (this.socket && !this.socket.connected) {
      console.log("[ChatRealtime] Reconnecting existing socket...");
      this.socket.connect();
      return;
    }

    this.setStatus("connecting");
    const token = getAccessToken() ?? undefined;
    const baseUrl = deriveWsUrl();
    const path = process.env.NEXT_PUBLIC_CHAT_SOCKET_PATH?.trim() || "/socket.io";

    console.log(`[ChatRealtime] Connecting to ${baseUrl}${path} as user ${this.userInfo?.id}`);

    this.socket = io(baseUrl, {
      path,
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: false,
      auth: {
        token,
        userId: this.userInfo?.id,
        name: this.userInfo?.name,
      },
      query: {
        token,
        userId: this.userInfo?.id,
      },
    });

    this.socket.on("connect", () => {
      console.log("[ChatRealtime] Connected successfully");
      this.setStatus("open");
      this.reconnectMs = 1800;
      this.schedulePing();
      this.sendRaw("auth:hello", {
        token: getAccessToken(),
        userId: this.userInfo?.id,
        name: this.userInfo?.name,
      });
      if (this.userInfo?.id) {
        this.sendRaw("presence:set", {
          userId: this.userInfo.id,
          status: "online",
          name: this.userInfo.name,
        });
      }
    });

    this.socket.onAny((event, data) => {
      try {
        const parsed = (data && typeof data === "object" ? (data as BaseEnvelope) : {}) as BaseEnvelope;
        const eventName = String(event ?? parsed.event ?? parsed.type ?? "").toLowerCase();
        const payload = (parsed.payload ?? parsed.data ?? data ?? {}) as Record<string, unknown>;

        // Message events — handle multiple payload shapes from different backends
        if (eventName.includes("message")) {
          if (eventName.includes("update") || eventName.includes("edit")) {
            this.emit("message:update", payload as MessagePayload);
            return;
          }
          if (eventName.includes("delete") || eventName.includes("remove")) {
            this.emit("message:delete", {
              conversationId: String(payload.conversationId ?? ""),
              messageId: String(payload.messageId ?? payload.id ?? ""),
            });
            return;
          }
          // Shape 1: { message: { id, senderId, text, ... }, conversationId }
          if (payload.message && typeof payload.message === "object") {
            this.emit("message:new", payload as MessagePayload);
            return;
          }
          // Shape 2: root-level fields { id, senderId, text, conversationId, ... }
          if ("text" in payload || "senderId" in payload) {
            this.emit("message:new", {
              conversationId: String(payload.conversationId ?? ""),
              message: {
                id: String(payload.id ?? ""),
                conversationId: String(payload.conversationId ?? ""),
                senderId: String(payload.senderId ?? ""),
                text: String(payload.text ?? ""),
                createdAt: String(payload.createdAt ?? new Date().toISOString()),
              },
            });
            return;
          }
          // Shape 3: nested under data/payload already extracted above — try as-is
          this.emit("message:new", payload as MessagePayload);
          return;
        }

        if (eventName.includes("typing")) {
          this.emit("typing:update", payload as TypingPayload);
          return;
        }
        if (eventName.includes("presence")) {
          const status = payload.isOnline === false || String(payload.status ?? "").toLowerCase() === "offline"
            ? "offline"
            : "online";
          this.emit("presence:update", {
            ...(payload as PresencePayload),
            status,
            isOnline: status === "online",
          });
          return;
        }
        if (eventName.includes("read")) {
          this.emit("read:update", {
            ...(payload as ReadPayload),
            messageId: String(payload.messageId ?? payload.lastReadMessageId ?? ""),
            lastReadMessageId: String(payload.lastReadMessageId ?? payload.messageId ?? ""),
          });
          return;
        }
        if (eventName.includes("conversation")) {
          this.emit("conversation:update", payload as { conversationId?: string });
          return;
        }
        if (eventName.includes("notification")) {
          this.emit("notification:new", payload);
          return;
        }
        if (eventName.includes("announcement")) {
          this.emit("announcement:new", payload);
          return;
        }
        if (eventName.includes("attempt:control")) {
          this.emit("attempt:control", payload as any);
          return;
        }
        if (eventName.includes("attempt:violation")) {
          this.emit("attempt:violation", payload as any);
          return;
        }
        if (eventName.includes("attempt:activity")) {
          this.emit("attempt:activity", payload as any);
          return;
        }
      } catch {
        // Ignore malformed events.
      }
    });

    this.socket.on("connect_error", () => {
      this.setStatus("error");
      this.emit("connection:error", { message: "WebSocket connection error" });
    });

    this.socket.on("disconnect", () => {
      this.setStatus("closed");
      this.clearPing();
      this.socket = null;
      this.scheduleReconnect();
    });
  }

  disconnect() {
    if (this.reconnectTimer != null && typeof window !== "undefined") {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.clearPing();
    this.setStatus("closed");
  }

  sendPing() {
    this.sendRaw("ping", {
      ts: Date.now(),
    });
  }

  joinConversation(conversationId: string, userId: string) {
    this.sendRaw("conversation:join", {
      conversationId,
      userId,
    });
  }

  leaveConversation(conversationId: string, userId: string) {
    this.sendRaw("conversation:leave", {
      conversationId,
      userId,
    });
  }

  sendTyping(conversationId: string, userId: string, isTyping: boolean) {
    this.sendRaw("typing:update", {
      conversationId,
      userId,
      isTyping,
    });
  }

  sendReadReceipt(conversationId: string, userId: string, messageId: string) {
    this.sendRaw("read:update", {
      conversationId,
      userId,
      messageId,
    });
  }

  on<K extends EventKey>(event: K, handler: Handler<K>) {
    this.handlers[event].add(handler as never);
    return () => {
      this.handlers[event].delete(handler as never);
    };
  }

  private scheduleReconnect() {
    if (typeof window === "undefined") return;
    if (this.reconnectTimer != null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectMs = Math.min(this.reconnectMs * 1.5, 12000);
    }, this.reconnectMs);
  }

  private schedulePing() {
    if (typeof window === "undefined") return;
    this.clearPing();
    this.pingTimer = window.setInterval(() => {
      this.sendPing();
    }, 25_000);
  }

  private clearPing() {
    if (this.pingTimer != null && typeof window !== "undefined") {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private setStatus(next: RealtimeStatus) {
    this.status = next;
    this.emit("status", next);
  }

  private emit<K extends EventKey>(event: K, payload: RealtimeEventMap[K]) {
    this.handlers[event].forEach((h) => h(payload));
  }

  private sendRaw(eventName: string, data: unknown) {
    if (!this.socket) return;
    if (this.socket.connected) {
      this.socket.emit(eventName, data);
      return;
    }
    // Socket.IO buffers emits while reconnecting.
    this.socket.emit(eventName, data);
  }
}

export const chatRealtime = new ChatRealtimeClient();

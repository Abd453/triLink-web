import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "teacher" | "student" | "admin" | "parent";

export interface ChatParticipant {
    id: string;
    name: string;
    role: UserRole;
    initials: string;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    text: string;
    ts: string; // ISO timestamp
}

export interface Conversation {
    id: string;
    type: "private" | "group";
    title: string;
    participants: ChatParticipant[];
    messages: ChatMessage[];
    /** student-teacher private threads are mirrored to the parent for transparency */
    parentVisible: boolean;
    /** class section label (groups only) */
    section?: string;
    lastTs: string;
}

interface ChatStore {
    conversations: Conversation[];
    readConversationIds: string[];
    sendMessage: (convId: string, msg: Omit<ChatMessage, "id" | "ts">) => void;
    createGroup: (section: string, participants: ChatParticipant[]) => void;
    createPrivateConversation: (params: {
        sender: ChatParticipant;
        recipient: ChatParticipant;
        initialText?: string;
        parentVisible?: boolean;
    }) => string;
    markConversationRead: (convId: string) => void;
}

const mkId = () => Math.random().toString(36).slice(2, 9);
const ago = (min: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - min);
    return d.toISOString();
};

const SEED: Conversation[] = [
    {
        id: "conv-1",
        type: "private",
        title: "Abebe Kebede",
        participants: [
            { id: "teacher-1", name: "Mr. Solomon", role: "teacher", initials: "MS" },
            { id: "student-1", name: "Abebe Kebede", role: "student", initials: "AK" },
        ],
        parentVisible: true,
        lastTs: ago(5),
        messages: [
            { id: "m1", senderId: "student-1", senderName: "Abebe Kebede", senderRole: "student", text: "Hello Mr. Solomon, I need help with the calculus homework.", ts: ago(40) },
            { id: "m2", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Sure Abebe, which problem are you stuck on?", ts: ago(38) },
            { id: "m3", senderId: "student-1", senderName: "Abebe Kebede", senderRole: "student", text: "Problem 7 about integration by parts. I don't understand the formula.", ts: ago(35) },
            { id: "m4", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Try letting u = x and dv = e^x dx. Apply the formula: \u222fu dv = uv \u2212 \u222fv du. That simplifies nicely!", ts: ago(30) },
            { id: "m5", senderId: "student-1", senderName: "Abebe Kebede", senderRole: "student", text: "Thank you so much for the feedback, sir!", ts: ago(5) },
        ],
    },
    {
        id: "conv-2",
        type: "private",
        title: "Admin Office",
        participants: [
            { id: "teacher-1", name: "Mr. Solomon", role: "teacher", initials: "MS" },
            { id: "admin-1", name: "Admin Office", role: "admin", initials: "AO" },
        ],
        parentVisible: false,
        lastTs: ago(175),
        messages: [
            { id: "m6", senderId: "admin-1", senderName: "Admin Office", senderRole: "admin", text: "Please submit all grades by Friday 5PM.", ts: ago(185) },
            { id: "m7", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Understood, I'll have them ready by Thursday.", ts: ago(180) },
            { id: "m8", senderId: "admin-1", senderName: "Admin Office", senderRole: "admin", text: "Thank you. Also the staff meeting is moved to Monday 10AM.", ts: ago(175) },
        ],
    },
    {
        id: "conv-3",
        type: "private",
        title: "Parent: Mr. Kebede",
        participants: [
            { id: "teacher-1", name: "Mr. Solomon", role: "teacher", initials: "MS" },
            { id: "parent-1", name: "Mr. Kebede", role: "parent", initials: "MK" },
        ],
        parentVisible: false,
        lastTs: ago(1440),
        messages: [
            { id: "m9", senderId: "parent-1", senderName: "Mr. Kebede", senderRole: "parent", text: "Good morning Mr. Solomon. How is Abebe doing in your class?", ts: ago(1445) },
            { id: "m10", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Good morning! Abebe is doing very well \u2014 he scored 88% on the last quiz and is consistently improving.", ts: ago(1440) },
        ],
    },
    {
        id: "conv-4",
        type: "group",
        title: "Grade 11-A Class",
        section: "11-A",
        participants: [
            { id: "teacher-1", name: "Mr. Solomon", role: "teacher", initials: "MS" },
            { id: "student-1", name: "Abebe Kebede", role: "student", initials: "AK" },
            { id: "student-2", name: "Sara Haile", role: "student", initials: "SH" },
            { id: "student-3", name: "Dawit Tadesse", role: "student", initials: "DT" },
            { id: "student-4", name: "Meron Alemu", role: "student", initials: "MA" },
        ],
        parentVisible: false,
        lastTs: ago(58),
        messages: [
            { id: "m11", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Good morning class! Reminder: Quiz tomorrow on Chapter 5. Please review integration techniques.", ts: ago(65) },
            { id: "m12", senderId: "student-2", senderName: "Sara Haile", senderRole: "student", text: "Will it include the substitution method too?", ts: ago(63) },
            { id: "m13", senderId: "teacher-1", senderName: "Mr. Solomon", senderRole: "teacher", text: "Yes, it covers both substitution and integration by parts.", ts: ago(60) },
            { id: "m14", senderId: "student-3", senderName: "Dawit Tadesse", senderRole: "student", text: "Thank you sir!", ts: ago(58) },
        ],
    },
];

export const useChatStore = create<ChatStore>()(
    persist(
        (set, get) => ({
            conversations: SEED,
            readConversationIds: [] as string[],

            markConversationRead(convId) {
                set((s) => ({
                    readConversationIds: s.readConversationIds.includes(convId)
                        ? s.readConversationIds
                        : [...s.readConversationIds, convId],
                }));
            },

            sendMessage(convId, msg) {
                const message: ChatMessage = {
                    ...msg,
                    id: mkId(),
                    ts: new Date().toISOString(),
                };
                set((s) => ({
                    conversations: s.conversations.map((c) =>
                        c.id === convId
                            ? { ...c, messages: [...c.messages, message], lastTs: message.ts }
                            : c
                    ),
                    readConversationIds: [...new Set([...s.readConversationIds, convId])],
                }));
            },

            createGroup(section, participants) {
                const teacher = participants.find((p) => p.role === "teacher");
                const conv: Conversation = {
                    id: `conv-grp-${mkId()}`,
                    type: "group",
                    title: `Grade ${section} Class`,
                    section,
                    participants,
                    messages: [
                        {
                            id: mkId(),
                            senderId: teacher?.id ?? "",
                            senderName: teacher?.name ?? "Teacher",
                            senderRole: "teacher",
                            text: `Welcome to the Grade ${section} group chat! Use this space for class discussions and announcements.`,
                            ts: new Date().toISOString(),
                        },
                    ],
                    parentVisible: false,
                    lastTs: new Date().toISOString(),
                };
                set((s) => ({
                    conversations: [conv, ...s.conversations],
                    readConversationIds: [...new Set([...s.readConversationIds, conv.id])],
                }));
            },

            createPrivateConversation({ sender, recipient, initialText, parentVisible = false }): string {
                const existing = get()
                    .conversations
                    .find(
                        (c) =>
                            c.type === "private" &&
                            c.participants.some((p) => p.id === sender.id) &&
                            c.participants.some((p) => p.id === recipient.id)
                    );
                if (existing) return existing.id;

                const now = new Date().toISOString();
                const convId = `conv-prv-${mkId()}`;
                const conv: Conversation = {
                    id: convId,
                    type: "private",
                    title: recipient.name,
                    participants: [sender, recipient],
                    messages: initialText
                        ? [
                              {
                                  id: mkId(),
                                  senderId: sender.id,
                                  senderName: sender.name,
                                  senderRole: sender.role,
                                  text: initialText,
                                  ts: now,
                              },
                          ]
                        : [],
                    parentVisible,
                    lastTs: now,
                };

                set((s) => ({
                    conversations: [conv, ...s.conversations],
                    readConversationIds: [...new Set([...s.readConversationIds, convId])],
                }));

                return convId;
            },
        }),
        { name: "trilink-chat-v1" }
    )
);

/** Format ISO timestamp to relative label */
export function fmtTs(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Format ISO timestamp to HH:MM */
export function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** All students for group creation, keyed by section */
export const SECTION_STUDENTS: Record<string, ChatParticipant[]> = {
    "11-A": [
        { id: "student-1", name: "Abebe Kebede", role: "student", initials: "AK" },
        { id: "student-2", name: "Sara Haile", role: "student", initials: "SH" },
        { id: "student-3", name: "Dawit Tadesse", role: "student", initials: "DT" },
        { id: "student-4", name: "Meron Alemu", role: "student", initials: "MA" },
        { id: "student-5", name: "Yonas Bekele", role: "student", initials: "YB" },
    ],
    "11-B": [
        { id: "student-6", name: "Tigist Girma", role: "student", initials: "TG" },
        { id: "student-7", name: "Biruk Tesfaye", role: "student", initials: "BT" },
        { id: "student-8", name: "Helen Assefa", role: "student", initials: "HA" },
        { id: "student-9", name: "Samuel Getachew", role: "student", initials: "SG" },
    ],
    "12-A": [
        { id: "student-10", name: "Mulugeta Worku", role: "student", initials: "MW" },
        { id: "student-11", name: "Selam Habtamu", role: "student", initials: "SH" },
        { id: "student-12", name: "Robel Kifle", role: "student", initials: "RK" },
    ],
    "12-B": [
        { id: "student-13", name: "Hana Tesfaye", role: "student", initials: "HT" },
        { id: "student-14", name: "Naod Girma", role: "student", initials: "NG" },
        { id: "student-15", name: "Lidiya Bekele", role: "student", initials: "LB" },
    ],
};

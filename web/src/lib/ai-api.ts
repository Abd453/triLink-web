import { getApiBase } from "./api";
import { authFetch } from "./auth";

/**
 * AI Core API Client (Proxied through NestJS Backend)
 */

async function aiFetch(path: string, options: RequestInit = {}) {
  const base = getApiBase();
  const url = `${base}/api/ai${path}`;
  
  const res = await authFetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "AI request failed" }));
    throw new Error(error.message || `AI Error: ${res.status}`);
  }

  return res.json();
}

// --- Chat ---

export interface ChatRequest {
  student_id: string;
  message: string;
  grade_level?: number;
}

export interface ChatResponse {
  student_id: string;
  message: string;
  answer: string;
  sources: any[];
}

export async function aiChat(data: ChatRequest): Promise<ChatResponse> {
  return aiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getChatHistory(studentId: string, limit = 20) {
  return aiFetch(`/chat/history/${studentId}?limit=${limit}`);
}

// --- Content ---

export interface GenerateLessonRequest {
  topic_id: string;
}

export interface GenerateLessonResponse {
  topic_id: string;
  lesson_plan: string;
}

export async function generateLesson(data: GenerateLessonRequest): Promise<GenerateLessonResponse> {
  return aiFetch("/content/generate-lesson", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface GenerateQuestionsRequest {
  topic_id: string;
  count?: number;
}

export interface GenerateQuestionsResponse {
  topic_id: string;
  questions: any[];
}

export async function generateQuestions(data: GenerateQuestionsRequest): Promise<GenerateQuestionsResponse> {
  return aiFetch("/content/generate-questions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Mastery ---

export interface MasteryUpdate {
  student_id: string;
  topic_id: string;
  is_correct: boolean;
}

export async function updateMastery(data: MasteryUpdate) {
  return aiFetch("/mastery/update", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMastery(studentId: string, topicId: string) {
  return aiFetch(`/mastery/${studentId}/${topicId}`);
}

export async function getWeakTopics(studentId: string, subjectId: string) {
  return aiFetch(`/mastery/${studentId}/weak/${subjectId}`);
}

// --- Recommendations ---

export async function getRecommendations(studentId: string) {
  return aiFetch(`/students/${studentId}/recommendations`);
}

// --- Analytics ---

export async function getEngagementAnalytics(studentId: string) {
  return aiFetch(`/analytics/engagement/${studentId}`);
}

export async function getLearningCurve(studentId: string, topicId: string) {
  return aiFetch(`/analytics/learning-curve/${studentId}/${topicId}`);
}

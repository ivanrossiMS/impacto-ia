// ============================================================
// IA-IMPACTO: Centralized AI Client (Frontend)
// All AI calls from the front-end go through this single client.
// It calls the Netlify Function proxy — the API key never touches
// the browser.
// ============================================================

// The URL to your Netlify Function.
// In development, Vite's proxy (if configured) forwards this.
// In production on Netlify, /.netlify/functions/ is automatic.
const AI_PROXY_URL = "/.netlify/functions/ai-proxy";

export interface AICallOptions {
  feature: string;
  userId?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AIResponse<T = string> {
  result: T;
  raw?: string;
}

class AIClientError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "AIClientError";
    this.statusCode = statusCode;
  }
}

/**
 * The universal AI caller.
 * Sends a request to the backend proxy and returns the result.
 * Throws `AIClientError` on failure.
 */
export async function callAI<T = string>(options: AICallOptions): Promise<AIResponse<T>> {
  const { feature, ...rest } = options;

  // 55s client-side timeout — longer than the function's own 50s to let the
  // function return a proper JSON error before the browser cuts the connection.
  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), 55_000);

  let response: Response;
  try {
    response = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, ...rest }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(clientTimeout);
    if (err.name === 'AbortError') throw new AIClientError('A requisição de IA expirou. Tente novamente.', 504);
    throw new AIClientError(err.message || 'Falha na conexão com o serviço de IA.');
  }
  clearTimeout(clientTimeout);

  // Read body as text first — if the function crashes/times out it may return
  // plain text ("TimeoutError", etc.) instead of JSON.
  const rawText = await response.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    // Non-JSON body = the Netlify function itself crashed or timed out.
    console.error(`[AI Client] Non-JSON response (HTTP ${response.status}):`, rawText.slice(0, 200));
    throw new AIClientError(
      `Serviço de IA indisponível (${response.status}). Tente novamente em instantes.`,
      response.status
    );
  }

  if (!response.ok) {
    const message = data?.error || `AI call failed with status ${response.status}`;
    throw new AIClientError(message, response.status);
  }

  return data as AIResponse<T>;
}

// ============================================================
// Feature-specific helpers (typed wrappers)
// ============================================================

/** Tutor Chat — student asking a question, optionally with an attached image */
export async function callTutorChat(params: {
  message: string;
  userName: string;
  grade?: string;
  userId?: string;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<string> {
  const res = await callAI<string>({ feature: "tutor-chat", ...params });
  return res.result;
}

/** Generate activity questions for a teacher */
export async function callGenerateActivity(params: {
  topic: string;
  subject: string;
  grade: string;
  type: string;
  activityTypeLabel?: string;
  difficulty: string;
  count: number;
  className?: string;
  seed?: number;
  userId?: string;
}): Promise<{ questions: any[] }> {
  const res = await callAI<{ questions: any[] }>({ feature: "generate-activity", ...params });
  return res.result;
}

/** Generate a full learning trail for admin */
export async function callGenerateTrail(params: {
  topic: string;
  subject: string;
  grade: string;
  difficulty: string;
  userId?: string;
}): Promise<{
  title: string;
  description: string;
  rewardXp: number;
  rewardCoins: number;
  steps: Array<{ id: string; title: string; type: string; content?: string; theory?: string; questions?: any[] }>;
}> {
  const res = await callAI({ feature: "generate-trail", ...params });
  return res.result as any;
}

/** Generate trail metadata only (title, description, rewardXp, rewardCoins) */
export async function callGenerateTrailMeta(params: {
  topic: string; subject: string; grade: string;
}): Promise<{ title: string; description: string; rewardXp: number; rewardCoins: number }> {
  const res = await callAI({ feature: "generate-trail-meta", ...params });
  return res.result as any;
}

/** Generate ONE step of a trail (content + theory + 3 questions) */
export async function callGenerateTrailStep(params: {
  topic: string; subject: string; grade: string; difficulty: string;
  phaseIndex: number; phaseType: string;
}): Promise<{ id: string; title: string; type: string; content: string; theory: string; questions: any[] }> {
  const res = await callAI({ feature: "generate-trail-step", ...params });
  return res.result as any;
}

/** Generate duel questions */
export async function callGenerateDuel(params: {
  theme: string;
  difficulty: string;
  count: number;
  grade?: string;
  userId?: string;
}): Promise<{ questions: any[] }> {
  const res = await callAI<{ questions: any[] }>({
    feature: "generate-duel",
    seed: Date.now(),  // unique per duel — forces varied question selection
    ...params,
  });
  return res.result;
}

/** Parent Tips — generate an article on a topic */
export async function callParentTips(params: {
  topic: string;
  userId?: string;
}): Promise<string> {
  const res = await callAI<string>({ feature: "parent-tips", ...params });
  return res.result;
}

/** Parent Q&A — answer a parent's question */
export async function callParentQA(params: {
  question: string;
  userId?: string;
}): Promise<string> {
  const res = await callAI<string>({ feature: "parent-qa", ...params });
  return res.result;
}

/** Admin Insights — analyze platform data */
export async function callAdminInsights(params: {
  data: string;
  userId?: string;
}): Promise<{ insights: any[]; summary: string }> {
  const res = await callAI<{ insights: any[]; summary: string }>({ feature: "admin-insights", ...params });
  return res.result;
}

/** Teacher feedback on student performance */
export async function callTeacherFeedback(params: {
  studentName: string;
  subject: string;
  score: number;
  totalQuestions: number;
  wrongAnswers: string[];
  userId?: string;
}): Promise<{
  feedback: string;
  strengths: string[];
  improvements: string[];
  recommendedTopics: string[];
  encouragement: string;
}> {
  const res = await callAI({ feature: "teacher-feedback", ...params });
  return res.result as any;
}

/** Guardian Summary — weekly progress for parents */
export async function callGuardianSummary(params: {
  studentName: string;
  xp: number;
  level: number;
  streak: number;
  recentActivities: string[];
  missionsCompleted: number;
  userId?: string;
}): Promise<string> {
  const res = await callAI<string>({ feature: "guardian-summary", ...params });
  return res.result;
}

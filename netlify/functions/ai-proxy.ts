import { Handler, HandlerEvent } from "@netlify/functions";

// ============================================================
// IA-IMPACTO: Backend AI Proxy (Netlify Function)
// All Gemini calls go through here. The API key NEVER reaches
// the client. This function validates requests, routes to the
// correct Gemini model, and returns structured responses.
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Model configuration strategy
const MODELS = {
  flash: "gemini-2.5-flash",        // Fast tasks: tutor chat, quiz, questions
  pro:   "gemini-2.5-flash",        // Complex tasks (same model — confirmed available)
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// ── Supabase observability (fire-and-forget logs) ──────────────────────────
const SUPABASE_URL  = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY  = process.env.VITE_SUPABASE_ANON_KEY || '';

async function logAICall(entry: {
  feature: string;
  model: string;
  response_ms: number;
  input_tokens?: number;
  output_tokens?: number;
  success?: boolean;
  user_id?: string;
  error_msg?: string;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/ai_call_logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      feature: entry.feature,
      model: entry.model,
      response_ms: entry.response_ms,
      input_tokens: entry.input_tokens ?? null,
      output_tokens: entry.output_tokens ?? null,
      success: entry.success ?? true,
      user_id: entry.user_id ?? null,
      error_msg: entry.error_msg ?? null,
    }),
  });
}

// Allowed features and their model assignments
const FEATURE_REGISTRY: Record<string, { model: keyof typeof MODELS; requiresJson: boolean }> = {
  "tutor-chat":         { model: "flash", requiresJson: false },
  "generate-activity":  { model: "flash", requiresJson: true  },
  "generate-trail":     { model: "flash", requiresJson: true  },
  "generate-trail-step":{ model: "flash", requiresJson: true  },
  "generate-trail-meta":{ model: "flash", requiresJson: true  },
  "generate-duel":      { model: "flash", requiresJson: true  }, // callGeminiDuel bypasses this
  "parent-tips":        { model: "flash", requiresJson: false },
  "parent-qa":          { model: "flash", requiresJson: false },
  "admin-insights":     { model: "pro",   requiresJson: true  },
  "teacher-feedback":   { model: "flash", requiresJson: true  },
  "teacher-lesson-plan":{ model: "pro",   requiresJson: true  },
  "guardian-summary":   { model: "flash", requiresJson: false },
  "generate-topics":    { model: "flash", requiresJson: true  },
  "generate-avatar-meta": { model: "flash", requiresJson: true },
};

interface GeminiRequest {
  feature: string;
  prompt: string;
  userId?: string;
  role?: string;
}

/**
 * Sanitize user input to prevent prompt injection.
 */
function sanitizeInput(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "")  // strip HTML
    .replace(/\[INST\]|\[\/INST\]|<s>|<\/s>/gi, "") // strip injection markers
    .trim()
    .slice(0, 4000); // hard cap
}

/**
 * Call the Gemini REST API with multimodal content (text + inline image).
 */
async function callGeminiMultimodal(
  modelKey: keyof typeof MODELS,
  textPrompt: string,
  imageBase64: string,
  imageMimeType: string,
  retries = 2
): Promise<string> {
  const model = MODELS[modelKey];
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [
      { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
      { text: textPrompt },
    ]}],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[AI-Proxy] Multimodal error (attempt ${attempt + 1}):`, errText);
        if (attempt === retries) throw new Error(`Gemini API error: ${response.status}`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("All Gemini retries failed");
}

/**
 * Call the Gemini REST API.
 */
async function callGemini(
  modelKey: keyof typeof MODELS,
  prompt: string,
  requiresJson: boolean,
  retries = 2,
  featureLabel = 'unknown'
): Promise<string> {
  const model = MODELS[modelKey];
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const t0 = Date.now();

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: requiresJson ? 4096 : 2048, // Reduced to avoid timeouts
      thinkingConfig: { thinkingBudget: 0 }, // Disable extended thinking — saves 10-20s on gemini-2.5-flash
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ],
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000); // 25s — safely under Netlify's 30s dev limit

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[AI-Proxy] Gemini error (attempt ${attempt + 1}):`, errText);
        if (attempt === retries) throw new Error(`Gemini API error: ${response.status}`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // exponential backoff
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const usage = data?.usageMetadata;

      // ── Observability log ──
      const ms = Date.now() - t0;
      console.log(`[AI-Log] ${featureLabel} | ${model} | ${ms}ms | in:${usage?.promptTokenCount ?? '?'} out:${usage?.candidatesTokenCount ?? '?'} tokens`);

      // ── Fire-and-forget: persist to ai_call_logs ──
      logAICall({
        feature: featureLabel,
        model,
        response_ms: ms,
        input_tokens: usage?.promptTokenCount,
        output_tokens: usage?.candidatesTokenCount,
        success: true,
      }).catch(() => {}); // never block the response

      if (!text) throw new Error("Empty response from Gemini");
      return text;

    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error("All Gemini retries failed");
}

/**
 * Compact, fast Gemini call for duel question generation.
 * Uses gemini-2.5-flash on v1beta (the ONLY confirmed working combo for this API key).
 * Short inline promptasync function callGeminiDuel(
  theme: string,
  difficulty: string,
  count: number,
  grade: string,
  opponentGrade?: string,
  seed?: number,
  recentQuestions?: string[],
  studentAccuracy?: number    // 0.0–1.0 for adaptive difficulty
): Promise<string> {
  const url = `${GEMINI_BASE_URL}/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;  // 1.5-flash: stable, fast (~10-15s), confirmed available

  // ── Grade balancing: use the lower serie as reference ──────────────────────
  const gradeToYear = (g: string): number => {
    const lower = g.toLowerCase();
    const isEM = lower.includes('em') || lower.includes('médio');
    const match = lower.match(/(\d+)/);
    const y = match ? parseInt(match[1]) : 6;
    return isEM ? y + 9 : y;
  };
  let referenceGrade = grade || '6º Ano';
  let gradeContext = `Série do aluno: ${referenceGrade}`;
  if (opponentGrade && opponentGrade !== grade) {
    const y1 = gradeToYear(grade);
    const y2 = gradeToYear(opponentGrade);
    referenceGrade = y2 < y1 ? opponentGrade : grade;
    gradeContext = `Duelo entre séries diferentes (${grade} vs ${opponentGrade}). Use a MENOR série "${referenceGrade}" como base para garantir equilíbrio e justiça para ambos os jogadores.`;
  }

  // ── Adaptive Difficulty: silently adjust based on student accuracy ──────────
  const levels = ['easy', 'medium', 'hard'] as const;
  const baseIdx = levels.indexOf(difficulty as any) !== -1 ? levels.indexOf(difficulty as any) : 1;
  let adaptedDiff = difficulty;
  if (studentAccuracy !== undefined && studentAccuracy < 0.35 && baseIdx > 0)
    adaptedDiff = levels[baseIdx - 1]; // silently lower
  else if (studentAccuracy !== undefined && studentAccuracy > 0.80 && baseIdx < 2)
    adaptedDiff = levels[baseIdx + 1]; // silently raise

  // ── Grade-specific word limit ──────────────────────────────────────────────
  const gp = getGradeProfile(referenceGrade);
  const wordLimitNote = `LIMITE: max ${gp.maxWords} palavras por enunciado (${gp.age}).`;

  // ── 3-Tier in-match progression ───────────────────────────────────────────
  const tierMap: Record<string, [string, string, string]> = {
    easy:   ['trivial (1 etapa, lembrar/reconhecer)',  'fácil (1-2 etapas, compreender)', 'médio (2 etapas, aplicar)'],
    medium: ['fácil (1-2 etapas)',                     'médio (2 etapas, compreender/aplicar)', 'difícil (2-3 etapas, analisar)'],
    hard:   ['médio (2 etapas)',                        'difícil (2-3 etapas, analisar)', 'mestre (3+ etapas, avaliar/criar)'],
  };
  const [t1, t2, t3] = tierMap[adaptedDiff] || tierMap.medium;
  const t1e = Math.ceil(count / 3);
  const t2e = Math.ceil(count * 2 / 3);
  const progressNote = count > 3
    ? `Progressao: Q1-${t1e}=${t1}; Q${t1e+1}-${t2e}=${t2}; Q${t2e+1}-${count}=${t3}.`
    : `Dificuldade: ${adaptedDiff}.`;

  // ── Difficulty calibration ─────────────────────────────────────────────────
  const diffMap: Record<string, { label: string; bloom: string; rules: string }> = {
    easy:   {
      label: 'FÁCIL',
      bloom: 'Lembrar / Reconhecer (Bloom nível 1-2)',
      rules: 'Conceito único direto. Enunciado sem ambiguidade. Resposta de memorização ou reconhecimento imediato. Distraidores claramente errados. Vocabulário muito simples.',
    },
    medium: {
      label: 'MÉDIO',
      bloom: 'Compreender / Aplicar (Bloom nível 2-3)',
      rules: 'Exige interpretação simples e aplicação de conceito. Contexto breve no enunciado (1-2 frases). Distraidores parcialmente plausíveis. Não deve ser resolvível apenas por memorização.',
    },
    hard:   {
      label: 'DIFÍCIL / MESTRE',
      bloom: 'Analisar / Avaliar / Criar (Bloom nível 4-6)',
      rules: 'Alto raciocínio lógico. Situação-problema ou análise em 2+ etapas. TODOS os distraidores tecnicamente plausíveis mas inequivocamente errados. Pode conter pegadinhas inteligentes sem ambiguidade. Exige domínio real do conteúdo.',
    },
  };
  const diff = diffMap[adaptedDiff] || diffMap.medium;

  // ── Theme guidance ─────────────────────────────────────────────────────────
  const themeGuideMap: Record<string, string> = {
    historia:       'Eventos históricos, personagens, causas/consequências e linhas do tempo adequados à série. Perguntas sobre fatos verificáveis.',
    geografia:      'Localização, biomas, geopolítica, clima e relações humano-ambiente adequados ao nível. Evite dados numéricos excessivamente específicos.',
    ciencias:       'Fenômenos naturais, corpo humano, ecologia, física e química básicas compatíveis com a série.',
    matematica:     'Raciocínio lógico, operações, geometria ou álgebra compatíveis. Garanta precisão numérica absoluta.',
    portugues:      'Gramática, interpretação de texto, ortografia e produção textual. Inclua trecho curto para interpretação quando pertinente.',
    arte:           'Movimentos artísticos, artistas brasileiros/mundiais, linguagens artísticas compatíveis com o nível.',
    esportes:       'Regras, história, recordes, atletas e cultura esportiva. Inclua esportes olímpicos e populares no Brasil.',
    entretenimento: 'TV, séries, filmes, animes, games e cultura pop. Foque em séries/programas populares entre jovens, personagens icônicos, enredos marcantes, franquias e fenômenos audiovisuais. Inclua referências nacionais e internacionais adequadas à faixa etária.',
    aleatorio:      `Distribua OBRIGATORIAMENTE entre áreas distintas (máx. 2 questões por área):\n • Ciências / Biologia  • História  • Geografia  • Matemática básica  • Português / Literatura  • Esportes / Arte / Cultura  • Curiosidade fascinante / Conhecimento Geral\n Nunca concentre mais de 2 perguntas em uma única área temática.`,
  };
  const THEME_DISPLAY: Record<string, string> = {
    historia:       'História',
    geografia:      'Geografia',
    ciencias:       'Ciências',
    matematica:     'Matemática',
    portugues:      'Português',
    arte:           'Arte',
    esportes:       'Esportes',
    entretenimento: 'TV, Séries e Cultura Pop',
    logica:         'Lógica e Raciocínio Lógico',
    quem_sou_eu:    'Conhecimento Geral e Atualidades',
    aleatorio:      'Mistura de Temas Educacionais Variados (Conhecimento Geral)',
  };
  const displayTheme = THEME_DISPLAY[theme.toLowerCase()] || theme;
  const themeGuide = themeGuideMap[theme.toLowerCase()] || themeGuideMap.aleatorio;

  const sessionSeed = seed ?? Date.now();
  const angles = ['aspectos curiosos e pouco conhecidos','aplicacoes praticas do cotidiano','personagens e eventos especificos','conexoes interdisciplinares','dimensao historica e evolucao','comparacoes e contrastes','aspectos regionais brasileiros','impactos na sociedade e ciencia'];
  const angle = angles[sessionSeed % angles.length];
  const gradeRef = referenceGrade || grade || '6 Ano';
  const crossGrade = opponentGrade && opponentGrade !== grade ? ` Duelo entre series (${grade} x ${opponentGrade}): use ${gradeRef} como base.` : '';

  // Anti-repetition block: inject up to 5 recent question snippets into the prompt
  const avoidBlock = (recentQuestions && recentQuestions.length > 0)
    ? ` EVITE ABSOLUTA repetição destes enunciados já usados recentemente (gere questões completamente diferentes): ${recentQuestions.slice(-5).map((q,i) => `[${i+1}] "${q.slice(0,100)}"`).join(' | ')}.`
    : '';

  const prompt = `Voce e professor especialista brasileiro BNCC. Gere ${count} questoes de multipla escolha sobre "${displayTheme}" para alunos do ${gradeRef}.${crossGrade} Dificuldade base: ${diff.label} (${diff.bloom}). Regra de dificuldade: ${diff.rules}. ${progressNote} ${wordLimitNote} Tema: ${themeGuide} Foco desta sessao #${sessionSeed}: ${angle}.${avoidBlock} Regras: linguagem EXATAMENTE para ${gp.age}; questoes com subtemas distintos; distraidores representam erros reais; explicacao 1-2 frases; sem erros factuais; sem repeticao de estrutura entre questoes. Responda SOMENTE com JSON valido: {"questions":[{"id":"1","questionText":"?","options":[{"id":"a","text":"Correta","isCorrect":true},{"id":"b","text":"Errada","isCorrect":false},{"id":"c","text":"Errada","isCorrect":false},{"id":"d","text":"Errada","isCorrect":false}],"explanation":"..."}]} Alternativa a SEMPRE correta. Gere exatamente ${count} questoes.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 },  // Disable 2.5-flash thinking — CONFIRMED works inside generationConfig (200 OK in 14s)
    },
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 24000);  // 24s: leaves 6s buffer for lambda-local hard 30s limit
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini duel ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini duel response");
    return text;
  } catch (err: any) {
    clearTimeout(t);
    console.error('[AI-Proxy] callGeminiDuel failed:', err.message);
    throw err;
  }
}

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini duel ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini duel response");
    return text;
  } catch (err: any) {
    clearTimeout(t);
    console.error('[AI-Proxy] callGeminiDuel failed:', err.message);
    throw err;
  }
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildTutorPrompt(
  userMessage: string,
  userName: string,
  grade?: string
): string {
  const gradeProfile = grade ? getGradeProfile(grade) : null;

  const yr = (() => {
    const g = (grade || '').toLowerCase();
    const isEM = g.includes('em') || g.includes('médio');
    const m = g.match(/(\d+)/); const y = m ? parseInt(m[1]) : 5;
    return isEM ? y + 9 : y;
  })();

  const p = yr <= 5
    ? { tone: 'acolhedor, lúdico, encorajador — como tio/tia educador(a)', depth: '1 conceito por vez, concreto, sem abstrações', ex: 'animais, escola, família, brinquedos', limit: '200 palavras, frases ≤15 palavras', restrict: 'NUNCA termos técnicos sem explicar; NUNCA mais de 1 ideia por vez' }
    : yr <= 9
    ? { tone: 'amigável e motivador — tutor mais velho', depth: 'intermediário: conceito + raciocínio passo a passo', ex: 'esportes, tecnologia, redes sociais, escola', limit: '300 palavras', restrict: 'Introduza termos com explicação; sem terminologia universitária' }
    : { tone: 'intelectual, respeitoso e estimulante', depth: 'avançado: síntese, pensamento crítico, conexões ENEM', ex: 'situações-problema reais, ciência, história', limit: '400 palavras', restrict: 'Estimule raciocínio — não entregue só a resposta' };

  const gradeCtx = grade ? `Série: **${grade}** (${gradeProfile?.stage || ''})` : 'Série não informada — adapte ao nível da pergunta.';

  return `Você é o **Capy**, tutor IA do IMPACTO-IA — professor inteligente, paciente e adaptável.
Aluno: **${userName}** | ${gradeCtx}

PERFIL PEDAGÓGICO:
- Tom: ${p.tone}
- Profundidade: ${p.depth}
- Exemplos: ${p.ex}
- Limite: ${p.limit}
- Restrição: ${p.restrict}

ESTRUTURA:
1. **Explicação** — conceito claro, 1 ideia por vez
2. **Aprofundamento** — detalhe compatível com a série
3. **Exemplo prático** — cotidiano do aluno (${gradeProfile?.age || 'faixa etária adequada'})
4. **Mini reforço** *(opcional)* — dica, reflexão ou destaque

MATEMÁTICA — use LaTeX **obrigatoriamente** quando houver cálculo/equação:
- Inline: \`$expressão$\` | Bloco: \`$$expressão$$\`
- Estrutura: 🧠 Entendendo → ✏️ Montando → 🔍 Passo a passo → ✅ Resultado → 💡 Por quê?
- EF I → $3+4=7$, $3\\times4=12$ | EF II → $\\frac{3}{4}$, $3x=15$ | EM → $\\Delta=b^2-4ac$
- NUNCA escreva fração como "3/4" — use $$\\frac{3}{4}$$
- NUNCA equações em bloco de código — use LaTeX com $$ $$

REGRAS:
- Português BR | Markdown completo | Máximo ${p.limit}
- Explique o "porquê", não só o "o quê"
- Resolva GUIANDO o raciocínio — socrático quando possível
- ACOLHEDOR: nunca humilhe — estimule sempre
- Se difícil: simplifique mais, quebre em passos | Se fácil: aprofunde, conecte com conceitos maiores
- Finalize: **✅ Resumo:** [1 frase direta]
- Feche com 1 mini-desafio ou pergunta motivadora adequada à faixa etária

**Pergunta:** "${userMessage}"`.trim();
}

function buildActivityPrompt(
  topic: string,
  subject: string,
  grade: string,
  type: string,
  difficulty: string,
  count: number,
  className?: string,
  activityTypeLabel?: string,
  seed?: number,
  existingQuestions?: string[]
): string {
  const g = (grade||'').toLowerCase();
  const isEM = g.includes('em')||g.includes('médio')||g.includes('medio');
  const yr = parseInt((g.match(/\d+/)||['0'])[0]);
  const age = isEM ? '15–17 anos' : yr>=6 ? '11–15 anos' : '6–11 anos';
  const bloom = isEM ? 'Bloom 4-6 (análise, síntese, avaliação crítica)' : yr>=6 ? 'Bloom 2-4 (compreensão, aplicação, análise)' : 'Bloom 1-2 (reconhecimento, compreensão básica)';
  const lang = isEM ? 'linguagem formal, vocabulário técnico-científico' : yr>=6 ? 'linguagem clara, vocabulário em expansão' : 'linguagem simples, frases curtas, vocabulário do cotidiano';
  const wl = isEM ? '80' : yr>=6 ? '70' : '55';
  const isObjetiva = type !== 'dissertativa';

  const typeNote: Record<string,string> = {
    objetiva:        '4 alternativas. A=correta sempre. Distraidores plausíveis e relacionados — não absurdos.',
    quiz_divertido:  '4 alternativas, A=correta. Linguagem leve, 1-2 emojis/questão, "efeito surpresa" pedagógico. Rigor mantido.',
    dissertativa:    'Resposta aberta. "answer": pontos essenciais. "explanation": critérios. Sem alternativas.',
    simulado:        'Estilo ENEM: contexto introdutório antes do enunciado. 4 alternativas, A=correta. ~30% fácil/~50% médio/~20% difícil.',
    prova_mensal:    'Prova formal: início acessível → progressão. 4 alternativas, A=correta. Equilíbrio reconhecimento/compreensão/aplicação.',
    prova_bimestral: 'Avaliação bimestral profunda. 4 alternativas, A=correta. Progressão: contextualização → aplicação → análise.',
  };
  const diffNote: Record<string,string> = {
    'Fácil':  '1 conceito, direto, vocabulário simples, distraidores claramente errados. Bloom 1-2.',
    'Médio':  'Interpretação + aplicação real. Contexto breve. Distraidores parcialmente plausíveis. Bloom 2-3.',
    'Difícil':'Análise crítica, situação-problema. Todos distraidores muito plausíveis. Bloom 4-5.',
  };

  const typeKey = type in typeNote ? type : 'objetiva';
  const diffKey = difficulty in diffNote ? difficulty : 'Médio';

  const existingBlock = existingQuestions?.length
    ? `\nEVITE REPETIÇÃO — já geradas (explore ângulo DIFERENTE):\n${existingQuestions.map((q,i)=>`Q${i+1}: "${q.slice(0,100)}"`).join('\n')}\n`
    : '';

  return `Você é pedagogo especialista BNCC. Crie ${count} questão(ões) de alta qualidade.

PARÂMETROS:
- Disciplina: ${subject} | Tópico: ${topic} | Série: ${grade} | Turma: ${className||grade}
- Faixa etária: ${age} | Tipo: ${activityTypeLabel||type} | Dificuldade: ${difficulty} | Qtd: ${count}
- Cognição: ${bloom} | Linguagem: ${lang} | Seed: #${seed||Date.now()}

TIPO: ${typeNote[typeKey]}
DIFICULDADE: ${diffNote[diffKey]}

REGRAS:
1. 100% sobre "${topic}" (${subject}) — zero desvios temáticos
2. Enunciados de 15-${wl} palavras, linguagem compatível com ${age}
3. Progressão pedagógica: simples → elaboradas
4. Cada questão: subtema/ângulo DIFERENTE — originalidade total
5. Distraidores: erros REAIS comuns dos alunos (não valores aleatórios)
6. Zero erros conceituais — valide antes de responder
7. Engajamento: desperte curiosidade, não só memorização
${existingBlock}
Responda SOMENTE com JSON válido (sem texto antes/depois):
${isObjetiva
  ? `{"questions":[{"id":"uuid","type":"objetiva","text":"Enunciado (15-${wl} palavras)","options":["Alternativa CORRETA (posição 0)","Distrator 1","Distrator 2","Distrator 3"],"answer":"0","explanation":"Explicação pedagógica clara"}]}`
  : `{"questions":[{"id":"uuid","type":"dissertativa","text":"Enunciado reflexivo","answer":"Pontos essenciais esperados","explanation":"Critérios de avaliação"}]}`
}

Gere ${count} questão(ões) para "${className||grade}", tópico "${topic}", nível ${difficulty}.`.trim();
}


function buildTrailPrompt(topic: string, subject: string, grade: string, difficulty: string): string {
  const g = (grade||'').toLowerCase();
  const isEM = g.includes('em')||g.includes('médio');
  const yr = parseInt((g.match(/\d+/)||['0'])[0]);
  const seg = isEM ? 'Ensino Médio' : yr>=6 ? 'EF II' : 'EF I';
  const age = isEM ? '15–18 anos' : yr>=6 ? '11–15 anos' : '6–11 anos';
  const bloom = isEM ? 'Bloom 3-6 (aplicação→criação, ENEM/vestibular)' : yr>=6 ? 'Bloom 2-4 (compreensão→análise)' : 'Bloom 1-3 (reconhecimento→aplicação básica)';
  const lang = isEM ? 'Precisa, terminologia científica/literária, situações-problema reais'
    : yr>=6 ? 'Intermediária, vocabulário técnico básico, exemplos cotidiano adolescente'
    : 'MUITO simples, frases curtas, cotidiano infantil, sem abstrações';
  const xp = isEM ? 800 : yr>=6 ? 650 : 500;
  const coins = isEM ? 320 : yr>=6 ? 250 : 180;
  const diffLabel = difficulty==='easy'?'Fácil':difficulty==='hard'?'Difícil':'Médio';

  return `Você é pedagogo sênior especialista em BNCC e design instrucional gamificado.
Missão: criar TRILHA DE APRENDIZAGEM PROGRESSIVA (plano de ensino coerente — não questões soltas).

PARÂMETROS:
- Disciplina: ${subject} | Tema: ${topic} | Série: ${grade} (${seg}) | Faixa etária: ${age}
- BNCC: ${bloom} | Linguagem: ${lang} | Dificuldade: ${diffLabel}

ESTRUTURA OBRIGATÓRIA — 5 FASES:
Fase 1 (intro):    Bloom 1-2 — Conhecimento prévio, curiosidade, cotidiano.
Fase 2 (theory):   Bloom 2-3 — Conceitos centrais, clareza, rigor, exemplos.
Fase 3 (practice): Bloom 3-4 — Situações práticas, problemas reais.
Fase 4 (quiz):     Bloom 3-4 — Revisão e integração de todos os conceitos.
Fase 5 (boss):     Bloom 4-5 — Domínio: questões elaboradas, síntese, pensamento crítico.

Arco de dificuldade: suave (Fase 1) → plena (Fase 5). Cada fase referencia a anterior.

REGRAS:
- PROGRESSÃO REAL: cada fase constrói sobre a anterior explicitamente
- COERÊNCIA: todas as 5 fases giram em torno de "${topic}" (${subject})
- ADEQUAÇÃO ETÁRIA: linguagem/complexidade compatível com ${age}
- QUESTÕES ENGAJANTES: enunciados curtos, curiosidade, raciocínio > memorização
- DISTRAIDORES PEDAGÓGICOS: erros reais comuns — nada absurdo
- RIGOR CONCEITUAL: zero erros — valide cada afirmação
- Alternativa "a" é SEMPRE correta (sistema embaralha automaticamente)
- Campo "theory" (Markdown RICO): ## Título\\n\\nParágrafo 4-6 frases...\\n\\n**Conceitos-chave:**\\n- **C1:** explicação\\n- **C2:** explicação\\n- **C3:** explicação\\n\\n**Exemplo Prático:** situação real de ${age}...\\n\\n**💡 Sabia que...** curiosidade...\\n\\n**⚠️ Atenção:** erro mais comum e como superar

Responda SOMENTE com JSON válido (sem texto antes/depois):
{
  "title": "Título criativo e específico ao tema (máx 60 chars)",
  "description": "Objetivo pedagógico em 2-3 frases: o que o aluno domina, como progride, por que vale concluir",
  "rewardXp": ${xp}, "rewardCoins": ${coins},
  "steps": [
    {
      "id": "1", "title": "Nome motivador da fase (máx 40 chars)", "type": "intro",
      "content": "2-3 frases motivadoras: apresenta tema, conecta cotidiano, desperta curiosidade.",
      "theory": "## Título\\n\\nParágrafo 4-6 frases...\\n\\n**Conceitos-chave:**\\n- **C1:** explicação\\n- **C2:** explicação\\n- **C3:** explicação\\n\\n**Exemplo Prático:** situação real de ${age}...\\n\\n**💡 Sabia que...** curiosidade...\\n\\n**⚠️ Atenção:** erro comum e como superar...",
      "questions": [
        {"id":"q1","text":"Enunciado curto e envolvente?","options":[{"id":"a","text":"Resposta CORRETA","isCorrect":true},{"id":"b","text":"Distrator plausível","isCorrect":false},{"id":"c","text":"Distrator plausível","isCorrect":false},{"id":"d","text":"Distrator plausível","isCorrect":false}],"explanation":"Explicação didática em 1-2 frases."}
      ]
    }
  ]
}`.trim();
}

// ============================================================
// SHARED HELPERS: Grade + Difficulty Profiles (BNCC-aligned)
// Used by trail meta, trail step, and duel prompts.
// ============================================================

function getGradeProfile(grade: string): {
  stage: string; age: string; level: string; language: string;
  maxWords: number; maxSteps: string; wordLimitLabel: string;
} {
  const g = (grade || '').toLowerCase();
  const isEM = g.includes('em') || g.includes('médio');
  const yearMatch = g.match(/(\d+)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  if (isEM) return {
    stage: `${year}º Ano do Ensino Médio`,
    age: '15-18 anos',
    level: 'Alta complexidade — síntese, análise crítica, avaliação (Bloom 4-5). ENEM/vestibular.',
    language: 'Linguagem precisa, terminologia científica/literária/histórica adequada. Situações-problema reais e contextos desafiadores são bem-vindos.',
    maxWords: 35,
    wordLimitLabel: 'máx 35 palavras',
    maxSteps: '3-4 etapas de raciocínio',
  };
  if (year >= 6) return {
    stage: `${year}º Ano do Ensino Fundamental II`,
    age: '11-15 anos',
    level: 'Complexidade intermediária — compreensão, aplicação e análise (Bloom 2-4). Pensamento abstrato emergente.',
    language: 'Linguagem intermediária, vocabulário técnico básico, exemplos do cotidiano do adolescente. Proibido: terminologia universitária ou construções sintáticas muito complexas.',
    maxWords: 25,
    wordLimitLabel: 'máx 25 palavras',
    maxSteps: '2-3 etapas de raciocínio',
  };
  if (year >= 3) return {
    stage: `${year}º Ano do Ensino Fundamental I (anos finais)`,
    age: '8-11 anos',
    level: 'Complexidade baixa-média — reconhecimento, compreensão e aplicação básica (Bloom 1-3). Pensamento concreto.',
    language: 'Linguagem simples, frases curtas, vocabulário do cotidiano da criança. Analogias familiares. Proibido: abstrações, textos longos e vocabulário técnico.',
    maxWords: 15,
    wordLimitLabel: 'máx 15 palavras',
    maxSteps: '1-2 etapas de raciocínio',
  };
  return {
    stage: `${year <= 1 ? '1º' : '2º'} Ano do Ensino Fundamental I (anos iniciais)`,
    age: '6-8 anos',
    level: 'Complexidade mínima — reconhecimento e compreensão (Bloom 1-2). Pensamento concreto puro.',
    language: 'Linguagem MUITO simples, frases CURTÍSSIMAS, vocabulário 100% do cotidiano infantil. Proibido: qualquer abstração, frase longa ou vocabulário não-familiar.',
    maxWords: 8,
    wordLimitLabel: 'máx 8 palavras',
    maxSteps: '1 etapa de raciocínio',
  };
}

function getDifficultyProfile(difficulty: string, stage: string): { label: string; bloom: string; instructions: string } {
  switch (difficulty) {
    case 'easy': return {
      label: 'Fácil (Iniciante)',
      bloom: 'Bloom Nível 1-2: Recordar e Compreender',
      instructions: 'Perguntas diretas sobre conceitos fundamentais. Resposta identificável no conteúdo. Distraidores claramente errados. Sem pegadinhas.',
    };
    case 'hard': return {
      label: 'Difícil (Mestre)',
      bloom: 'Bloom Nível 4-5: Analisar e Avaliar',
      instructions: 'Perguntas exigem raciocínio aprofundado, síntese de conceitos e análise crítica. Todos os distraidores devem ser plausíveis. Use situações-problema complexas.',
    };
    default: return {
      label: 'Médio',
      bloom: 'Bloom Nível 2-3: Compreender e Aplicar',
      instructions: 'Perguntas que vão além da memorização — exigem compreensão real e aplicação do conceito. Distraidores parcialmente plausíveis. Use contextos práticos.',
    };
  }
}

function buildTrailMetaPrompt(topic: string, subject: string, grade: string): string {
  const gradeProfile = getGradeProfile(grade);
  return `
Você é um especialista sênior em design instrucional, pedagogia brasileira e currículo BNCC com 20 anos de experiência.

Sua missão: criar os METADADOS PEDAGÓGICOS de uma trilha de aprendizagem.

═══ CONTEXTO DA TRILHA ═══
Disciplina: ${subject}
Tema Central: ${topic}
Série/Grau: ${grade} (${gradeProfile.stage})
Faixa etária: ${gradeProfile.age}
Nível cognitivo BNCC: ${gradeProfile.level}
Perfil de linguagem: ${gradeProfile.language}

═══ INSTRUÇÕES ═══
- O título deve ser motivador, criativo e refletir EXATAMENTE o tema e a série
- A descrição deve descrever claramente o objetivo pedagógico, o que o aluno dominará, e mencionar implicitamente a progressão didática da trilha
- Use linguagem adequada para o professor/admin que vai cadastrar a trilha
- As recompensas devem ser proporcionais ao nível (mais difícil = mais XP)

Recompensas sugeridas por nível:
- EF I (1º-5º ano): rewardXp 400-500, rewardCoins 150-200
- EF II (6º-9º ano): rewardXp 550-700, rewardCoins 200-280
- EM (1º-3º EM): rewardXp 700-900, rewardCoins 280-380

Responda SOMENTE com JSON (sem texto antes ou depois):
{"title":"Título criativo e atrativo da trilha (máx 60 caracteres)","description":"Objetivo pedagógico claro em 2-3 frases, descrevendo o que o aluno dominará e a progressão didática","rewardXp":600,"rewardCoins":250}
`.trim();
}

function buildTrailStepPrompt(
  topic: string, subject: string, grade: string, difficulty: string,
  phaseIndex: number, phaseType: string, _phaseDescription: string
): string {
  const gp = getGradeProfile(grade);
  const dp = getDifficultyProfile(difficulty, gp.stage);

  // Compact phase map: [Bloom levels, focus keyword]
  const phaseMap: Record<string, [string, string]> = {
    intro:    ['1-2', 'contextualização e conhecimento prévio'],
    theory:   ['2-3', 'conceitos centrais com rigor e exemplos'],
    practice: ['3-4', 'situações-problema e aplicação real'],
    quiz:     ['3-4', 'revisão integrada de todos os conceitos'],
    boss:     ['4-5', 'síntese crítica e raciocínio avançado'],
  };
  const [bloom, focus] = phaseMap[phaseType] || phaseMap.theory;

  return `Prof BNCC. Fase ${phaseIndex+1}/5 (${phaseType}) sobre "${topic}" — ${subject} ${grade} ${gp.age}.
Foco: ${focus}. Bloom ${bloom}. Dific: ${dp.label}. Língua: ${gp.language.split(',')[0]}.
${dp.instructions}

Gere JSON (SOMENTE JSON, sem texto fora):
{"id":"${phaseIndex+1}","title":"<45ch>","type":"${phaseType}","content":"<2-3 frases intro>","theory":"## Título\\n\\nParágrafo 4-6 frases...\\n\\n**Conceitos-chave:**\\n- **C1:** explicação\\n- **C2:** explicação\\n- **C3:** explicação\\n\\n**Exemplo:** situação real ${gp.age}...\\n\\n**💡** curiosidade...\\n\\n**⚠️** erro comum e como superar...","questions":[{"id":"q1","text":"?","options":[{"id":"a","text":"CORRETA","isCorrect":true},{"id":"b","text":"errada","isCorrect":false},{"id":"c","text":"errada","isCorrect":false},{"id":"d","text":"errada","isCorrect":false}],"explanation":"..."},{"id":"q2","text":"?","options":[{"id":"a","text":"CORRETA","isCorrect":true},{"id":"b","text":"errada","isCorrect":false},{"id":"c","text":"errada","isCorrect":false},{"id":"d","text":"errada","isCorrect":false}],"explanation":"..."},{"id":"q3","text":"?","options":[{"id":"a","text":"CORRETA","isCorrect":true},{"id":"b","text":"errada","isCorrect":false},{"id":"c","text":"errada","isCorrect":false},{"id":"d","text":"errada","isCorrect":false}],"explanation":"..."}]}`.trim();
}



function buildLogicPrompt(difficulty: string, count: number, grade: string, opponentGrade?: string): string {
  // Duelo Equilibrado: always use the lower grade as reference
  let referenceGrade = grade || '';
  let duelMode = 'Duelo Padrão';
  if (opponentGrade && opponentGrade !== grade) {
    const gradeToYear = (g: string): number => {
      const lower = g.toLowerCase();
      const isEM = lower.includes('em') || lower.includes('médio');
      const m = lower.match(/(\d+)/);
      const y = m ? parseInt(m[1]) : 0;
      return isEM ? y + 9 : y;
    };
    if (gradeToYear(opponentGrade) < gradeToYear(grade)) referenceGrade = opponentGrade;
    duelMode = `Duelo Equilibrado — série de referência: ${referenceGrade}`;
  }

  const gradeProfile = getGradeProfile(referenceGrade);

  // Grade-specific logic challenge parameters
  const gradeLogicProfile = (() => {
    const g = referenceGrade.toLowerCase();
    const isEM = g.includes('em') || g.includes('médio');
    const m = g.match(/(\d+)/);
    const year = m ? parseInt(m[1]) : 5;
    const actual = isEM ? year + 9 : year;

    if (actual <= 5) return {
      abstraction: 'Raciocínio CONCRETO. Use objetos reais, figuras familiares, quantidade pequena de elementos (até 5-6). Evite qualquer abstração matemática avançada ou dedução complexa.',
      questionTypes: `
- Sequências simples de números (1, 2, 3, ?, 5) ou letras (A, B, C, ?)
- Padrões de cores/formas descritos em texto (círculo, quadrado, círculo, ?)
- Problemas de comparação simples ("Maria tem 3 maçãs e Jorge tem mais 2. Quem tem mais?")
- Ordenação simples (maior, menor, primeiro, último)
- Problemas de lógica concreta com objetos do cotidiano
- Complete a sequência com formas geométricas simples`,
      maxSteps: '1 etapa de raciocínio',
      numbers: 'Use números de 1 a 30'
    };

    if (actual <= 9) return {
      abstraction: 'Raciocínio PROGRESSIVAMENTE ABSTRATO. Pode incluir variáveis simples, múltiplas condições básicas e inferências moderadas. Pensamento lógico em desenvolvimento.',
      questionTypes: `
- Sequências numéricas com progressão (2, 4, 8, 16, ?) ou mistas
- Problemas de lógica com 2-3 condições (Se A→B, e B→C, então A→?)
- Analogias lógicas (Gato está para felino como cachorro está para ?)
- Problemas de desigualdade e ordenação com até 4 elementos
- Deduções simples com eliminação de alternativas
- Problemas de raciocínio matemático básico aplicado (idade, velocidade simples, quantidades)
- Identificação de padrões em grades 2x2 ou 3x3 descritas em texto
- Lógica verbal com proposições simples`,
      maxSteps: '2-3 etapas de raciocínio',
      numbers: 'Use números até 200, frações simples e percentuais básicos'
    };

    return {
      abstraction: 'Raciocínio ABSTRATO AVANÇADO. Múltiplas condições, abstrações matemáticas, análise de proposições lógicas e resolução de problemas complexos. Preparação ENEM/vestibular.',
      questionTypes: `
- Sequências complexas com múltiplas variáveis ou padrões de segunda ordem
- Silogismos e proposições lógicas (se P→Q e ¬Q, então ¬P)
- Problemas de lógica matemática com múltiplas condições e incógnitas
- Tabela verdade simplificada
- Problemas de contagem e combinatória básica
- Raciocínio espacial complexo descrito em texto
- Problemas de lógica formal com predicados simples
- Análise de argumentos e identificação de falácias.
- Problemas de velocidade, tempo e distância
- Diagramas de Venn descritos em texto`,
      maxSteps: '3-5 etapas de raciocínio',
      numbers: 'Use qualquer número; pode incluir álgebra simples, probabilidade básica e geometria analítica elementar'
    };
  })();

  // Difficulty calibration
  const diffConfig = {
    easy: {
      label: 'Fácil',
      desc: 'Problema direto e objetivo. Solução em 1 etapa clara. Resposta identificável com atenção básica. Distraidores bem diferentes.',
      distractor: 'Distraidores claramente errados para quem raciocinou corretamente.',
      example: `Ex fácil: "Qual vem depois na sequência: 2, 4, 6, 8, ___?" → Resposta: 10`
    },
    medium: {
      label: 'Médio',
      desc: 'Exige atenção e raciocínio em 2 etapas. Pode envolver eliminação de alternativas. Solução requer interpretação cuidadosa do enunciado.',
      distractor: 'Distraidores plausíveis, representando erros comuns de raciocínio.',
      example: `Ex médio: "Se todo A é B, e todo B é C, qual das afirmações é necessariamente verdadeira?" → Requer deduç ão em 2 passos`
    },
    hard: {
      label: 'Difícil',
      desc: 'Múltiplas etapas de raciocínio. Exige análise profunda, concentração e processamento de múltiplas condições simultâneas. Fácil errar por distração.',
      distractor: 'Todos os distraidores muito plausíveis — representam erros sutis de raciocínio ou casos parcialmente corretos.',
      example: `Ex difícil: problemas com 3+ condições encadeadas ou padrões de segunda ordem`
    }
  }[difficulty] || { label: 'Médio', desc: 'raciocínio em 2 etapas', distractor: 'distraidores plausíveis', example: '' };

  return `
Você é um(a) professor(a) especialista em raciocínio lógico, matemática cognitiva e desenvolvimento do pensamento crítico para educação brasileira (BNCC).

Sua missão: Criar ${count} questões de DUELO LÓGICO PERFEITAS, desafiadoras e matematicamente corretas.

═══ CONTEXTO DO DUELO ═══
${duelMode}
Série de referência: ${referenceGrade} (${gradeProfile.stage})
Faixa etária: ${gradeProfile.age}
Linguagem adequada: ${gradeProfile.language}

═══ PERFIL LÓGICO DA SÉRIE ═══
Nível de abstração: ${gradeLogicProfile.abstraction}
Limitação numérica: ${gradeLogicProfile.numbers}
Etapas de raciocínio máximas: ${gradeLogicProfile.maxSteps}

═══ TIPOS DE DESAFIOS LÓGICOS (varie entre os tipos) ═══
${gradeLogicProfile.questionTypes}

═══ DIFICULDADE: ${diffConfig.label.toUpperCase()} ═══
Calibração: ${diffConfig.desc}
Distraidores: ${diffConfig.distractor}
${diffConfig.example}

═══ REGRAS ABSOLUTAS DE QUALIDADE ═══
1. TODA questão deve ter UMA E APENAS UMA resposta correta — sem ambiguidade matemática ou lógica
2. O caminho de resolução deve ser claro e verificável pelo aluno com raciocínio adequado à série
3. NUNCA crie questões impossíveis de resolver ou que exijam conhecimento além de ${referenceGrade}
4. Varie os tipos de desafio: não repita o mesmo padrão mais de 2 vezes seguidas
5. Progressão leve: as últimas questões podem ser levemente mais complexas dentro do mesmo nível
6. Linguagem RIGOROSAMENTE compatível com ${gradeProfile.age} — sem termos técnicos acima da série
7. Antes de cada questão, valide internamente: (a) a resposta é única? (b) o enunciado é claro? (c) o tipo está dentro da série? (d) os distraidores são plausíveis mas incorretos?
8. ZERO tolerância para: erros matemáticos/lógicos, enunciados ambíguos, questões sem solução clara, dificuldade incoerente
9. Cada distrator deve representar um ERRO REAL de raciocínio (não valores aleatórios)
10. A alternativa "a" (isCorrect: true) é SEMPRE a correta — o sistema embaralha automaticamente

═══ FORMATO DE SAÍDA ═══
Responda SOMENTE com JSON válido, sem texto antes ou depois:
{
  "questions": [
    {
      "id": "uuid-placeholder",
      "questionText": "Enunciado claro e completo do problema lógico, incluindo todos os dados necessários para resolver. Não deixe informações ambíguas.",
      "options": [
        { "id": "a", "text": "Resposta correta", "isCorrect": true },
        { "id": "b", "text": "Erro de raciocínio plausível 1", "isCorrect": false },
        { "id": "c", "text": "Erro de raciocínio plausível 2", "isCorrect": false },
        { "id": "d", "text": "Erro de raciocínio plausível 3", "isCorrect": false }
      ],
      "explanation": "Explicação passo a passo da solução em 1-3 frases, mostrando o raciocínio correto de forma didática."
    }
  ]
}
`.trim();
}

function buildWhoAmIPrompt(difficulty: string, count: number, grade: string, opponentGrade?: string): string {
  // Duelo Equilibrado: always use lower grade
  let referenceGrade = grade || '';
  let duelMode = 'Duelo Padrão';
  if (opponentGrade && opponentGrade !== grade) {
    const gradeToYear = (g: string): number => {
      const lower = g.toLowerCase();
      const isEM = lower.includes('em') || lower.includes('médio');
      const m = lower.match(/(\d+)/);
      const y = m ? parseInt(m[1]) : 0;
      return isEM ? y + 9 : y;
    };
    if (gradeToYear(opponentGrade) < gradeToYear(grade)) referenceGrade = opponentGrade;
    duelMode = `Duelo Equilibrado — série de referência: ${referenceGrade}`;
  }

  const gradeProfile = getGradeProfile(referenceGrade);

  // Age-appropriate categories
  const categoryGuide = (() => {
    const g = referenceGrade.toLowerCase();
    const isEM = g.includes('em') || g.includes('médio');
    const m = g.match(/(\d+)/);
    const year = m ? parseInt(m[1]) : 5;
    const actual = isEM ? year + 9 : year;

    if (actual <= 5) return {
      categories: 'personagens de desenhos animados famosos (ex: Turma da Mônica, Peppa Pig, Mickey), animais do cotidiano e da natureza, profissões simples (médico, bombeiro, professor), personagens folclóricos brasileiros (Saci, Curupira, Iara), super-heróis conhecidos do universo infantil, objetos do dia a dia escolar',
      references: 'Mantenha referências 100% dentro do universo infantil e escolar. Evite qualquer referência adulta, histórica complexa ou política.',
      language: 'Linguagem muito simples, direta, lúdica. Vocabulário para 6-11 anos.'
    };
    if (actual <= 9) return {
      categories: 'personagens de séries e filmes populares entre adolescentes, atletas e esportistas famosos (especialmente brasileiros), figuras históricas do currículo escolar (D. Pedro I, Santos Dumont, Zumbi), animais brasileiros e mundiais, profissões do mundo moderno, super-heróis (Marvel, DC), influenciadores digitais conhecidos pela faixa etária, lugares famosos do Brasil e do mundo',
      references: 'Use referências do universo adolescente que sejam conhecidas pela série. Evite referências adultas, políticas ou polêmicas.',
      language: 'Linguagem intermediária, dinâmica e envolvente. Vocabulário para 11-15 anos.'
    };
    return {
      categories: 'figuras históricas nacionais e internacionais, cientistas, artistas, filósofos, escritores, atletas olímpicos, personagens literários do currículo do Ensino Médio, lugares históricos e geográficos relevantes, conceitos e elementos científicos personificados, músicos e bandas relevantes culturalmente',
      references: 'Use referências mais amplas, inteligentes e culturalmente ricas. Pode incluir referências acadêmicas e históricas mais profundas.',
      language: 'Linguagem rica, criativa e desafiadora. Vocabulário para 15-18 anos.'
    };
  })();

  // Difficulty calibration for clue style
  const diffConfig = {
    easy: {
      label: 'Fácil',
      clueStyle: 'Pistas DIRETAS e características muito conhecidas. Comece com 2 pistas que quase entregam a resposta. A resposta deve ser fácil de identificar para quem conhece o personagem/elemento. Distraidores claramente diferentes.',
      clueCount: '3 a 4 pistas',
      ambiguity: 'Baixa — as pistas devem ser bastante reveladoras.'
    },
    medium: {
      label: 'Médio',
      clueStyle: 'Pistas MODERADAMENTE desafiadoras. Comece amplo e afunile progressivamente. A resposta é identificável com atenção e interpretação. Distraidores razoavelmente similares.',
      clueCount: '4 a 5 pistas',
      ambiguity: 'Média — a resposta requer interpretação das pistas em conjunto.'
    },
    hard: {
      label: 'Difícil',
      clueStyle: 'Pistas SUTIS e estratégicas. Inicie com características indiretas e ambíguas. Só as últimas pistas devem apontar para a resposta. A resposta requer associação de múltiplas características. Distraidores muito similares e plausíveis.',
      clueCount: '5 a 6 pistas',
      ambiguity: 'Alta — exige raciocínio dedutivo e associação inteligente de pistas.'
    }
  }[difficulty] || { label: 'Médio', clueStyle: 'pistas moderadas', clueCount: '4-5', ambiguity: 'média' };

  return `
Você é um(a) professor(a) criativo(a) especialista em jogos educacionais, com talento para criar adivinhações envolventes e pedagogicamente perfeitas para o tema "Quem Sou Eu?".

Sua missão: Criar ${count} perguntas de adivinhação em formato "Quem Sou Eu?" para o duelo a seguir.

═══ CONTEXTO DO DUELO ═══
${duelMode}
Série de referência: ${referenceGrade} (${gradeProfile.stage})
Faixa etária: ${gradeProfile.age}
Linguagem adequada: ${gradeProfile.language}

═══ FORMATO "QUEM SOU EU?" ═══
Cada pergunta deve funcionar como uma ADIVINHAÇÃO POR PISTAS PROGRESSIVAS:
- O enunciado ("questionText") constrói ${diffConfig.clueCount} pistas descritivas que revelam QUEM ou O QUÊ é o elemento
- As pistas devem ser organizadas do MAIS AMPLO para o MAIS ESPECÍFICO
- Cada pista deve gerar curiosidade e ajudar a eliminar possibilidades
- A resposta correta é a alternativa "a" (o sistema embaralha automaticamente)

Estilo das pistas: ${diffConfig.clueStyle}
Ambiguidade: ${diffConfig.ambiguity}

═══ CATEGORIAS ADEQUADAS PARA ${referenceGrade} ═══
${categoryGuide.categories}

${categoryGuide.references}

═══ COMO CONSTRUIR O ENUNCIADO ═══
Use este formato para o "questionText":
"🕵️ Quem sou eu?\\n\\n🔎 Pista 1: [característica ampla]\\n🔎 Pista 2: [característica mais específica]\\n🔎 Pista 3: [outra pista que afunila]\\n[...mais pistas conforme o nível de dificuldade]\\n\\nQuem sou eu?"

Regras das pistas:
- Pista 1: sempre começa com algo geral (ex: "Sou um animal", "Sou uma pessoa real", "Sou um personagem fictício")
- Pistas do meio: características marcantes, contexto, hábitos, aparência, habilidades, ambiente
- Última pista: mais específica mas SEM revelar o nome diretamente
- NUNCA inclua o nome do elemento nas pistas
- NUNCA use pistas contraditórias ou enganosas
- Cada pista deve ser curta: 1 frase direta e objetiva

═══ REGRAS ABSOLUTAS DE QUALIDADE ═══
1. Cada pergunta deve ter um elemento DIFERENTE — não repita o mesmo personagem/animal/etc
2. Varie as categorias: não faça todas sobre animais, ou todas sobre super-heróis
3. As 4 alternativas devem ser da MESMA CATEGORIA (ex: se a resposta é um super-herói, os distraidores também são)
4. Distraidores devem ser plausíveis, não óbvios de eliminar
5. Antes de cada pergunta, valide internamente: pistas são coerentes? levam à resposta correta? são adequadas para ${gradeProfile.age}?
6. ZERO tolerância para: pistas incoerentes, referências inadequadas para a idade, respostas reveladas cedo demais
7. Conteúdo 100% adequado e seguro para ${gradeProfile.age}
8. ${diffConfig.clueStyle}

═══ FORMATO DE SAÍDA ═══
Responda SOMENTE com JSON válido, sem texto antes ou depois:
{
  "questions": [
    {
      "id": "uuid-placeholder",
      "questionText": "🕵️ Quem sou eu?\\n\\n🔎 Pista 1: Sou um ser vivo encontrado em florestas tropicais.\\n🔎 Pista 2: Sou famoso por minha preguiça e pelo tempo que passo pendurado nas árvores.\\n🔎 Pista 3: Meu nome sugere lentidão, e eu me movo muito devagar mesmo.\\n\\nQuem sou eu?",
      "options": [
        { "id": "a", "text": "Bicho-Preguiça", "isCorrect": true },
        { "id": "b", "text": "Macaco-Prego", "isCorrect": false },
        { "id": "c", "text": "Tatu-Bola", "isCorrect": false },
        { "id": "d", "text": "Tamanduá-Bandeira", "isCorrect": false }
      ],
      "explanation": "O Bicho-Preguiça é famoso por sua lentidão e por passar a maior parte da vida pendurado em árvores das florestas tropicais!"
    }
  ]
}
`.trim();
}

function buildDuelPrompt(theme: string, difficulty: string, count: number, grade: string, opponentGrade?: string, seed?: number, studentAccuracy?: number): string {

  // ─── Duelo Equilibrado: always use the lower grade as reference ───
  let referenceGrade = grade || '';
  let duelMode = 'Modo: Duelo Solo ou Padrão';

  if (opponentGrade && opponentGrade !== grade) {
    const gradeToYear = (g: string): number => {
      const lower = g.toLowerCase();
      const isEM = lower.includes('em') || lower.includes('médio');
      const match = lower.match(/(\d+)/);
      const y = match ? parseInt(match[1]) : 0;
      return isEM ? y + 9 : y;
    };
    const y1 = gradeToYear(grade);
    const y2 = gradeToYear(opponentGrade);
    referenceGrade = y2 < y1 ? opponentGrade : grade;
    duelMode = `Duelo Equilibrado — série de referência: ${referenceGrade} (menor entre "${grade}" e "${opponentGrade}")`;
  } else if (grade) {
    duelMode = `Solo/Padrão — série do aluno: ${grade}`;
  }

  const gradeProfile = getGradeProfile(referenceGrade);
  const difficultyProfile = getDifficultyProfile(difficulty, gradeProfile.stage);

  // ─── Per-grade BNCC content anchors ───
  const gradeContentMap: Record<string, string> = {
    EFI: `
• Conteúdos EFI (1º–5º Ano):
  - História: história local, família, comunidade, primeiros povos do Brasil, descobrimento (linguagem simples)
  - Geografia: bairro, cidade, campo/cidade, regiões brasileiras básicas, pontos cardeais
  - Ciências: seres vivos, corpo humano básico, saúde e higiene, animais e plantas, estados da matéria
  - Matemática: operações fundamentais, frações simples, medidas, formas geométricas
  - Português: alfabeto, leitura, interpretação de textos curtos, gramática básica
  - Arte: cores, formas, artistas brasileiros acessíveis, dança e teatro infantil
  - Esportes: regras básicas de futebol, vôlei, atletismo, Olimpíadas (conceito geral)`,
    EFII: `
• Conteúdos EFII (6º–9º Ano):
  - História: Brasil Colônia, Império, República, Revolução Industrial, Guerras Mundiais (contextualizado)
  - Geografia: biomas brasileiros, geopolítica, clima, cartografia, urbanização
  - Ciências: sistema solar, célula, ecossistemas, física básica, química introdutória
  - Matemática: equações, proporção, porcentagem, geometria plana/espacial, estatística básica
  - Português: figuras de linguagem, análise sintática, textos argumentativos, literatura brasileira
  - Arte: movimentos artísticos (Modernismo, Barroco), arte contemporânea, música e cinema
  - Esportes: modalidades olímpicas, recordes, federações, história dos Jogos Olímpicos`,
    EM: `
• Conteúdos EM (1º–3º Médio):
  - História: Idade Contemporânea, Guerra Fria, globalização, ditadura militar brasileira, redemocratização
  - Geografia: geopolítica global, economia mundial, questões ambientais, metropolização
  - Biologia: genética, evolução, ecologia, fisiologia humana complexa
  - Física: mecânica clássica, óptica, termodinâmica, eletromagnetismo
  - Química: ligações químicas, reações, estequiometria, química orgânica introdutória
  - Matemática: funções, trigonometria, análise combinatória, cálculo básico
  - Literatura: escolas literárias brasileiras, Realismo, Modernismo, análise crítica`,
  };
  const gradeContent = gradeContentMap[gradeProfile.stage] || gradeContentMap['EFII'];

  // ─── Theme guidance ───
  const themeGuide: Record<string, string> = {
    historia:       'Eventos históricos, personagens, causas/consequências e linhas do tempo compatíveis com a série. Perguntas sobre fatos verificáveis, não opinião.',
    geografia:      'Localização, características físicas, relações humano-ambiente, biomas e geopolítica adequados ao nível. Evite dados numéricos muito específicos.',
    ciencias:       'Conceitos científicos fundamentais, fenômenos naturais, corpo humano, ecologia e física básica compatíveis com a série.',
    matematica:     'Raciocínio lógico, operações, geometria ou álgebra compatíveis com o nível. Seja preciso numericamente.',
    portugues:      'Gramática, interpretação de texto, ortografia e produção textual adequados. Inclua trechos curtos para interpretação quando adequado.',
    arte:           'Movimentos artísticos, artistas brasileiros e mundiais, linguagens artísticas e expressão cultural compatíveis com o nível.',
    esportes:       'Regras, história, recordes, atletas importantes e cultura esportiva. Inclua esportes olímpicos e populares no Brasil.',
    entretenimento: `Cultura pop, filmes, músicas, jogos e fenômenos culturais reconhecíveis e adequados para ${gradeProfile.age}.`,
    aleatorio:      `Distribua as perguntas de forma OBRIGATORIAMENTE variada entre as seguintes áreas (nenhuma área pode ter mais de 2 perguntas):
  • 1-2 perguntas de Ciências ou Biologia
  • 1-2 perguntas de História
  • 1 pergunta de Geografia ou Geopolítica
  • 1 pergunta de Esportes, Arte ou Cultura
  • 1 pergunta de conhecimento geral ou curiosidade fascinante
  Nunca concentre todas as perguntas em uma única área temática.`,
  };
  const themeContext = themeGuide[theme.toLowerCase()] || themeGuide.aleatorio;

  // ─── Difficulty calibration ───
  const diffDetailMap: Record<string, string> = {
    easy:   `NÍVEL FÁCIL: Pergunta direta, resposta memorização/reconhecimento. Enunciado com 1 único conceito. Distraidores claramente errados. Vocabulário bem simples. BLOOM: Lembrar/Reconhecer.`,
    medium: `NÍVEL MÉDIO: Exige interpretação simples e aplicação. Contexto breve no enunciado. Distraidores parcialmente plausíveis. Entendimento genuíno, não só memorização. BLOOM: Compreender/Aplicar.`,
    hard:   `NÍVEL DIFÍCIL: Exige raciocínio lógico e aplicação em contexto. Situação-problema ou análise. TODOS os distraidores tecnicamente plausíveis mas inequivocamente errados. BLOOM: Analisar/Avaliar.`,
  };
  const diffDetail = diffDetailMap[difficulty] || diffDetailMap.medium;

  // ─── Adaptive Difficulty: silently adjust based on student accuracy ─────────
  // accuracy: 0.0–1.0. Default 0.5 (neutral) if no history yet.
  const adaptedDifficulty = (() => {
    const levels = ['easy', 'medium', 'hard'] as const;
    const baseIdx = levels.indexOf(difficulty as any) !== -1
      ? levels.indexOf(difficulty as any)
      : 1;
    if (studentAccuracy !== undefined && studentAccuracy < 0.35 && baseIdx > 0)
      return levels[baseIdx - 1]; // silently lower
    if (studentAccuracy !== undefined && studentAccuracy > 0.80 && baseIdx < 2)
      return levels[baseIdx + 1]; // silently raise
    return difficulty;
  })();

  // ─── 3-Tier In-Match Progression ─────────────────────────────────────────
  // Each match ramps from easier to harder to create natural flow.
  // Tiers are RELATIVE to the configured difficulty level:
  //   Configured FÁCIL:  Q1-3=trivial,   Q4-6=fácil,   Q7-9=médio
  //   Configured MÉDIO:  Q1-3=fácil,     Q4-6=médio,   Q7-9=difícil
  //   Configured MESTRE: Q1-3=médio,     Q4-6=difícil,  Q7-9=mestre
  const diffTierMap: Record<string, [string, string, string]> = {
    easy:   [
      'TRIVIAL — direto, 1 conceito, 1 etapa de lembrar/reconhecer, resposta óbvia para quem sabe',
      'FÁCIL — 1 etapa de compreender/aplicar, enunciado direto, distraidores bem distintos',
      'MÉDIO — 2 etapas de raciocínio, exige interpretação leve, distraidores parcialmente plausíveis',
    ],
    medium: [
      'FÁCIL — 1-2 etapas, enunciado claro, distraidores distintos (aquecimento da partida)',
      'MÉDIO — 2 etapas de compreensão/aplicação, distraidores plausíveis',
      'DIFÍCIL — 2-3 etapas de análise, situação-problema, todos os distraidores muito plausíveis',
    ],
    hard: [
      'MÉDIO — 2 etapas de compreensão (aquecimento)',
      'DIFÍCIL — 2-3 etapas de análise, situação-problema complexa',
      'MESTRE — 3+ etapas, síntese crítica, raciocínio aprofundado, pega quem não estudou bem',
    ],
  };
  const [tier1Label, tier2Label, tier3Label] = diffTierMap[adaptedDifficulty] || diffTierMap.medium;
  const t1End = Math.ceil(count / 3);
  const t2End = Math.ceil(count * 2 / 3);
  const progressionPlan = count <= 3
    ? `Todas as questões no nível ${getDifficultyProfile(adaptedDifficulty, '').label}.`
    : `🎯 PROGRESSÃO OBRIGATÓRIA DE DIFICULDADE DENTRO DA PARTIDA:
  • Questões 1–${t1End}: ${tier1Label}
  • Questões ${t1End + 1}–${t2End}: ${tier2Label}
  • Questões ${t2End + 1}–${count}: ${tier3Label}
  ⚠️ A Q1 deve ser VISIVELMENTE mais fácil que a Q${count}. Isso é obrigatório.`;

  // ─── Strict per-age word limits ──────────────────────────────────────────
  const wordLimitRule = `⚠️ LIMITE ABSOLUTO DE PALAVRAS NO ENUNCIADO (${gradeProfile.age}):
MÁXIMO ${gradeProfile.maxWords} palavras por enunciado (${gradeProfile.wordLimitLabel}).
Conte ANTES de finalizar. Se ultrapassar, reescreva. Enunciados longos são REPROVADOS.
Exemplos de enunciado correto para ${gradeProfile.age}:
${gradeProfile.maxWords <= 8
  ? '• "Quanto é 3 + 4?"\n• "Qual animal voa?"\n• "De que cor é o sol?"'
  : gradeProfile.maxWords <= 15
  ? '• "Qual é o maior bioma do Brasil?"\n• "O que é fotossíntese?"\n• "Quanto é 25% de 80?"'
  : gradeProfile.maxWords <= 25
  ? '• "Qual foi a principal causa da Proclamação da República no Brasil?"\n• "Em que camada da Terra ocorrem os terremotos?"'
  : '• "Considerando a Lei de Conservação de Massa, o que acontece com a massa total dos reagentes após uma reação química?"\n• "Qual das afirmativas descreve corretamente o papel dos mitocôndrias no metabolismo celular?"'
}`;

  // ─── Freshness & topic dispersion seed ───
  const freshSeed = seed || Date.now();
  const subtopicVariant = [
    'Explore aspectos POUCO CONHECIDOS ou CURIOSOS do tema — evite conceitos que costumam aparecer sempre.',
    'Foque em APLICAÇÕES PRÁTICAS e CONTEXTOS DO COTIDIANO relacionados ao tema.',
    'Priorize perguntas sobre PERSONAGENS, EVENTOS ou DESCOBERTAS específicos dentro do tema.',
    'Aborde CONEXÕES INTERDISCIPLINARES do tema com outras áreas do conhecimento.',
    'Explore a DIMENSÃO HISTÓRICA ou EVOLUÇÃO TEMPORAL do tema ao longo do tempo.',
    'Foque em COMPARAÇÕES e CONTRASTES dentro do tema — semelhanças, diferenças, casos especiais.',
    'Priorize aspectos REGIONAIS ou BRASILEIROS do tema sempre que possível.',
    'Explore IMPACTOS e CONSEQUÊNCIAS do tema na sociedade, natureza ou ciência.',
  ][freshSeed % 8];

  return `
Você é um(a) professor(a) especialista no currículo brasileiro BNCC com 20 anos de experiência em avaliações educacionais gamificadas e rigor pedagógico absoluto.

Sua missão: Criar ${count} perguntas de Duelo Educacional IMPECÁVEIS — curtas, claras, pedagógicas e 100% coerentes com a série e o tema definidos.

╔═══ CHAVE DE FRESCOR ════════════════════════════════╗
Seed único de geração: #${freshSeed}
Esta chave garante que esta série de perguntas seja COMPLETAMENTE DIFERENTE de qualquer outra gerada anteriormente. Use-a como inspiração para escolher ângulos, exemplos e contextos que você NÃO usaria normalmente.

Foco de variedade desta geração: ${subtopicVariant}
╚═══════════════════════════════════════════╗

═══ CONTEXTO DO DUELO ═══
${duelMode}
Série de referência: ${referenceGrade || 'Não informada — use 6º Ano como padrão'}
Segmento: ${gradeProfile.stage} | Faixa etária: ${gradeProfile.age}
Nível BNCC: ${gradeProfile.level}
Linguagem exigida: ${gradeProfile.language}

═══ TEMA E DIFICULDADE ═══
Tema: ${theme}
Diretriz do tema: ${themeContext}
Nível de dificuldade: ${difficultyProfile.label} — ${diffDetail}

═══ CONTEÚDOS ADEQUADOS PARA A SÉRIE ═══
${gradeContent}
⚠️ CRÍTICO: Use APENAS conteúdos dentro da faixa acima. Nunca ultrapasse o nível da série.

═══ PROGRESSÃO PEDAGÓGICA ═══
${progressionPlan}

═══ LIMITE DE PALAVRAS — REGRA INVIOLÁVEL ═══
${wordLimitRule}

═══ REGRAS ABSOLUTAS — LEIA COM ATENÇÃO ═══
1. ENUNCIADO CURTO: ${gradeProfile.wordLimitLabel} por enunciado. Conte antes de finalizar. PROIBIDO ultrapassar.
2. SEM ERROS: zero erros conceituais, gramaticais ou de conteúdo.
3. TEMA EXCLUSIVO: cada pergunta deve ser 100% dentro do tema "${theme}". Zero desvios.
4. SÉRIE RESPEITADA: NUNCA gere conteúdo acima do nível de ${referenceGrade}. Linguagem: ${gradeProfile.language}
5. SEM REPETIÇÃO INTERNA: nenhum conceito ou aspecto repetido entre as ${count} perguntas desta sessão.
6. SEM REPETIÇÃO ENTRE SESSÕES: use o Seed #${freshSeed} para escolher ângulos que NÃO são os mais óbvios do tema.
7. DISPERSÃO TEMÁTICA: cada pergunta aborda um SUBTÓPICO ou ÂNGULO DIFERENTE dentro de "${theme}".
8. DISTRAIDORES REAIS: 3 alternativas erradas mas plausíveis — representam erros reais que alunos cometem.
9. EXPLICAÇÃO DIDÁTICA: 1-2 frases, linguagem adequada para ${gradeProfile.age}, ensina algo concreto.
10. VALIDAÇÃO POR QUESTÃO antes de finalizar:
   ✓ Enunciado está dentro do limite de ${gradeProfile.maxWords} palavras?
   ✓ O conteúdo é compatível com ${referenceGrade}?
   ✓ Os distraidores são plausíveis mas claramente errados?
   ✓ A explicação ensina algo real?
   ✓ Esta pergunta aborda um ASPECTO DIFERENTE das anteriores?

═══ FORMATO DE SAÍDA (JSON puro, sem texto antes ou depois) ═══
{
  "questions": [
    {
      "id": "uuid-placeholder",
      "questionText": "Enunciado curto e claro (máx. 2 linhas)?",
      "options": [
        { "id": "a", "text": "Resposta correta", "isCorrect": true },
        { "id": "b", "text": "Distrator plausível 1", "isCorrect": false },
        { "id": "c", "text": "Distrator plausível 2", "isCorrect": false },
        { "id": "d", "text": "Distrator plausível 3", "isCorrect": false }
      ],
      "explanation": "Explicação didática em 1-2 frases adequada para ${gradeProfile.age}."
    }
  ]
}
`.trim();
}

function buildParentTipsPrompt(topic: string): string {
  return `
Você é um especialista em educação infantil, parentalidade positiva e psicologia do desenvolvimento.
Escreva um artigo curto e prático (máximo 250 palavras) sobre: "${topic}"

Regras:
- Português do Brasil
- Tom acolhedor e não-julgamental
- Dê dicas concretas e acionáveis
- Use linguagem acessível para pais sem formação pedagógica
- Estruture com parágrafo de introdução, dicas práticas e encerramento motivador
`.trim();
}

function buildParentQAPrompt(question: string): string {
  return `
Você é um especialista em educação infantil e parentalidade. Um pai ou mãe fez a seguinte pergunta:
"${question}"

Responda de forma:
- Empática e acolhedora
- Prática e direta
- Em português do Brasil
- Máximo 200 palavras
- Sem julgamentos
- Com pelo menos uma dica concreta que o pai pode aplicar hoje
`.trim();
}

function buildAdminInsightsPrompt(data: string): string {
  return `
Você é um(a) analista educacional sênior. Analise os dados abaixo e gere insights estratégicos para um Administrador de sistema educacional.

Dados:
${data}

Gere SOMENTE um JSON válido com o seguinte formato:
{
  "insights": [
    { "title": "Título do insight", "description": "Descrição detalhada do problema ou oportunidade", "priority": "high|medium|low", "action": "Ação recomendada" }
  ],
  "summary": "Resumo executivo em 2-3 frases"
}
`.trim();
}

function buildTeacherFeedbackPrompt(
  studentName: string,
  subject: string,
  score: number,
  totalQuestions: number,
  wrongAnswers: string[]
): string {
  const percentage = Math.round((score / totalQuestions) * 100);
  return `
Você é um professor especialista em ${subject}. Analise o desempenho do(a) aluno(a) abaixo e gere um feedback pedagógico personalizado.

Aluno(a): ${studentName}
Disciplina: ${subject}
Acertos: ${score} de ${totalQuestions} (${percentage}%)
Questões erradas: ${wrongAnswers.slice(0, 5).join("; ")}

Gere SOMENTE um JSON válido:
{
  "feedback": "Feedback completo e motivador para o aluno (3-4 frases)",
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "improvements": ["Área a melhorar 1", "Área a melhorar 2"],
  "recommendedTopics": ["Tópico para rever 1", "Tópico para rever 2"],
  "encouragement": "Mensagem encorajadora curta (1 frase)"
}
`.trim();
}

function buildGuardianSummaryPrompt(
  studentName: string,
  xp: number,
  level: number,
  streak: number,
  recentActivities: string[],
  missionsCompleted: number
): string {
  return `
Você é um assistente educacional amigável. Crie um resumo semanal do progresso escolar para os pais/responsáveis de ${studentName}.

Dados do período:
- Nível no sistema: ${level}
- XP total acumulado: ${xp}
- Dias consecutivos de estudo: ${streak}
- Missões concluídas: ${missionsCompleted}
- Atividades recentes: ${recentActivities.slice(0, 5).join(", ")}

Escreva um resumo em português do Brasil:
- Tom positivo e acolhedor
- Máximo 200 palavras
- Destaque conquistas
- Mencione áreas de atenção de forma gentil
- Termine com uma dica prática para os pais apoiarem em casa
`.trim();
}

// ============================================================
// MAIN HANDLER
// ============================================================

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!GEMINI_API_KEY) {
    console.error("[AI-Proxy] GEMINI_API_KEY not configured");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "AI service not configured. Contact support." }),
    };
  }

  let body: GeminiRequest & Record<string, any>;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { feature, prompt: rawPrompt, userId, role, ...featureData } = body;

  // Validate feature
  if (!feature || !FEATURE_REGISTRY[feature]) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown AI feature: ${feature}` }) };
  }

  const { model, requiresJson } = FEATURE_REGISTRY[feature];

  // Build structured prompt based on feature
  let finalPrompt = "";
  try {
    switch (feature) {
      case "tutor-chat": {
        const tutorPrompt = buildTutorPrompt(
          sanitizeInput(featureData.message),
          sanitizeInput(featureData.userName),
          featureData.grade ? sanitizeInput(featureData.grade) : undefined
        );
        // If image is attached, use multimodal path
        if (featureData.imageBase64 && featureData.imageMimeType) {
          const imgResult = await callGeminiMultimodal(
            model, tutorPrompt, featureData.imageBase64, featureData.imageMimeType
          );
          return { statusCode: 200, headers, body: JSON.stringify({ result: imgResult }) };
        }
        finalPrompt = tutorPrompt;
        break;
      }

      case "generate-activity":
        finalPrompt = buildActivityPrompt(
          sanitizeInput(featureData.topic),
          sanitizeInput(featureData.subject),
          sanitizeInput(featureData.grade),
          featureData.type || "objetiva",
          featureData.difficulty || "Médio",
          Math.min(featureData.count || 5, 30),
          featureData.className ? sanitizeInput(featureData.className) : undefined,
          featureData.activityTypeLabel ? sanitizeInput(featureData.activityTypeLabel) : undefined,
          featureData.seed ? Number(featureData.seed) : undefined
        );
        break;

      case "generate-trail":
        finalPrompt = buildTrailPrompt(
          sanitizeInput(featureData.topic),
          sanitizeInput(featureData.subject),
          sanitizeInput(featureData.grade),
          featureData.difficulty || "medium"
        );
        break;

      case "generate-trail-meta":
        finalPrompt = buildTrailMetaPrompt(
          sanitizeInput(featureData.topic),
          sanitizeInput(featureData.subject),
          sanitizeInput(featureData.grade)
        );
        break;

      case "generate-topics":
        // Generic pass-through: the caller provides a fully-built prompt.
        // Used by BulkAIGeneratorModal to get N unique curriculum topics.
        finalPrompt = sanitizeInput(rawPrompt || "");
        break;

      case "generate-trail-step":
        finalPrompt = buildTrailStepPrompt(
          sanitizeInput(featureData.topic),
          sanitizeInput(featureData.subject),
          sanitizeInput(featureData.grade),
          featureData.difficulty || "medium",
          featureData.phaseIndex || 0,
          sanitizeInput(featureData.phaseType || "theory"),
          sanitizeInput(featureData.phaseDescription || "")
        );
        break;

      case "generate-duel": {
        const duelTheme = sanitizeInput(featureData.theme);
        const duelDifficulty = featureData.difficulty || "medium";
        const duelCount = Math.min(featureData.count || 5, 12); // cap at 12: allows questionCount(10) + 1 reserve for Swap power
        const duelGrade = sanitizeInput(featureData.grade || "");
        const duelOpponentGrade = featureData.opponentGrade ? sanitizeInput(featureData.opponentGrade) : undefined;
        const duelSeed = featureData.seed ? parseInt(featureData.seed as string) : Date.now();
        const duelStudentAccuracy: number | undefined = typeof featureData.studentAccuracy === 'number'
          ? Math.max(0, Math.min(1, featureData.studentAccuracy))
          : undefined;
        // Anti-repetition: receive recent question texts from the client (max 10, sanitized)
        const duelRecentQuestions: string[] = Array.isArray(featureData.recentQuestions)
          ? (featureData.recentQuestions as string[]).slice(0, 10).map(q => String(q).slice(0, 150))
          : [];

        if (duelTheme === "quem_sou_eu") {
          finalPrompt = buildWhoAmIPrompt(duelDifficulty, duelCount, duelGrade, duelOpponentGrade);
        } else if (duelTheme === "logica") {
          finalPrompt = buildLogicPrompt(duelDifficulty, duelCount, duelGrade, duelOpponentGrade);
        } else {
          finalPrompt = buildDuelPrompt(duelTheme, duelDifficulty, duelCount, duelGrade, duelOpponentGrade, duelSeed, duelStudentAccuracy);
        }

        // Use compact, fast duel call (no large prompt builders — builds inline prompt)
        try {
          const duelRaw = await callGeminiDuel(duelTheme, duelDifficulty, duelCount, duelGrade, duelOpponentGrade, duelSeed, duelRecentQuestions, duelStudentAccuracy);

          console.log('[AI-Proxy] Raw duel response (first 300 chars):', duelRaw.slice(0, 300));

          // Balanced-brace walker: finds the FIRST complete JSON object, ignoring trailing text
          const start = duelRaw.indexOf('{');
          if (start === -1) throw new Error('No JSON object found in Gemini duel response');
          let depth = 0;
          let end = -1;
          let inString = false;
          let escaped = false;
          for (let i = start; i < duelRaw.length; i++) {
            const ch = duelRaw[i];
            if (escaped) { escaped = false; continue; }
            if (ch === '\\' && inString) { escaped = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end === -1) throw new Error('Unbalanced JSON braces in Gemini duel response');
          const parsed = JSON.parse(duelRaw.slice(start, end + 1));

          // Validate & sanitize questions: require 4 options, exactly 1 correct
          if (Array.isArray(parsed.questions)) {
            parsed.questions = parsed.questions
              .map((q: any) => {
                if (!Array.isArray(q.options)) q.options = [];
                while (q.options.length < 4) q.options.push({ id: String.fromCharCode(97 + q.options.length), text: '—', isCorrect: false });
                q.options = q.options.slice(0, 4);
                const nCorrect = q.options.filter((o: any) => o.isCorrect).length;
                if (nCorrect === 0) q.options[0].isCorrect = true;
                else if (nCorrect > 1) { let found = false; q.options = q.options.map((o: any) => { if (o.isCorrect && !found) { found = true; return o; } return { ...o, isCorrect: false }; }); }
                return q;
              })
              .filter((q: any) => q.questionText && q.options.filter((o: any) => o.isCorrect).length === 1);
          }

          return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result: parsed }) };
        } catch (duelErr: any) {
          console.error("[AI-Proxy] Duel generation failed:", duelErr.message);
          return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Falha ao gerar perguntas do duelo. Tente novamente." }) };
        }
      }

      case "parent-tips":
        finalPrompt = buildParentTipsPrompt(sanitizeInput(featureData.topic));
        break;

      case "parent-qa":
        finalPrompt = buildParentQAPrompt(sanitizeInput(featureData.question));
        break;

      case "admin-insights":
        finalPrompt = buildAdminInsightsPrompt(sanitizeInput(featureData.data));
        break;

      case "teacher-feedback":
        finalPrompt = buildTeacherFeedbackPrompt(
          sanitizeInput(featureData.studentName),
          sanitizeInput(featureData.subject),
          featureData.score,
          featureData.totalQuestions,
          (featureData.wrongAnswers || []).map(sanitizeInput)
        );
        break;

      case "guardian-summary":
        finalPrompt = buildGuardianSummaryPrompt(
          sanitizeInput(featureData.studentName),
          featureData.xp,
          featureData.level,
          featureData.streak,
          (featureData.recentActivities || []).map(sanitizeInput),
          featureData.missionsCompleted
        );
        break;

      default:
        // Generic fallback with sanitized prompt
        finalPrompt = sanitizeInput(rawPrompt || "");
    }
  } catch (err) {
    console.error("[AI-Proxy] Prompt building error:", err);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid feature data" }) };
  }

  if (!finalPrompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Empty prompt" }) };
  }

  // Log usage (without sensitive data)
  console.log(`[AI-Proxy] Feature: ${feature} | Model: ${MODELS[model]} | UserId: ${userId || "anon"} | Role: ${role || "unknown"}`);

  try {
    const result = await callGemini(model, finalPrompt, requiresJson, 2, feature);

    // For JSON features, validate the response is parseable
    if (requiresJson) {
      try {
        // Strip markdown code fences — Gemini sometimes wraps JSON in ```json ... ```
        const cleaned = result
          .replace(/^```[\w]*\s*/m, '')   // opening fence: ```json or ```
          .replace(/\s*```\s*$/m, '')     // closing fence
          .trim();
        const parsed = JSON.parse(cleaned);
        return { statusCode: 200, headers, body: JSON.stringify({ result: parsed, raw: cleaned }) };
      } catch (parseErr) {
        // Last resort: try to extract a JSON object/array directly from the text
        const jsonMatch = result.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            return { statusCode: 200, headers, body: JSON.stringify({ result: parsed, raw: jsonMatch[1] }) };
          } catch {}
        }
        console.error("[AI-Proxy] JSON parse error from Gemini:", result.slice(0, 400));
        return { statusCode: 502, headers, body: JSON.stringify({ error: "AI returned invalid JSON. Try again." }) };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ result }) };

  } catch (err: any) {
    console.error("[AI-Proxy] Gemini call failed:", err.message);
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: "AI service temporarily unavailable. Please try again in a moment." }),
    };
  }
};
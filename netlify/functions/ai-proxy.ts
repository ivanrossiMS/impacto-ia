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

// Allowed features and their model assignments
const FEATURE_REGISTRY: Record<string, { model: keyof typeof MODELS; requiresJson: boolean }> = {
  "tutor-chat":         { model: "flash", requiresJson: false },
  "generate-activity":  { model: "flash", requiresJson: true  },
  "generate-trail":     { model: "flash", requiresJson: true  },
  "generate-trail-step":{ model: "flash", requiresJson: true  },
  "generate-trail-meta":{ model: "flash", requiresJson: true  },
  "generate-duel":      { model: "flash", requiresJson: true  },
  "parent-tips":        { model: "flash", requiresJson: false },
  "parent-qa":          { model: "flash", requiresJson: false },
  "admin-insights":     { model: "pro",   requiresJson: true  },
  "teacher-feedback":   { model: "flash", requiresJson: true  },
  "teacher-lesson-plan":{ model: "pro",   requiresJson: true  },
  "guardian-summary":   { model: "flash", requiresJson: false },
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
 * Call the Gemini REST API.
 */
async function callGemini(
  modelKey: keyof typeof MODELS,
  prompt: string,
  requiresJson: boolean,
  retries = 2
): Promise<string> {
  const model = MODELS[modelKey];
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: requiresJson ? 16384 : 8192,
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
      const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

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

      if (!text) throw new Error("Empty response from Gemini");
      return text;

    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error("All Gemini retries failed");
}

// ============================================================
// PROMPT BUILDERS
// ============================================================

function buildTutorPrompt(
  userMessage: string,
  userName: string,
  grade?: string
): string {

  // Build grade-adaptive teaching profile using shared helper
  const gradeProfile = grade ? getGradeProfile(grade) : null;

  const teachingProfile = (() => {
    if (!gradeProfile) return {
      tone: 'Use linguagem clara, didática e direta. Adapte ao contexto da pergunta.',
      depth: 'Nível intermediário — explique com clareza sem ser superficial.',
      examples: 'Use exemplos práticos do cotidiano.',
      structure: 'Organize a resposta de forma clara e progressiva.',
      wordLimit: '350 palavras',
      restriction: '',
    };

    const g = (grade || '').toLowerCase();
    const isEM = g.includes('em') || g.includes('médio');
    const m = g.match(/(\d+)/);
    const year = m ? parseInt(m[1]) : 5;
    const actual = isEM ? year + 9 : year;

    if (actual <= 5) return {
      tone: 'Tom MUITO acolhedor, lúdico e encorajador — como um professor que adora crianças! Use frases curtas, simples e diretas. Emojis são bem-vindos com moderação 🎉.',
      depth: 'SUPERFICIAL e CONCRETO — foque em 1 ideia central por vez. Sem abstrações. Raciocínio concreto com objetos e situações reais.',
      examples: 'Exemplos OBRIGATÓRIOS do dia a dia da criança: animais, brinquedos, família, escola, alimentos. Nunca use exemplos adultos ou abstratos.',
      structure: 'Máximo 3 parágrafos curtos. Frases de no máximo 15 palavras. Linguagem de 6-11 anos.',
      wordLimit: '200 palavras',
      restriction: 'NUNCA use termos técnicos sem explicar com palavras simples. NUNCA dê mais de 1 conceito por vez.',
    };

    if (actual <= 9) return {
      tone: 'Tom amigável, motivador e próximo — como um "tutor mais velho" que gosta de ajudar. Pode usar linguagem um pouco mais elaborada, mas ainda acessível.',
      depth: 'INTERMEDIÁRIO — explique o conceito com clareza, introduza a terminologia correta, mostre o raciocínio passo a passo.',
      examples: 'Exemplos do cotidiano adolescente: esportes, tecnologia, redes sociais, música, situações escolares. Conecte com o que o aluno já conhece.',
      structure: 'Estruturado em partes claras. Pode usar listas e negrito para destacar pontos-chave. Linguagem para 11-15 anos.',
      wordLimit: '300 palavras',
      restriction: 'Introduza termos técnicos sempre com explicação. Evite terminologia universitária.',
    };

    return {
      tone: 'Tom intelectual, respeitoso e estimulante — como um professor que trata o aluno como capaz. Pode usar linguagem mais precisa e técnica.',
      depth: 'AVANÇADO — aprofunde o conceito, mostre conexões com outros temas, estimule o pensamento crítico e analítico.',
      examples: 'Exemplos contextualizados: situações-problema reais, conexões com ENEM/vestibular, aplicações científicas ou históricas relevantes.',
      structure: 'Pode ser mais rico em conteúdo. Use formatação Markdown completa. Linguagem para 15-18 anos.',
      wordLimit: '400 palavras',
      restriction: 'Estimule o raciocínio — não entregue apenas a resposta, mostre o caminho de chegada.',
    };
  })();

  const gradeContext = grade
    ? `Série do aluno: **${grade}** (${gradeProfile?.stage || ''})`
    : 'Série não informada — adapte ao nível da pergunta.';

  return `
Você é o **Capy**, o tutor educacional do sistema IA-IMPACTO — um professor inteligente, paciente e altamente adaptável.
Você está conversando com **${userName}**.
${gradeContext}

═══ PERFIL PEDAGÓGICO PARA ESTA SÉRIE ═══
Tom e linguagem: ${teachingProfile.tone}
Profundidade: ${teachingProfile.depth}
Tipos de exemplos: ${teachingProfile.examples}
Estrutura da resposta: ${teachingProfile.structure}
Restrições: ${teachingProfile.restriction}

═══ ESTRUTURA OBRIGATÓRIA DA RESPOSTA ═══
Organize SEMPRE sua resposta nestas partes:

**1️⃣ Explicação inicial simples**
Explique o conceito de forma clara e fácil. Uma ideia por vez.

**2️⃣ Aprofundamento progressivo**
Adicione um pouco mais de detalhe, mantendo compatível com a série.

**3️⃣ Exemplo prático**
Dê um exemplo concreto do cotidiano do aluno (adequado à faixa etária).

**4️⃣ Mini reforço** *(opcional, use quando ajudar)*
Uma pequena dica, pergunta reflexiva ou destaque para fixar o aprendizado.

═══ 🧮 REGRA ESPECIAL PARA MATEMÁTICA — NOTAÇÃO LaTeX (CRÍTICA) ═══
SE a pergunta envolver qualquer cálculo, equação, operação ou problema matemático, use OBRIGATORIAMENTE este padrão visual com NOTAÇÃO LaTeX:

O sistema RENDERIZA LaTeX automaticamente. Use:
- \`$expressão$\` para matemática INLINE (dentro de uma frase)
- \`$$expressão$$\` para matemática em BLOCO CENTRALIZADO (equações, frações, passos)

📐 FORMATO OBRIGATÓRIO — siga EXATAMENTE esta estrutura:

---

🧠 **Entendendo o problema**
[Explique em 1-2 frases simples. Use linguagem adequada para ${gradeProfile?.age || 'a faixa etária'}.]

---

✏️ **Montando a conta**
[Explique como montar. Depois escreva a expressão matemática em bloco LaTeX:]
$$[expressão montada]$$

---

🔍 **Resolvendo passo a passo**
[Uma linha de explicação, depois a equação LaTeX. Repita para cada etapa:]

etapa 1:
$$[operação]$$

etapa 2:
$$[operação → resultado parcial]$$

etapa 3 (se necessário):
$$[operação → resultado final]$$

${(() => {
  const g = (grade || '').toLowerCase();
  const isEM = g.includes('em') || g.includes('médio');
  const m = g.match(/(\d+)/);
  const year = m ? parseInt(m[1]) : 5;
  const actual = isEM ? year + 9 : year;
  if (actual <= 5)  return `[EF I → LaTeX simples: adições $3 + 4 = 7$, multiplicações $3 \\times 4 = 12$, grupos. Evite frações complexas.]`;
  if (actual <= 9) return `[EF II → Use frações LaTeX: $\\frac{3}{4}$, variáveis $x$, equações $3x = 15 \\Rightarrow x = 5$.]`;
  return `[EM → LaTeX completo: $\\frac{a}{b}$, potências $x^2$, raízes $\\sqrt{x}$, fórmulas como $\\Delta = b^2 - 4ac$, desenvolvimento algébrico completo.]`;
})()}

---

✅ **Resultado final**
$$[resultado em destaque]$$

O resultado é: **[resultado em palavras]**

---

💡 **Por que funciona?**
[1-2 frases explicando o raciocínio. Reforce o conceito matemático.]

---

📌 EXEMPLO DO PADRÃO ESPERADO (regra de 3):
🧠 **Entendendo o problema**
Queremos descobrir o valor de $x$ usando a regra de três.

✏️ **Montando a conta**
$$\frac{3}{45} = \frac{5}{x}$$

🔍 **Resolvendo passo a passo**
Multiplicação cruzada:
$$3 \cdot x = 5 \cdot 45$$

$$3x = 225$$

Isolando $x$:
$$x = \frac{225}{3}$$

✅ **Resultado final**
$$x = 75$$

O resultado é: **75**

💡 **Por que funciona?**
A regra de três mantém a proporção constante entre os valores, por isso podemos multiplicar cruzado para encontrar o valor desconhecido.

---

🚫 RESTRIÇÕES ABSOLUTAS PARA MATEMÁTICA:
- NUNCA escreva fração como "3/4" — SEMPRE use $$\\frac{3}{4}$$
- NUNCA coloque equação dentro de bloco de código — use LaTeX com $$ $$
- NUNCA pule etapas no desenvolvimento
- NUNCA resolva acima do nível de ${grade || 'a série do aluno'} (${gradeProfile?.age || ''})
- Use SEMPRE os separadores (---) e emojis (🧠 ✏️ 🔍 ✅ 💡)

═══ REGRAS ABSOLUTAS ═══
- Responda SEMPRE em português do Brasil
- Use Markdown — **negrito** para conceitos, listas para passos, \`código\` para fórmulas/equações
- Máximo ${teachingProfile.wordLimit} — seja didático e conciso, não exaustivo
- Explique sempre o "porquê", não apenas o "o quê"
- NUNCA forneça respostas prontas de provas — guie o raciocínio
- Se o aluno demonstrar dificuldade: simplifique mais, quebre em passos menores
- Se o aluno demonstrar facilidade: aprofunde levemente, proponha reflexão
- Finalize com uma linha: **✅ Resumo:** [resposta direta em 1 frase]

**Pergunta do aluno:** "${userMessage}"
`.trim();
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
  seed?: number
): string {
  // ── Cognitive level by grade ──────────────────────────────────────────────
  const gradeInfo = (() => {
    const g = (grade || '').toLowerCase();
    const isEM = g.includes('em') || g.includes('médio') || g.includes('medio');
    const year = parseInt((g.match(/\d+/) || ['0'])[0]);
    if (isEM) return {
      stage: `${year || ''}º Ano do Ensino Médio`,
      ageRange: '15–17 anos',
      cognitiveLevel: 'alta complexidade — análise, síntese, avaliação crítica (Bloom 4-6)',
      languageLevel: 'linguagem formal, vocabulário técnico-científico, enunciados elaborados',
      abstractionLevel: 'alta abstração, contextualização social/científica/filosófica',
    };
    if (year >= 6) return {
      stage: `${year}º Ano do Ensino Fundamental II`,
      ageRange: '11–15 anos',
      cognitiveLevel: 'média complexidade — compreensão, aplicação e análise (Bloom 2-4)',
      languageLevel: 'linguagem clara e objetiva, vocabulário em expansão, enunciados intermediários',
      abstractionLevel: 'abstração moderada, aplicação contextualizada',
    };
    if (year >= 1) return {
      stage: `${year}º Ano do Ensino Fundamental I`,
      ageRange: '6–11 anos',
      cognitiveLevel: 'baixa-média complexidade — reconhecimento, memorização e compreensão (Bloom 1-2)',
      languageLevel: 'linguagem simples e direta, vocabulário acessível, frases curtas e claras',
      abstractionLevel: 'baixa abstração, exemplos concretos do cotidiano',
    };
    return {
      stage: grade,
      ageRange: 'a definir pela série',
      cognitiveLevel: 'intermediário',
      languageLevel: 'adequada à série',
      abstractionLevel: 'moderada',
    };
  })();

  // ── Activity-type-specific instructions ───────────────────────────────────
  const typeInstructions: Record<string, string> = {
    objetiva: `
TIPO: OBJETIVA (Múltipla Escolha)
- Cada questão deve ter exatamente 4 alternativas (A, B, C, D)
- A alternativa A é SEMPRE a correta (o sistema embaralha depois)
- Os distratores (B, C, D) devem ser plausíveis, pedagogicamente relacionados ao tema, mas inequivocamente incorretos
- Evite alternativas obviamente erradas, absurdas ou fora do contexto
- Enunciados claros, objetivos e bem formulados
- Questões que testem compreensão real, não apenas memorização mecânica`,

    quiz_divertido: `
TIPO: QUIZ DIVERTIDO (Gamificado)
- Linguagem mais leve, dinâmica e envolvente, mantendo rigor pedagógico real
- Use emojis estrategicamente no enunciado (1-2 por questão, não excessivo)
- Questões com 4 alternativas — A SEMPRE correta
- Inclua perguntas que estimulem curiosidade e "efeito surpresa" pedagógico
- Pode usar situações do cotidiano, cultura pop educativa, analogias criativas
- Mantenha 100% do conteúdo alinhado à disciplina, série e tópico
- Evite trivialidade — o quiz deve ter valor pedagógico REAL`,

    dissertativa: `
TIPO: DISSERTATIVA (Resposta Aberta)
- Enunciados claros que estimulem reflexão, argumentação e produção textual própria
- Cada questão deve ter um gabarito/resposta esperada detalhado (campo "answer")
- O gabarito deve indicar pontos essenciais que o aluno precisa contemplar
- Inclua critérios de avaliação no campo "explanation"
- Questões progressivas: das mais interpretativas às mais analíticas
- Adeque a extensão esperada da resposta ao nível da série
- NÃO use alternativas — tipo é "dissertativa"`,

    simulado: `
TIPO: SIMULADO (Estilo ENEM/Avaliação)
- Questões no estilo avaliativo formal, com contexto introdutório (texto-base, gráfico descrito, situação-problema)
- Cada questão deve ter 4 alternativas — A SEMPRE correta
- Distribua os níveis internos: ~30% fácil, ~50% médio, ~20% difícil dentro do conjunto
- Use dados, situações reais e contextos interdisciplinares quando pertinente
- Enunciados mais elaborados, que exijam leitura e interpretação
- Formato: presente texto/contexto introdutório antes do enunciado da questão`,

    prova_mensal: `
TIPO: PROVA MENSAL (Avaliação Formal Mensal)
- Estrutura formal e organizada de prova escolar
- Distribua as questões coerentemente: início mais acessível, progressão até as mais elaboradas
- Questões com 4 alternativas — A SEMPRE correta
- Abrange o conteúdo do mês de forma abrangente e equilibrada
- Linguagem formal e clara, típica de instrumento avaliativo
- Equilíbrio entre reconhecimento, compreensão, aplicação e análise`,

    prova_bimestral: `
TIPO: PROVA BIMESTRAL (Avaliação Bimestral Completa)
- Avaliação de maior profundidade e abrangência bimestral
- Questões com 4 alternativas — A SEMPRE correta
- Cobertura ampla e equilibrada do conteúdo bimestral dentro do tópico
- Progressão clara: questões contextualizadoras → aplicação → análise
- Linguagem formal, rigorosa e adequada ao nível da série
- Inclua questões que integrem diferentes aspectos do tópico`
  };

  // ── Difficulty calibration ────────────────────────────────────────────────
  const difficultyInstructions: Record<string, string> = {
    'Fácil': `
CALIBRAÇÃO — NÍVEL FÁCIL:
- Foco em reconhecimento e compreensão básica dos conceitos
- Questões de aplicação direta, sem rodeios
- Vocabulário mais acessível, enunciados curtos e objetivos
- Contextos simples, sem informações extras que desorientem
- Distratores claramente diferenciáveis da resposta correta
- Adequado para fixação inicial e verificação de compreensão básica`,

    'Médio': `
CALIBRAÇÃO — NÍVEL MÉDIO:
- Exige interpretação moderada e compreensão aplicada
- Questões que combinam compreensão e raciocínio
- Vocabulário em expansão compatível com a série
- Enunciados com contexto, mas claros e bem delimitados
- Distratores mais elaborados e pedagogicamente plausíveis
- Adequado para consolidação do aprendizado`,

    'Difícil': `
CALIBRAÇÃO — NÍVEL DIFÍCIL:
- Exige análise crítica, síntese e raciocínio avançado
- Aplicação contextualizada, com situações-problema complexas
- Pode exigir resolução em múltiplas etapas (para dissertativas)
- Vocabulário completo e técnico compatível com a série
- Distratores muito plausíveis — exigem conhecimento real para diferenciar
- Questões que vão além da memorização — exigem pensamento crítico real`
  };

  const typeKey = type in typeInstructions ? type : 'objetiva';
  const diffKey = difficulty in difficultyInstructions ? difficulty : 'Médio';
  const typeInstruction = typeInstructions[typeKey];
  const diffInstruction = difficultyInstructions[diffKey];
  const isObjetiva = !['dissertativa'].includes(typeKey);

  return `
Você é uma equipe pedagógica especialista, composta por professores com profundo conhecimento da BNCC (Base Nacional Comum Curricular) e design instrucional para o ensino brasileiro. Sua missão é criar atividades de alta qualidade educacional real.

═══════════════════════════════════════════════
PARÂMETROS DA ATIVIDADE (SEGUIR COM RIGOR ABSOLUTO)
═══════════════════════════════════════════════
• Disciplina: ${subject}
• Tópico Específico: ${topic}
• Série/Ano: ${grade} — ${gradeInfo.stage}
• Turma Destinatária: ${className || grade}
• Tipo de Atividade: ${activityTypeLabel || type}
• Faixa Etária: ${gradeInfo.ageRange}
• Quantidade de questões: ${count}
• Nível Cognitivo: ${gradeInfo.cognitiveLevel}
• Linguagem esperada: ${gradeInfo.languageLevel}
• Nível de Abstração: ${gradeInfo.abstractionLevel}
• Chave de Frescor (anti-repetição): #${seed || Date.now()}

═══════════════════════════════════════════════
TIPO DE ATIVIDADE
═══════════════════════════════════════════════
${typeInstruction}

═══════════════════════════════════════════════
CALIBRAÇÃO DE DIFICULDADE
═══════════════════════════════════════════════
${diffInstruction}

═══════════════════════════════════════════════
REGRAS PEDAGÓGICAS ABSOLUTAS
═══════════════════════════════════════════════
1. COERÊNCIA TOTAL: Toda questão deve ser 100% sobre "${topic}" da disciplina "${subject}"
2. ADEQUAÇÃO ETÁRIA: Use linguagem e complexidade compatíveis com ${gradeInfo.ageRange} — turma "${className || grade}"
3. PROGRESSÃO LÓGICA: As ${count} questões devem ter progressão pedagógica (simples → elaboradas)
4. RIGOR CONCEITUAL: Zero erros de conteúdo. Valide internamente antes de responder.
5. ENUNCIADOS CONCISOS: Cada enunciado deve ter entre 15 e ${gradeInfo.ageRange.startsWith('6') ? '60' : '80'} palavras — claro, objetivo, sem excessos. NUNCA escreva enunciados longos e confusos.
6. NÃO GENERICIDADE: Cada questão deve ser específica ao tópico "${topic}" — sem questões genéricas ou que poderiam servir para qualquer turma
7. ORIGINALIDADE E UNICIDADE: As ${count} questões devem ser COMPLETAMENTE DIFERENTES entre si — enunciados distintos, contextos distintos, aspectos distintos do tópico. NUNCA repita padrão de questão, contexto ou estrutura de enunciado.
8. FOCO: Toda a atividade deve girar em torno do tópico "${topic}" — sem desvios temáticos
9. LINGUAGEM DA TURMA: A linguagem deve ser natural e compreensível para alunos de ${gradeInfo.ageRange}. Evite termos técnicos desnecessários, frases muito longas ou vocabulário além do esperado para a série.

ZERO TOLERÂNCIA PARA:
❌ Questões repetidas ou com enunciados muito semelhantes entre si
❌ Enunciados longos, confusos ou com vocabulário inadequado
❌ Conteúdo fora da disciplina
❌ Atividade inadequada para a série
❌ Dificuldade incompatível com o nível selecionado
❌ Enunciados confusos ou mal formulados
❌ Erros conceituais de qualquer natureza
❌ Questões desconexas entre si
❌ Progressão pedagógica sem lógica
❌ Linguagem inadequada para a faixa etária

═══════════════════════════════════════════════
FORMATO DE RESPOSTA (JSON OBRIGATÓRIO)
═══════════════════════════════════════════════
Responda SOMENTE com JSON válido, sem texto antes ou depois:

${isObjetiva ? `{
  "questions": [
    {
      "id": "uuid-placeholder",
      "type": "objetiva",
      "text": "Enunciado completo e pedagogicamente rigoroso da questão",
      "options": [
        "Alternativa CORRETA (sempre na posição 0)",
        "Distrator plausível mas incorreto 1",
        "Distrator plausível mas incorreto 2",
        "Distrator plausível mas incorreto 3"
      ],
      "answer": "0",
      "explanation": "Explicação clara e pedagógica da resposta correta para o professor"
    }
  ]
}` : `{
  "questions": [
    {
      "id": "uuid-placeholder",
      "type": "dissertativa",
      "text": "Enunciado claro que estimule reflexão e produção própria do aluno",
      "answer": "Gabarito detalhado: pontos essenciais que o aluno deve contemplar na resposta",
      "explanation": "Critérios de avaliação: o que observar na resposta do aluno"
    }
  ]
}`}

LEMBRE-SE: A "Chave de Frescor" #${seed || Date.now()} garante que esta geração seja única e diferente de qualquer outra anterior. Gere ${count} questões completamente distintas entre si, coerentes com a turma "${className || grade}", focadas em "${topic}" (${subject}), com enunciados concisos (15-${gradeInfo.ageRange.startsWith('6') ? '60' : '80'} palavras), linguagem acessível para ${gradeInfo.ageRange} e dificuldade real no nível ${difficulty}.
`.trim();
}


function buildTrailPrompt(topic: string, subject: string, grade: string, difficulty: string): string {
  // Map grade to BNCC cognitive level
  const gradeInfo = (() => {
    const g = (grade || '').toLowerCase();
    const isEM = g.includes('em') || g.includes('médio');
    const year = parseInt((g.match(/\d+/) || ['0'])[0]);
    if (isEM) return { stage: `${year}º Ano do Ensino Médio`, level: 'alta complexidade — análise, síntese, avaliação (Bloom 3-5)', age: '15-17 anos' };
    if (year >= 6) return { stage: `${year}º Ano do EF II`, level: 'média complexidade — compreensão e aplicação (Bloom 2-3)', age: '11-15 anos' };
    return { stage: `${year}º Ano do EF I`, level: 'baixa complexidade — reconhecimento e compreensão (Bloom 1-2)', age: '6-11 anos' };
  })();

  return `
Você é um pedagogo especialista na BNCC (Base Nacional Comum Curricular) e em design instrucional gamificado para o ensino brasileiro.

Sua missão é criar uma TRILHA DE APRENDIZAGEM COMPLETA com CONTEÚDO EDUCACIONAL REAL para:
- Disciplina: ${subject}
- Tema Central: ${topic}
- Série/Grau: ${grade} (${gradeInfo.stage})
- Nível cognitivo esperado: ${gradeInfo.level}
- Faixa etária: ${gradeInfo.age}
- Dificuldade: ${difficulty}

A trilha deve ter 5 FASES PROGRESSIVAS. Cada fase contém:

1. **content** — Resumo curto de 2-3 frases para mostrar na tela de introdução da fase (o que o aluno vai estudar).
2. **theory** — Conteúdo pedagógico RICO e DETALHADO para o painel do Tutor IA, usando Markdown. Este campo deve ser COMPLETAMENTE DIFERENTE do "content" — mais aprofundado, estruturado e didático. Inclua obrigatoriamente:
   - Um título da seção (##)
   - Um parágrafo explicativo principal (4-6 frases) aprofundando o tema
   - Uma lista de **Conceitos-chave** (•) com pelo menos 3 itens explicados brevemente
   - Um exemplo prático ou analogia do cotidiano (rotule como **Exemplo Prático:**)
   - Uma curiosidade ou dado surpreendente (rotule como **💡 Sabia que...**)
3. **questions** — Exatamente 3 questões objetivas com 4 alternativas cada (alternativa "a" sempre correta)

Progressão pedagógica das 5 fases:
- Fase 1 (intro): Contextualização e conceitos iniciais
- Fase 2 (theory): Aprofundamento teórico dos conceitos centrais
- Fase 3 (practice): Aplicação prática e exemplos do cotidiano
- Fase 4 (quiz): Revisão consolidando múltiplos conceitos
- Fase 5 (boss): Desafio final com questões elaboradas e interdisciplinares

REGRAS ABSOLUTAS:
- Todo conteúdo deve ser 100% correto pedagogicamente
- Questões adequadas à faixa etária
- A alternativa "a" de cada questão é SEMPRE a correta
- Os distraidores (b, c, d) devem ser plausíveis mas inequivocamente errados
- O campo "theory" DEVE ser Markdown válido e diferente do "content"

Responda SOMENTE com JSON válido neste formato exato (sem texto antes ou depois):
{
  "title": "Título criativo da trilha (máx 60 caracteres)",
  "description": "Objetivo pedagógico em 2-3 frases — o que o aluno vai dominar ao concluir",
  "rewardXp": 600,
  "rewardCoins": 250,
  "steps": [
    {
      "id": "1",
      "title": "Nome da Fase (curto e motivador)",
      "type": "intro",
      "content": "Resumo breve de 2-3 frases para a tela de introdução desta fase.",
      "theory": "## Título do Conteúdo\\n\\nParágrafo explicativo principal com 4-6 frases aprofundando o tema desta fase de forma clara e adequada à série.\\n\\n**Conceitos-chave:**\\n- **Conceito 1:** Explicação breve e clara\\n- **Conceito 2:** Explicação breve e clara\\n- **Conceito 3:** Explicação breve e clara\\n\\n**Exemplo Prático:** Descrição de um exemplo concreto do cotidiano ou analogia que facilita o entendimento.\\n\\n**💡 Sabia que...** Curiosidade relevante e surpreendente sobre o tema desta fase.",
      "questions": [
        {
          "id": "q1",
          "text": "Pergunta objetiva clara e sem ambiguidade?",
          "options": [
            { "id": "a", "text": "Resposta correta — completa e inequívoca", "isCorrect": true },
            { "id": "b", "text": "Distrator plausível mas errado", "isCorrect": false },
            { "id": "c", "text": "Segundo distrator plausível mas errado", "isCorrect": false },
            { "id": "d", "text": "Terceiro distrator plausível mas errado", "isCorrect": false }
          ],
          "explanation": "Explicação didática da resposta correta em 1-2 frases."
        }
      ]
    }
  ]
}
`.trim();
}

// ============================================================
// SHARED HELPERS: Grade + Difficulty Profiles (BNCC-aligned)
// Used by trail meta, trail step, and duel prompts.
// ============================================================

function getGradeProfile(grade: string): { stage: string; age: string; level: string; language: string } {
  const g = (grade || '').toLowerCase();
  const isEM = g.includes('em') || g.includes('médio');
  const yearMatch = g.match(/(\d+)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 0;

  if (isEM) return {
    stage: `${year}º Ano do Ensino Médio`,
    age: '15-18 anos',
    level: 'Alta complexidade — síntese, análise crítica, avaliação (Bloom 4-5). ENEM/vestibular.',
    language: 'Linguagem precisa, terminologia científica/literária/histórica adequada. Use contextos desafiadores e situações-problema reais.',
  };
  if (year >= 6) return {
    stage: `${year}º Ano do Ensino Fundamental II`,
    age: '11-15 anos',
    level: 'Complexidade intermediária — compreensão, aplicação e análise (Bloom 2-4). Pensamento abstrato emergente.',
    language: 'Linguagem intermediária, vocabulário técnico básico, exemplos do cotidiano do adolescente. Evite terminologia universitária.',
  };
  return {
    stage: `${year}º Ano do Ensino Fundamental I`,
    age: '6-11 anos',
    level: 'Baixa complexidade — reconhecimento, compreensão e aplicação básica (Bloom 1-3). Pensamento concreto.',
    language: 'Linguagem muito simples, frases curtas, vocabulário do cotidiano da criança. Use analogias familiares. Sem abstrações.',
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
  phaseIndex: number, phaseType: string, phaseDescription: string
): string {
  const gradeProfile = getGradeProfile(grade);
  const difficultyProfile = getDifficultyProfile(difficulty, gradeProfile.stage);

  const phaseDescriptions: Record<string, { focus: string; cognitive: string; pedagogical: string }> = {
    intro: {
      focus: 'Contextualização e ativação do conhecimento prévio',
      cognitive: 'Bloom Nível 1 (Recordar) + Nível 2 (Compreender). Acolha o aluno, desperte curiosidade, conecte ao cotidiano.',
      pedagogical: 'Apresente o tema de forma atraente. Explique POR QUÊ esse conteúdo é importante. Faça perguntas que ativem o que o aluno já sabe. Questões devem avaliar conhecimentos prévios e contextualização.'
    },
    theory: {
      focus: 'Aprofundamento teórico dos conceitos centrais',
      cognitive: 'Bloom Nível 2 (Compreender) + Nível 3 (Aplicar). Explique com clareza, estrutura e exemplos concretos.',
      pedagogical: 'Defina e explique os conceitos fundamentais com rigor. Use exemplos práticos do cotidiano do aluno. Construa o conhecimento de forma progressiva. Questões devem verificar compreensão conceitual.'
    },
    practice: {
      focus: 'Aplicação prática e resolução de problemas reais',
      cognitive: 'Bloom Nível 3 (Aplicar) + Nível 4 (Analisar). Mova o conhecimento para situações concretas e práticas.',
      pedagogical: 'Proponha situações-problema que exijam aplicação do que foi aprendido. Mostre como o conteúdo se manifesta na vida real. Questões devem envolver cálculo, interpretação ou análise de casos.'
    },
    quiz: {
      focus: 'Revisão integrada e consolidação dos conceitos',
      cognitive: 'Bloom Nível 3 (Aplicar) + Nível 4 (Analisar). Conecte e consolide todos os conceitos da trilha.',
      pedagogical: 'Revise os principais pontos das fases anteriores de forma integrada. Identifique possíveis dúvidas e reforce pontos críticos. Questões devem conectar múltiplos conceitos aprendidos.'
    },
    boss: {
      focus: 'Desafio final com questões de alta ordem cognitiva',
      cognitive: 'Bloom Nível 4 (Analisar) + Nível 5 (Avaliar). Exija síntese, julgamento crítico e raciocínio avançado.',
      pedagogical: 'Proponha questões que exijam análise profunda, síntese de conceitos e julgamento crítico. Use contextos novos e interdisciplinares. Questões devem ser desafiantes mas justas dentro do nível da série.'
    },
  };

  const phase = phaseDescriptions[phaseType] || phaseDescriptions.theory;

  return `
Você é um pedagogo sênior especialista na BNCC (Base Nacional Comum Curricular) e em design instrucional para educação brasileira gamificada.

═══ CONTEXTO DA FASE ═══
Disciplina: ${subject}
Tema Central: ${topic}
Série/Grau: ${grade} (${gradeProfile.stage})
Faixa etária: ${gradeProfile.age}
Nível cognitivo BNCC: ${gradeProfile.level}
Linguagem adequada: ${gradeProfile.language}
Dificuldade: ${difficultyProfile.label} — ${difficultyProfile.bloom}
═══ FASE ${phaseIndex + 1} DE 5: ${phaseType.toUpperCase()} ═══
Foco: ${phase.focus}
Exigência cognitiva: ${phase.cognitive}
Critério pedagógico: ${phase.pedagogical}

═══ REGRAS ABSOLUTAS DE CONTEÚTO ═══
1. Todo conteúdo deve ser 100% correto, rigoroso e alinhado ao currículo BNCC para ${grade}
2. A linguagem e complexidade devem ser ESTRITAMENTE adequadas à faixa etária (${gradeProfile.age})
3. A progressão deve respeitar a posição desta fase na trilha (Fase ${phaseIndex + 1}/5)
4. Conecte teoria, prática e revisão de forma coerente com o tema "${topic}"
5. Não use terminologia acima do nível da série ${grade}
6. ${difficultyProfile.instructions}
7. Identifique e aborde possíveis dificuldades de aprendizagem comuns neste tópico

═══ ESTRUTURA DA FASE ═══

**CAMPO "content"** (tela de introdução — 2-3 frases):
- Apresente de forma envolvente O QUE o aluno vai aprender nesta fase
- Use linguagem motivadora e adequada à faixa etária (${gradeProfile.age})
- Desperte curiosidade e articule claramente o objetivo didático

**CAMPO "theory"** (painel do Tutor IA — conteúdo Markdown RICO, DIFERENTE do content):
Este é o campo mais importante. Inclua OBRIGATORIAMENTE:
- ## Título claro e motivador da seção
- Parágrafo expositivo principal (4-6 frases), aprofundado, correto e adequado ao nível ${grade}
- **Conceitos-chave:** (mínimo 3 itens, cada um com explicação clara de 1-2 frases)
- **Exemplo Prático:** analogia ou situação real do cotidiano do aluno (${gradeProfile.age})
- **💡 Sabia que...** curiosidade relevante e surpreendente sobre o tema
- **⚠️ Atenção:** aponte a dificuldade mais comum dos alunos neste tópico e como superá-la

**CAMPO "questions"** (exatamente 3 questões objetivas):
- Questões devem respeitar rigorosamente: ${difficultyProfile.instructions}
- A alternativa "a" (isCorrect: true) é SEMPRE a correta — o sistema embaralha as opções automaticamente
- Os 3 distraidores (b, c, d) devem ser plausíveis para o nível mas inequivocamente errados
- Explicação (explanation) deve ser didática e ensinar algo ao aprender a resposta
- Questões devem cobrir o conteúdo desta fase específica, não de outras

Responda SOMENTE com JSON válido (sem texto antes ou depois):
{
  "id": "${phaseIndex + 1}",
  "title": "Nome motivador da fase (máx 45 caracteres)",
  "type": "${phaseType}",
  "content": "Introdução clara e motivadora de 2-3 frases adequada a ${gradeProfile.age}.",
  "theory": "## Título\\n\\nParágrafo principal rico e correto (4-6 frases)...\\n\\n**Conceitos-chave:**\\n- **Conceito 1:** Explicação clara\\n- **Conceito 2:** Explicação clara\\n- **Conceito 3:** Explicação clara\\n\\n**Exemplo Prático:** Situação real do cotidiano...\\n\\n**💡 Sabia que...** Curiosidade relevante...\\n\\n**⚠️ Atenção:** Dificuldade comum e como superar...",
  "questions": [
    {"id":"q1","text":"Pergunta clara e adequada ao nível ${grade}?","options":[{"id":"a","text":"Resposta correta completa","isCorrect":true},{"id":"b","text":"Distrator plausível","isCorrect":false},{"id":"c","text":"Distrator plausível","isCorrect":false},{"id":"d","text":"Distrator plausível","isCorrect":false}],"explanation":"Explicação didática da resposta."},
    {"id":"q2","text":"Segunda pergunta?","options":[{"id":"a","text":"Correta","isCorrect":true},{"id":"b","text":"Errada","isCorrect":false},{"id":"c","text":"Errada","isCorrect":false},{"id":"d","text":"Errada","isCorrect":false}],"explanation":"Explicação."},
    {"id":"q3","text":"Terceira pergunta?","options":[{"id":"a","text":"Correta","isCorrect":true},{"id":"b","text":"Errada","isCorrect":false},{"id":"c","text":"Errada","isCorrect":false},{"id":"d","text":"Errada","isCorrect":false}],"explanation":"Explicação."}
  ]
}
`.trim();
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

function buildDuelPrompt(theme: string, difficulty: string, count: number, grade: string, opponentGrade?: string): string {

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
    aleatorio:      'Distribua as perguntas equilibradamente: 2 de ciências/história, 1 de geografia, 1 de esportes/arte, 1 de conhecimentos gerais. Evite concentrar em uma única área.',
  };
  const themeContext = themeGuide[theme.toLowerCase()] || themeGuide.aleatorio;

  // ─── Difficulty calibration ───
  const diffDetailMap: Record<string, string> = {
    easy:   `NÍVEL FÁCIL: Pergunta direta, resposta memorização/reconhecimento. Enunciado com 1 único conceito. Distraidores claramente errados. Vocabulário bem simples. BLOOM: Lembrar/Reconhecer.`,
    medium: `NÍVEL MÉDIO: Exige interpretação simples e aplicação. Contexto breve no enunciado. Distraidores parcialmente plausíveis. Entendimento genuíno, não só memorização. BLOOM: Compreender/Aplicar.`,
    hard:   `NÍVEL DIFÍCIL: Exige raciocínio lógico e aplicação em contexto. Situação-problema ou análise. TODOS os distraidores tecnicamente plausíveis mas inequivocamente errados. BLOOM: Analisar/Avaliar.`,
  };
  const diffDetail = diffDetailMap[difficulty] || diffDetailMap.medium;

  // ─── Progressive complexity plan ───
  const half = Math.ceil(count / 2);
  const progressionPlan = count <= 3
    ? 'Todas as perguntas no mesmo nível de dificuldade.'
    : `Progressão obrigatória:
  - Perguntas 1–${half}: um pouco mais simples dentro do nível "${difficulty}" (aquecimento)
  - Perguntas ${half + 1}–${count}: dificuldade plena do nível "${difficulty}" (pico pedagógico)
  NÃO use dificuldades fora do nível "${difficulty}". Apenas calibre a complexidade do contexto.`;

  return `
Você é um(a) professor(a) especialista no currículo brasileiro BNCC com 20 anos de experiência em avaliações educacionais gamificadas e rigor pedagógico absoluto.

Sua missão: Criar ${count} perguntas de Duelo Educacional IMPECÁVEIS — curtas, claras, pedagógicas e 100% coerentes com a série e o tema definidos.

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

═══ REGRAS ABSOLUTAS — LEIA COM ATENÇÃO ═══
1. ENUNCIADO CURTO: máximo 2 linhas. Direto ao ponto. Sem introduções desnecessárias.
2. SEM ERROS: zero erros conceituais, gramaticais ou de conteúdo.
3. TEMA EXCLUSIVO: cada pergunta deve ser 100% dentro do tema "${theme}". Zero desvios.
4. SÉRIE RESPEITADA: NUNCA gere conteúdo acima do nível de ${referenceGrade}.
5. SEM REPETIÇÃO: nenhum conceito repetido entre as ${count} perguntas.
6. DISTRAIDORES COERENTES: 3 alternativas erradas mas plausíveis para o nível — sem respostas absurdas e sem pegar em palavras.
7. EXPLICAÇÃO DIDÁTICA: 1-2 frases, ensina algo real, linguagem adequada para ${gradeProfile.age}.
8. ANTES DE FINALIZAR cada pergunta, valide internamente:
   ✓ O enunciado está claro e curto?
   ✓ O conteúdo é compatível com ${referenceGrade}?
   ✓ Os distraidores são plausíveis mas claramente errados?
   ✓ A explicação ensina algo?
   ✓ Esta pergunta é diferente das anteriores?

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
      case "tutor-chat":
        finalPrompt = buildTutorPrompt(
          sanitizeInput(featureData.message),
          sanitizeInput(featureData.userName),
          featureData.grade ? sanitizeInput(featureData.grade) : undefined
        );
        break;

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
        const duelCount = Math.min(featureData.count || 5, 10);
        const duelGrade = sanitizeInput(featureData.grade || "");
        const duelOpponentGrade = featureData.opponentGrade ? sanitizeInput(featureData.opponentGrade) : undefined;

        if (duelTheme === "quem_sou_eu") {
          finalPrompt = buildWhoAmIPrompt(duelDifficulty, duelCount, duelGrade, duelOpponentGrade);
        } else if (duelTheme === "logica") {
          finalPrompt = buildLogicPrompt(duelDifficulty, duelCount, duelGrade, duelOpponentGrade);
        } else {
          finalPrompt = buildDuelPrompt(duelTheme, duelDifficulty, duelCount, duelGrade, duelOpponentGrade);
        }
        break;
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
    const result = await callGemini(model, finalPrompt, requiresJson);

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

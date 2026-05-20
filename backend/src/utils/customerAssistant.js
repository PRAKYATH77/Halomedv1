import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_PATH = path.join(__dirname, '..', 'data', 'customer-assistant-kb.json');
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'ask', 'be', 'can', 'did', 'do', 'does', 'for', 'from', 'get', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'should', 'tell', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'you', 'your'
]);

let cachedKnowledgeBase = null;

const tokenize = (text) => {
  if (!text) return [];

  return String(text)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) || [];
};

const unique = (items) => [...new Set(items)];

const buildChunkText = (chunk) => [chunk.title, chunk.answer, chunk.source, ...(chunk.tags || [])].filter(Boolean).join(' ');

const loadKnowledgeBase = async () => {
  if (cachedKnowledgeBase) {
    return cachedKnowledgeBase;
  }

  const raw = await fs.readFile(KB_PATH, 'utf8');
  cachedKnowledgeBase = JSON.parse(raw);
  return cachedKnowledgeBase;
};

const scoreChunk = (queryTokens, chunk) => {
  const chunkTokens = unique(tokenize(buildChunkText(chunk)));
  const chunkTokenSet = new Set(chunkTokens);
  const querySet = new Set(queryTokens);

  const matchedTokens = queryTokens.filter((token) => chunkTokenSet.has(token));
  const overlap = queryTokens.length === 0 ? 0 : matchedTokens.length / querySet.size;

  const titleTokens = tokenize(chunk.title);
  const titleMatches = titleTokens.filter((token) => querySet.has(token)).length;
  const titleBonus = titleTokens.length === 0 ? 0 : titleMatches / titleTokens.length;

  const tagMatches = (chunk.tags || []).filter((tag) => querySet.has(tag.toLowerCase())).length;
  const tagBonus = (chunk.tags || []).length === 0 ? 0 : tagMatches / chunk.tags.length;

  const directPhraseBoost = chunk.title && queryTokens.some((token) => chunk.title.toLowerCase().includes(token)) ? 0.08 : 0;

  const score = Math.min(1, overlap * 0.65 + titleBonus * 0.2 + tagBonus * 0.1 + directPhraseBoost);

  return {
    score,
    matchedTokens: unique(matchedTokens),
  };
};

const confidenceLabel = (score) => {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 30) return 'low';
  return 'very low';
};

const buildFallbackAnswer = (message) => ({
  answer: `I could not find a clear answer for: "${message}". Try asking about medicines, cart, checkout, orders, prescriptions, delivery tracking, or your account.`,
  groundednessScore: 18,
  groundednessLabel: 'very low',
  responseMode: 'app_help',
  sources: [],
  matchedTopics: [],
});

const looksLikeMedicalQuestion = (queryTokens, message) => {
  const medicalTokens = new Set([
    'symptom', 'symptoms', 'fever', 'pain', 'cold', 'cough', 'headache', 'stomach', 'digestion', 'acidity', 'infection', 'antibiotic', 'antibiotics', 'dose', 'dosage', 'duration', 'days', 'medication', 'medicine'
  ]);

  if (queryTokens.some((token) => medicalTokens.has(token))) {
    return true;
  }

  const lowerMessage = String(message || '').toLowerCase();

  // treat urgent symptom phrases as medical questions
  if (lowerMessage.includes('chest pain') || lowerMessage.includes('shortness of breath') || lowerMessage.includes('breathless')) {
    return true;
  }

  return ['how long', 'for how long', 'can it cure', 'will it cure', 'what medicine', 'medicine for'].some((phrase) => lowerMessage.includes(phrase));
};

const getMedicalMatch = (message, knowledgeBase) => {
  const lowerMessage = String(message || '').toLowerCase();

  const medicalPriority = [
    { ids: ['headache-guidance'], keywords: ['headache', 'migraine', 'head pain'] },
    { ids: ['runny-nose-guidance'], keywords: ['runny', 'runny nose', 'rhinorrhea'] },
    { ids: ['sore-throat-guidance'], keywords: ['sore throat', 'throat', 'pharyngitis'] },
    { ids: ['cough-guidance'], keywords: ['cough', 'productive cough', 'dry cough'] },
    { ids: ['congestion-guidance'], keywords: ['congestion', 'blocked nose', 'stuffy', 'nasal'] },
    { ids: ['allergy-guidance'], keywords: ['allergy', 'hay fever', 'sneezing', 'itchy'] },
    { ids: ['fever-pain-guidance'], keywords: ['fever', 'temperature', 'bodyache', 'pain'] },
    { ids: ['digestion-guidance'], keywords: ['digestion', 'stomach', 'acidity', 'gas', 'nausea', 'indigestion'] },
    { ids: ['diarrhea-guidance'], keywords: ['diarrhea', 'loose stools', 'stool'] },
    { ids: ['nausea-guidance'], keywords: ['nausea', 'vomit', 'vomiting', 'sick'] },
    { ids: ['constipation-guidance'], keywords: ['constipation', 'hard stools', 'bowel movement'] },
    { ids: ['minor-wound-guidance'], keywords: ['cut', 'wound', 'bleeding', 'minor wound'] },
    { ids: ['antibiotics-guidance'], keywords: ['antibiotic', 'antibiotics', 'infection', 'bacterial'] },
    { ids: ['skin-vitamins-guidance'], keywords: ['skin', 'vitamin', 'vitamins', 'supplement'] },
  ];

  for (const group of medicalPriority) {
    if (!group.keywords.some((keyword) => lowerMessage.includes(keyword))) {
      continue;
    }

    const chunk = knowledgeBase.find((entry) => group.ids.includes(entry.id));
    if (chunk) {
      return chunk;
    }
  }

  return knowledgeBase.find((entry) => entry.id === 'symptom-guidance-overview') || null;
};

const buildSymptomAnswer = (message) => {
  const lowerMessage = String(message || '').toLowerCase();

  // Urgent flags: concise clear message for dangerous symptoms.
  if (lowerMessage.includes('chest pain') || lowerMessage.includes('shortness of breath') || lowerMessage.includes('breathless')) {
    return 'Chest pain or shortness of breath can be serious and require urgent medical attention.';
  }

  if (lowerMessage.includes('headache')) {
    return 'Paracetamol (acetaminophen) is the common first-line option for simple headaches; follow label dosing.';
  }

  if (lowerMessage.includes('sore throat') || (lowerMessage.includes('sore') && lowerMessage.includes('throat'))) {
    return 'For sore throat: lozenges, warm saline gargles, and paracetamol for pain relief; follow product labels.';
  }

  if (lowerMessage.includes('congestion') || lowerMessage.includes('blocked') || lowerMessage.includes('stuffy') || (lowerMessage.includes('nasal') && lowerMessage.includes('congestion'))) {
    return 'For nasal congestion: saline rinses, humidifiers, and short-term decongestant sprays can help; follow product labels.';
  }

  if (lowerMessage.includes('allergy') || lowerMessage.includes('hay fever') || lowerMessage.includes('sneezing') || lowerMessage.includes('itchy')) {
    return 'For allergy symptoms: non-drowsy oral antihistamines like cetirizine or loratadine commonly relieve sneezing and runny nose; follow the label.';
  }

  if (lowerMessage.includes('fever') || lowerMessage.includes('temperature')) {
    return 'For fever or body pain: paracetamol (acetaminophen) is the usual first-line option; ibuprofen is an alternative when suitable. Use label dosing.';
  }

  if (lowerMessage.includes('pain') || lowerMessage.includes('bodyache')) {
    return 'For pain or bodyache: paracetamol (acetaminophen) is usually the first choice; follow label dosing.';
  }

  if (lowerMessage.includes('runny') || lowerMessage.includes('runny nose') || lowerMessage.includes('rhinorrhea')) {
    return 'For a runny nose: oral antihistamines like cetirizine or loratadine for allergies, or saline and short-term decongestants for viral colds; follow labels.';
  }

  if (lowerMessage.includes('cough')) {
    return 'For cough: a suppressant (dextromethorphan) for dry cough or an expectorant (guaifenesin) for productive cough; follow the label.';
  }

  if (lowerMessage.includes('digestion') || lowerMessage.includes('stomach') || lowerMessage.includes('acidity') || lowerMessage.includes('gas') || lowerMessage.includes('nausea') || lowerMessage.includes('indigestion')) {
    return 'For digestion issues: antacids for acidity, rehydration for diarrhoea, and symptom-specific remedies—follow labels.';
  }

  if (lowerMessage.includes('diarrhea') || lowerMessage.includes('diarrhoea') || lowerMessage.includes('loose stools')) {
    return 'For mild diarrhoea: stay hydrated and use oral rehydration; loperamide can reduce frequency in adults—follow the label.';
  }

  if (lowerMessage.includes('nausea') || lowerMessage.includes('vomit') || lowerMessage.includes('vomiting')) {
    return 'For mild nausea: ginger, antacids, or OTC antiemetics may help; sip fluids slowly and follow product labels.';
  }

  if (lowerMessage.includes('constipation') || lowerMessage.includes('hard stool') || lowerMessage.includes('bowel movement')) {
    return 'For constipation: increase fiber and fluids and consider gentle laxatives (polyethylene glycol); follow product labels.';
  }

  if (lowerMessage.includes('cut') || lowerMessage.includes('wound') || lowerMessage.includes('bleeding')) {
    return 'For minor cuts: clean with water, apply antiseptic or ointment, and dress the wound; follow product labels.';
  }

  if (lowerMessage.includes('antibiotic') || lowerMessage.includes('antibiotics') || lowerMessage.includes('infection') || lowerMessage.includes('bacterial')) {
    return 'Antibiotics should be used only when prescribed for a bacterial infection; follow the prescription exactly.';
  }

  if (lowerMessage.includes('skin') || lowerMessage.includes('vitamin') || lowerMessage.includes('vitamins') || lowerMessage.includes('supplement')) {
    return 'For skin or vitamin queries: choose the product matching the need and follow label instructions.';
  }

  return 'I can give general medicine guidance, but I could not find a specific symptom match.';
};

export const answerCustomerQuestion = async (message, history = []) => {
  const knowledgeBase = await loadKnowledgeBase();
  const recentHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .map((entry) => entry?.content || entry?.message || '')
        .join(' ')
    : '';
  const query = `${message} ${recentHistory}`.trim();
  const queryTokens = tokenize(query);
  const medicalQuestion = looksLikeMedicalQuestion(queryTokens, query);

  if (medicalQuestion) {
    const medicalChunk = getMedicalMatch(message, knowledgeBase);
    const sources = medicalChunk
      ? [
          {
            title: medicalChunk.title,
            source: medicalChunk.source,
            score: 96,
            matchedTokens: unique(tokenize(`${message} ${medicalChunk.title} ${medicalChunk.answer}`)).slice(0, 6),
          },
        ]
      : [];

    const answer = buildSymptomAnswer(message);

    return {
      answer,
      groundednessScore: medicalChunk?.id === 'symptom-guidance-overview' ? 68 : 90,
      groundednessLabel: medicalChunk?.id === 'symptom-guidance-overview' ? 'medium' : 'high',
      responseMode: 'medical_guidance',
      sources,
      matchedTopics: medicalChunk ? unique([medicalChunk.id, ...(medicalChunk.tags || [])]).slice(0, 8) : [],
    };
  }

  const ranked = knowledgeBase
    .map((chunk) => {
      const scoring = scoreChunk(queryTokens, chunk);
      return {
        ...chunk,
        score: scoring.score,
        matchedTokens: scoring.matchedTokens,
      };
    })
    .sort((left, right) => right.score - left.score);

  const relevant = ranked.filter((chunk) => chunk.score >= 0.08).slice(0, 3);

  if (relevant.length === 0) {
    return buildFallbackAnswer(message);
  }

  const [primary, secondary] = relevant;
  const scoreBase = Math.round(
    Math.min(
      98,
      Math.max(
        22,
        primary.score * 72 + (secondary?.score || 0) * 18 + relevant.length * 5 + Math.min(primary.matchedTokens.length * 4, 14)
      )
    )
  );

  const sources = relevant.map((chunk) => ({
    title: chunk.title,
    source: chunk.source,
    score: Math.round(chunk.score * 100),
    matchedTokens: chunk.matchedTokens,
  }));

  const singleAnswer = primary.answer;

  return {
    answer: singleAnswer,
    groundednessScore: scoreBase,
    groundednessLabel: confidenceLabel(scoreBase),
    responseMode: 'app_help',
    sources,
    matchedTopics: unique(relevant.flatMap((chunk) => chunk.matchedTokens)).slice(0, 8),
  };
};

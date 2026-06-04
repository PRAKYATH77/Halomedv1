import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDocKnowledge } from './docKnowledge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_PATH = path.join(__dirname, '..', 'data', 'customer-assistant-kb.json');
const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'ask', 'be', 'can', 'did', 'do', 'does', 'for', 'from', 'get', 'how', 'i', 'in', 'is', 'it', 'my', 'of', 'on', 'or', 'should', 'tell', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'you', 'your'
]);

let cachedKnowledgeBase = null;
let cachedDocKnowledge = null;
let cachedIdf = null;

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

const loadDocs = async () => {
  if (cachedDocKnowledge) return cachedDocKnowledge;
  cachedDocKnowledge = await loadDocKnowledge({ repoRoot: REPO_ROOT });
  return cachedDocKnowledge;
};

const buildIdf = (chunks) => {
  const docCount = chunks.length || 1;
  const df = new Map();

  for (const chunk of chunks) {
    const tokens = unique(tokenize(buildChunkText(chunk)));
    for (const token of tokens) {
      df.set(token, (df.get(token) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [token, count] of df.entries()) {
    // smooth IDF
    const val = Math.log(1 + docCount / (1 + count));
    idf.set(token, val);
  }
  return idf;
};

const cosineSimilarity = (a, b) => {
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (const [key, av] of a.entries()) {
    const bv = b.get(key) || 0;
    dot += av * bv;
    a2 += av * av;
  }
  for (const bv of b.values()) b2 += bv * bv;
  if (a2 === 0 || b2 === 0) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
};

const vectorize = (tokens, idf) => {
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  const vec = new Map();
  for (const [token, count] of tf.entries()) {
    const w = (1 + Math.log(count)) * (idf.get(token) || 0);
    if (w > 0) vec.set(token, w);
  }
  return vec;
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

  const baseScore = overlap * 0.55 + titleBonus * 0.2 + tagBonus * 0.1 + directPhraseBoost;

  // Optional semantic-ish boost via TF-IDF cosine similarity (built once)
  let tfidfBoost = 0;
  if (cachedIdf) {
    const qv = vectorize(queryTokens, cachedIdf);
    const cv = vectorize(chunkTokens, cachedIdf);
    tfidfBoost = cosineSimilarity(qv, cv) * 0.35;
  }

  const score = Math.min(1, baseScore + tfidfBoost);

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

const snippet = (text, max = 260) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
};

const sanitizeAnswer = (text) => String(text || '')
  .replace(/\r\n/g, '\n')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .trim();

const buildFallbackAnswer = (message) => ({
  answer: `I could not find a clear answer for: "${message}". Try asking about login, roles (admin/staff/customer/delivery_store/supplier), medicines & inventory, cart & checkout, orders & delivery tracking, prescriptions, payments, or reports.`,
  groundednessScore: 18,
  groundednessLabel: 'very low',
  responseMode: 'app_help',
  sources: [],
  matchedTopics: [],
});

const looksLikeMedicalQuestion = (queryTokens, message) => {
  const medicalTokens = new Set([
    'symptom', 'symptoms',
    'fever', 'temperature', 'chills',
    'pain', 'bodyache', 'ache',
    'cold', 'flu', 'cough', 'sneeze', 'sneezing', 'runny', 'congestion', 'stuffy',
    'headache', 'migraine',
    'throat', 'sore', 'phlegm',
    'stomach', 'digestion', 'acidity', 'gas', 'heartburn', 'nausea', 'vomit', 'vomiting',
    'diarrhea', 'diarrhoea', 'constipation',
    'infection', 'antibiotic', 'antibiotics',
    'dose', 'dosage', 'duration', 'days', 'medication', 'medicine'
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

const parseAgeYears = (text) => {
  const m = String(text || '').toLowerCase().match(/(\d{1,2})\s*(years?|yrs?)\b/);
  if (!m) return null;
  const age = Number(m[1]);
  return Number.isFinite(age) ? age : null;
};

const parseTempF = (text) => {
  const lower = String(text || '').toLowerCase();
  // 102, 102f, 102°F, 38.5c
  const f = lower.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*f\b/);
  if (f) return Number(f[1]);
  const c = lower.match(/(\d{2}(?:\.\d+)?)\s*°?\s*c\b/);
  if (c) {
    const v = Number(c[1]);
    return Number.isFinite(v) ? v * 9 / 5 + 32 : null;
  }
  // if mentions "degree" without unit, assume Fahrenheit for common phrasing
  const deg = lower.match(/(\d{2,3}(?:\.\d+)?)\s*degree/);
  if (deg) return Number(deg[1]);
  return null;
};

const parseDurationDays = (text) => {
  const lower = String(text || '').toLowerCase();
  const d = lower.match(/(\d+)\s*(day|days)\b/);
  if (d) return Number(d[1]);
  const h = lower.match(/(\d+)\s*(hour|hours|hrs)\b/);
  if (h) return Math.ceil(Number(h[1]) / 24);
  return null;
};

const hasAny = (text, phrases) => {
  const lower = String(text || '').toLowerCase();
  return phrases.some((p) => lower.includes(p));
};

const buildMedicalClarifiers = ({ ageYears, message }) => {
  const clarifiers = [];
  if (!ageYears) clarifiers.push('Your age (years)');
  if (hasAny(message, ['pregnant', 'pregnancy', 'breastfeeding', 'breast feeding'])) {
    // already mentioned
  } else {
    clarifiers.push('Pregnant or breastfeeding? (yes/no)');
  }
  clarifiers.push('Any allergies or major conditions (asthma, ulcers, kidney disease, liver disease)?');
  return clarifiers.slice(0, 3);
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

// Legacy short-form guidance kept for reference (not used).
const buildSymptomAnswerLegacy = (message) => {
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

const buildSymptomAnswer = (message) => {
  const ageYears = parseAgeYears(message);
  const tempF = parseTempF(message);
  const durationDays = parseDurationDays(message);

  const lower = String(message || '').toLowerCase();

  const redFlags = [
    { when: ['chest pain', 'shortness of breath', 'breathless'], text: 'Chest pain or shortness of breath can be serious—seek urgent medical care now.' },
    { when: ['confusion', 'fainting', 'seizure'], text: 'If you have confusion, fainting, or seizures—seek urgent medical care now.' },
    { when: ['stiff neck', 'severe headache'], text: 'Severe headache or stiff neck with fever needs urgent evaluation.' },
    { when: ['rash'], text: 'A rapidly spreading rash with fever should be checked urgently.' },
    { when: ['vomiting', 'can’t keep fluids', 'cannot keep fluids'], text: 'If you can’t keep fluids down or show dehydration—seek medical care.' },
  ];

  const urgent = redFlags.find((f) => hasAny(lower, f.when));
  if (urgent) return urgent.text;

  // Fever guidance (OTC, not a prescription)
  if (lower.includes('fever') || lower.includes('temperature') || tempF) {
    const tempLine = tempF ? `Your temperature looks like about ${Math.round(tempF * 10) / 10}°F.` : '';
    const highFever = tempF != null && tempF >= 103;
    const longFever = durationDays != null && durationDays >= 3;

    const adult = ageYears == null ? null : ageYears >= 12;
    const dosing = adult !== false
      ? [
          'Paracetamol / acetaminophen is usually the first OTC choice—follow the label dosing. Avoid combining multiple products that contain paracetamol.',
          'Ibuprofen is an alternative for many people—take with food and follow the label. Avoid if you have stomach ulcer/bleeding history, kidney disease, are on blood thinners, or are pregnant.',
        ]
      : [
          'For children, dosing depends on weight and age—use a pediatric formulation and follow the label or a clinician’s advice.',
        ];

    const whenToSee = [
      highFever ? 'Fever ≥103°F (39.4°C) that isn’t coming down—seek urgent care.' : null,
      longFever ? 'Fever lasting 3+ days—see a clinician.' : null,
      'Seek care sooner if you have trouble breathing, severe headache/stiff neck, confusion, chest pain, dehydration, or worsening symptoms.'
    ].filter(Boolean);

    const clarifiers = buildMedicalClarifiers({ ageYears, message });

    return [
      'General guidance (not a diagnosis):',
      tempLine,
      '',
      ...dosing.map((l) => `- ${l}`),
      '',
      'Self-care: rest, drink fluids, and re-check temperature after 60–90 minutes.',
      '',
      ...whenToSee.map((l) => `- ${l}`),
      '',
      `To be more specific, tell me: ${clarifiers.join('; ')}.`,
    ].filter(Boolean).join('\n');
  }

  // Other common symptom buckets (keep high-level + safe)
  if (lower.includes('cough')) {
    return [
      'For cough (general OTC guidance):',
      '- Dry cough: a suppressant like dextromethorphan may help (follow the label).',
      '- Productive cough with phlegm: an expectorant like guaifenesin may help (follow the label).',
      '- Honey (if age > 1 year) and warm fluids can soothe.',
      'Seek care if you have shortness of breath, chest pain, coughing blood, or symptoms lasting > 1 week.'
    ].join('\n');
  }

  if (lower.includes('sore') && lower.includes('throat')) {
    return [
      'For sore throat (general OTC guidance):',
      '- Warm salt-water gargles, lozenges, and fluids can help.',
      '- Paracetamol/acetaminophen can help pain/fever—follow the label.',
      'Seek care if you have trouble swallowing/breathing, high fever, or symptoms lasting > 3 days.'
    ].join('\n');
  }

  if (lower.includes('acidity') || lower.includes('heartburn') || lower.includes('gas')) {
    return [
      'For acidity/heartburn (general OTC guidance):',
      '- Antacids can give quick relief; H2 blockers/PPIs are longer-acting options (follow labels).',
      '- Avoid spicy/fatty foods, late meals, and lying down right after eating.',
      'Seek care if you have severe chest pain, black stools, vomiting blood, or persistent symptoms.'
    ].join('\n');
  }

  return 'I can give general OTC guidance for common symptoms (fever, cough, sore throat, acidity, diarrhea), but I need more details about your symptoms and duration.';
};

export const answerCustomerQuestion = async (message, history = []) => {
  const knowledgeBase = await loadKnowledgeBase();
  const docKnowledge = await loadDocs();

  if (!cachedIdf) {
    cachedIdf = buildIdf([...knowledgeBase, ...docKnowledge]);
  }
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

  const combinedKnowledge = [...knowledgeBase, ...docKnowledge];

  const ranked = combinedKnowledge
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

  const singleAnswer = relevant.length > 1
    ? `${primary.answer}\n\nRelated:\n- ${secondary.title}: ${snippet(secondary.answer)}`
    : primary.answer;

  return {
    answer: sanitizeAnswer(singleAnswer),
    groundednessScore: scoreBase,
    groundednessLabel: confidenceLabel(scoreBase),
    responseMode: 'app_help',
    sources,
    matchedTopics: unique(relevant.flatMap((chunk) => chunk.matchedTokens)).slice(0, 8),
  };
};

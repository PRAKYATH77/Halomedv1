import fs from 'fs/promises';
import path from 'path';

const DEFAULT_DOC_FILES = [
  'README.md',
  'START_HERE.md',
  'START_HERE_FINAL.md',
  'QUICK_START.md',
  'QUICK_START_WINDOWS.md',
  'INSTALLATION.md',
  'API_DOCUMENTATION.md',
  'FINAL_IMPLEMENTATION_GUIDE.md',
  'PROJECT_STRUCTURE.md',
  'FEATURE_FLOW_COMPLETE.md',
  'ROLE_WORKFLOWS_DETAILED.md',
  'TESTING_GUIDE.md',
];

const normalizeText = (text) => String(text || '').replace(/\r\n/g, '\n');
const cleanMarkdown = (markdown) => {
  const text = normalizeText(markdown);
  return text
    // remove fenced code blocks
    .replace(/```[\s\S]*?```/g, '')
    // remove inline code ticks
    .replace(/`([^`]+)`/g, '$1')
    // remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // collapse extra whitespace
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const chunkSection = (filePath, heading, body, maxChars = 1200) => {
  const cleanBody = cleanMarkdown(body);
  if (!cleanBody) return [];

  const chunks = [];
  const total = cleanBody.length;
  const size = clamp(maxChars, 400, 2400);

  for (let start = 0; start < total; start += size) {
    const slice = cleanBody.slice(start, start + size).trim();
    if (!slice) continue;
    const title = start === 0 ? heading : `${heading} (cont.)`;
    chunks.push({
      id: `doc:${filePath}:${heading}:${start}`,
      title,
      tags: ['docs'],
      source: filePath,
      answer: slice,
    });
  }

  return chunks;
};

const parseMarkdownToChunks = (filePath, markdown) => {
  const text = normalizeText(markdown);
  const lines = text.split('\n');

  const chunks = [];
  let currentHeading = path.basename(filePath);
  let currentBody = [];

  const flush = () => {
    chunks.push(...chunkSection(filePath, currentHeading, currentBody.join('\n')));
    currentBody = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      currentHeading = cleanMarkdown(headingMatch[2]);
      continue;
    }
    currentBody.push(line);
  }

  flush();
  return chunks;
};

export async function loadDocKnowledge({ repoRoot, docFiles = DEFAULT_DOC_FILES } = {}) {
  if (!repoRoot) throw new Error('repoRoot is required');

  const chunks = [];
  for (const relativePath of docFiles) {
    const fullPath = path.join(repoRoot, relativePath);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const parsed = parseMarkdownToChunks(relativePath, raw);
      chunks.push(...parsed);
    } catch {
      // ignore missing docs
    }
  }
  return chunks;
}

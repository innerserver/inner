export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT = 200000;
export const MAX_UNITS = 100;
export const SUPPORTED = /\.(pdf|pptx|docx|txt|md|csv)$/i;
export function cleanText(value) {
  return String(value || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function validateFile(name, size) {
  if (!SUPPORTED.test(name)) throw new Error('Choose a PPTX, PDF, DOCX, TXT, Markdown or CSV file. Save old .ppt/.doc files as PPTX/DOCX first.');
  if (!Number.isFinite(size) || size < 1 || size > MAX_FILE_BYTES) throw new Error('Choose a non-empty file up to 25 MB');
}
export function splitText(text, limit = 1400) {
  const chunks = []; let current = '';
  for (const line of cleanText(text).split('\n')) {
    if (current && current.length + line.length + 1 > limit) { chunks.push(current); current = ''; }
    let remaining = line;
    while (remaining.length > limit) {
      let end = remaining.lastIndexOf(' ', limit); if (end < limit / 2) end = limit;
      if (current) { chunks.push(current); current = ''; }
      chunks.push(remaining.slice(0, end)); remaining = remaining.slice(end).trim();
    }
    current += (current ? '\n' : '') + remaining;
  }
  if (current) chunks.push(current);
  return chunks;
}
const stop = new Set('the and that this with from have has were was are for but not you your into its they their these those also about which when what will can our each than then some'.split(' '));
export function keyTerms(text, limit = 8) {
  const counts = new Map();
  for (const word of cleanText(text).toLocaleLowerCase().match(/[\p{L}][\p{L}\p{N}-]{3,}/gu) || []) if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([word]) => word);
}
export function makeSourceNotes(units, detail = 'standard') {
  const count = detail === 'brief' ? 2 : detail === 'detailed' ? 6 : 4;
  return units.filter(unit => cleanText(unit.text)).map((unit) => {
    const terms = keyTerms(unit.text), unique = [...new Set(cleanText(unit.text).split(/\n+|(?<=[.!?])\s+/u).map(line => line.trim()).filter(Boolean))];
    const ranked = unique.map((line,index) => ({ line,index,score: terms.reduce((sum,word) => sum + (line.toLocaleLowerCase().includes(word) ? 1 : 0),0) + (/\d|\b(is|means|defined|because|therefore)\b/i.test(line) ? 1 : 0) }));
    const chosen = ranked.sort((a,b) => b.score-a.score || a.index-b.index).slice(0,count).sort((a,b) => a.index-b.index);
    return { ...unit, terms, bullets: chosen.map(entry => entry.line), aiSummary: '' };
  });
}
export function checkUnits(units) {
  if (units.length > MAX_UNITS) throw new Error('Maximum 100 pages, slides or text sections. Split this file into smaller documents.');
  if (units.reduce((sum,unit) => sum + unit.text.length,0) > MAX_TEXT) throw new Error('Maximum 200,000 extracted characters. Split this file into smaller documents.');
  if (!units.some(unit => cleanText(unit.text))) throw new Error('No selectable text found. Image-only scans and pictures need OCR, which this version does not include.');
  return units;
}
export function groundedSummary(draft, source) {
  const words=new Set(cleanText(draft).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
  return [...new Set(cleanText(source).split(/\n+|(?<=[.!?])\s+/u).filter(Boolean))].map((line,index)=>({line,index,score:(line.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(word=>words.has(word)).length})).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,3).sort((a,b)=>a.index-b.index).map(entry=>entry.line).join('\n');
}
export function exportNotes(name, notes) {
  const lines = [cleanText(name), 'Connectifi study notes', 'Source points are extracts. AI summaries, when included, are drafts to check against the original.', ''];
  for (const note of notes) {
    lines.push(`${note.ref}: ${note.title}`, ...note.bullets.map(line => `• ${line}`));
    if (note.aiSummary) lines.push(`AI-selected source points: ${note.aiSummary}`);
    if (note.terms.length) lines.push(`Key terms: ${note.terms.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Minimal RFC 4180-style CSV parser with comma/semicolon auto-detection.

function detectDelimiter(text) {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semicolons++;
  }
  return semicolons > commas ? ';' : ',';
}

export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  const endRecord = () => {
    record.push(field);
    // Skip blank lines (a single empty field).
    if (record.length > 1 || record[0] !== '') records.push(record);
    record = [];
    field = '';
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) endRecord();

  const [headerRow = [], ...rows] = records;
  return { headers: headerRow.map(h => h.trim()), rows };
}

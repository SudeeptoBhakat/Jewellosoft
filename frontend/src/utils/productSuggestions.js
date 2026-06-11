const STORAGE_KEY = 'jewellosoft_product_suggestions';

export const DEFAULT_SUGGESTIONS = [
  'Rani Haar',
  'Sita Haar',
  'Choker Necklace',
  'Mala Necklace',
  'Kanthi Haar',
  'Tilapata Haar',
  'Chik Necklace',
  'Aadh Necklace',
  'Hasuli',
  'Joydhar Haar',
  'Panchlari Haar',
  'Mohan Mala',
  'Laxmi Haar',
  'Gundla Haram',
  'Temple Necklace',
  'Antique Necklace',
  'Mango Necklace',
  'Chain Necklace',
  'Navratna Necklace',

  'Shakha Pola',
  'Loha Bangle',
  'Gold Bangle',
  'Kankan',
  'Ratanchur',
  'Chur Bangle',
  'Mantasha',
  'Baala Bangle',
  'Broad Bangle',
  'Hinge Bangle',
  'Filigree Bangle',
  'Bengali Bangle Pair',

  'Jhumka',
  'Kanbala',
  'Toppa',
  'Jhumki Earring',
  'Chandbali',
  'Hoop Earring',
  'Stud Earring',
  'Sui Dhaga',
  'Bugadi',
  'Latkan Earring',
  'Ear Cuff',
  'Drop Earring',

  'Angti',
  'Gents Ring',
  'Ladies Ring',
  'Nakshi Ring',
  'Engagement Ring',
  'Wedding Band',
  'Cocktail Ring',
  'Arsi Ring',
  'Gemstone Ring',

  'Pendant',
  'Locket',
  'Dollar Chain',
  'Mangalsutra Pendant',
  'Om Pendant',
  'Ganesh Pendant',
  'Heart Pendant',
  'Chain — Flat',
  'Chain — Rope',
  'Chain — Box',
  'Chain — Singapore',
  'Mangalsutra Chain',
  'Baby Chain',

  'Kamarband',
  'Tagdi',
  'Waist Chain',
  'Nosering — Nath',
  'Nose Pin',
  'Maang Tikka',
  'Matha Patti',
  'Sindhoor Box',
  'Armlet — Bajuband',
  'Anklet — Payal',
  'Toe Ring — Bichhua',
  'Brooch',

  'Gold Coin — 1g',
  'Gold Coin — 2g',
  'Gold Coin — 5g',
  'Gold Coin — 10g',
  'Gold Bar — 50g',
  'Gold Bar — 100g',
  'Silver Coin — 10g',
  'Silver Coin — 50g',
  'Puja Thali Set',
  'Laxmi Idol',
  'Ganesh Idol',
];



const norm = (s) => (s || '').trim().toLowerCase();

export function getSuggestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* corrupt — re-seed */ }

  const sorted = [...DEFAULT_SUGGESTIONS].sort((a, b) => a.localeCompare(b));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}

function persist(list) {
  const unique = [...new Set(list.map(s => s.trim()).filter(Boolean))];
  unique.sort((a, b) => a.localeCompare(b));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  return unique;
}

export function addSuggestion(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return getSuggestions();
  const list = getSuggestions();
  if (list.some(s => norm(s) === norm(trimmed))) return list;
  list.push(trimmed);
  return persist(list);
}

export function updateSuggestion(oldName, newName) {
  const list = getSuggestions();
  const idx = list.findIndex(s => norm(s) === norm(oldName));
  if (idx === -1) return list;
  list[idx] = (newName || '').trim();
  return persist(list);
}

export function deleteSuggestion(name) {
  const list = getSuggestions().filter(s => norm(s) !== norm(name));
  return persist(list);
}

export function resetToDefaults() {
  const sorted = [...DEFAULT_SUGGESTIONS].sort((a, b) => a.localeCompare(b));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  return sorted;
}

export function recordUsedName(name) {
  const trimmed = (name || '').trim();
  if (trimmed.length < 3) return;
  addSuggestion(trimmed);
}

const KEY = 'crownfire-save';

export interface SaveData {
  crowns: number;
  wins: number;
}

export function loadSave(): SaveData {
  try {
    return { crowns: 0, wins: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { crowns: 0, wins: 0 };
  }
}

export function saveProgress(deltaCrowns: number, won: boolean): SaveData {
  const save = loadSave();
  save.crowns += deltaCrowns;
  if (won) save.wins += 1;
  localStorage.setItem(KEY, JSON.stringify(save));
  return save;
}

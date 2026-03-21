const fs = require('fs');
const code = fs.readFileSync('c:/Users/ivanr/OneDrive/Área de Trabalho/IMPACTO-IA/src/lib/gameSeeder.ts', 'utf-8');
const match = code.match(/export const ALL_ACHIEVEMENTS = \[([\s\S]*?)\];/);
if (match) {
  const titles = [];
  const regex = /title:\s*['"]([^'"]+)['"]/g;
  let t;
  while ((t = regex.exec(match[1])) !== null) {
    titles.push(t[1]);
  }
  const seen = new Set();
  const dupes = [];
  for (const title of titles) {
    if (seen.has(title)) dupes.push(title);
    seen.add(title);
  }
  console.log('Total achievements:', titles.length);
  console.log('Duplicates:', dupes);
}

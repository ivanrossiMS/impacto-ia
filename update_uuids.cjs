const fs = require('fs');
const crypto = require('crypto');
const filepath = 'c:/Users/ivanr/OneDrive/Área de Trabalho/IMPACTO-IA/src/lib/gameSeeder.ts';
let content = fs.readFileSync(filepath, 'utf-8');

// Replace standard IDs with real UUIDs
content = content.replace(/id:\s*['\"]ach-\d{3}['\"]/g, () => {
  return "id: '" + crypto.randomUUID() + "'";
});

fs.writeFileSync(filepath, content);
console.log('Replaced ach-XXX with UUIDs');

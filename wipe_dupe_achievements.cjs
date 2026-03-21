const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function fixDupes() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const supaUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
  const supaKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const supabase = createClient(supaUrl, supaKey);

  console.log('Deletando todas as conquistas antigas do Supabase para limpar duplicatas...');
  
  // Como delete() não funciona no vazio, selecionamos todos os IDs primeiro
  const { data: all } = await supabase.from('achievements').select('id');
  if (all && all.length > 0) {
    const ids = all.map(a => a.id);
    const { error } = await supabase.from('achievements').delete().in('id', ids);
    if (error) console.error('Erro ao deletar:', error);
    else console.log('Deletadas', ids.length, 'referências.');
  }

  console.log('Limpeza finalizada. A página fará o push das 100 originais ao recarregar.');
}

fixDupes();

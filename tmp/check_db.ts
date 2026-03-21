import { db } from './src/lib/dexie';

async function checkDb() {
  const users = await db.users.toArray();
  const classes = await db.classes.toArray();
  const missions = await db.missions.toArray();
  
  console.log('--- Users ---');
  users.forEach(u => console.log(`${u.id}: ${u.name} (Role: ${u.role}, ClassId: ${u.classId})`));
  
  console.log('--- Classes ---');
  classes.forEach(c => console.log(`${c.id}: ${c.name} (Students: ${c.studentIds?.length || 0})`));
  
  console.log('--- Missions ---');
  const counts = missions.reduce((acc: any, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {});
  console.log('Mission counts by type:', counts);
}

checkDb();

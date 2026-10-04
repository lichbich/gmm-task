const https = require('https');

https.get('https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task/tasks.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tasks = Object.values(JSON.parse(data));
    console.log('Total tasks in DB:', tasks.length);
    
    // Check duplicates per week
    const weekMap = {};
    tasks.forEach(t => {
      const w = t.weekNumber || 'no_week';
      if (!weekMap[w]) weekMap[w] = {};
      const key = `${(t.assigneeAccount||'').trim().toLowerCase()}__${t.title.trim().toLowerCase()}`;
      if (!weekMap[w][key]) weekMap[w][key] = [];
      weekMap[w][key].push(t);
    });
    
    Object.keys(weekMap).forEach(w => {
      const dupes = Object.entries(weekMap[w]).filter(([k, list]) => list.length > 1);
      if (dupes.length > 0) {
        console.log(`\n=== WEEK ${w} HAS ${dupes.length} DUPLICATE GROUPS ===`);
        dupes.forEach(([k, list]) => {
          console.log(`Key: ${k} (count: ${list.length})`);
          list.forEach(item => console.log(`  -> ID: ${item.id}, status: ${item.status}, effort: ${item.actualEffort}, pct: ${item.completionPercentage}%, parent: ${item.parentTaskId}`));
        });
      }
    });
  });
});

const https = require('https');

https.get('https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task/tasks.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tasks = Object.values(JSON.parse(data));
    console.log('Total tasks in DB:', tasks.length);
    
    // Group by (weekNumber, title, assigneeAccount)
    const groups = {};
    tasks.forEach(t => {
      const key = (t.weekNumber || 'no_week') + '_' + (t.assigneeAccount || '').toLowerCase() + '_' + t.title;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    
    const duplicates = Object.entries(groups).filter(([k, list]) => list.length > 1);
    console.log('Found duplicate groups in DB:', duplicates.length);
    duplicates.forEach(([k, list]) => {
      console.log('--- Key:', k);
      list.forEach(t => console.log('  ID:', t.id, 'Week:', t.weekNumber, 'Effort:', t.actualEffort, 'Pct:', t.completionPercentage, 'Parent:', t.parentTaskId, 'Created:', t.createdAt));
    });
  });
});

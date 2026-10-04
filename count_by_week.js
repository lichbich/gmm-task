const https = require('https');

https.get('https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app/gmm-task/tasks.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const tasks = Object.values(JSON.parse(data));
    const counts = {};
    tasks.forEach(t => {
      const w = t.weekNumber || 'none';
      counts[w] = (counts[w] || 0) + 1;
    });
    console.log('Task counts by weekNumber in DB:', counts);
  });
});

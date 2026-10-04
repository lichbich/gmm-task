const https = require('https');

const FIREBASE_HOST = 'docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app';
const DB_PATH_PREFIX = '/gmm-task';

const idsToDelete = [
  'tsk-1791137619477-hcrb',
  'tsk-1791137619477-k6lw',
  'tsk-1791137619477-2awl',
  'tsk-1791137619477-w71d',
  'tsk-1791137619477-hpvz'
];

function deleteRequest(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: FIREBASE_HOST,
      path: `${DB_PATH_PREFIX}${path}.json`,
      method: 'DELETE'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.end();
  });
}

function putRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: FIREBASE_HOST,
      path: `${DB_PATH_PREFIX}${path}.json`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Cleaning up 5 duplicate tasks in Week 96...');
  for (const id of idsToDelete) {
    console.log(`Deleting ${id}...`);
    await deleteRequest(`/tasks/${id}`);
    
    // Add tombstone to deletedTasks so clients don't restore it from local cache
    await putRequest(`/deletedTasks/${id}`, {
      deletedAt: new Date().toISOString(),
      deletedBy: 'system-dedup',
      reason: 'Deduplicated week 96 task'
    });
    console.log(`Deleted and tombstoned ${id}`);
  }
  console.log('All 5 duplicate tasks successfully removed from Firebase DB!');
}

main().catch(console.error);

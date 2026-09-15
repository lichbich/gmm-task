const { initializeApp, getApps, getApp } = require('firebase/app');
const { getDatabase, ref, set, remove, get } = require('firebase/database');

const firebaseConfig = {
  projectId: "docugen-676bf",
  databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);
const DB_ROOT_NODE = 'gmm-task';

async function clearDataKeepUsers() {
  console.log('Starting data wipe on Firebase Realtime Database...');
  
  try {
    // 1. Remove tasks, milestones, weeklyArchives
    await remove(ref(database, `${DB_ROOT_NODE}/tasks`));
    console.log('✓ Cleared tasks node');

    await remove(ref(database, `${DB_ROOT_NODE}/milestones`));
    console.log('✓ Cleared milestones node');

    await remove(ref(database, `${DB_ROOT_NODE}/weeklyArchives`));
    console.log('✓ Cleared weeklyArchives node');

    await remove(ref(database, `${DB_ROOT_NODE}/weeklyAwards`));
    console.log('✓ Cleared weeklyAwards node');

    // 2. Reset users' totalEffort to 0 while preserving user profiles
    const usersSnapshot = await get(ref(database, `${DB_ROOT_NODE}/users`));
    if (usersSnapshot.exists()) {
      const usersData = usersSnapshot.val();
      const updatedUsers = {};
      for (const key in usersData) {
        updatedUsers[key] = {
          ...usersData[key],
          totalEffort: 0, // Reset cumulative effort to 0 for fresh start
        };
      }
      await set(ref(database, `${DB_ROOT_NODE}/users`), updatedUsers);
      console.log('✓ Reset totalEffort to 0 for all users in Firebase');
    }

    console.log('\n🎉 SUCCESS: All tasks, milestones, and history cleared! User accounts preserved.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error wiping data:', err);
    process.exit(1);
  }
}

clearDataKeepUsers();

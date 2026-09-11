import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';

const firebaseConfig = {
  projectId: "docugen-676bf",
  databaseURL: "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database, ref, onValue, set, update, remove };

// Root node name for project
export const DB_ROOT_NODE = 'gmm-task';

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

// Root node name for project:
// Mặc định kết nối đồng bộ vào node 'gmm-task' (hoặc ghi đè qua NEXT_PUBLIC_FIREBASE_DB_NODE).
const getDbRootNode = (): string => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_DB_NODE) {
    return process.env.NEXT_PUBLIC_FIREBASE_DB_NODE;
  }
  return 'gmm-task-test';
};

export const DB_ROOT_NODE = getDbRootNode();


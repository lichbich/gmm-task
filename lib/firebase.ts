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
// Khi chạy ở localhost (local dev), sử dụng node 'gmm-task-test'.
// Khi deploy production, sử dụng node 'gmm-task'.
const getDbRootNode = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'gmm-task-test';
    }
  }
  if (process.env.NODE_ENV === 'development') {
    return 'gmm-task-test';
  }
  return 'gmm-task';
};

export const DB_ROOT_NODE = getDbRootNode();


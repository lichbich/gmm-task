import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove, get, child } from 'firebase/database';

export const FIREBASE_DATABASE_URL = "https://docugen-676bf-default-rtdb.asia-southeast1.firebasedatabase.app";

const firebaseConfig = {
  projectId: "docugen-676bf",
  databaseURL: FIREBASE_DATABASE_URL,
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database, ref, onValue, set, update, remove, get, child };

// Root node name for project:
// - Nếu có biến môi trường NEXT_PUBLIC_FIREBASE_DB_NODE -> ưu tiên dùng biến đó.
// - Khi chạy local (NODE_ENV === 'development' hoặc localhost) -> tự động dùng 'gmm-task-test' để không ảnh hưởng data thật.
// - Khi deploy production -> tự động dùng 'gmm-task'.
const getDbRootNode = (): string => {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIREBASE_DB_NODE) {
    return process.env.NEXT_PUBLIC_FIREBASE_DB_NODE.trim();
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'gmm-task-test';
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'gmm-task-test';
    }
  }
  return 'gmm-task';
};

export const DB_ROOT_NODE = getDbRootNode();
export const IS_TEST_DB = DB_ROOT_NODE !== 'gmm-task';


import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Explicitly set persistence to local to support multiple devices staying logged in
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Persistence setting failed:", error);
});

export const googleProvider = new GoogleAuthProvider();

async function testConnection() {
  try {
    // Attempt to read a non-existent document from the server to force a connection check
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error: any) {
    if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
      console.error("Please check your Firebase configuration or internet connection. The client is offline.");
    } else if (error?.code === 'permission-denied') {
      // Permission denied means we SUCCESSFULLY reached the server, which is good for a connection test!
      console.log("Firestore connection verified (Permission Denied as expected)");
    } else {
      console.error("Firestore connection status unknown:", error);
    }
  }
}

testConnection();

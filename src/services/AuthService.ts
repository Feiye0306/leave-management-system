import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut
} from 'firebase/auth';

const STORAGE_AUTH_USER_KEY = 'winner_auth_user_v1';
const STORAGE_WHITELIST_KEY = 'winner_auth_whitelist_v2';

// 預設管理員白名單 (全轉小寫比對) - 僅限個人管理員
export const DEFAULT_WHITELIST: string[] = [
  'feiye0306@gmail.com'
];

export interface AuthUserInfo {
  email: string;
  name: string;
  photoURL?: string;
  isWhitelisted: boolean;
  loginMethod: 'google' | 'dev_bypass';
}

// 取得目前的白名單列表 (支援動態擴充)
export function getWhitelist(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_WHITELIST_KEY);
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list) && list.length > 0) {
        return Array.from(new Set([...DEFAULT_WHITELIST, ...list.map((e: string) => e.toLowerCase().trim())]));
      }
    }
  } catch (e) {
    console.error('讀取白名單失敗:', e);
  }
  return [...DEFAULT_WHITELIST];
}

// 儲存白名單
export function saveWhitelist(emails: string[]): void {
  const cleanList = Array.from(new Set(emails.map(e => e.toLowerCase().trim()).filter(Boolean)));
  localStorage.setItem(STORAGE_WHITELIST_KEY, JSON.stringify(cleanList));
}

// 檢查是否在白名單
export function isEmailWhitelisted(email: string): boolean {
  if (!email) return false;
  const list = getWhitelist();
  return list.includes(email.toLowerCase().trim());
}

// 取得目前本機登入的使用者
export function getStoredUser(): AuthUserInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_USER_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      // 確保仍符合白名單
      if (isEmailWhitelisted(user.email)) {
        return user;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

// 儲存登入使用者
export function setStoredUser(user: AuthUserInfo | null): void {
  if (user) {
    localStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_AUTH_USER_KEY);
  }
}

// 初始化 Firebase Auth
function getFirebaseAuth() {
  try {
    let app;
    if (getApps().length > 0) {
      app = getApp();
    } else {
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
      };
      app = initializeApp(firebaseConfig);
    }
    return getAuth(app);
  } catch (e) {
    console.warn('Firebase Auth 初始化失敗 (可能尚未設定 API Key):', e);
    return null;
  }
}

// Google 彈窗登入
export async function loginWithGoogle(): Promise<{ success: boolean; user?: AuthUserInfo; error?: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return { success: false, error: 'Firebase 尚未正確設定，請使用管理員直通模式。' };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const fbUser = result.user;
    const email = fbUser.email?.toLowerCase().trim() || '';

    if (!isEmailWhitelisted(email)) {
      await firebaseSignOut(auth);
      setStoredUser(null);
      return {
        success: false,
        error: `存取已被拒絕：Google 帳號 (${email}) 不在管理員白名單中！`
      };
    }

    const userInfo: AuthUserInfo = {
      email,
      name: fbUser.displayName || email,
      photoURL: fbUser.photoURL || undefined,
      isWhitelisted: true,
      loginMethod: 'google'
    };

    setStoredUser(userInfo);
    return { success: true, user: userInfo };
  } catch (err: any) {
    console.error('Google 登入失敗:', err);
    return { success: false, error: err.message || 'Google 登入連線失敗' };
  }
}

// 登出
export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error(e);
    }
  }
  setStoredUser(null);
}

// 開發直通模式登入 (如同工讀金系統)
export function devBypassLogin(targetEmail: string = 'feiye0306@gmail.com'): { success: boolean; user?: AuthUserInfo; error?: string } {
  const cleanEmail = targetEmail.toLowerCase().trim();
  if (!isEmailWhitelisted(cleanEmail)) {
    return {
      success: false,
      error: `帳號 (${cleanEmail}) 不在白名單中！`
    };
  }

  const userInfo: AuthUserInfo = {
    email: cleanEmail,
    name: '管理員 (直通登入)',
    isWhitelisted: true,
    loginMethod: 'dev_bypass'
  };

  setStoredUser(userInfo);
  return { success: true, user: userInfo };
}

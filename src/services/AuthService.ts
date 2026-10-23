// 登入驗證與白名單管理模組 (Google OAuth 2.0 & 管理員安全驗證)
// 支援 Google Identity Services (GSI) 官方登入與安全通行密碼雙重防護

const STORAGE_AUTH_USER_KEY = 'winner_auth_user_v2';

// 官方 Google OAuth Client ID (已向 Google Cloud 註冊)
export const GOOGLE_CLIENT_ID =
  '749211899095-aoia1vg0k3u4u0lthralb19o4jg2k8o6.apps.googleusercontent.com';

// 唯一授權之管理員 Gmail 白名單 (全轉小寫嚴格比對)
export const DEFAULT_WHITELIST: string[] = ['feiye0306@gmail.com'];

// 管理員專屬安全通行密碼庫 (內部最高管理權限，杜絕無痕任意進入)
const VALID_PASSCODES = ['winners888', 'feiye888'];

export interface AuthUserInfo {
  email: string;
  name: string;
  photoURL?: string;
  isWhitelisted: boolean;
  loginMethod: 'google' | 'passcode';
}

// 檢查是否符合白名單
export function isEmailWhitelisted(email: string): boolean {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  return DEFAULT_WHITELIST.includes(cleanEmail);
}

// 取得本機目前登入之使用者
export function getStoredUser(): AuthUserInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_USER_KEY);
    if (raw) {
      const user: AuthUserInfo = JSON.parse(raw);
      if (user && isEmailWhitelisted(user.email)) {
        return user;
      }
    }
  } catch (e) {
    console.error('讀取登入身分失敗:', e);
  }
  return null;
}

// 儲存登入使用者至本機快取
export function setStoredUser(user: AuthUserInfo | null): void {
  if (user) {
    localStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_AUTH_USER_KEY);
  }
}

// 登出系統
export async function logout(): Promise<void> {
  setStoredUser(null);
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
    try {
      (window as any).google.accounts.id.disableAutoSelect();
    } catch {
      // 忽略
    }
  }
}

// 解析 Google GSI 返回之 JWT ID Token (OpenID Connect 標準)
export function decodeGoogleJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('憑證格式不正確');
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('解析 Google JWT 失敗:', err);
    return null;
  }
}

// 驗證 Google GSI JWT 憑證並登入
export function verifyAndLoginWithGoogleJwt(credential: string): {
  success: boolean;
  user?: AuthUserInfo;
  error?: string;
} {
  const payload = decodeGoogleJwt(credential);
  if (!payload || !payload.email) {
    return { success: false, error: 'Google 憑證解析失敗，請重新嘗試登入。' };
  }

  const email = payload.email.toLowerCase().trim();
  if (!isEmailWhitelisted(email)) {
    return {
      success: false,
      error: `存取受限：Google 帳號 (${email}) 不在管理員白名單內！`
    };
  }

  const user: AuthUserInfo = {
    email,
    name: payload.name || email,
    photoURL: payload.picture,
    isWhitelisted: true,
    loginMethod: 'google'
  };

  setStoredUser(user);
  return { success: true, user };
}

// 透過 Google OAuth 2.0 Token Client 彈窗授權登入
export function loginWithGoogleOAuth(): Promise<{
  success: boolean;
  user?: AuthUserInfo;
  error?: string;
}> {
  return new Promise((resolve) => {
    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.oauth2) {
      resolve({
        success: false,
        error: 'Google 登入套件尚未載入完成，請稍候重試或改用通行密碼登入。'
      });
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            resolve({
              success: false,
              error: `Google 授權失敗: ${tokenResponse.error_description || tokenResponse.error}`
            });
            return;
          }

          if (!tokenResponse.access_token) {
            resolve({ success: false, error: '未取得 Google 存取金鑰。' });
            return;
          }

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            if (!res.ok) {
              resolve({ success: false, error: '無法讀取 Google 使用者個人資料。' });
              return;
            }
            const info = await res.json();
            const email = (info.email || '').toLowerCase().trim();

            if (!isEmailWhitelisted(email)) {
              resolve({
                success: false,
                error: `存取受限：Google 帳號 (${email}) 不在管理員白名單內！`
              });
              return;
            }

            const user: AuthUserInfo = {
              email,
              name: info.name || email,
              photoURL: info.picture,
              isWhitelisted: true,
              loginMethod: 'google'
            };

            setStoredUser(user);
            resolve({ success: true, user });
          } catch (e: any) {
            resolve({ success: false, error: '連線 Google 伺服器驗證失敗: ' + e.message });
          }
        },
        error_callback: (err: any) => {
          resolve({
            success: false,
            error: err.message || 'Google 授權彈窗被阻擋或關閉。'
          });
        }
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (e: any) {
      resolve({
        success: false,
        error: '啟動 Google 授權失敗 (請確認已開啟彈窗授權或使用通行密碼): ' + e.message
      });
    }
  });
}

// 透過管理員專屬安全通行密碼登入 (開無痕亦受密碼保護，嚴禁無驗證通行)
export function loginWithPasscode(passcode: string): {
  success: boolean;
  user?: AuthUserInfo;
  error?: string;
} {
  const cleanPasscode = (passcode || '').trim();
  if (!cleanPasscode) {
    return { success: false, error: '請輸入管理員安全通行密碼。' };
  }

  if (!VALID_PASSCODES.includes(cleanPasscode)) {
    return { success: false, error: '通行密碼錯誤，拒絕存取！' };
  }

  const user: AuthUserInfo = {
    email: 'feiye0306@gmail.com',
    name: '總管理員 (Darry)',
    photoURL: undefined,
    isWhitelisted: true,
    loginMethod: 'passcode'
  };

  setStoredUser(user);
  return { success: true, user };
}

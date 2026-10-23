import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import type { AuthUserInfo } from '../services/AuthService';
import {
  getStoredUser,
  loginWithGoogleOAuth,
  verifyAndLoginWithGoogleJwt,
  loginWithPasscode,
  GOOGLE_CLIENT_ID
} from '../services/AuthService';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [currentUser, setCurrentUser] = useState<AuthUserInfo | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 安全通行密碼輸入狀態
  const [showPasscodeInput, setShowPasscodeInput] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');

  const gsiBtnContainerRef = useRef<HTMLDivElement>(null);

  // 初始化 Google Identity Services (GSI) 原生按鈕 (比照工讀金系統)
  useEffect(() => {
    if (currentUser) return;

    let retryCount = 0;
    const interval = setInterval(() => {
      const google = (window as any).google;
      if (google?.accounts?.id && gsiBtnContainerRef.current) {
        clearInterval(interval);
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              if (response?.credential) {
                const res = verifyAndLoginWithGoogleJwt(response.credential);
                if (res.success && res.user) {
                  setCurrentUser(res.user);
                } else {
                  setErrorMsg(res.error || 'Google 身分驗證未通過');
                }
              }
            },
            auto_select: false
          });

          gsiBtnContainerRef.current.innerHTML = '';
          google.accounts.id.renderButton(gsiBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'pill',
            width: 320
          });
        } catch (err: any) {
          console.warn('GSI 初始化按鈕未就緒:', err);
        }
      }

      retryCount++;
      if (retryCount > 15) {
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [currentUser]);

  // 點擊自訂 Google 登入按鈕
  const handleGoogleOAuthLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginWithGoogleOAuth();
      if (res.success && res.user) {
        setCurrentUser(res.user);
      } else {
        setErrorMsg(res.error || 'Google 授權未完成');
        // 若 Google 跨網域受限，提示切換密碼驗證
        setShowPasscodeInput(true);
      }
    } catch (e: any) {
      setErrorMsg(e.message || '連線授權失敗');
      setShowPasscodeInput(true);
    } finally {
      setLoading(false);
    }
  };

  // 管理員專屬安全通行密碼登入 (杜絕無痕開任意進)
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = loginWithPasscode(passcode);
    if (res.success && res.user) {
      setCurrentUser(res.user);
    } else {
      setErrorMsg(res.error || '密碼錯誤');
    }
  };

  // 若已通過白名單身分驗證，直接放行顯示系統頁面
  if (currentUser && currentUser.isWhitelisted) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center space-y-6 border border-slate-200 animate-scale-up">
        {/* 圖標與標題 */}
        <div className="w-16 h-16 rounded-3xl bg-blue-600 text-white text-3xl flex items-center justify-center mx-auto shadow-xl shadow-blue-500/30">
          <ShieldCheck size={36} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">管理員身分安全驗證</h2>
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            本系統為校內專屬排班資料庫，僅允許授權之 Google 管理員或具備安全通行金鑰存取。
          </p>
        </div>

        {/* 錯誤提示 */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 text-left flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google 登入區域 */}
        <div className="pt-2 flex flex-col items-center justify-center space-y-3">
          {/* GSI 原生按鈕掛載點 (比照工讀金系統) */}
          <div ref={gsiBtnContainerRef} className="min-h-[44px] flex items-center justify-center w-full"></div>

          {/* 備用彈窗按鈕 (相容各種瀏覽器) */}
          <button
            onClick={handleGoogleOAuthLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 text-slate-700 font-bold px-6 py-3 rounded-2xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-sm">
              {loading ? '正在啟動 Google 授權...' : '使用 Google 帳號授權登入'}
            </span>
          </button>

          <p className="text-[11px] text-slate-400">
            採用 Google OAuth 2.0 官方安全授權加密通道
          </p>
        </div>

        {/* 管理員安全通行密碼 (非無痕直通！必須輸入正確密碼始得進入) */}
        <div className="pt-3 border-t border-slate-100 text-left">
          {!showPasscodeInput ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowPasscodeInput(true)}
                className="text-xs text-slate-500 hover:text-blue-600 font-semibold flex items-center justify-center gap-1.5 mx-auto hover:underline"
              >
                <Lock size={13} />
                <span>切換為管理員通行密碼登入</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasscodeSubmit} className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Lock size={13} className="text-slate-500" />
                  <span>管理員安全通行密碼:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasscodeInput(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600"
                >
                  隱藏
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="請輸入管理通行密碼"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition-all shadow-md active:scale-95"
                >
                  <span>驗證</span>
                  <ArrowRight size={13} />
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                本系統嚴格執行身分檢驗，杜絕未授權任意存取
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

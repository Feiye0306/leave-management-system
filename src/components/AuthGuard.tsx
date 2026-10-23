import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, Key, CheckCircle2 } from 'lucide-react';
import type { AuthUserInfo } from '../services/AuthService';
import {
  getStoredUser,
  loginWithGoogle,
  devBypassLogin,
  getWhitelist
} from '../services/AuthService';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [currentUser, setCurrentUser] = useState<AuthUserInfo | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDevInput, setShowDevInput] = useState<boolean>(false);
  const [customEmail, setCustomEmail] = useState<string>('feiye0306@gmail.com');

  const whitelist = getWhitelist();

  // 嘗試透過 Google 登入
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginWithGoogle();
      if (res.success && res.user) {
        setCurrentUser(res.user);
      } else {
        setErrorMsg(res.error || 'Google 登入失敗');
      }
    } catch (e: any) {
      setErrorMsg(e.message || '連線錯誤');
    } finally {
      setLoading(false);
    }
  };

  // 直通模式
  const handleDevBypass = (email: string) => {
    setErrorMsg(null);
    const res = devBypassLogin(email);
    if (res.success && res.user) {
      setCurrentUser(res.user);
    } else {
      setErrorMsg(res.error || '直通登入失敗');
    }
  };

  // 若已通過驗證，直接放行子頁面
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
            本系統為校內專屬排班資料庫，僅允許授權的 Google 管理員帳號登入存取。非授權帳號將無法讀取資料。
          </p>
        </div>

        {/* 錯誤提示 */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 text-left flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google 登入大按鈕 */}
        <div className="pt-2 flex flex-col items-center justify-center space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 text-slate-700 font-bold px-6 py-3.5 rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {/* Google G Logo SVG */}
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
              {loading ? '正在連線 Google 授權...' : '使用 Google 帳號授權登入'}
            </span>
          </button>

          <p className="text-[11px] text-slate-400">
            支援所有主流瀏覽器彈窗授權
          </p>
        </div>

        {/* 授權白名單說明 */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left">
          <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>已認可之管理員信箱範圍:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {whitelist.map((email: string) => (
              <span key={email} className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                {email}
              </span>
            ))}
          </div>
        </div>

        {/* 本地直通 / 快速登入模式 (如同工讀金系統) */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={() => handleDevBypass('feiye0306@gmail.com')}
            className="text-blue-600 hover:text-blue-700 font-bold hover:underline flex items-center gap-1"
          >
            <Key size={13} />
            <span>管理員直通登入</span>
          </button>

          <button
            onClick={() => setShowDevInput(!showDevInput)}
            className="text-slate-400 hover:text-slate-600 text-[11px]"
          >
            {showDevInput ? '收合自訂' : '切換信箱直通'}
          </button>
        </div>

        {showDevInput && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-left animate-fade-in">
            <label className="text-[11px] font-bold text-slate-600 block">輸入白名單信箱直通:</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="flex-1 text-xs border border-slate-300 rounded-lg px-2 py-1 font-mono"
                placeholder="xxx@gmail.com"
              />
              <button
                onClick={() => handleDevBypass(customEmail)}
                className="bg-blue-600 text-white font-bold text-xs px-3 py-1 rounded-lg hover:bg-blue-700"
              >
                登入
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

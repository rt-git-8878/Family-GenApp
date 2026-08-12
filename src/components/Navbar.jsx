import React from 'react';
import { Home, Users, User, GitFork, Sparkles, Download } from 'lucide-react';

export default function Navbar({ currentTab, onTabChange, onInstallPWA, canInstallPWA }) {
  return (
    <>
      {/* Top Mobile Bar */}
      <header className="fixed top-0 inset-x-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-2.5 max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-black text-sm">
            F
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight leading-none">Family-GenApp</h1>
            <span className="text-[10px] text-indigo-400 font-semibold">ग्राम वंशावली पोर्टल</span>
          </div>
        </div>

        {canInstallPWA && (
          <button
            onClick={onInstallPWA}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            ऐप इंस्टॉल करें
          </button>
        )}
      </header>

      {/* Bottom Mobile Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 px-6 py-2 max-w-lg mx-auto">
        <div className="flex items-center justify-around">
          {/* Tab 1: Directory (Home) */}
          <button
            onClick={() => onTabChange('directory')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'directory'
                ? 'text-indigo-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className={`w-5 h-5 ${currentTab === 'directory' ? 'text-indigo-400' : ''}`} />
            <span className="text-[10px]">निर्देशिका (Home)</span>
          </button>

          {/* Tab 2: Profile */}
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'profile'
                ? 'text-indigo-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className={`w-5 h-5 ${currentTab === 'profile' ? 'text-indigo-400' : ''}`} />
            <span className="text-[10px]">सदस्य विवरण</span>
          </button>

          {/* Tab 3: Family Tree */}
          <button
            onClick={() => onTabChange('tree')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              currentTab === 'tree'
                ? 'text-indigo-400 font-bold scale-105'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitFork className={`w-5 h-5 ${currentTab === 'tree' ? 'text-indigo-400' : ''}`} />
            <span className="text-[10px]">वंशावली वृक्ष</span>
          </button>
        </div>
      </nav>
    </>
  );
}

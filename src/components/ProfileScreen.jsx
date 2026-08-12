import React from 'react';
import { ArrowLeft, GitFork, User, Calendar, Briefcase, Heart, ChevronRight } from 'lucide-react';
import { dataAdapter } from '../services/dataAdapter';

export default function ProfileScreen({ memberId, onBack, onNavigateToTree, onSelectMember }) {
  const member = dataAdapter.getMemberById(memberId) || dataAdapter.getAllMembers()[0];
  const { father, mother } = dataAdapter.getParents(member.Person_ID);
  const spouse = dataAdapter.getSpouse(member.Person_ID);
  const children = dataAdapter.getChildren(member.Person_ID);

  const dobFormatted = member.DOB 
    ? `जन्म तिथि: ${member.DOB}`
    : `जन्म तिथि: उपलब्ध नहीं`;

  return (
    <div className="flex flex-col min-h-screen pb-28 pt-4 px-4 max-w-lg mx-auto animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          वापस (Back)
        </button>

        <span className="text-xs font-bold text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
          पीढ़ी {member.Generation_Level}
        </span>
      </div>

      {/* Main Profile Header Card */}
      <div className="relative mb-6 p-6 rounded-3xl bg-gradient-to-b from-indigo-950/90 via-slate-900 to-slate-900 border border-slate-800 shadow-2xl text-center overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-28 bg-indigo-500/20 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col items-center">
          <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600 shadow-2xl shadow-indigo-500/30 mb-4">
            <img
              src={member.Profile_Image}
              alt={member.Full_Name}
              className="w-full h-full rounded-full object-cover bg-slate-950 border-2 border-slate-900 shadow-inner"
            />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
            {member.Full_Name}
          </h1>

          {member.Marriage_Note && (
            <span className="mt-2 px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
              💍 विवाह स्थिति: {member.Marriage_Note} ({member.Marriages_Count} शादियाँ)
            </span>
          )}

          {member.Notes && member.Notes.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
              {member.Notes.map((note, idx) => (
                <span key={idx} className="px-2.5 py-0.5 text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full">
                  {note}
                </span>
              ))}
            </div>
          )}

          {/* Details list */}
          <div className="w-full mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-left">
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <Calendar className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">जन्म विवरण</div>
                <div className="text-xs font-bold text-white truncate">{dobFormatted}</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <Briefcase className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">व्यवसाय / पद</div>
                <div className="text-xs font-bold text-white truncate">{member.Occupation || 'कृषि / सेवा'}</div>
              </div>
            </div>
          </div>

          {/* PRIMARY ACTION BUTTON: View Family Tree */}
          <button
            onClick={() => onNavigateToTree(member.Person_ID)}
            className="w-full mt-5 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <GitFork className="w-5 h-5 text-amber-300" />
            पारिवारिक वृक्ष देखें (View Family Tree)
          </button>
        </div>
      </div>

      {/* QUICK LINKS SECTION */}
      <div className="mb-6">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 px-1">
          मुख्य रिश्ते (Key Relationships)
        </h3>

        <div className="grid grid-cols-1 gap-2.5">
          {father ? (
            <div
              onClick={() => onSelectMember(father.Person_ID)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <img src={father.Profile_Image} alt={father.Full_Name} className="w-10 h-10 rounded-full border border-indigo-500/40" />
                <div>
                  <div className="text-[11px] font-bold text-indigo-400 uppercase">पिता (View Father)</div>
                  <div className="text-sm font-bold text-white group-hover:text-indigo-300">{father.Full_Name}</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/50 text-xs text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-600" />
              पिता विवरण: मूल पुरुष / अभिलेख में नहीं
            </div>
          )}

          {spouse ? (
            <div
              onClick={() => onSelectMember(spouse.Person_ID)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <img src={spouse.Profile_Image} alt={spouse.Full_Name} className="w-10 h-10 rounded-full border border-pink-500/40" />
                <div>
                  <div className="text-[11px] font-bold text-pink-400 uppercase">जीवनसाथी (View Spouse)</div>
                  <div className="text-sm font-bold text-white group-hover:text-pink-300">{spouse.Full_Name}</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/50 text-xs text-slate-500 flex items-center gap-2">
              <Heart className="w-4 h-4 text-slate-600" />
              जीवनसाथी विवरण: उपलब्ध नहीं है
            </div>
          )}
        </div>
      </div>

      {/* Children Section */}
      {children.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center justify-between">
            <span>संतान (Children - {children.length})</span>
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            {children.map(child => (
              <div
                key={child.Person_ID}
                onClick={() => onSelectMember(child.Person_ID)}
                className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer group"
              >
                <img src={child.Profile_Image} alt={child.Full_Name} className="w-9 h-9 rounded-full border border-slate-700" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">{child.Full_Name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{child.DOB ? child.DOB : 'उपलब्ध नहीं'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

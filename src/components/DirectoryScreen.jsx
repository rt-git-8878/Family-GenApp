import React, { useState, useMemo } from 'react';
import { Search, Users, Sparkles, ChevronRight, Calendar } from 'lucide-react';
import { dataAdapter } from '../services/dataAdapter';

export default function DirectoryScreen({ onSelectMember, onNavigateToTree }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenFilter, setSelectedGenFilter] = useState('ALL');

  const allMembers = useMemo(() => dataAdapter.getAllMembers(), []);
  const stats = useMemo(() => dataAdapter.getStats(), []);

  const generations = useMemo(() => {
    return [...new Set(allMembers.map(m => m.Generation_Level))].sort((a, b) => a - b);
  }, [allMembers]);

  const filteredMembers = useMemo(() => {
    let result = dataAdapter.searchMembers(searchQuery);
    if (selectedGenFilter !== 'ALL') {
      const genNum = parseInt(selectedGenFilter, 10);
      result = result.filter(m => m.Generation_Level === genNum);
    }
    return result;
  }, [searchQuery, selectedGenFilter]);

  return (
    <div className="flex flex-col min-h-screen pb-28 pt-4 px-4 max-w-lg mx-auto">
      {/* Header & Village Stats */}
      <div className="relative mb-5 p-5 rounded-3xl bg-gradient-to-br from-indigo-900/80 via-slate-900 to-indigo-950/90 border border-indigo-500/20 shadow-xl overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">गांव परिवार निर्देशिका</h1>
              <p className="text-xs text-indigo-300 font-medium">Family-GenApp Directory</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {stats.totalMembers} सदस्य
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-indigo-500/10 text-center">
          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400">कुल सदस्य</div>
            <div className="text-base font-extrabold text-white">{stats.totalMembers}</div>
          </div>
          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400">पीढ़ियाँ</div>
            <div className="text-base font-extrabold text-indigo-400">{stats.totalGenerations}</div>
          </div>
          <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400">मूल वंशज</div>
            <div className="text-xs font-bold text-amber-300 truncate">देव चरण</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sticky top-2 z-30 mb-4">
        <div className="relative flex items-center shadow-2xl">
          <Search className="absolute left-4 w-5 h-5 text-indigo-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="नाम या 'तीन शादी' से खोजें (Search)..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-900/90 backdrop-blur-xl border-2 border-indigo-500/30 focus:border-indigo-500 rounded-2xl text-slate-100 placeholder-slate-400 text-sm font-medium outline-none transition-all shadow-lg focus:ring-4 focus:ring-indigo-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded-md hover:text-white"
            >
              साफ़ करें
            </button>
          )}
        </div>
      </div>

      {/* Generation Filter Chips */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedGenFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
            selectedGenFilter === 'ALL'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          सभी पीढ़ियाँ ({allMembers.length})
        </button>
        {generations.map(gen => (
          <button
            key={gen}
            onClick={() => setSelectedGenFilter(String(gen))}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              selectedGenFilter === String(gen)
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            पीढ़ी {gen}
          </button>
        ))}
      </div>

      {/* Member List Counter */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          सदस्य सूची ({filteredMembers.length})
        </span>
      </div>

      {/* Scrollable List View of Village Members */}
      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 my-4">
          <Users className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-300">कोई सदस्य नहीं मिला</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredMembers.map((member) => {
            const father = member.Father_ID ? dataAdapter.getMemberById(member.Father_ID) : null;
            return (
              <div
                key={member.Person_ID}
                onClick={() => onSelectMember(member.Person_ID)}
                className="group relative flex items-center justify-between p-3.5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img
                      src={member.Profile_Image}
                      alt={member.Full_Name}
                      className="w-13 h-13 rounded-full object-cover bg-slate-800 border-2 border-indigo-500/30 group-hover:border-indigo-400 transition-colors shadow-inner"
                    />
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-slate-950 text-indigo-300 text-[10px] font-bold rounded-md border border-slate-800">
                      P{member.Generation_Level}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {member.Full_Name}
                      </h3>
                      {member.Marriage_Note && (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md whitespace-nowrap">
                          💍 {member.Marriage_Note}
                        </span>
                      )}
                    </div>
                    
                    {/* Only show DOB if person has DOB in JSON, otherwise hide line entirely on Home Page */}
                    {member.DOB ? (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-indigo-300 font-semibold">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        {member.DOB}
                      </div>
                    ) : (
                      father ? (
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          पिता: <strong className="text-slate-300 font-medium">{father.Full_Name}</strong>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pl-2">
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { GitFork, ZoomIn, ZoomOut, RotateCcw, ChevronUp, ChevronDown, User, Sparkles, Search, Layers, Maximize2 } from 'lucide-react';
import { dataAdapter } from '../services/dataAdapter';

export default function FamilyTreeScreen({ focusPersonId, onSelectMember, onOpenModal }) {
  const [currentFocusId, setCurrentFocusId] = useState(focusPersonId || 'P_001');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Sync focus person if prop changes
  React.useEffect(() => {
    if (focusPersonId) {
      setCurrentFocusId(focusPersonId);
    }
  }, [focusPersonId]);

  // Compute 3-generation lineage based on currentFocusId
  const lineage = useMemo(() => {
    return dataAdapter.get3GenLineage(currentFocusId);
  }, [currentFocusId]);

  const { focus, father, mother, grandFather, grandMother, children, siblings } = lineage;

  // Handler when any node in the tree is tapped
  const handleNodeClick = (personId) => {
    if (!personId) return;
    if (personId === currentFocusId) {
      // If clicking already focused person, open their modal card
      onOpenModal(personId);
    } else {
      // Instantly refocus the tree layout around the tapped person
      setCurrentFocusId(personId);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-28 pt-4 px-3 max-w-lg mx-auto select-none">
      {/* Top Header & Refocus Controls */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
            <GitFork className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight">पारिवारिक वृक्ष (3-Gen Lineage)</h2>
            <p className="text-[11px] text-slate-400">टैप करके केंद्र बदलें (Tap node to refocus)</p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 1.4))}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs font-bold"
            title="Reset Zoom"
          >
            100%
          </button>
          <button
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.75))}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Focus Member Badge */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 mb-4 shadow-lg">
        <div className="flex items-center gap-2.5">
          <img src={focus.Profile_Image} alt={focus.Full_Name} className="w-8 h-8 rounded-full border border-indigo-400" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">वर्तमान केंद्र:</span>
            <div className="text-sm font-bold text-white leading-tight">{focus.Full_Name}</div>
          </div>
        </div>
        <button
          onClick={() => onOpenModal(focus.Person_ID)}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md"
        >
          प्रोफ़ाइल कार्ड
        </button>
      </div>

      {/* GRAPHICAL TREE CONTAINER */}
      <div 
        className="relative flex-1 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-900/90 rounded-3xl border border-slate-800 p-4 shadow-2xl overflow-x-auto min-h-[460px] flex flex-col justify-between transition-transform duration-300"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
      >
        {/* Ambient SVG Connectors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>

        {/* LAYER 1: ANCESTORS (Grandparents & Parents) */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/40">
            <ChevronUp className="w-3 h-3 text-indigo-400" /> पूर्वज (Generation +1 / +2)
          </div>

          {/* Grandparents Row */}
          <div className="flex justify-center gap-4">
            {grandFather ? (
              <div
                onClick={() => handleNodeClick(grandFather.Person_ID)}
                className="flex flex-col items-center p-2 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer shadow-md group"
              >
                <img src={grandFather.Profile_Image} alt={grandFather.Full_Name} className="w-9 h-9 rounded-full border border-indigo-500/40" />
                <span className="text-[10px] text-slate-400 font-semibold mt-1">दादा</span>
                <span className="text-xs font-bold text-white group-hover:text-indigo-300 max-w-[90px] truncate">{grandFather.Full_Name}</span>
              </div>
            ) : (
              <div className="p-2 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-center opacity-60">
                <span className="text-[10px] text-slate-500 block">दादा (Grandfather)</span>
                <span className="text-xs text-slate-600">अभिलेख नहीं</span>
              </div>
            )}
          </div>

          {/* Vertical Connecting Line */}
          <div className="w-0.5 h-4 bg-gradient-to-b from-indigo-500 to-indigo-400 rounded-full" />

          {/* Parents Row */}
          <div className="flex justify-center gap-4">
            {father ? (
              <div
                onClick={() => handleNodeClick(father.Person_ID)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 transition-all cursor-pointer shadow-lg group hover:scale-105"
              >
                <img src={father.Profile_Image} alt={father.Full_Name} className="w-10 h-10 rounded-full border-2 border-indigo-400 shadow-md" />
                <div className="text-left">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase block">पिता (Father)</span>
                  <span className="text-xs font-extrabold text-white group-hover:text-indigo-300">{father.Full_Name}</span>
                  <span className="text-[10px] text-slate-400 block">~{father.Birth_Year}</span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-xs text-slate-500">
                पिता: मूल पुरुष (Patriarch)
              </div>
            )}
          </div>
        </div>

        {/* Vertical Connector to Focus Node */}
        <div className="relative z-0 flex justify-center my-1">
          <div className="w-0.5 h-6 bg-gradient-to-b from-indigo-400 via-indigo-500 to-amber-400" />
        </div>

        {/* LAYER 2: FOCUS PERSON & SPOUSE (Center) */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative p-4 rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 border-2 border-amber-400/80 shadow-2xl shadow-amber-400/10 flex items-center gap-3 max-w-full">
            <div className="relative">
              <img
                src={focus.Profile_Image}
                alt={focus.Full_Name}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-300 shadow-xl"
              />
              <span className="absolute -top-2 -right-1 px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full shadow-md">
                केंद्र
              </span>
            </div>

            <div className="text-left">
              <h3 className="text-base font-black text-white leading-tight">
                {focus.Full_Name}
              </h3>
              <p className="text-xs font-semibold text-indigo-300 mt-0.5">
                {focus.DOB ? focus.DOB : `जन्म: ~${focus.Birth_Year}`}
              </p>
              <div className="flex gap-1 mt-1">
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-400/30">
                  पीढ़ी {focus.Generation_Level}
                </span>
                {focus.Notes?.[0] && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md border border-amber-400/30">
                    {focus.Notes[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical Connector to Children */}
        <div className="relative z-0 flex justify-center my-1">
          <div className="w-0.5 h-6 bg-gradient-to-b from-amber-400 via-indigo-500 to-emerald-400" />
        </div>

        {/* LAYER 3: DESCENDANTS / CHILDREN (Below) */}
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
            <ChevronDown className="w-3 h-3 text-emerald-400" /> संतान (Children - {children.length})
          </div>

          {children.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2 max-w-full">
              {children.map(child => (
                <div
                  key={child.Person_ID}
                  onClick={() => handleNodeClick(child.Person_ID)}
                  className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 transition-all cursor-pointer shadow-md group hover:scale-105"
                >
                  <img src={child.Profile_Image} alt={child.Full_Name} className="w-8 h-8 rounded-full border border-emerald-500/40" />
                  <div className="text-left max-w-[90px] truncate">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 truncate block">{child.Full_Name}</span>
                    <span className="text-[10px] text-slate-400 block">~{child.Birth_Year}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-2 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-xs text-slate-500">
              कोई संतान दर्ज नहीं (End of branch)
            </div>
          )}
        </div>
      </div>

      {/* Siblings Bar (Quick Jump) */}
      {siblings.length > 0 && (
        <div className="mt-4 p-3 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">भाई-बहन (Siblings):</div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {siblings.map(sib => (
              <button
                key={sib.Person_ID}
                onClick={() => handleNodeClick(sib.Person_ID)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-indigo-600 text-slate-200 hover:text-white text-xs font-semibold whitespace-nowrap transition-all border border-slate-700/50"
              >
                <img src={sib.Profile_Image} alt={sib.Full_Name} className="w-5 h-5 rounded-full" />
                {sib.Full_Name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

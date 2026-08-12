import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DirectoryScreen from './components/DirectoryScreen';
import ProfileScreen from './components/ProfileScreen';
import FamilyTreeScreen from './components/FamilyTreeScreen';
import MemberProfileModal from './components/MemberProfileModal';
import { dataAdapter } from './services/dataAdapter';

export default function App() {
  const [currentTab, setCurrentTab] = useState('directory'); // 'directory' | 'profile' | 'tree'
  const [selectedMemberId, setSelectedMemberId] = useState('P_001'); // Default Dev Charan
  const [modalMemberId, setModalMemberId] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Open modal or navigate when a member is selected
  const handleSelectMember = (personId) => {
    setSelectedMemberId(personId);
    setModalMemberId(personId);
  };

  const handleNavigateToTree = (personId) => {
    setSelectedMemberId(personId);
    setCurrentTab('tree');
    setModalMemberId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative pt-14">
      {/* Top Navbar Header & Bottom Tab Bar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        onInstallPWA={handleInstallPWA}
        canInstallPWA={!!deferredPrompt}
      />

      {/* Main Screen Views */}
      <main className="w-full">
        {currentTab === 'directory' && (
          <DirectoryScreen
            onSelectMember={handleSelectMember}
            onNavigateToTree={handleNavigateToTree}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen
            memberId={selectedMemberId}
            onBack={() => setCurrentTab('directory')}
            onNavigateToTree={handleNavigateToTree}
            onSelectMember={handleSelectMember}
          />
        )}

        {currentTab === 'tree' && (
          <FamilyTreeScreen
            focusPersonId={selectedMemberId}
            onSelectMember={handleSelectMember}
            onOpenModal={(id) => setModalMemberId(id)}
          />
        )}
      </main>

      {/* Member Profile Modal Card (Popup as requested) */}
      {modalMemberId && (
        <MemberProfileModal
          memberId={modalMemberId}
          onClose={() => setModalMemberId(null)}
          onNavigateToTree={handleNavigateToTree}
          onSelectMember={(id) => {
            setSelectedMemberId(id);
            setModalMemberId(id);
          }}
        />
      )}
    </div>
  );
}

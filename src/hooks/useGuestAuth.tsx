import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GuestUser {
  id: string;
  name: string;
  isGuest: true;
}

interface GuestAuthContextType {
  guestUser: GuestUser | null;
  loginAsGuest: (guestId: string, guestName: string) => void;
  logoutGuest: () => void;
}

const GuestAuthContext = createContext<GuestAuthContextType | undefined>(undefined);

export const useGuestAuth = () => {
  const context = useContext(GuestAuthContext);
  if (context === undefined) {
    throw new Error('useGuestAuth must be used within a GuestAuthProvider');
  }
  return context;
};

interface GuestAuthProviderProps {
  children: ReactNode;
}

export const GuestAuthProvider = ({ children }: GuestAuthProviderProps) => {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);

  // Load guest session from localStorage on mount
  useEffect(() => {
    const savedGuest = localStorage.getItem('guestSession');
    if (savedGuest) {
      try {
        const guest = JSON.parse(savedGuest);
        setGuestUser(guest);
      } catch (error) {
        console.error('Error loading guest session:', error);
        localStorage.removeItem('guestSession');
      }
    }
  }, []);

  const loginAsGuest = (guestId: string, guestName: string) => {
    const guest: GuestUser = {
      id: guestId,
      name: guestName,
      isGuest: true,
    };
    
    setGuestUser(guest);
    localStorage.setItem('guestSession', JSON.stringify(guest));
    localStorage.setItem('lastGuest', JSON.stringify({ id: guestId, name: guestName }));
  };

  const logoutGuest = () => {
    // Preserve last used guest so user can re-login easily
    if (guestUser) {
      localStorage.setItem('lastGuest', JSON.stringify({ id: guestUser.id, name: guestUser.name }));
    }
    setGuestUser(null);
    localStorage.removeItem('guestSession');
  };

  return (
    <GuestAuthContext.Provider value={{ guestUser, loginAsGuest, logoutGuest }}>
      {children}
    </GuestAuthContext.Provider>
  );
};
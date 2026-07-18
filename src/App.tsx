import { useState, useEffect } from 'react';
import type { BeerEvent, BeerDrink } from './types';
import { StatsHeader } from './components/StatsHeader';
import { EventCard } from './components/EventCard';
import { EventModal } from './components/EventModal';
import { EventDetailScreen } from './components/EventDetailScreen';
import { AuthScreen } from './components/AuthScreen';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { UserProfileScreen } from './components/UserProfileScreen';
import { Beer, Plus, Search, Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import './App.css';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('keg_swap_theme') as 'light' | 'dark') || 'light';
  });

  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState<BeerEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BeerEvent['status']>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [cookieConsent, setCookieConsent] = useState<{ necessary: boolean; preferences: boolean } | null>(() => {
    const saved = localStorage.getItem('keg_swap_cookie_consent');
    return saved ? JSON.parse(saved) : null;
  });
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaColorScheme) {
      metaColorScheme.setAttribute('content', theme === 'dark' ? 'dark' : 'light dark');
    }
    if (cookieConsent && cookieConsent.preferences) {
      localStorage.setItem('keg_swap_theme', theme);
    } else {
      localStorage.removeItem('keg_swap_theme');
    }
  }, [theme, cookieConsent]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleAcceptAllCookies = () => {
    const consentVal = { necessary: true, preferences: true };
    setCookieConsent(consentVal);
    localStorage.setItem('keg_swap_cookie_consent', JSON.stringify(consentVal));
  };

  const handleRejectNonEssentialCookies = () => {
    const consentVal = { necessary: true, preferences: false };
    setCookieConsent(consentVal);
    localStorage.setItem('keg_swap_cookie_consent', JSON.stringify(consentVal));
  };

  const handleSaveCustomConsent = (preferencesAccepted: boolean) => {
    const consentVal = { necessary: true, preferences: preferencesAccepted };
    setCookieConsent(consentVal);
    localStorage.setItem('keg_swap_cookie_consent', JSON.stringify(consentVal));
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Events Sync & Seeding
  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        try {
        } catch (seedErr) {
          console.error('Failed to seed events collection:', seedErr);
        }
        return;
      }

      const fetchedEvents: BeerEvent[] = [];
      snapshot.forEach((docSnapshot) => {
        fetchedEvents.push({ 
          id: docSnapshot.id, 
          ...docSnapshot.data() 
        } as BeerEvent);
      });
      setEvents(fetchedEvents);
    }, (err) => {
      console.error("Firestore events snapshot error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddEvent = async (eventData: Omit<BeerEvent, 'id'>) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'events'), {
        name: eventData.name,
        date: eventData.date,
        ...(eventData.endDate ? { endDate: eventData.endDate } : {}),
        address: eventData.address,
        status: eventData.status,
        drinks: [],
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to add event to Firestore:', err);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      if (activeEventId === id) {
        setActiveEventId(null);
      }
    } catch (err) {
      console.error('Failed to delete event from Firestore:', err);
    }
  };

  const handleStatusChange = async (id: string, newStatus: BeerEvent['status']) => {
    try {
      await updateDoc(doc(db, 'events', id), { status: newStatus });
    } catch (err) {
      console.error('Failed to update event status in Firestore:', err);
    }
  };

  const handleAddReview = async (eventId: string, drinkId: string, reviewer: string, rating: number, comment: string) => {
    const newReview = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      reviewer,
      rating,
      comment,
      createdAt: new Date().toISOString(),
      userId: user?.uid,
    };

    const eventToUpdate = events.find((e) => e.id === eventId);
    if (!eventToUpdate) return;

    try {
      const updatedDrinks = (eventToUpdate.drinks || []).map((drink) => {
        if (drink.id !== drinkId) return drink;
        return {
          ...drink,
          reviews: [newReview, ...drink.reviews],
        };
      });

      await updateDoc(doc(db, 'events', eventId), { drinks: updatedDrinks });
    } catch (err) {
      console.error('Failed to add review in Firestore:', err);
    }
  };

  const handleToggleAttendance = async (eventId: string) => {
    if (!user) return;
    const eventToUpdate = events.find((e) => e.id === eventId);
    if (!eventToUpdate) return;

    const currentAttendees = eventToUpdate.attendees || [];
    const isAttending = currentAttendees.includes(user.uid);
    const updatedAttendees = isAttending
      ? currentAttendees.filter((uid) => uid !== user.uid)
      : [...currentAttendees, user.uid];

    try {
      await updateDoc(doc(db, 'events', eventId), { attendees: updatedAttendees });
    } catch (err) {
      console.error('Failed to update event attendance in Firestore:', err);
    }
  };

  const handleAddDrink = async (eventId: string, drinkData: Omit<BeerDrink, 'id' | 'reviews'>) => {
    const newDrink: BeerDrink = {
      ...drinkData,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      reviews: [],
    };

    const eventToUpdate = events.find((e) => e.id === eventId);
    if (!eventToUpdate) return;

    try {
      const updatedDrinks = [...(eventToUpdate.drinks || []), newDrink];
      await updateDoc(doc(db, 'events', eventId), { drinks: updatedDrinks });
    } catch (err) {
      console.error('Failed to add drink in Firestore:', err);
    }
  };

  const handleAddDrinksBatch = async (eventId: string, drinksData: Omit<BeerDrink, 'id' | 'reviews'>[]) => {
    const newDrinks: BeerDrink[] = drinksData.map(drinkData => ({
      ...drinkData,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
      reviews: [],
    }));

    const eventToUpdate = events.find((e) => e.id === eventId);
    if (!eventToUpdate) return;

    try {
      const updatedDrinks = [...(eventToUpdate.drinks || []), ...newDrinks];
      await updateDoc(doc(db, 'events', eventId), { drinks: updatedDrinks });
    } catch (err) {
      console.error('Failed to batch add drinks in Firestore:', err);
    }
  };

  // Filter events based on search query and status filter
  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeEvent = events.find((e) => e.id === activeEventId);

  if (authLoading) {
    return (
      <div className="auth-container-wrapper">
        <div className="loading-container">
          <Beer className="auth-brand-logo animate-float" size={48} />
          <h3>Loading Keg Swap...</h3>
          <p>Connecting to Firebase services</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-page-wrapper">
        <AuthScreen />
        <footer className="auth-footer-links">
          <button type="button" className="footer-link-btn" onClick={() => setIsPolicyOpen(true)}>
            Privacy Policy & Cookie Settings
          </button>
        </footer>
        <CookieConsent
          isVisible={cookieConsent === null}
          onAcceptAll={handleAcceptAllCookies}
          onRejectAll={handleRejectNonEssentialCookies}
          onOpenSettings={() => setIsPolicyOpen(true)}
        />
        <PrivacyPolicyModal
          isOpen={isPolicyOpen}
          onClose={() => setIsPolicyOpen(false)}
          consent={cookieConsent || { necessary: true, preferences: false }}
          onSaveConsent={handleSaveCustomConsent}
        />
      </div>
    );
  }

  if (activeEvent) {
    return (
      <div className="app-container">
        {/* Header section with beer theme */}
        <header className="app-header">
          <div className="brand" onClick={() => { setActiveEventId(null); setShowProfile(false); }} style={{ cursor: 'pointer' }}>
            <div className="logo-container">
              <Beer className="brand-logo" size={32} />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Keg Swap</h1>
              <p className="brand-subtitle">Beer & Ale Events Board</p>
            </div>
          </div>
          
          <div className="header-actions">
            <button
              type="button"
              className={`btn-user-profile ${showProfile ? 'active' : ''}`}
              onClick={() => {
                setShowProfile(true);
                setActiveEventId(null);
              }}
              title="View Profile"
            >
              <UserIcon size={14} />
              <span>{user.displayName || user.email}</span>
            </button>

            <button
              type="button"
              className="btn-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button
              type="button"
              className="btn-logout"
              onClick={() => {
                signOut(auth);
                setActiveEventId(null);
                setShowProfile(false);
              }}
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        <main className="app-main">
          <EventDetailScreen
            event={activeEvent}
            user={user}
            onBack={() => setActiveEventId(null)}
            onAddDrink={(drinkData) => handleAddDrink(activeEvent.id, drinkData)}
            onAddReview={(drinkId, reviewer, rating, comment) =>
              handleAddReview(activeEvent.id, drinkId, reviewer, rating, comment)
            }
            onAddDrinksBatch={(drinksData) => handleAddDrinksBatch(activeEvent.id, drinksData)}
            onToggleAttendance={handleToggleAttendance}
          />
        </main>

        <footer className="app-footer">
          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={() => setIsPolicyOpen(true)}>
              Privacy Policy & Cookie Settings
            </button>
          </div>
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} Keg Swap. All rights reserved.
          </p>
        </footer>

        <CookieConsent
          isVisible={cookieConsent === null}
          onAcceptAll={handleAcceptAllCookies}
          onRejectAll={handleRejectNonEssentialCookies}
          onOpenSettings={() => setIsPolicyOpen(true)}
        />
        <PrivacyPolicyModal
          isOpen={isPolicyOpen}
          onClose={() => setIsPolicyOpen(false)}
          consent={cookieConsent || { necessary: true, preferences: false }}
          onSaveConsent={handleSaveCustomConsent}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header section with beer theme */}
      <header className="app-header">
        <div className="brand" onClick={() => { setActiveEventId(null); setShowProfile(false); }} style={{ cursor: 'pointer' }}>
          <div className="logo-container">
            <Beer className="brand-logo" size={32} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">Keg Swap</h1>
            <p className="brand-subtitle">Beer & Ale Events Board</p>
          </div>
        </div>
        
        <div className="header-actions">
          <button
            type="button"
            className={`btn-user-profile ${showProfile ? 'active' : ''}`}
            onClick={() => {
              setShowProfile(true);
              setActiveEventId(null);
            }}
            title="View Profile"
          >
            <UserIcon size={14} />
            <span>{user.displayName || user.email}</span>
          </button>

          <button
            type="button"
            className="btn-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          <button
            type="button"
            className="btn-logout"
            onClick={() => {
              signOut(auth);
              setActiveEventId(null);
              setShowProfile(false);
            }}
            title="Sign Out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
          
          <button
            type="button"
            className="btn-create-header"
            onClick={() => setIsModalOpen(true)}
            id="btn-add-event-desktop"
            aria-label="Add new event"
          >
            <Plus size={18} />
            <span>New Event</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        {showProfile ? (
          <UserProfileScreen
            user={user}
            events={events}
            onBack={() => setShowProfile(false)}
            onNavigateToEvent={(eventId) => {
              setShowProfile(false);
              setActiveEventId(eventId);
            }}
          />
        ) : (
          <>
            {/* Statistics Dashboard */}
            <section className="stats-section">
              <StatsHeader events={events} />
            </section>

            {/* Filters and Actions Toolbar */}
            <section className="toolbar-section">
              <div className="toolbar">
                {/* Search inputs */}
                <div className="search-bar">
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    placeholder="Search events by name or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    id="search-events-input"
                    aria-label="Search events by name or location"
                  />
                </div>

                {/* Filter segments (horizontal tab buttons) */}
                <div className="filter-tabs" role="tablist" aria-label="Filter events by status">
                  {(['All', 'Upcoming', 'Ongoing', 'Completed', 'Cancelled'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === status}
                      onClick={() => setStatusFilter(status)}
                      className={`filter-tab-btn ${statusFilter === status ? 'active' : ''}`}
                      id={`filter-tab-${status}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Events Feed / Grid */}
            <section className="events-section">
              {filteredEvents.length > 0 ? (
                <div className="events-grid">
                  {filteredEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      user={user}
                      onDelete={handleDeleteEvent}
                      onStatusChange={handleStatusChange}
                      onSelect={() => setActiveEventId(event.id)}
                      onToggleAttendance={handleToggleAttendance}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Beer className="empty-icon animate-float" size={48} />
                  <h3>No events found</h3>
                  <p>
                    {searchQuery || statusFilter !== 'All'
                      ? "We couldn't find any events matching your search or filters. Try adjusting them!"
                      : "There are no events registered. Be the first to brew up a new one!"}
                  </p>
                  {(searchQuery || statusFilter !== 'All') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                      className="btn-secondary"
                      id="reset-filters-btn"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Sticky Bottom Add Button (Mobile-first UX) */}
      <button
        type="button"
        className="mobile-sticky-add-btn"
        onClick={() => setIsModalOpen(true)}
        aria-label="Create new event"
        id="btn-add-event-mobile"
      >
        <Plus size={24} />
      </button>

      {/* Add Event Dialog Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddEvent}
      />

      <footer className="app-footer">
        <div className="footer-links">
          <button type="button" className="footer-link-btn" onClick={() => setIsPolicyOpen(true)}>
            Privacy Policy & Cookie Settings
          </button>
        </div>
        <p className="footer-copyright">
          &copy; {new Date().getFullYear()} Keg Swap. All rights reserved.
        </p>
      </footer>

      <CookieConsent
        isVisible={cookieConsent === null}
        onAcceptAll={handleAcceptAllCookies}
        onRejectAll={handleRejectNonEssentialCookies}
        onOpenSettings={() => setIsPolicyOpen(true)}
      />
      <PrivacyPolicyModal
        isOpen={isPolicyOpen}
        onClose={() => setIsPolicyOpen(false)}
        consent={cookieConsent || { necessary: true, preferences: false }}
        onSaveConsent={handleSaveCustomConsent}
      />
    </div>
  );
}

export default App;

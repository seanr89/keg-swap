import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { BeerEvent, BeerDrink } from './types';
import { StatsHeader } from './components/StatsHeader';
import { EventCard } from './components/EventCard';
import { EventModal } from './components/EventModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { AuthScreen } from './components/AuthScreen';
import { CookieConsent } from './components/CookieConsent';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { UserSearchModal } from './components/UserSearchModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Beer, Plus, Search, User as UserIcon, ShieldAlert } from 'lucide-react';
import { parseLocalDate } from './utils/dateUtils';
import { useAuth } from './hooks/useAuth';
import { useEvents } from './hooks/useEvents';
import { useLocations } from './hooks/useLocations';
import { useEventDrinks } from './hooks/useEventDrinks';
import './App.css';

// Heavy screens are only needed after sign-in and navigation, so load them on demand.
const EventDetailScreen = lazy(() => import('./components/EventDetailScreen').then(m => ({ default: m.EventDetailScreen })));
const UserProfileScreen = lazy(() => import('./components/UserProfileScreen').then(m => ({ default: m.UserProfileScreen })));
const AdminScreen = lazy(() => import('./components/AdminScreen').then(m => ({ default: m.AdminScreen })));

const ScreenFallback = () => (
  <div className="loading-container" role="status" aria-live="polite">
    <Beer className="animate-float" size={32} />
    <p>Loading...</p>
  </div>
);

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('keg_swap_theme') as 'light' | 'dark') || 'dark';
  });

  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSection, setProfileSection] = useState<'overview' | 'diary'>('overview');
  const [showAdmin, setShowAdmin] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BeerEvent['status']>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventPendingDelete, setEventPendingDelete] = useState<BeerEvent | null>(null);

  const {
    user,
    userProfile,
    allUsers,
    authLoading,
    isAdmin,
    signOutUser,
    togglePrivacy: handleTogglePrivacy,
    addFriend: handleAddFriend,
    removeFriend: handleRemoveFriend,
  } = useAuth();

  const {
    events,
    canDeleteEvent,
    addEvent,
    deleteEvent,
    updateStatus: handleStatusChange,
    toggleAttendance: handleToggleAttendance,
    addDrink: handleAddDrink,
    addDrinksBatch: handleAddDrinksBatch,
    addDrinkReview,
    seedTestEvent: handleSeedTestEvent,
  } = useEvents(user, isAdmin);

  const {
    locations,
    saveLocation: handleSaveLocation,
    deleteLocation: handleDeleteLocation,
  } = useLocations(user);

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
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0c0a09' : '#f7f5f0');
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

  const handleSignOut = () => {
    void signOutUser();
    setActiveEventId(null);
    setShowProfile(false);
    setShowAdmin(false);
  };

  const handleNavigateToAdmin = () => {
    setShowAdmin(true);
    setShowProfile(false);
    setActiveEventId(null);
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

  const handleAddEvent = async (
    eventData: Omit<BeerEvent, 'id'>,
    initialDrinks?: Omit<BeerDrink, 'id' | 'reviews'>[]
  ) => {
    const created = await addEvent(eventData, initialDrinks);
    if (created) {
      setIsModalOpen(false);
    }
  };

  const handleConfirmDeleteEvent = async () => {
    const event = eventPendingDelete;
    setEventPendingDelete(null);
    if (!event) return;
    const deleted = await deleteEvent(event);
    if (deleted && activeEventId === event.id) {
      setActiveEventId(null);
    }
  };

  // Filter events based on search query and status filter
  const filteredEvents = events
    .filter((event) => {
      const matchesSearch =
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || event.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const now = Date.now();
      const timeA = parseLocalDate(a.date).getTime();
      const timeB = parseLocalDate(b.date).getTime();
      const diffA = Math.abs(timeA - now);
      const diffB = Math.abs(timeB - now);
      return diffA - diffB;
    });

  const baseActiveEvent = events.find((e) => e.id === activeEventId);
  const { drinks: activeDrinks, loading: drinksLoading } = useEventDrinks(
    baseActiveEvent ? baseActiveEvent.id : null,
    baseActiveEvent?.drinks
  );
  const activeEvent = useMemo(
    () => (baseActiveEvent ? { ...baseActiveEvent, drinks: activeDrinks } : undefined),
    [baseActiveEvent, activeDrinks]
  );

  const handleAddReview = async (
    eventId: string,
    drinkId: string,
    reviewer: string,
    rating: number,
    comment: string,
    price?: string,
    servingSize?: string,
    imageUrl?: string,
    reviewId?: string,
    tags?: string[]
  ) => {
    const drink = activeDrinks.find((d) => d.id === drinkId);
    await addDrinkReview(
      eventId,
      drink,
      reviewer,
      rating,
      comment,
      price,
      servingSize,
      imageUrl,
      reviewId,
      tags
    );
  };

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
                setProfileSection('overview');
                setActiveEventId(null);
                setShowAdmin(false);
              }}
              title="View Profile"
            >
              <UserIcon size={14} />
              <span>{user.displayName || user.email}</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                className="btn-admin"
                onClick={() => {
                  setShowAdmin(true);
                  setShowProfile(false);
                  setActiveEventId(null);
                }}
                title="Admin Panel"
                aria-label="Open Admin Panel"
              >
                <ShieldAlert size={16} />
                <span>Admin</span>
              </button>
            )}
          </div>
        </header>

        <main className="app-main">
          <Suspense fallback={<ScreenFallback />}>
            <EventDetailScreen
              event={activeEvent}
              drinksLoading={drinksLoading}
              user={user}
              onBack={() => setActiveEventId(null)}
              onAddDrink={(drinkData) => handleAddDrink(activeEvent.id, drinkData)}
              onAddReview={(drinkId, reviewer, rating, comment, price, servingSize, imageUrl, reviewId, tags) =>
                handleAddReview(activeEvent.id, drinkId, reviewer, rating, comment, price, servingSize, imageUrl, reviewId, tags)
              }
              onAddDrinksBatch={(drinksData) => handleAddDrinksBatch(activeEvent.id, drinksData)}
              onToggleAttendance={handleToggleAttendance}
            />
          </Suspense>
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
        <EventModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddEvent}
          locations={locations}
        />
        {user && (
          <UserSearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            currentUserId={user.uid}
            currentUserFriends={userProfile?.friends || []}
            publicUsers={allUsers}
            onAddFriend={handleAddFriend}
            onRemoveFriend={handleRemoveFriend}
          />
        )}

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={
            showProfile
              ? (profileSection === 'diary' ? 'diary' : 'profile')
              : (!showAdmin && !activeEventId ? 'events' : null)
          }
          onSelectEvents={() => {
            setActiveEventId(null);
            setShowProfile(false);
            setShowAdmin(false);
          }}
          onOpenFriends={() => setIsSearchModalOpen(true)}
          onAddEvent={() => setIsModalOpen(true)}
          onSelectDiary={() => {
            setProfileSection('diary');
            setShowProfile(true);
            setActiveEventId(null);
            setShowAdmin(false);
          }}
          onSelectProfile={() => {
            setProfileSection('overview');
            setShowProfile(true);
            setActiveEventId(null);
            setShowAdmin(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header section with beer theme */}
      <header className="app-header">
        <div className="brand" onClick={() => { setActiveEventId(null); setShowProfile(false); setShowAdmin(false); }} style={{ cursor: 'pointer' }}>
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
              setProfileSection('overview');
              setActiveEventId(null);
              setShowAdmin(false);
            }}
            title="View Profile"
          >
            <UserIcon size={14} />
            <span>{user.displayName || user.email}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              className="btn-admin"
              onClick={() => {
                setShowAdmin(true);
                setShowProfile(false);
                setActiveEventId(null);
              }}
              title="Admin Panel"
              aria-label="Open Admin Panel"
            >
              <ShieldAlert size={16} />
              <span>Admin</span>
            </button>
          )}

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
        {showAdmin ? (
          <Suspense fallback={<ScreenFallback />}>
            <AdminScreen
              isAdmin={isAdmin}
              locations={locations}
              onBack={() => setShowAdmin(false)}
              onSaveLocation={handleSaveLocation}
              onDeleteLocation={handleDeleteLocation}
              onSeedTestEvent={handleSeedTestEvent}
            />
          </Suspense>
        ) : showProfile ? (
          <Suspense fallback={<ScreenFallback />}>
            <UserProfileScreen
              user={user}
              userProfile={userProfile}
              allUsers={allUsers}
              events={events}
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
              isAdmin={isAdmin}
              onNavigateToAdmin={handleNavigateToAdmin}
              initialSection={profileSection}
              onBack={() => setShowProfile(false)}
              onNavigateToEvent={(eventId) => {
                setShowProfile(false);
                setActiveEventId(eventId);
              }}
              onTogglePrivacy={handleTogglePrivacy}
              onOpenSearchModal={() => setIsSearchModalOpen(true)}
              onRemoveFriend={handleRemoveFriend}
            />
          </Suspense>
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
                      canDelete={canDeleteEvent(event)}
                      onRequestDelete={setEventPendingDelete}
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
        locations={locations}
      />

      <ConfirmDialog
        isOpen={eventPendingDelete !== null}
        title="Delete Event"
        message={
          <>
            Delete <strong style={{ color: 'var(--text-primary)' }}>{eventPendingDelete?.name}</strong>?
            This also removes its drinks and reviews. This action cannot be undone.
          </>
        }
        confirmLabel="Delete Event"
        onConfirm={handleConfirmDeleteEvent}
        onCancel={() => setEventPendingDelete(null)}
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
      {user && (
        <UserSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          currentUserId={user.uid}
          currentUserFriends={userProfile?.friends || []}
          publicUsers={allUsers}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={
          showProfile
            ? (profileSection === 'diary' ? 'diary' : 'profile')
            : (!showAdmin && !activeEventId ? 'events' : null)
        }
        onSelectEvents={() => {
          setActiveEventId(null);
          setShowProfile(false);
          setShowAdmin(false);
        }}
        onOpenFriends={() => setIsSearchModalOpen(true)}
        onAddEvent={() => setIsModalOpen(true)}
        onSelectDiary={() => {
          setProfileSection('diary');
          setShowProfile(true);
          setActiveEventId(null);
          setShowAdmin(false);
        }}
        onSelectProfile={() => {
          setProfileSection('overview');
          setShowProfile(true);
          setActiveEventId(null);
          setShowAdmin(false);
        }}
      />
    </div>
  );
}

export default App;

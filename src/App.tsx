import { useState, useEffect } from 'react';
import type { BeerEvent, BeerDrink } from './types';
import { StatsHeader } from './components/StatsHeader';
import { EventCard } from './components/EventCard';
import { EventModal } from './components/EventModal';
import { EventDetailScreen } from './components/EventDetailScreen';
import { AuthScreen } from './components/AuthScreen';
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [events, setEvents] = useState<BeerEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BeerEvent['status']>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaColorScheme) {
      metaColorScheme.setAttribute('content', theme === 'dark' ? 'dark' : 'light dark');
    }
    localStorage.setItem('keg_swap_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
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
        // Seed initial mock data if events are completely empty
        try {
          for (const initialEv of INITIAL_EVENTS) {
            await addDoc(collection(db, 'events'), {
              name: initialEv.name,
              date: initialEv.date,
              address: initialEv.address,
              status: initialEv.status,
              drinks: initialEv.drinks || [],
              userId: 'system',
              createdAt: new Date().toISOString()
            });
          }
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
    return <AuthScreen />;
  }

  if (activeEvent) {
    return (
      <div className="app-container">
        {/* Header section with beer theme */}
        <header className="app-header">
          <div className="brand" onClick={() => setActiveEventId(null)} style={{ cursor: 'pointer' }}>
            <div className="logo-container">
              <Beer className="brand-logo" size={32} />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Keg Swap</h1>
              <p className="brand-subtitle">Beer & Ale Events Board</p>
            </div>
          </div>
          
          <div className="header-actions">
            <span className="user-email-badge">
              <UserIcon size={14} />
              <span>{user.displayName || user.email}</span>
            </span>

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
            onBack={() => setActiveEventId(null)}
            onAddDrink={(drinkData) => handleAddDrink(activeEvent.id, drinkData)}
            onAddReview={(drinkId, reviewer, rating, comment) =>
              handleAddReview(activeEvent.id, drinkId, reviewer, rating, comment)
            }
            onAddDrinksBatch={(drinksData) => handleAddDrinksBatch(activeEvent.id, drinksData)}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header section with beer theme */}
      <header className="app-header">
        <div className="brand">
          <div className="logo-container">
            <Beer className="brand-logo" size={32} />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">Keg Swap</h1>
            <p className="brand-subtitle">Beer & Ale Events Board</p>
          </div>
        </div>
        
        <div className="header-actions">
          <span className="user-email-badge">
            <UserIcon size={14} />
            <span>{user.displayName || user.email}</span>
          </span>

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
                  onDelete={handleDeleteEvent}
                  onStatusChange={handleStatusChange}
                  onSelect={() => setActiveEventId(event.id)}
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
    </div>
  );
}

export default App;

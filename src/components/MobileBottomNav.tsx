import React from 'react';
import { Beer, Users, Plus, BookOpen, User as UserIcon } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'events' | 'diary' | 'profile' | null;
  onSelectEvents: () => void;
  onOpenFriends: () => void;
  onAddEvent: () => void;
  onSelectDiary: () => void;
  onSelectProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectEvents,
  onOpenFriends,
  onAddEvent,
  onSelectDiary,
  onSelectProfile,
}) => {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <button
        type="button"
        className={`nav-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
        onClick={onSelectEvents}
        id="nav-tab-events"
      >
        <Beer size={20} />
        <span>Events</span>
      </button>

      <button
        type="button"
        className="nav-tab-btn"
        onClick={onOpenFriends}
        id="nav-tab-friends"
      >
        <Users size={20} />
        <span>Friends</span>
      </button>

      <div className="nav-primary-wrapper">
        <button
          type="button"
          className="nav-tab-btn nav-tab-primary"
          onClick={onAddEvent}
          aria-label="Add Event"
          title="Add Event"
          id="nav-tab-add"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>

      <button
        type="button"
        className={`nav-tab-btn ${activeTab === 'diary' ? 'active' : ''}`}
        onClick={onSelectDiary}
        id="nav-tab-diary"
      >
        <BookOpen size={20} />
        <span>Diary</span>
      </button>

      <button
        type="button"
        className={`nav-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={onSelectProfile}
        id="nav-tab-profile"
      >
        <UserIcon size={20} />
        <span>Profile</span>
      </button>
    </nav>
  );
};

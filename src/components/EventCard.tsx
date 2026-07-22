import React, { useState, useRef, useEffect } from 'react';
import type { BeerEvent } from '../types';
import type { User } from 'firebase/auth';
import { MapPin, Calendar, Trash2, Clock, Play, CheckCircle, XCircle, UserCheck, Globe, ExternalLink } from 'lucide-react';

interface EventCardProps {
  event: BeerEvent;
  user: User;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: BeerEvent['status']) => void;
  onSelect: () => void;
  onToggleAttendance: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, user, onDelete, onStatusChange, onSelect, onToggleAttendance }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Status-specific configuration for badges and styling
  const statusConfig = {
    Upcoming: {
      color: 'status-upcoming',
      icon: <Clock size={14} />,
    },
    Ongoing: {
      color: 'status-ongoing',
      icon: <Play size={14} />,
    },
    Completed: {
      color: 'status-completed',
      icon: <CheckCircle size={14} />,
    },
    Cancelled: {
      color: 'status-cancelled',
      icon: <XCircle size={14} />,
    },
  };

  // Touch event handlers for mobile swipe-to-delete reveal
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diffX = touchCurrentX.current - touchStartX.current;
    
    // Only allow swiping to the left
    if (diffX < 0) {
      // Limit the swipe drag amount (resistance)
      const baseOffset = isRevealed ? -80 : 0;
      const targetOffset = Math.max(-140, baseOffset + diffX);
      setSwipeOffset(targetOffset);
    } else if (isRevealed && diffX > 0) {
      // Swipe right to close the revealed action
      const targetOffset = Math.min(0, -80 + diffX);
      setSwipeOffset(targetOffset);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    const diffX = touchCurrentX.current - touchStartX.current;

    if (isRevealed) {
      // If already swiped open, a right swipe snaps back to closed
      if (diffX > 30) {
        setSwipeOffset(0);
        setIsRevealed(false);
      } else if (diffX < -40) {
        // Deeper swipe triggers delete
        onDelete(event.id);
      } else {
        setSwipeOffset(-80);
      }
    } else {
      // Swiping left to reveal the delete button
      if (diffX < -50) {
        setSwipeOffset(-80);
        setIsRevealed(true);
      } else {
        setSwipeOffset(0);
      }
    }
  };

  // Reset swipe if clicking outside or on reset triggers
  useEffect(() => {
    if (isRevealed && !isSwiping) {
      const handleOutsideClick = (e: MouseEvent) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          setSwipeOffset(0);
          setIsRevealed(false);
        }
      };
      document.addEventListener('click', handleOutsideClick);
      return () => document.removeEventListener('click', handleOutsideClick);
    }
  }, [isRevealed, isSwiping]);

  // Formatting date to a friendly local string range
  const formatFriendlyDate = (startDateString: string, endDateString?: string) => {
    if (!startDateString) return '';
    const startObj = new Date(startDateString);
    
    if (!endDateString || startDateString === endDateString) {
      return startObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const endObj = new Date(endDateString);
    
    const isSameDay = startObj.getFullYear() === endObj.getFullYear() &&
                      startObj.getMonth() === endObj.getMonth() &&
                      startObj.getDate() === endObj.getDate();
                      
    if (isSameDay) {
      return startObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const startYear = startObj.getFullYear();
    const endYear = endObj.getFullYear();

    const startFormatted = startObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    if (startYear !== endYear) {
      const startFull = startObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const endFull = endObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startFull} – ${endFull}`;
    }

    const endFormatted = endObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const yearFormatted = startObj.getFullYear().toString();
    
    return `${startFormatted} – ${endFormatted}, ${yearFormatted}`;
  };

  const config = statusConfig[event.status] || statusConfig.Upcoming;
  const mapsTargetUrl = event.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;

  return (
    <div 
      className="event-card-wrapper" 
      ref={cardRef}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      {/* Background delete action revealed by swipe */}
      <div className="card-swipe-actions">
        <button
          type="button"
          className="swipe-delete-btn"
          onClick={() => onDelete(event.id)}
          aria-label={`Delete event ${event.name}`}
          id={`swipe-delete-${event.id}`}
        >
          <Trash2 size={20} />
          <span>Delete</span>
        </button>
      </div>

      {/* Main card content layer */}
      <div
        className="event-card"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: 'pointer'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onSelect}
      >
        <div className="card-header">
          <div className={`status-badge ${config.color}`}>
            {config.icon}
            <span>{event.status}</span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
            <button
              type="button"
              className={`card-attend-btn ${event.attendees?.includes(user.uid) ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleAttendance(event.id);
              }}
              title={event.attendees?.includes(user.uid) ? "You are attending! Click to leave." : "Click to attend event"}
            >
              <UserCheck size={14} />
              <span>{event.attendees?.includes(user.uid) ? 'Attending' : 'Attend'}</span>
            </button>

            <button
              type="button"
              className="card-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event.id);
              }}
              aria-label={`Delete event ${event.name}`}
              id={`delete-${event.id}`}
              title="Delete Event"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <h3 className="event-name">{event.name}</h3>

        <div className="event-details">
          <div className="detail-item">
            <Calendar size={15} className="detail-icon" />
            <time dateTime={event.date}>{formatFriendlyDate(event.date, event.endDate)}</time>
          </div>
          
          <a
            href={mapsTargetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="detail-item detail-link-location"
            onClick={(e) => e.stopPropagation()}
            title="Open location pin in Google Maps"
          >
            <MapPin size={15} className="detail-icon detail-location-icon" />
            <span className="address-text">{event.address}</span>
            <ExternalLink size={12} className="link-external-icon" />
          </a>

          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-item detail-link-website"
              onClick={(e) => e.stopPropagation()}
              title="Open official event website"
            >
              <Globe size={15} className="detail-icon detail-website-icon" />
              <span>Event Website</span>
              <ExternalLink size={12} className="link-external-icon" />
            </a>
          )}
        </div>

        <div className="card-footer" onClick={(e) => e.stopPropagation()}>
          <label htmlFor={`status-select-${event.id}`} className="status-select-label">
            Change Status:
          </label>
          <div className="status-select-wrapper">
            <select
              id={`status-select-${event.id}`}
              value={event.status}
              onChange={(e) => onStatusChange(event.id, e.target.value as BeerEvent['status'])}
              onClick={(e) => e.stopPropagation()}
              className="status-select"
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import type { BeerEvent } from '../types';
import { MapPin, Calendar, Trash2, Clock, Play, CheckCircle, XCircle } from 'lucide-react';

interface EventCardProps {
  event: BeerEvent;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: BeerEvent['status']) => void;
  onSelect: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onDelete, onStatusChange, onSelect }) => {
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

  // Formatting date to a friendly local string
  const formatFriendlyDate = (dateString: string) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const config = statusConfig[event.status] || statusConfig.Upcoming;

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

        <h3 className="event-name">{event.name}</h3>

        <div className="event-details">
          <div className="detail-item">
            <Calendar size={15} className="detail-icon" />
            <time dateTime={event.date}>{formatFriendlyDate(event.date)}</time>
          </div>
          <div className="detail-item">
            <MapPin size={15} className="detail-icon" />
            <span>{event.address}</span>
          </div>
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

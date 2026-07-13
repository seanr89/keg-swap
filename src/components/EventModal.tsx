import React, { useRef, useEffect, useState } from 'react';
import type { BeerEvent } from '../types';
import { X, Calendar } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: Omit<BeerEvent, 'id'>) => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const [name, setName] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<BeerEvent['status']>('Upcoming');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Sync React open state with native dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        // Reset form on open
        setName('');
        setIsMultiDay(false);
        setDate('');
        setEndDate('');
        setAddress('');
        setStatus('Upcoming');
        setErrors({});
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Event listeners for closing and backdrop clicking fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleNativeClose);

    // Fallback for browsers that do not support closedby="any" (e.g. Safari)
    const handleBackdropClick = (event: MouseEvent) => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        if (event.target !== dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (!isDialogContent) {
          dialog.close();
        }
      }
    };

    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (errors.name) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.name;
        return copy;
      });
    }
  };

  const handleDateChange = (val: string) => {
    setDate(val);
    if (errors.date) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.date;
        return copy;
      });
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (errors.endDate) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.endDate;
        return copy;
      });
    }
  };

  const handleAddressChange = (val: string) => {
    setAddress(val);
    if (errors.address) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.address;
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = 'Event name is required';
    if (!date) {
      newErrors.date = 'Event date is required';
    }
    
    if (isMultiDay) {
      if (!endDate) {
        newErrors.endDate = 'End date is required';
      } else if (date && new Date(endDate) < new Date(date)) {
        newErrors.endDate = 'End date cannot be before the start date';
      }
    }
    
    if (!address.trim()) newErrors.location = 'Location address is required';
    if (!status) newErrors.status = 'Event status is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      date,
      ...(isMultiDay && endDate ? { endDate } : {}),
      address: address.trim(),
      status,
    });
    
    if (dialogRef.current) {
      dialogRef.current.close();
    }
  };

  // Calculate total days
  const getDurationDays = () => {
    if (!date || !endDate) return 0;
    const start = new Date(date);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };
  const duration = isMultiDay ? getDurationDays() : 1;

  return (
    <dialog
      ref={dialogRef}
      id="add-event-dialog"
      closedby="any"
      aria-labelledby="dialog-title"
      className="event-modal-dialog"
    >
      <div className="modal-header">
        <h2 id="dialog-title">New Beer & Ale Event</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="modal-close-btn"
          aria-label="Close dialog"
          id="close-dialog-btn"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="modal-form" noValidate>
        <div className="form-group">
          <label htmlFor="event-name" className="form-label">
            Event Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            id="event-name"
            placeholder="e.g. Imperial Stout Tap Takeover"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={`form-input ${errors.name ? 'input-error' : ''}`}
            required
            autoFocus
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        {/* Duration Type Segmented Picker */}
        <div className="form-group">
          <label className="form-label">Duration</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${!isMultiDay ? 'active' : ''}`}
              onClick={() => {
                setIsMultiDay(false);
                setEndDate('');
                if (errors.endDate) {
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.endDate;
                    return copy;
                  });
                }
              }}
            >
              Single Day
            </button>
            <button
              type="button"
              className={`segmented-btn ${isMultiDay ? 'active' : ''}`}
              onClick={() => setIsMultiDay(true)}
            >
              Runs Over Days
            </button>
          </div>
        </div>

        {/* Date Picker Section */}
        <div className="date-pickers-layout">
          <div className="form-group flex-1">
            <label htmlFor="event-date" className="form-label">
              {isMultiDay ? 'Start Date' : 'Event Date'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div className="date-input-wrapper">
              <Calendar className="date-input-icon" size={16} />
              <input
                type="date"
                id="event-date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className={`form-input date-picker-input ${errors.date ? 'input-error' : ''}`}
                required
              />
            </div>
            {errors.date && <span className="error-message">{errors.date}</span>}
          </div>

          {isMultiDay && (
            <div className="form-group flex-1 animate-slide-down">
              <label htmlFor="event-end-date" className="form-label">
                End Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="date-input-wrapper">
                <Calendar className="date-input-icon" size={16} />
                <input
                  type="date"
                  id="event-end-date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className={`form-input date-picker-input ${errors.endDate ? 'input-error' : ''}`}
                  required
                />
              </div>
              {errors.endDate && <span className="error-message">{errors.endDate}</span>}
            </div>
          )}
        </div>

        {/* Duration hint badge */}
        {isMultiDay && duration > 0 && (
          <div className="date-duration-hint-container">
            <span className="date-duration-hint">
              Event spans <strong>{duration}</strong> {duration === 1 ? 'day' : 'days'}
            </span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="event-address" className="form-label">
            Location Address <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            id="event-address"
            placeholder="e.g. The Crafty Keg, 12 Pint Rd"
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            className={`form-input ${errors.location ? 'input-error' : ''}`}
            required
          />
          {errors.location && <span className="error-message">{errors.location}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="event-status" className="form-label">
            Status <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div className="form-select-wrapper">
            <select
              id="event-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BeerEvent['status'])}
              className="form-select"
              required
            >
              <option value="Upcoming">Upcoming</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dialogRef.current?.close()}
            id="cancel-dialog-btn"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" id="submit-dialog-btn">
            Create Event
          </button>
        </div>
      </form>
    </dialog>
  );
};

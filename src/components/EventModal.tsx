import React, { useRef, useEffect, useState } from 'react';
import type { BeerEvent } from '../types';
import { X } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (eventData: Omit<BeerEvent, 'id'>) => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
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
        setDate('');
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
      // Check if browser supports closedBy property on HTMLDialogElement
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

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = 'Event name is required';
    if (!date) newErrors.date = 'Date is required';
    if (!address.trim()) newErrors.address = 'Location address is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      date,
      address: address.trim(),
      status,
    });
    
    // Close the dialog natively, which will trigger the 'close' event and update parent state
    if (dialogRef.current) {
      dialogRef.current.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      id="add-event-dialog"
      // Declarative light-dismiss (supported in modern Chrome/Firefox/Edge)
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
            Event Name
          </label>
          <input
            type="text"
            id="event-name"
            placeholder="e.g. Imperial Stout Tap Takeover"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`form-input ${errors.name ? 'input-error' : ''}`}
            required
            autoFocus
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="event-date" className="form-label">
            Event Date
          </label>
          <input
            type="date"
            id="event-date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`form-input ${errors.date ? 'input-error' : ''}`}
            required
          />
          {errors.date && <span className="error-message">{errors.date}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="event-address" className="form-label">
            Location Address
          </label>
          <input
            type="text"
            id="event-address"
            placeholder="e.g. The Crafty Keg, 12 Pint Rd"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={`form-input ${errors.address ? 'input-error' : ''}`}
            required
          />
          {errors.address && <span className="error-message">{errors.address}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="event-status" className="form-label">
            Status
          </label>
          <div className="form-select-wrapper">
            <select
              id="event-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BeerEvent['status'])}
              className="form-select"
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

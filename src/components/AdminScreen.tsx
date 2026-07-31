import React, { useState, useRef, useEffect } from 'react';
import type { EventLocation } from '../types';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Globe,
  Building2,
  Search,
  ShieldAlert,
  ExternalLink,
  StickyNote,
} from 'lucide-react';

const ADMIN_EMAIL = 'srafferty89@gmail.com';

interface AdminScreenProps {
  user: User;
  locations: EventLocation[];
  onBack: () => void;
  onSaveLocation: (locationData: Omit<EventLocation, 'id' | 'createdAt'>, id?: string) => Promise<void>;
  onDeleteLocation: (id: string) => Promise<void>;
}

interface LocationFormState {
  name: string;
  address: string;
  city: string;
  postcode: string;
  mapsUrl: string;
  website: string;
  notes: string;
}

const emptyForm = (): LocationFormState => ({
  name: '',
  address: '',
  city: '',
  postcode: '',
  mapsUrl: '',
  website: '',
  notes: '',
});

export const AdminScreen: React.FC<AdminScreenProps> = ({
  user,
  locations,
  onBack,
  onSaveLocation,
  onDeleteLocation,
}) => {
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  // Sync form dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isFormOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isFormOpen]);

  // Sync delete confirm dialog
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteConfirmId !== null) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [deleteConfirmId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (loc: EventLocation) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      address: loc.address,
      city: loc.city || '',
      postcode: loc.postcode || '',
      mapsUrl: loc.mapsUrl || '',
      website: loc.website || '',
      notes: loc.notes || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errs: { [k: string]: string } = {};
    if (!form.name.trim()) errs.name = 'Venue name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      await onSaveLocation(
        {
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim() || undefined,
          postcode: form.postcode.trim() || undefined,
          mapsUrl: form.mapsUrl.trim() || undefined,
          website: form.website.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        editingId ?? undefined
      );
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await onDeleteLocation(deleteConfirmId);
      setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredLocations = locations.filter((loc) => {
    const q = searchQuery.toLowerCase();
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.address.toLowerCase().includes(q) ||
      (loc.city || '').toLowerCase().includes(q) ||
      (loc.postcode || '').toLowerCase().includes(q)
    );
  });

  // ─── Access Denied ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <ShieldAlert className="access-denied-icon" size={64} />
        <h2>Access Denied</h2>
        <p>This page is restricted to administrators only.</p>
        <button type="button" className="btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  // ─── Admin Page ──────────────────────────────────────────────────────────────
  return (
    <div className="admin-page">
      {/* Admin Page Header */}
      <div className="admin-header">
        <button type="button" className="btn-back" onClick={onBack} aria-label="Back to events board">
          <ArrowLeft size={18} />
        </button>
        <div className="admin-title-group">
          <h2 className="admin-page-title">
            Admin Panel
          </h2>
          <p className="admin-page-subtitle">Manage event locations & venues</p>
        </div>
        <div className="admin-header-badge">
          <ShieldAlert size={14} />
          <span>Admin</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-search-bar">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="admin-location-search"
            aria-label="Search locations"
          />
        </div>
        <div className="admin-toolbar-right">
          <span className="admin-count-badge">{filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''}</span>
          <button
            type="button"
            className="btn-primary"
            onClick={openCreate}
            id="btn-add-location"
          >
            <Plus size={16} />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      {/* Locations Grid */}
      {filteredLocations.length > 0 ? (
        <div className="admin-locations-grid">
          {filteredLocations.map((loc) => (
            <div key={loc.id} className="admin-location-card">
              <div className="admin-location-card-header">
                <div className="admin-location-icon-wrap">
                  <Building2 size={18} />
                </div>
                <div className="admin-location-name-group">
                  <h3 className="admin-location-name">{loc.name}</h3>
                  {loc.city && <span className="admin-location-city">{loc.city}{loc.postcode ? `, ${loc.postcode}` : ''}</span>}
                </div>
                <div className="admin-location-card-actions">
                  <button
                    type="button"
                    className="btn-icon-edit"
                    onClick={() => openEdit(loc)}
                    title="Edit location"
                    aria-label={`Edit ${loc.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-delete"
                    onClick={() => setDeleteConfirmId(loc.id)}
                    title="Delete location"
                    aria-label={`Delete ${loc.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="admin-location-address">
                <MapPin size={12} />
                <span>{loc.address}</span>
              </div>

              {loc.notes && (
                <div className="admin-location-notes">
                  <StickyNote size={11} />
                  <span>{loc.notes}</span>
                </div>
              )}

              <div className="admin-location-links">
                {loc.mapsUrl && (
                  <a
                    href={loc.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-location-link"
                    title="Open in Google Maps"
                  >
                    <MapPin size={12} />
                    Maps
                    <ExternalLink size={10} />
                  </a>
                )}
                {loc.website && (
                  <a
                    href={loc.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-location-link"
                    title="Open website"
                  >
                    <Globe size={12} />
                    Website
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              <div className="admin-location-card-footer">
                <span className="admin-location-date">
                  Added {new Date(loc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          <Building2 size={48} className="animate-float" />
          <h3>{searchQuery ? 'No locations match your search' : 'No locations yet'}</h3>
          <p>{searchQuery ? 'Try adjusting your search terms.' : 'Add your first managed venue or location above.'}</p>
          {!searchQuery && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              <span>Add First Location</span>
            </button>
          )}
        </div>
      )}

      {/* ─── Create / Edit Dialog ───────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        className="event-modal-dialog"
        id="admin-location-dialog"
        aria-labelledby="location-dialog-title"
      >
        <div className="modal-header">
          <h2 id="location-dialog-title">
            {editingId ? 'Edit Location' : 'Add New Location'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setIsFormOpen(false)}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {/* Venue Name */}
          <div className="form-group">
            <label htmlFor="loc-name" className="form-label">
              Venue Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              id="loc-name"
              className={`form-input ${formErrors.name ? 'input-error' : ''}`}
              placeholder="e.g. The Northern Monk Refectory"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            {formErrors.name && <span className="error-message">{formErrors.name}</span>}
          </div>

          {/* Full Address */}
          <div className="form-group">
            <label htmlFor="loc-address" className="form-label">
              Full Address <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              id="loc-address"
              className={`form-input ${formErrors.address ? 'input-error' : ''}`}
              placeholder="e.g. 33 Sovereign St, Leeds LS1 4BJ"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
            {formErrors.address && <span className="error-message">{formErrors.address}</span>}
          </div>

          {/* City / Postcode row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="loc-city" className="form-label">City / Area</label>
              <input
                type="text"
                id="loc-city"
                className="form-input"
                placeholder="e.g. Leeds"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="loc-postcode" className="form-label">Postcode / ZIP</label>
              <input
                type="text"
                id="loc-postcode"
                className="form-input"
                placeholder="e.g. LS1 4BJ"
                value={form.postcode}
                onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
              />
            </div>
          </div>

          {/* Maps URL */}
          <div className="form-group">
            <label htmlFor="loc-maps-url" className="form-label">
              Google Maps URL <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <div className="date-input-wrapper">
              <MapPin className="date-input-icon" size={16} />
              <input
                type="url"
                id="loc-maps-url"
                className="form-input date-picker-input"
                placeholder="https://maps.app.goo.gl/..."
                value={form.mapsUrl}
                onChange={(e) => setForm((f) => ({ ...f, mapsUrl: e.target.value }))}
              />
            </div>
          </div>

          {/* Website URL */}
          <div className="form-group">
            <label htmlFor="loc-website" className="form-label">
              Venue Website <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <div className="date-input-wrapper">
              <Globe className="date-input-icon" size={16} />
              <input
                type="url"
                id="loc-website"
                className="form-input date-picker-input"
                placeholder="https://northernmonk.com"
                value={form.website}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>
          </div>

          {/* Admin Notes */}
          <div className="form-group">
            <label htmlFor="loc-notes" className="form-label">
              Admin Notes <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <textarea
              id="loc-notes"
              className="form-input"
              placeholder="Internal notes about this venue..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              style={{ resize: 'vertical', minHeight: '70px' }}
            />
          </div>

          {formErrors.general && (
            <div className="form-alert" style={{ marginBottom: '16px' }}>
              <AlertCircle size={14} />
              <span>{formErrors.general}</span>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsFormOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              <Check size={16} />
              <span>{isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Location'}</span>
            </button>
          </div>
        </form>
      </dialog>

      {/* ─── Delete Confirm Dialog ───────────────────────────────────────── */}
      <dialog
        ref={deleteDialogRef}
        className="event-modal-dialog admin-confirm-dialog"
        id="admin-delete-dialog"
        aria-labelledby="delete-dialog-title"
      >
        <div className="modal-header">
          <h2 id="delete-dialog-title">Delete Location</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setDeleteConfirmId(null)}
            aria-label="Cancel"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '8px 0 24px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {locations.find((l) => l.id === deleteConfirmId)?.name ?? 'this location'}
            </strong>
            ? This action cannot be undone.
          </p>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            id="confirm-delete-location-btn"
          >
            <Trash2 size={15} />
            <span>{isDeleting ? 'Deleting...' : 'Delete Location'}</span>
          </button>
        </div>
      </dialog>
    </div>
  );
};

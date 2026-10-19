import React, { useState } from 'react';
import { SERVING_FORMATS, type BeerEvent, type BeerDrink, type ServingFormat } from '../types';
import type { User } from 'firebase/auth';
import { parseLocalDate } from '../utils/dateUtils';
import { ABV_BRACKETS, getAbvBracket, type AbvBracket } from '../utils/abvUtils';
import { useWishlist } from '../hooks/useWishlist';
import { countMatching, matchesShowFilter, type ShowFilter } from '../utils/showFilter';
import { matchesDietaryFilter, parseDrinkFlags, parseServingFormat, type DietaryFilter } from '../utils/drinkFlags';
import { topTags } from '../utils/tastingTags';
import {
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Plus, 
  Beer, 
  X, 
  Check, 
  MessageSquare, 
  AlertCircle, 
  Upload, 
  Search, 
  UserCheck, 
  Globe, 
  ExternalLink,
  Camera,
  Image as ImageIcon,
  Maximize2,
  Trash2,
  Bookmark,
  Star
} from 'lucide-react';
import { StarRating } from './StarRating';
import { ShareButton } from './ShareButton';
import { ReviewBottomSheet } from './review/ReviewBottomSheet';
import { getAppShareUrl } from '../utils/shareUtils';
import { 
  uploadImageFile, 
  sanitizeOrUploadImageUrl, 
  isBase64DataUrl 
} from '../utils/imageUtils';

interface EventDetailScreenProps {
  event: BeerEvent;
  drinksLoading?: boolean;
  user: User;
  onBack: () => void;
  onAddDrink: (drinkData: Omit<BeerDrink, 'id' | 'reviews'> & { id?: string }) => void;
  onAddReview: (
    drinkId: string, 
    reviewer: string, 
    rating: number, 
    comment: string, 
    price?: string, 
    servingSize?: string,
    imageUrl?: string,
    reviewId?: string,
    tags?: string[]
  ) => void;
  onAddDrinksBatch: (drinksData: Omit<BeerDrink, 'id' | 'reviews'>[]) => void;
  onToggleAttendance: (id: string) => void;
}

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  event,
  drinksLoading = false,
  user,
  onBack,
  onAddDrink,
  onAddReview,
  onAddDrinksBatch,
  onToggleAttendance,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkBrewery, setNewDrinkBrewery] = useState('');
  const [newDrinkLocation, setNewDrinkLocation] = useState('');
  const [newDrinkAbv, setNewDrinkAbv] = useState('');
  const [newDrinkStyle, setNewDrinkStyle] = useState('');
  const [newDrinkDesc, setNewDrinkDesc] = useState('');
  const [newDrinkImageUrl, setNewDrinkImageUrl] = useState('');
  const [newDrinkVegan, setNewDrinkVegan] = useState(false);
  const [newDrinkGlutenFree, setNewDrinkGlutenFree] = useState(false);
  const [newDrinkFormat, setNewDrinkFormat] = useState<ServingFormat | ''>('');
  const [newDrinkType, setNewDrinkType] = useState<string>('');
  const [drinkDraftId, setDrinkDraftId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
  );
  const [drinkImageUploading, setDrinkImageUploading] = useState(false);
  const [addDrinkError, setAddDrinkError] = useState('');

  const isAttending = event.attendees?.includes(user.uid) || false;
  const attendeesCount = event.attendees?.length || 0;

  // Search and Filter states
  const [drinkSearchQuery, setDrinkSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState<ShowFilter>('all');
  const { wishlist, toggle: toggleWishlist } = useWishlist(user.uid, event.id);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [selectedAbv, setSelectedAbv] = useState<'all' | AbvBracket>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryFilter>('any');
  const [selectedFormat, setSelectedFormat] = useState<'all' | ServingFormat>('all');
  const [selectedSort, setSelectedSort] = useState<string>('default');

  // Review Bottom Sheet state
  const [activeReviewDrink, setActiveReviewDrink] = useState<BeerDrink | null>(null);

  // Lightbox Modal state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const mapsTargetUrl = event.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;

  const handleDrinkImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDrinkImageUploading(true);
    setAddDrinkError('');
    try {
      const storagePath = `events/${event.id}/drinks/${drinkDraftId}.jpg`;
      const downloadUrl = await uploadImageFile(file, storagePath);
      setNewDrinkImageUrl(downloadUrl);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to upload image';
      setAddDrinkError(errMsg);
    } finally {
      setDrinkImageUploading(false);
      e.target.value = '';
    }
  };

  const handleDrinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrinkName.trim()) return setAddDrinkError('Drink name is required');
    if (!newDrinkBrewery.trim()) return setAddDrinkError('Brewery is required');
    if (!newDrinkLocation.trim()) return setAddDrinkError('Location is required');
    if (!newDrinkAbv.trim()) return setAddDrinkError('ABV is required');
    if (!newDrinkStyle.trim()) return setAddDrinkError('Style is required');
    if (!newDrinkDesc.trim()) return setAddDrinkError('Description is required');

    const formattedAbv = newDrinkAbv.trim().endsWith('%') ? newDrinkAbv.trim() : `${newDrinkAbv.trim()}%`;

    let finalImageUrl = newDrinkImageUrl.trim() || undefined;
    if (finalImageUrl && isBase64DataUrl(finalImageUrl)) {
      try {
        setDrinkImageUploading(true);
        finalImageUrl = await sanitizeOrUploadImageUrl(
          finalImageUrl,
          `events/${event.id}/drinks/${drinkDraftId}.jpg`
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to process drink photo';
        setAddDrinkError(errMsg);
        setDrinkImageUploading(false);
        return;
      } finally {
        setDrinkImageUploading(false);
      }
    }

    onAddDrink({
      id: drinkDraftId,
      name: newDrinkName.trim(),
      brewery: newDrinkBrewery.trim(),
      location: newDrinkLocation.trim(),
      abv: formattedAbv,
      style: newDrinkStyle.trim(),
      description: newDrinkDesc.trim(),
      imageUrl: finalImageUrl,
      type: newDrinkType.trim() || 'Unknown',
      ...(newDrinkVegan ? { isVegan: true } : {}),
      ...(newDrinkGlutenFree ? { isGlutenFree: true } : {}),
      ...(newDrinkFormat ? { caskOrKeg: newDrinkFormat } : {}),
    });

    // Reset Form
    setNewDrinkName('');
    setNewDrinkBrewery('');
    setNewDrinkLocation('');
    setNewDrinkAbv('');
    setNewDrinkStyle('');
    setNewDrinkDesc('');
    setNewDrinkImageUrl('');
    setNewDrinkType('');
    setNewDrinkVegan(false);
    setNewDrinkGlutenFree(false);
    setNewDrinkFormat('');
    setAddDrinkError('');
    setShowAddForm(false);
    setDrinkDraftId(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
  };

  const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!Array.isArray(parsed)) {
          alert('Invalid file format. The file must contain an array of drink objects matching 2026_beers.json or beers.json.');
          return;
        }

        const validatedDrinks: Omit<BeerDrink, 'id' | 'reviews'>[] = [];

        for (const item of parsed) {
          if (
            item &&
            typeof item === 'object' &&
            typeof item.name === 'string' &&
            typeof item.brewery === 'string' &&
            typeof item.location === 'string' &&
            typeof item.abv === 'string' &&
            typeof item.style === 'string' &&
            typeof item.description === 'string'
          ) {
            const batchAbv = item.abv.trim();
            const formattedBatchAbv = batchAbv.endsWith('%') ? batchAbv : `${batchAbv}%`;
            validatedDrinks.push({
              name: item.name.trim(),
              brewery: item.brewery.trim(),
              location: item.location.trim(),
              abv: formattedBatchAbv,
              style: item.style.trim(),
              description: item.description.trim(),
              ...(typeof item.imageUrl === 'string' && item.imageUrl.trim() ? { imageUrl: item.imageUrl.trim() } : {}),
              ...parseDrinkFlags(item as Record<string, unknown>),
            });
          }
        }

        if (validatedDrinks.length === 0) {
          alert('No valid beers were found in the uploaded file. Check the fields in 2026_beers.json / beers.json.');
          return;
        }

        onAddDrinksBatch(validatedDrinks);
        alert(`Successfully imported ${validatedDrinks.length} beers!`);
      } catch (err) {
        console.error('Batch upload error:', err);
        alert('Failed to parse JSON file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const statusColors: { [key: string]: string } = {
    Upcoming: 'status-upcoming',
    Ongoing: 'status-ongoing',
    Completed: 'status-completed',
    Cancelled: 'status-cancelled',
  };

  const availableStyles = Array.from(
    new Set((event.drinks || []).map((drink) => drink.style).filter(Boolean))
  ).sort();

  const availableTypes = React.useMemo(() => {
    const typesSet = new Set<string>();
    (event.drinks || []).forEach((drink) => {
      typesSet.add(drink.type?.trim() || 'Unknown');
    });
    // Ensure 'Unknown' is always available so beers with an unknown status can be filtered/grouped
    typesSet.add('Unknown');
    return Array.from(typesSet).sort((a, b) => {
      if (a.toLowerCase() === 'unknown') return 1;
      if (b.toLowerCase() === 'unknown') return -1;
      return a.localeCompare(b);
    });
  }, [event.drinks]);

  const getAvgRatingNum = (drink: BeerDrink): number => {
    if (!drink.reviews || drink.reviews.length === 0) return 0;
    return drink.reviews.reduce((acc, r) => acc + r.rating, 0) / drink.reviews.length;
  };

  const filteredDrinks = (event.drinks || []).filter((drink) => {
    const effectiveType = drink.type?.trim() || 'Unknown';
    const matchesSearch =
      drink.name.toLowerCase().includes(drinkSearchQuery.toLowerCase()) ||
      drink.brewery.toLowerCase().includes(drinkSearchQuery.toLowerCase()) ||
      drink.style.toLowerCase().includes(drinkSearchQuery.toLowerCase()) ||
      effectiveType.toLowerCase().includes(drinkSearchQuery.toLowerCase());
    const matchesShow = matchesShowFilter(drink, selectedShow, user.uid, wishlist);
    const matchesType =
      selectedType === 'all' ||
      effectiveType.toLowerCase() === selectedType.toLowerCase();
    const matchesStyle = selectedStyle === 'All Styles' || drink.style === selectedStyle;
    const matchesAbv = selectedAbv === 'all' || getAbvBracket(drink.abv) === selectedAbv;
    const matchesDietary = matchesDietaryFilter(drink, selectedDietary);
    const matchesFormat = selectedFormat === 'all' || drink.caskOrKeg === selectedFormat;
    return matchesSearch && matchesShow && matchesType && matchesStyle && matchesAbv && matchesDietary && matchesFormat;
  });

  const sortedDrinks = [...filteredDrinks].sort((a, b) => {
    if (selectedSort === 'type') {
      const typeA = (a.type?.trim() || 'Unknown').toLowerCase();
      const typeB = (b.type?.trim() || 'Unknown').toLowerCase();
      if (typeA !== typeB) {
        if (typeA === 'unknown') return 1;
        if (typeB === 'unknown') return -1;
        return typeA.localeCompare(typeB);
      }
      return a.name.localeCompare(b.name);
    }
    if (selectedSort === 'rating-desc') {
      return getAvgRatingNum(b) - getAvgRatingNum(a);
    }
    if (selectedSort === 'rating-asc') {
      const aRating = getAvgRatingNum(a);
      const bRating = getAvgRatingNum(b);
      if (aRating === 0) return 1;
      if (bRating === 0) return -1;
      return aRating - bRating;
    }
    if (selectedSort === 'reviews-desc') {
      return (b.reviews?.length || 0) - (a.reviews?.length || 0);
    }
    return 0;
  });

  const groupedDrinksByType = React.useMemo(() => {
    if (selectedSort !== 'type') return null;
    const map = new Map<string, BeerDrink[]>();
    for (const drink of sortedDrinks) {
      const groupKey = drink.type?.trim() || 'Unknown';
      const existing = map.get(groupKey) || [];
      existing.push(drink);
      map.set(groupKey, existing);
    }
    return Array.from(map.entries());
  }, [selectedSort, sortedDrinks]);

  const formatFriendlyDate = (startDateString: string, endDateString?: string) => {
    if (!startDateString) return '';
    const startObj = parseLocalDate(startDateString);
    
    if (!endDateString || startDateString === endDateString) {
      return startObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    const endObj = parseLocalDate(endDateString);
    
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

  return (
    <div className="event-detail-screen">
      {/* Navigation & Header */}
      <div className="detail-navigation">
        <button type="button" className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="detail-header-card">
        <div className="detail-header-meta">
          <span className={`status-badge ${statusColors[event.status] || 'status-upcoming'}`}>
            {event.status}
          </span>
          <h2 className="detail-event-title">{event.name}</h2>
          <div className="detail-meta-grid">
            <div className="detail-meta-item">
              <Calendar size={16} />
              <span>{formatFriendlyDate(event.date, event.endDate)}</span>
            </div>
            <a
              href={mapsTargetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-meta-item detail-meta-link"
              title="Open location pin in Google Maps"
            >
              <MapPin size={16} />
              <span>{event.address}</span>
              <ExternalLink size={13} style={{ marginLeft: '4px', opacity: 0.8 }} />
            </a>
            {event.url && (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-meta-item detail-meta-link"
                title="Open official event website"
              >
                <Globe size={16} />
                <span>Event Website</span>
                <ExternalLink size={13} style={{ marginLeft: '4px', opacity: 0.8 }} />
              </a>
            )}
          </div>
        </div>

        <div className="detail-header-actions-group">
          <input
            type="file"
            id="batch-beer-file-upload"
            accept=".json"
            onChange={handleBatchUpload}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className={`btn-detail-attend ${isAttending ? 'active' : ''}`}
            onClick={() => onToggleAttendance(event.id)}
            title={isAttending ? "You are attending this event! Click to leave." : "Click to attend this event"}
          >
            <UserCheck size={16} />
            <span>{isAttending ? 'Attending' : 'Attend Event'}</span>
            {attendeesCount > 0 && <span className="attendees-count-pill">{attendeesCount}</span>}
          </button>
          
          <button
            type="button"
            className="btn-batch-upload"
            onClick={() => document.getElementById('batch-beer-file-upload')?.click()}
            title="Import a batch list of beers from a beers.json file"
          >
            <Upload size={16} />
            <span>Upload beers.json</span>
          </button>

          <button 
            type="button" 
            className={`btn-add-drink-toggle ${showAddForm ? 'active' : ''}`}
            onClick={() => {
              setShowAddForm(!showAddForm);
              setAddDrinkError('');
            }}
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showAddForm ? 'Cancel Form' : 'Add Beer / Drink'}</span>
          </button>
        </div>
      </div>

      {/* Add New Drink Form Drawer */}
      {showAddForm && (
        <form onSubmit={handleDrinkSubmit} className="add-drink-form">
          <h4 className="form-title">Register a Drink</h4>
          {addDrinkError && (
            <div className="form-alert">
              <AlertCircle size={16} />
              <span>{addDrinkError}</span>
            </div>
          )}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="drink-name" className="form-label">Beer/Drink Name</label>
              <input
                type="text"
                id="drink-name"
                className="form-input"
                placeholder="e.g. Amethyst"
                value={newDrinkName}
                onChange={(e) => setNewDrinkName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="drink-brewery" className="form-label">Brewery</label>
              <input
                type="text"
                id="drink-brewery"
                className="form-input"
                placeholder="e.g. Amity Brew Co"
                value={newDrinkBrewery}
                onChange={(e) => setNewDrinkBrewery(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="drink-location" className="form-label">Brewery Location</label>
              <input
                type="text"
                id="drink-location"
                className="form-input"
                placeholder="e.g. Leeds"
                value={newDrinkLocation}
                onChange={(e) => setNewDrinkLocation(e.target.value)}
              />
            </div>
            <div className="form-grid-three">
              <div className="form-group">
                <label htmlFor="drink-abv" className="form-label">ABV (%)</label>
                <input
                  type="text"
                  id="drink-abv"
                  className="form-input"
                  placeholder="e.g. 4.6%"
                  value={newDrinkAbv}
                  onChange={(e) => setNewDrinkAbv(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="drink-style" className="form-label">Beer Type</label>
              <input
                type="text"
                id="drink-style"
                className="form-input"
                placeholder="e.g. Porter"
                value={newDrinkStyle}
                onChange={(e) => setNewDrinkStyle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="drink-desc" className="form-label">Tasting Profile</label>
              <input
                type="text"
                id="drink-desc"
                className="form-input"
                placeholder="e.g. Dark, plums, berries, full-bodied"
                value={newDrinkDesc}
                onChange={(e) => setNewDrinkDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="drink-type" className="form-label">Drink Type</label>
              <div className="form-select-wrapper">
                <select
                  id="drink-type"
                  className="form-select"
                  value={newDrinkType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewDrinkType(val);
                    if (val === 'Cask') setNewDrinkFormat('Cask');
                    else if (val === 'Rotating Keg' || val === 'Keg') setNewDrinkFormat('Keg');
                  }}
                >
                  <option value="">Unknown (or select type...)</option>
                  <option value="Cask">Cask</option>
                  <option value="Rotating Keg">Rotating Keg</option>
                  <option value="Cider">Cider</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="drink-format" className="form-label">Serving Format (Optional)</label>
              <div className="form-select-wrapper">
                <select
                  id="drink-format"
                  className="form-select"
                  value={newDrinkFormat}
                  onChange={(e) => setNewDrinkFormat(parseServingFormat(e.target.value) ?? '')}
                >
                  <option value="">Not specified</option>
                  {SERVING_FORMATS.map((format) => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <span className="form-label">Dietary (Optional)</span>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', paddingTop: '8px' }}>
              <label htmlFor="drink-vegan" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="drink-vegan"
                  checked={newDrinkVegan}
                  onChange={(e) => setNewDrinkVegan(e.target.checked)}
                />
                Vegan
              </label>
              <label htmlFor="drink-gluten-free" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="drink-gluten-free"
                  checked={newDrinkGlutenFree}
                  onChange={(e) => setNewDrinkGlutenFree(e.target.checked)}
                />
                Gluten-free
              </label>
            </div>
          </div>

          {/* Photo / Image Attachment Section for New Drink */}
          <div className="form-group image-upload-group" style={{ marginTop: '12px', marginBottom: '16px' }}>
            <label className="form-label d-flex align-items-center" style={{ gap: '6px' }}>
              <ImageIcon size={16} />
              <span>Drink Photo (Optional)</span>
            </label>
            <div className="image-attachment-wrapper">
              {newDrinkImageUrl ? (
                <div className="image-preview-card">
                  <img src={newDrinkImageUrl} alt="Drink Preview" className="image-preview-thumb" />
                  <button
                    type="button"
                    className="btn-remove-image"
                    onClick={() => setNewDrinkImageUrl('')}
                    title="Remove attached photo"
                  >
                    <Trash2 size={14} />
                    <span>Remove Photo</span>
                  </button>
                </div>
              ) : (
                <div className="image-input-options">
                  <label htmlFor="drink-file-upload" className="btn-file-upload">
                    <Camera size={16} />
                    <span>{drinkImageUploading ? 'Processing Image...' : 'Upload or Snap Photo'}</span>
                    <input
                      type="file"
                      id="drink-file-upload"
                      accept="image/*"
                      onChange={handleDrinkImageFileSelect}
                      style={{ display: 'none' }}
                      disabled={drinkImageUploading}
                    />
                  </label>
                  <span className="or-divider">or</span>
                  <input
                    type="url"
                    className="form-input url-input"
                    placeholder="Paste Image URL (https://...)"
                    value={newDrinkImageUrl}
                    onChange={(e) => setNewDrinkImageUrl(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="btn-primary form-submit-btn" disabled={drinkImageUploading}>
            <Check size={16} />
            <span>Confirm Add Drink</span>
          </button>
        </form>
      )}

      {/* Beers List Section */}
      <div className="drinks-feed-section">
        <h3 className="section-title">Drinks Available ({filteredDrinks.length})</h3>
        
        {event.drinks && event.drinks.length > 0 ? (
          <>
            {/* Search & Filter Toolbar inside Event Details */}
            <div className="toolbar" style={{ marginBottom: '24px', padding: '12px 16px', gap: '16px', flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ flex: '1 1 250px' }}>
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search drinks by name, brewery or style..."
                  value={drinkSearchQuery}
                  onChange={(e) => setDrinkSearchQuery(e.target.value)}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Drink Type Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '130px' }}>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="form-select"
                    aria-label="Filter drinks by type"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="all">All Types ({event.drinks?.length || 0})</option>
                    {availableTypes.map((type) => {
                      const count = (event.drinks || []).filter(
                        (d) => (d.type?.trim() || 'Unknown').toLowerCase() === type.toLowerCase()
                      ).length;
                      return (
                        <option key={type} value={type}>
                          {type} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Beer Type/Style Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '140px' }}>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="form-select"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="All Styles">All Styles ({event.drinks?.length || 0})</option>
                    {availableStyles.map((style) => (
                      <option key={style} value={style}>
                        {style} ({event.drinks?.filter(d => d.style === style).length || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* ABV Bracket Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '140px' }}>
                  <select
                    value={selectedAbv}
                    onChange={(e) => setSelectedAbv(e.target.value as 'all' | AbvBracket)}
                    className="form-select"
                    aria-label="Filter by ABV"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="all">All ABV</option>
                    {ABV_BRACKETS.map((bracket) => (
                      <option key={bracket.id} value={bracket.id}>
                        {bracket.label} ({event.drinks?.filter(d => getAbvBracket(d.abv) === bracket.id).length || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Serving Format Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '130px' }}>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value as 'all' | ServingFormat)}
                    className="form-select"
                    aria-label="Filter by serving format"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="all">All Formats</option>
                    {SERVING_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {format} ({event.drinks?.filter(d => d.caskOrKeg === format).length || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dietary Dropdown Filter (only drinks that list the flag match) */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '150px' }}>
                  <select
                    value={selectedDietary}
                    onChange={(e) => setSelectedDietary(e.target.value as DietaryFilter)}
                    className="form-select"
                    aria-label="Filter by dietary info (where listed)"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="any">Dietary (where listed)</option>
                    <option value="vegan">Vegan ({event.drinks?.filter(d => matchesDietaryFilter(d, 'vegan')).length || 0})</option>
                    <option value="gluten-free">Gluten-free ({event.drinks?.filter(d => matchesDietaryFilter(d, 'gluten-free')).length || 0})</option>
                    <option value="both">Vegan + GF ({event.drinks?.filter(d => matchesDietaryFilter(d, 'both')).length || 0})</option>
                  </select>
                </div>

                {/* Sort Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '130px' }}>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="form-select"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="default">Default Sort</option>
                    <option value="type">Group by Type</option>
                    <option value="rating-desc">Highest Rating</option>
                    <option value="rating-asc">Lowest Rating</option>
                    <option value="reviews-desc">Most Reviewed</option>
                  </select>
                </div>

                <div className="filter-tabs" role="group" aria-label="Show">
                  {(
                    [
                      { id: 'all', label: 'All', count: event.drinks?.length ?? 0 },
                      { id: 'tried', label: 'Tried', count: countMatching(event.drinks ?? [], 'tried', user.uid, wishlist) },
                      { id: 'wishlist', label: 'Wishlist', count: countMatching(event.drinks ?? [], 'wishlist', user.uid, wishlist) },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`filter-tab-btn ${selectedShow === tab.id ? 'active' : ''}`}
                      aria-pressed={selectedShow === tab.id}
                      onClick={() => setSelectedShow(tab.id)}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sortedDrinks.length > 0 ? (
              groupedDrinksByType ? (
                <div className="drinks-grouped-container">
                  {groupedDrinksByType.map(([typeGroup, groupDrinks]) => (
                    <div key={typeGroup} className="drink-type-group-section">
                      <div className="drink-type-group-header">
                        <h4 className="drink-type-group-title">
                          <span className={`drink-type-group-badge ${typeGroup.toLowerCase() === 'unknown' ? 'badge-unknown' : ''}`}>
                            {typeGroup}
                          </span>
                          <span className="drink-type-group-count">
                            ({groupDrinks.length} {groupDrinks.length === 1 ? 'drink' : 'drinks'})
                          </span>
                        </h4>
                      </div>
                      <div className="drinks-grid">
                        {groupDrinks.map((drink) => (
                          <BeerDrinkCard
                            key={drink.id}
                            drink={drink}
                            eventName={event.name}
                            userRating={drink.reviews.find((r) => r.userId === user.uid)?.rating}
                            isWishlisted={wishlist.has(drink.id)}
                            onToggleWishlist={() => toggleWishlist(drink.id)}
                            onTriggerReview={() => setActiveReviewDrink(drink)}
                            onOpenLightbox={(url, title, subtitle) => setLightboxImage({ url, title, subtitle })}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="drinks-grid">
                  {sortedDrinks.map((drink) => (
                    <BeerDrinkCard
                      key={drink.id}
                      drink={drink}
                      eventName={event.name}
                      userRating={drink.reviews.find((r) => r.userId === user.uid)?.rating}
                      isWishlisted={wishlist.has(drink.id)}
                      onToggleWishlist={() => toggleWishlist(drink.id)}
                      onTriggerReview={() => setActiveReviewDrink(drink)}
                      onOpenLightbox={(url, title, subtitle) => setLightboxImage({ url, title, subtitle })}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="empty-state drinks-empty">
                <X size={32} />
                <h4>No drinks match your filters</h4>
                <p>Try refining your search keyword or selection criteria.</p>
              </div>
            )}
          </>
        ) : drinksLoading ? (
          <div className="loading-container" role="status" aria-live="polite">
            <Beer className="animate-float" size={32} />
            <p>Loading drinks...</p>
          </div>
        ) : (
          <div className="empty-state drinks-empty">
            <X size={32} />
            <h4>No drinks registered yet</h4>
            <p>Help shape the event by registering the first available drink above!</p>
          </div>
        )}
      </div>

      {/* Mobile-First Review Bottom Sheet Dialog */}
      <ReviewBottomSheet
        drink={activeReviewDrink}
        eventId={event.id}
        user={user}
        onClose={() => setActiveReviewDrink(null)}
        onSubmitReview={onAddReview}
      />

      {/* Lightbox / Full-screen Image Preview Overlay */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxImage(null)}
              aria-label="Close photo modal"
            >
              <X size={20} />
            </button>
            <img src={lightboxImage.url} alt={lightboxImage.title} className="lightbox-img" />
            <div className="lightbox-caption">
              <h4>{lightboxImage.title}</h4>
              {lightboxImage.subtitle && <p>{lightboxImage.subtitle}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Sub Component for Individual Drink Rendering --- */
interface BeerDrinkCardProps {
  drink: BeerDrink;
  onTriggerReview: () => void;
  onOpenLightbox: (url: string, title: string, subtitle?: string) => void;
  eventName: string;
  userRating?: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
}

const BeerDrinkCard: React.FC<BeerDrinkCardProps> = ({
  drink,
  eventName,
  userRating,
  isWishlisted,
  onToggleWishlist,
  onTriggerReview,
  onOpenLightbox,
}) => {
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  // Calculate Average Rating
  const avgRating = drink.reviews.length > 0
    ? (drink.reviews.reduce((acc, r) => acc + r.rating, 0) / drink.reviews.length).toFixed(1)
    : null;
  const flavorTags = topTags(drink.reviews);

  return (
    <div className="beer-card">
      {/* Optional Top Drink Image Header */}
      {drink.imageUrl && (
        <div 
          className="beer-card-image-banner"
          onClick={() => onOpenLightbox(drink.imageUrl!, drink.name, `${drink.brewery} • ${drink.style}`)}
          title="Click to view full drink photo"
        >
          <img src={drink.imageUrl} alt={drink.name} className="beer-card-img" />
          <div className="image-zoom-badge">
            <Maximize2 size={14} />
            <span>Enlarge</span>
          </div>
        </div>
      )}

      <div className="beer-card-main">
        {/* Left Side Details */}
        <div className="beer-card-info">
          <div className="beer-card-top">
            <span className="beer-style-badge">{drink.style}</span>
            <span className="beer-abv-badge">{drink.abv}</span>
            <span className={`beer-abv-badge beer-type-badge ${(drink.type?.trim() || (!drink.caskOrKeg ? 'Unknown' : drink.caskOrKeg)).toLowerCase() === 'unknown' ? 'badge-unknown' : ''}`}>
              {drink.type?.trim() || drink.caskOrKeg || 'Unknown'}
            </span>
            {drink.isVegan && <span className="beer-abv-badge" title="Vegan">Vegan</span>}
            {drink.isGlutenFree && <span className="beer-abv-badge" title="Gluten-free">GF</span>}
            {drink.imageUrl && (
              <span className="photo-attached-badge" title="Drink has photo attached">
                <ImageIcon size={12} /> Photo
              </span>
            )}
          </div>
          <h4 className="beer-name">{drink.name}</h4>
          <div className="beer-origin">
            <span className="beer-brewery">{drink.brewery}</span>
            <span className="beer-dot">•</span>
            <span className="beer-location">{drink.location}</span>
          </div>
          <p className="beer-description">{drink.description}</p>
          {flavorTags.length > 0 && (
            <ul className="flavor-tags" aria-label="Top flavor tags from reviews">
              {flavorTags.map(({ tag, count }) => (
                <li
                  key={tag}
                  className="flavor-tag"
                  title={`Tagged by ${count} reviewer${count === 1 ? '' : 's'}`}
                >
                  {tag}
                  <span className="flavor-tag-count">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Side Metric / Star Dashboard */}
        <div className="beer-card-rating-dash">
          <div className="avg-rating-badge">
            {avgRating ? (
              <>
                <Beer className="star-filled" size={18} fill="currentColor" />
                <span className="avg-val">{avgRating}</span>
                <span className="avg-val-scale" style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.85 }}>/10</span>
              </>
            ) : (
              <span className="avg-val-none">No Reviews</span>
            )}
          </div>
          
          <button 
            type="button" 
            className={`btn-add-review-trigger ${userRating !== undefined ? 'has-user-rating' : ''}`}
            onClick={onTriggerReview}
            title={userRating !== undefined ? `You rated ${userRating.toFixed(1)}/10 — tap to edit` : 'Rate and review this beer'}
          >
            {userRating !== undefined ? (
              <>
                <Star size={14} fill="currentColor" />
                <span>You rated: {userRating.toFixed(1)} • Edit</span>
              </>
            ) : (
              <>
                <Star size={14} />
                <span>Rate &amp; Review</span>
              </>
            )}
          </button>

          <div className="beer-card-secondary-actions">
            <button 
              type="button" 
              className="btn-toggle-reviews"
              onClick={() => setIsReviewsOpen(!isReviewsOpen)}
            >
              <MessageSquare size={14} />
              <span>Reviews ({drink.reviews.length})</span>
            </button>

            <button
              type="button"
              className={`share-btn ${isWishlisted ? 'active' : ''}`}
              onClick={onToggleWishlist}
              aria-pressed={isWishlisted}
              aria-label={isWishlisted ? `Remove ${drink.name} from wishlist` : `Add ${drink.name} to wishlist`}
              title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Bookmark size={15} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>

            <ShareButton
              label={`Share ${drink.name}`}
              title="Keg Swap"
              text={`${drink.name} by ${drink.brewery} (${drink.abv}), at ${eventName} on Keg Swap`}
              url={getAppShareUrl()}
            />
          </div>
        </div>
      </div>

      {/* Expanded Reviews Drawer */}
      {isReviewsOpen && (
        <div className="beer-reviews-drawer">
          <div className="reviews-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <h5 style={{ margin: 0 }}>Reviews ({drink.reviews.length})</h5>
            <button
              type="button"
              className="btn-close-reviews"
              onClick={() => setIsReviewsOpen(false)}
              title="Close reviews"
              aria-label="Close reviews"
            >
              <X size={16} />
            </button>
          </div>

          {/* Individual Reviews Feed */}
          {drink.reviews.length > 0 ? (
            <div className="reviews-list">
              {drink.reviews.map((rev) => (
                <div key={rev.id} className="review-item">
                  <div className="review-item-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="review-author">{rev.reviewer}</span>
                      {rev.servingSize && <span className="review-meta-tag">{rev.servingSize}</span>}
                      {rev.price && <span className="review-meta-tag price">{rev.price}</span>}
                    </div>
                    <div className="review-stars-fixed" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <StarRating rating={rev.rating} maxStars={10} size={11} />
                      <span className="review-rating-num" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  {rev.comment && <p className="review-comment">{rev.comment}</p>}
                  {rev.tags && rev.tags.length > 0 && (
                    <div className="review-tags">
                      {rev.tags.map((tag) => (
                        <span key={tag} className="review-meta-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  
                  {/* Photo of the drink the reviewer had */}
                  {rev.imageUrl && (
                    <div className="review-photo-container">
                      <img
                        src={rev.imageUrl}
                        alt={`${rev.reviewer}'s drink check-in photo`}
                        className="review-photo-thumb"
                        onClick={() => onOpenLightbox(rev.imageUrl!, `${rev.reviewer}'s Drink Photo`, `${drink.name} • Rating: ${rev.rating.toFixed(1)}/10`)}
                        title="Click to view full photo"
                      />
                      <span className="review-photo-caption">
                        <Camera size={12} /> Snap of drink served
                      </span>
                    </div>
                  )}

                  <span className="review-date">
                    {new Date(rev.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="reviews-empty-state">
              <p>No reviews yet. Be the first to share your tasting notes!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

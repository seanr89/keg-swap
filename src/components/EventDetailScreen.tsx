import React, { useState, useRef, useEffect } from 'react';
import type { BeerEvent, BeerDrink } from '../types';
import type { User } from 'firebase/auth';
import { ArrowLeft, MapPin, Calendar, Plus, Beer, X, Check, MessageSquare, AlertCircle, Upload, Search, UserCheck, Globe, ExternalLink } from 'lucide-react';
import { StarRating } from './StarRating';

interface EventDetailScreenProps {
  event: BeerEvent;
  user: User;
  onBack: () => void;
  onAddDrink: (drinkData: Omit<BeerDrink, 'id' | 'reviews'>) => void;
  onAddReview: (drinkId: string, reviewer: string, rating: number, comment: string, price?: string, servingSize?: string) => void;
  onAddDrinksBatch: (drinksData: Omit<BeerDrink, 'id' | 'reviews'>[]) => void;
  onToggleAttendance: (id: string) => void;
}

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  event,
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
  const [addDrinkError, setAddDrinkError] = useState('');

  const isAttending = event.attendees?.includes(user.uid) || false;
  const attendeesCount = event.attendees?.length || 0;

  // Search and Filter states
  const [drinkSearchQuery, setDrinkSearchQuery] = useState('');
  const [filterHasReviews, setFilterHasReviews] = useState<'all' | 'with-reviews'>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [selectedSort, setSelectedSort] = useState<string>('default');

  // Add Review Dialog Modal states (top-level to prevent parents clipping)
  const [activeReviewDrink, setActiveReviewDrink] = useState<BeerDrink | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [ratingVal, setRatingVal] = useState(8);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPrice, setReviewPrice] = useState('');
  const [reviewServingSize, setReviewServingSize] = useState('');
  const [customServingSize, setCustomServingSize] = useState('');
  const [reviewError, setReviewError] = useState('');

  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  const mapsTargetUrl = event.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`;

  // Sync React open state with native dialog element
  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;

    if (activeReviewDrink) {
      if (!dialog.open) {
        dialog.showModal();
        // Reset form on open
        setReviewerName(user.displayName || user.email || '');
        setRatingVal(8);
        setReviewComment('');
        setReviewPrice('');
        setReviewServingSize('');
        setCustomServingSize('');
        setReviewError('');
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [activeReviewDrink, user]);

  // Handle native close events (e.g. Escape key) and backdrop clicks
  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      setActiveReviewDrink(null);
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, []);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewDrink) return;
    if (!reviewerName.trim()) return setReviewError('Your name is required');
    if (!reviewComment.trim()) return setReviewError('Review comment is required');
    if (ratingVal < 0.5 || ratingVal > 10) return setReviewError('Rating must be between 0.5 and 10');

    const effectiveServingSize = reviewServingSize === 'Other' ? customServingSize.trim() : reviewServingSize;

    onAddReview(
      activeReviewDrink.id,
      reviewerName.trim(),
      ratingVal,
      reviewComment.trim(),
      reviewPrice.trim() || undefined,
      effectiveServingSize || undefined
    );

    // Reset Form & Close Modal
    setReviewerName('');
    setReviewComment('');
    setRatingVal(8);
    setReviewPrice('');
    setReviewServingSize('');
    setCustomServingSize('');
    setReviewError('');
    setActiveReviewDrink(null);
  };

  const handleDrinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrinkName.trim()) return setAddDrinkError('Drink name is required');
    if (!newDrinkBrewery.trim()) return setAddDrinkError('Brewery is required');
    if (!newDrinkLocation.trim()) return setAddDrinkError('Location is required');
    if (!newDrinkAbv.trim()) return setAddDrinkError('ABV is required');
    if (!newDrinkStyle.trim()) return setAddDrinkError('Style is required');
    if (!newDrinkDesc.trim()) return setAddDrinkError('Description is required');

    const formattedAbv = newDrinkAbv.trim().endsWith('%') ? newDrinkAbv.trim() : `${newDrinkAbv.trim()}%`;

    onAddDrink({
      name: newDrinkName.trim(),
      brewery: newDrinkBrewery.trim(),
      location: newDrinkLocation.trim(),
      abv: formattedAbv,
      style: newDrinkStyle.trim(),
      description: newDrinkDesc.trim(),
    });

    // Reset Form
    setNewDrinkName('');
    setNewDrinkBrewery('');
    setNewDrinkLocation('');
    setNewDrinkAbv('');
    setNewDrinkStyle('');
    setNewDrinkDesc('');
    setAddDrinkError('');
    setShowAddForm(false);
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
          alert('Invalid file format. The beers.json file must contain an array of drink objects.');
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
            });
          }
        }

        if (validatedDrinks.length === 0) {
          alert('No valid beers were found in the uploaded file. Check the fields in beers.json.');
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

  const getAvgRatingNum = (drink: BeerDrink): number => {
    if (!drink.reviews || drink.reviews.length === 0) return 0;
    return drink.reviews.reduce((acc, r) => acc + r.rating, 0) / drink.reviews.length;
  };

  const filteredDrinks = (event.drinks || []).filter((drink) => {
    const matchesSearch =
      drink.name.toLowerCase().includes(drinkSearchQuery.toLowerCase()) ||
      drink.brewery.toLowerCase().includes(drinkSearchQuery.toLowerCase()) ||
      drink.style.toLowerCase().includes(drinkSearchQuery.toLowerCase());
    const matchesReviews = filterHasReviews === 'all' || (drink.reviews && drink.reviews.length > 0);
    const matchesStyle = selectedStyle === 'All Styles' || drink.style === selectedStyle;
    return matchesSearch && matchesReviews && matchesStyle;
  });

  const sortedDrinks = [...filteredDrinks].sort((a, b) => {
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
          <button type="submit" className="btn-primary form-submit-btn">
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

                {/* Sort Dropdown Filter */}
                <div className="form-select-wrapper" style={{ width: 'auto', minWidth: '130px' }}>
                  <select
                    value={selectedSort}
                    onChange={(e) => setSelectedSort(e.target.value)}
                    className="form-select"
                    style={{ padding: '8px 32px 8px 12px', fontSize: '13px', height: '36px' }}
                  >
                    <option value="default">Default Sort</option>
                    <option value="rating-desc">Highest Rating</option>
                    <option value="rating-asc">Lowest Rating</option>
                    <option value="reviews-desc">Most Reviewed</option>
                  </select>
                </div>

                <div className="filter-tabs">
                  <button
                    type="button"
                    className={`filter-tab-btn ${filterHasReviews === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterHasReviews('all')}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    All Drinks
                  </button>
                  <button
                    type="button"
                    className={`filter-tab-btn ${filterHasReviews === 'with-reviews' ? 'active' : ''}`}
                    onClick={() => setFilterHasReviews('with-reviews')}
                    style={{ padding: '6px 12px', fontSize: '13px' }}
                  >
                    Reviewed Only ({event.drinks?.filter(d => d.reviews && d.reviews.length > 0).length || 0})
                  </button>
                </div>
              </div>
            </div>

            {sortedDrinks.length > 0 ? (
              <div className="drinks-grid">
                {sortedDrinks.map((drink) => (
                  <BeerDrinkCard
                    key={drink.id}
                    drink={drink}
                    onTriggerReview={() => {
                      setActiveReviewDrink(drink);
                      setReviewError('');
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state drinks-empty">
                <X size={32} />
                <h4>No drinks match your filters</h4>
                <p>Try refining your search keyword or selection criteria.</p>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state drinks-empty">
            <X size={32} />
            <h4>No drinks registered yet</h4>
            <p>Help shape the event by registering the first available drink above!</p>
          </div>
        )}
      </div>

      {/* Add Review Dialog Modal */}
      <dialog
        ref={reviewDialogRef}
        className="event-modal-dialog"
        id="add-review-dialog"
        aria-labelledby="review-dialog-title"
      >
        {activeReviewDrink && (
          <>
            <div className="modal-header">
              <h2 id="review-dialog-title">Review {activeReviewDrink.name}</h2>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setActiveReviewDrink(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleReviewSubmit} className="modal-form">
              {reviewError && (
                <div className="form-alert review-alert" style={{ marginBottom: '16px' }}>
                  <AlertCircle size={14} />
                  <span>{reviewError}</span>
                </div>
              )}
              
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="form-label" style={{ margin: 0 }}>Your Rating (1–10)</span>
                  <span className="rating-score-badge">
                    {ratingVal.toFixed(1)} <span style={{ fontSize: '13px', opacity: 0.7 }}>/ 10</span>
                  </span>
                </div>
                
                <div className="rating-input-box">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <StarRating
                      rating={ratingVal}
                      maxStars={10}
                      size={24}
                      interactive={true}
                      onChange={(val) => setRatingVal(val)}
                    />
                  </div>

                  <div className="rating-slider-row">
                    <button
                      type="button"
                      className="btn-rating-step"
                      onClick={() => setRatingVal(prev => Math.max(0.5, prev - 0.5))}
                      title="Decrease rating by 0.5"
                    >
                      -0.5
                    </button>

                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={ratingVal}
                      onChange={(e) => setRatingVal(parseFloat(e.target.value))}
                      className="rating-range-slider"
                    />

                    <button
                      type="button"
                      className="btn-rating-step"
                      onClick={() => setRatingVal(prev => Math.min(10, prev + 0.5))}
                      title="Increase rating by 0.5"
                    >
                      +0.5
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rev-name" className="form-label">Your Name</label>
                <input
                  type="text"
                  id="rev-name"
                  className="form-input"
                  value={reviewerName}
                  disabled
                  readOnly
                  required
                />
                <span className="form-input-help" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Posting review as your authenticated profile account.
                </span>
              </div>

              <div className="form-row-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="rev-size" className="form-label">Serving Size (Optional)</label>
                  <select
                    id="rev-size"
                    className="form-input"
                    value={reviewServingSize}
                    onChange={(e) => setReviewServingSize(e.target.value)}
                  >
                    <option value="">Select size...</option>
                    <option value="Pint">Pint</option>
                    <option value="Half Pint">Half Pint</option>
                    <option value="Third Pint">Third Pint</option>
                    <option value="25cl">25cl</option>
                    <option value="33cl">33cl</option>
                    <option value="44cl">44cl</option>
                    <option value="50cl">50cl</option>
                    <option value="Flight / Sample">Flight / Sample</option>
                    <option value="Other">Other...</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="rev-price" className="form-label">Price (Optional)</label>
                  <input
                    type="text"
                    id="rev-price"
                    className="form-input"
                    placeholder="e.g. £5.50"
                    value={reviewPrice}
                    onChange={(e) => setReviewPrice(e.target.value)}
                  />
                </div>
              </div>

              {reviewServingSize === 'Other' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label htmlFor="rev-custom-size" className="form-label">Custom Serving Size</label>
                  <input
                    type="text"
                    id="rev-custom-size"
                    className="form-input"
                    placeholder="e.g. 75cl Bottle"
                    value={customServingSize}
                    onChange={(e) => setCustomServingSize(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="rev-comment" className="form-label">Tasting Notes / Comments</label>
                <textarea
                  id="rev-comment"
                  className="form-input review-textarea"
                  placeholder="Describe flavor notes, body, aroma, finish, etc..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  required
                  style={{ minHeight: '100px' }}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setActiveReviewDrink(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={16} />
                  <span>Submit Review</span>
                </button>
              </div>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
};

/* --- Sub Component for Individual Drink Rendering --- */
interface BeerDrinkCardProps {
  drink: BeerDrink;
  onTriggerReview: () => void;
}

const BeerDrinkCard: React.FC<BeerDrinkCardProps> = ({ drink, onTriggerReview }) => {
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  // Calculate Average Rating
  const avgRating = drink.reviews.length > 0
    ? (drink.reviews.reduce((acc, r) => acc + r.rating, 0) / drink.reviews.length).toFixed(1)
    : null;

  return (
    <div className="beer-card">
      <div className="beer-card-main">
        {/* Left Side Details */}
        <div className="beer-card-info">
          <div className="beer-card-top">
            <span className="beer-style-badge">{drink.style}</span>
            <span className="beer-abv-badge">{drink.abv}</span>
          </div>
          <h4 className="beer-name">{drink.name}</h4>
          <div className="beer-origin">
            <span className="beer-brewery">{drink.brewery}</span>
            <span className="beer-dot">•</span>
            <span className="beer-location">{drink.location}</span>
          </div>
          <p className="beer-description">{drink.description}</p>
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
            className="btn-add-review-trigger"
            onClick={onTriggerReview}
            title="Write a review"
          >
            <Plus size={14} />
            <span>Add Review</span>
          </button>

          <button 
            type="button" 
            className="btn-toggle-reviews"
            onClick={() => setIsReviewsOpen(!isReviewsOpen)}
          >
            <MessageSquare size={14} />
            <span>Reviews ({drink.reviews.length})</span>
          </button>
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
                  <p className="review-comment">{rev.comment}</p>
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

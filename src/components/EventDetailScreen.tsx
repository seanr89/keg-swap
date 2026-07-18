import React, { useState, useRef, useEffect } from 'react';
import type { BeerEvent, BeerDrink } from '../types';
import { ArrowLeft, MapPin, Calendar, Plus, Star, X, Check, MessageSquare, AlertCircle, Upload, Search } from 'lucide-react';

interface EventDetailScreenProps {
  event: BeerEvent;
  onBack: () => void;
  onAddDrink: (drinkData: Omit<BeerDrink, 'id' | 'reviews'>) => void;
  onAddReview: (drinkId: string, reviewer: string, rating: number, comment: string) => void;
  onAddDrinksBatch: (drinksData: Omit<BeerDrink, 'id' | 'reviews'>[]) => void;
}

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  event,
  onBack,
  onAddDrink,
  onAddReview,
  onAddDrinksBatch,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkBrewery, setNewDrinkBrewery] = useState('');
  const [newDrinkLocation, setNewDrinkLocation] = useState('');
  const [newDrinkAbv, setNewDrinkAbv] = useState('');
  const [newDrinkStyle, setNewDrinkStyle] = useState('');
  const [newDrinkDesc, setNewDrinkDesc] = useState('');
  const [addDrinkError, setAddDrinkError] = useState('');

  // Search and Filter states
  const [drinkSearchQuery, setDrinkSearchQuery] = useState('');
  const [filterHasReviews, setFilterHasReviews] = useState<'all' | 'with-reviews'>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [selectedSort, setSelectedSort] = useState<string>('default');

  // Add Review Dialog Modal states (top-level to prevent parents clipping)
  const [activeReviewDrink, setActiveReviewDrink] = useState<BeerDrink | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [ratingVal, setRatingVal] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');

  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  // Sync React open state with native dialog element
  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;

    if (activeReviewDrink) {
      if (!dialog.open) {
        dialog.showModal();
        // Reset form on open
        setReviewerName('');
        setRatingVal(5);
        setReviewComment('');
        setReviewError('');
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [activeReviewDrink]);

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
    if (ratingVal < 1 || ratingVal > 5) return setReviewError('Invalid rating selected');

    onAddReview(activeReviewDrink.id, reviewerName.trim(), ratingVal, reviewComment.trim());

    // Reset Form & Close Modal
    setReviewerName('');
    setReviewComment('');
    setRatingVal(5);
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

    onAddDrink({
      name: newDrinkName.trim(),
      brewery: newDrinkBrewery.trim(),
      location: newDrinkLocation.trim(),
      abv: newDrinkAbv.trim(),
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
            validatedDrinks.push({
              name: item.name.trim(),
              brewery: item.brewery.trim(),
              location: item.location.trim(),
              abv: item.abv.trim(),
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
            <div className="detail-meta-item">
              <MapPin size={16} />
              <span>{event.address}</span>
            </div>
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
                <span className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Your Rating</span>
                <div className="star-selector" style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="star-btn"
                      onClick={() => setRatingVal(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`Rate ${star} stars`}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                      <Star 
                        size={28} 
                        className={(hoverRating || ratingVal) >= star ? 'star-filled' : 'star-empty'} 
                        fill={(hoverRating || ratingVal) >= star ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rev-name" className="form-label">Your Name</label>
                <input
                  type="text"
                  id="rev-name"
                  className="form-input"
                  placeholder="e.g. Liam"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  required
                />
              </div>

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
                <Star className="star-filled" size={18} fill="currentColor" />
                <span className="avg-val">{avgRating}</span>
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
                    <span className="review-author">{rev.reviewer}</span>
                    <div className="review-stars-fixed">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          size={11} 
                          className={i < rev.rating ? 'star-filled' : 'star-empty'} 
                          fill={i < rev.rating ? 'currentColor' : 'none'}
                        />
                      ))}
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

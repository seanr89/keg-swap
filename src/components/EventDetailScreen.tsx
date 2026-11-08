import React, { useState } from 'react';
import { SERVING_FORMATS, type BeerEvent, type BeerDrink, type BeerReview, type ServingFormat } from '../types';
import type { User } from 'firebase/auth';
import { parseLocalDate } from '../utils/dateUtils';
import { ABV_BRACKETS, getAbvBracket, type AbvBracket } from '../utils/abvUtils';
import { useWishlist } from '../hooks/useWishlist';
import { countMatching, isTried, matchesShowFilter, type ShowFilter } from '../utils/showFilter';
import { matchesDietaryFilter, parseServingFormat, type DietaryFilter } from '../utils/drinkFlags';
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
  Star,
  Trophy,
  Loader2,
  RotateCcw,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { StarRating } from './StarRating';
import { ConfirmDialog } from './ConfirmDialog';
import { ReviewBottomSheet } from './review/ReviewBottomSheet';
import { BatchUploadModal } from './BatchUploadModal';
import { TopFiveHeroTray } from './TopFiveHeroTray';
import { TopFiveSwapModal } from './TopFiveSwapModal';
import { MAX_TOP_FIVE } from '../utils/wishlist';
import { 
  uploadImageFile, 
  sanitizeOrUploadImageUrl, 
  isBase64DataUrl 
} from '../utils/imageUtils';

interface EventDetailScreenProps {
  event: BeerEvent;
  drinksLoading?: boolean;
  drinksRetrying?: boolean;
  drinksError?: string | null;
  onRetryDrinks?: () => void;
  user: User;
  isAdmin?: boolean;
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
  onDeleteReview?: (drinkId: string, reviewId: string, imageUrl?: string) => Promise<boolean | void> | void;
  onAddDrinksBatch: (drinksData: Omit<BeerDrink, 'id' | 'reviews'>[]) => void;
  onToggleAttendance: (id: string) => void;
  onUpdateDrinkAvailability?: (drinkId: string, isAvailable: boolean) => Promise<void> | void;
}

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  event,
  drinksLoading = false,
  drinksRetrying = false,
  drinksError = null,
  onRetryDrinks,
  user,
  isAdmin,
  onBack,
  onAddDrink,
  onAddReview,
  onDeleteReview,
  onAddDrinksBatch,
  onToggleAttendance,
  onUpdateDrinkAvailability,
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

  const validDrinkIds = React.useMemo(() => {
    if (drinksLoading || !event.drinks) return undefined;
    return new Set(event.drinks.map((d) => d.id));
  }, [drinksLoading, event.drinks]);

  const {
    wishlist,
    toggle: toggleWishlist,
    topFiveDrinkIds,
    topFiveSet,
    getTopFiveRank,
    toggleTopFive,
    swapTopFive,
    moveTopFive,
  } = useWishlist(user.uid, event.id, validDrinkIds);

  const [swapCandidateDrink, setSwapCandidateDrink] = useState<BeerDrink | null>(null);

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('All Styles');
  const [selectedAbv, setSelectedAbv] = useState<'all' | AbvBracket>('all');
  const [selectedDietary, setSelectedDietary] = useState<DietaryFilter>('any');
  const [selectedFormat, setSelectedFormat] = useState<'all' | ServingFormat>('all');
  const [selectedSort, setSelectedSort] = useState<string>('default');

  const handleClearAllFilters = () => {
    setDrinkSearchQuery('');
    setSelectedType('all');
    setSelectedStyle('All Styles');
    setSelectedAbv('all');
    setSelectedDietary('any');
    setSelectedFormat('all');
    setSelectedSort('default');
    setSelectedShow('all');
  };

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (drinkSearchQuery.trim().length > 0) count++;
    if (selectedType !== 'all') count++;
    if (selectedStyle !== 'All Styles') count++;
    if (selectedAbv !== 'all') count++;
    if (selectedDietary !== 'any') count++;
    if (selectedFormat !== 'all') count++;
    if (selectedSort !== 'default') count++;
    if (selectedShow !== 'all') count++;
    return count;
  }, [
    drinkSearchQuery,
    selectedType,
    selectedStyle,
    selectedAbv,
    selectedDietary,
    selectedFormat,
    selectedSort,
    selectedShow,
  ]);
  const hasActiveFilters = activeFiltersCount > 0;

  const handleToggleTopFive = async (drink: BeerDrink) => {
    const isRemovingLastTopFive =
      topFiveSet.has(drink.id) &&
      countMatching(event.drinks ?? [], 'top5', user.uid, wishlist, topFiveSet) <= 1;
    const action = await toggleTopFive(drink.id);
    if (action === 'limit-reached') {
      setSwapCandidateDrink(drink);
    } else if (action === 'removed' && isRemovingLastTopFive && selectedShow === 'top5') {
      setSelectedShow('all');
    }
  };

  const handleRemoveFromTopFive = (drinkId: string) => {
    const isRemovingLastTopFive =
      topFiveSet.has(drinkId) &&
      countMatching(event.drinks ?? [], 'top5', user.uid, wishlist, topFiveSet) <= 1;
    void toggleTopFive(drinkId);
    if (isRemovingLastTopFive && selectedShow === 'top5') {
      setSelectedShow('all');
    }
  };

  const handleToggleWishlist = (drinkId: string) => {
    const isRemovingLastWishlisted =
      wishlist.has(drinkId) &&
      countMatching(event.drinks ?? [], 'wishlist', user.uid, wishlist, topFiveSet) <= 1;
    toggleWishlist(drinkId);
    if (isRemovingLastWishlisted && selectedShow === 'wishlist') {
      setSelectedShow('all');
    }
  };

  // Review Bottom Sheet state
  const [activeReviewDrink, setActiveReviewDrink] = useState<BeerDrink | null>(null);
  const [reviewPendingDelete, setReviewPendingDelete] = useState<{
    drinkId: string;
    drinkName: string;
    review: BeerReview;
  } | null>(null);

  const handleConfirmDeleteReview = async () => {
    if (!reviewPendingDelete) return;
    const { drinkId, review } = reviewPendingDelete;
    setReviewPendingDelete(null);

    const isRemovingLastTried =
      isTried({ reviews: [review] }, user.uid) &&
      countMatching(event.drinks ?? [], 'tried', user.uid, wishlist, topFiveSet) <= 1;

    await onDeleteReview?.(drinkId, review.id, review.imageUrl);

    if (isRemovingLastTried && selectedShow === 'tried') {
      setSelectedShow('all');
    }
  };

  const handleDeleteFromSheet = async (drinkId: string, reviewId: string, imageUrl?: string) => {
    const isRemovingLastTried =
      countMatching(event.drinks ?? [], 'tried', user.uid, wishlist, topFiveSet) <= 1;

    await onDeleteReview?.(drinkId, reviewId, imageUrl);

    if (isRemovingLastTried && selectedShow === 'tried') {
      setSelectedShow('all');
    }
  };

  // Lightbox Modal state
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Batch beers.json upload dialog state
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);
  const [initialBatchFile, setInitialBatchFile] = useState<File | null>(null);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState('');

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

  const statusColors: { [key: string]: string } = {
    Upcoming: 'status-upcoming',
    Ongoing: 'status-ongoing',
    Completed: 'status-completed',
    Cancelled: 'status-cancelled',
  };

  const showScopedDrinks = React.useMemo(
    () =>
      (event.drinks || []).filter((drink) =>
        matchesShowFilter(drink, selectedShow, user.uid, wishlist, topFiveSet)
      ),
    [event.drinks, selectedShow, user.uid, wishlist, topFiveSet]
  );

  const availableStyles = React.useMemo(
    () =>
      Array.from(
        new Set(showScopedDrinks.map((drink) => drink.style).filter(Boolean))
      ).sort(),
    [showScopedDrinks]
  );

  const availableTypes = React.useMemo(() => {
    const typesSet = new Set<string>();
    showScopedDrinks.forEach((drink) => {
      typesSet.add(drink.type?.trim() || 'Unknown');
    });
    // Ensure 'Unknown' is always available so beers with an unknown status can be filtered/grouped
    typesSet.add('Unknown');
    return Array.from(typesSet).sort((a, b) => {
      if (a.toLowerCase() === 'unknown') return 1;
      if (b.toLowerCase() === 'unknown') return -1;
      return a.localeCompare(b);
    });
  }, [showScopedDrinks]);

  // Keep secondary filter controls valid when items are added or removed from the active view
  React.useEffect(() => {
    if (showScopedDrinks.length === 0) return;

    if (selectedStyle !== 'All Styles' && !availableStyles.includes(selectedStyle)) {
      setSelectedStyle('All Styles');
    }
    if (
      selectedType !== 'all' &&
      !showScopedDrinks.some(
        (d) => (d.type?.trim() || 'Unknown').toLowerCase() === selectedType.toLowerCase()
      )
    ) {
      setSelectedType('all');
    }
    if (
      selectedAbv !== 'all' &&
      !showScopedDrinks.some((d) => getAbvBracket(d.abv) === selectedAbv)
    ) {
      setSelectedAbv('all');
    }
    if (
      selectedFormat !== 'all' &&
      !showScopedDrinks.some((d) => d.caskOrKeg === selectedFormat)
    ) {
      setSelectedFormat('all');
    }
    if (
      selectedDietary !== 'any' &&
      !showScopedDrinks.some((d) => matchesDietaryFilter(d, selectedDietary))
    ) {
      setSelectedDietary('any');
    }
  }, [
    showScopedDrinks,
    availableStyles,
    selectedStyle,
    selectedType,
    selectedAbv,
    selectedFormat,
    selectedDietary,
  ]);

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
    const matchesShow = matchesShowFilter(drink, selectedShow, user.uid, wishlist, topFiveSet);
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
    if (selectedShow === 'top5') {
      const rankA = getTopFiveRank(a.id) ?? MAX_TOP_FIVE + 1;
      const rankB = getTopFiveRank(b.id) ?? MAX_TOP_FIVE + 1;
      return rankA - rankB;
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
            onClick={() => {
              setInitialBatchFile(null);
              setIsBatchUploadOpen(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                setInitialBatchFile(file);
                setIsBatchUploadOpen(true);
              }
            }}
            title="Import and preview a batch list of beers from a beers.json file"
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

      {batchSuccessMessage && (
        <div className="batch-success-banner" role="status">
          <Check size={16} />
          <span>{batchSuccessMessage}</span>
          <button
            type="button"
            onClick={() => setBatchSuccessMessage('')}
            className="btn-close-banner"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

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
        <h3 className="section-title">
          <span>
            Drinks Available
            {!drinksLoading || (event.drinks && event.drinks.length > 0)
              ? ` (${filteredDrinks.length})`
              : ''}
          </span>
          {drinksLoading && (
            <span className="section-title-loading-pill" role="status" aria-live="polite">
              <Loader2 className="animate-spin" size={14} aria-hidden="true" />
              <span>{drinksRetrying ? 'Retrying...' : 'Loading...'}</span>
            </span>
          )}
        </h3>
        
        {event.drinks && event.drinks.length > 0 ? (
          <>
            {/* Top 5 Must-Try Wishlist Hero Tray */}
            <TopFiveHeroTray
              drinks={event.drinks}
              topFiveDrinkIds={topFiveDrinkIds}
              userUid={user.uid}
              isFilteredByTopFive={selectedShow === 'top5'}
              onToggleFilterTopFive={() =>
                setSelectedShow((prev) => (prev === 'top5' ? 'all' : 'top5'))
              }
              onRemoveFromTopFive={handleRemoveFromTopFive}
              onMoveTopFive={(fromIdx, toIdx) => {
                void moveTopFive(fromIdx, toIdx);
              }}
              onTriggerReview={(drink) => setActiveReviewDrink(drink)}
            />

            {/* Search & Filter Toolbar inside Event Details */}
            <div className="toolbar drinks-toolbar">
              <div className="search-bar">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  className="search-input"
                  id="search-drinks-input"
                  aria-label="Search drinks by name, brewery or style"
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
                    <option value="all">All Types ({showScopedDrinks.length})</option>
                    {availableTypes.map((type) => {
                      const count = showScopedDrinks.filter(
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
                    <option value="All Styles">All Styles ({showScopedDrinks.length})</option>
                    {availableStyles.map((style) => (
                      <option key={style} value={style}>
                        {style} ({showScopedDrinks.filter(d => d.style === style).length})
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
                        {bracket.label} ({showScopedDrinks.filter(d => getAbvBracket(d.abv) === bracket.id).length})
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
                        {format} ({showScopedDrinks.filter(d => d.caskOrKeg === format).length})
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
                    <option value="vegan">Vegan ({showScopedDrinks.filter(d => matchesDietaryFilter(d, 'vegan')).length})</option>
                    <option value="gluten-free">Gluten-free ({showScopedDrinks.filter(d => matchesDietaryFilter(d, 'gluten-free')).length})</option>
                    <option value="both">Vegan + GF ({showScopedDrinks.filter(d => matchesDietaryFilter(d, 'both')).length})</option>
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
                      { id: 'all', label: 'All', count: `${event.drinks?.length ?? 0}` },
                      { id: 'tried', label: 'Tried', count: `${countMatching(event.drinks ?? [], 'tried', user.uid, wishlist, topFiveSet)}` },
                      { id: 'wishlist', label: 'Wishlist', count: `${countMatching(event.drinks ?? [], 'wishlist', user.uid, wishlist, topFiveSet)}` },
                      { id: 'top5', label: 'Top 5', count: `${countMatching(event.drinks ?? [], 'top5', user.uid, wishlist, topFiveSet)}/${MAX_TOP_FIVE}` },
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

                {/* Clear All Filters Toggle Button */}
                <button
                  type="button"
                  id="clear-all-filters-btn"
                  data-testid="clear-all-filters-toggle"
                  className={`btn-clear-filters-toggle ${hasActiveFilters ? 'active' : 'disabled'}`}
                  aria-label="Clear all filters"
                  aria-pressed={hasActiveFilters}
                  disabled={!hasActiveFilters}
                  onClick={handleClearAllFilters}
                  title={
                    hasActiveFilters
                      ? `Clear all ${activeFiltersCount} active filter${activeFiltersCount > 1 ? 's' : ''}`
                      : 'No active filters to clear'
                  }
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Clear All</span>
                  {activeFiltersCount > 0 && (
                    <span className="filter-count-badge" aria-hidden="true">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
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
                            userRating={drink.reviews.find((r) => r.userId === user.uid)?.rating}
                            isWishlisted={wishlist.has(drink.id)}
                            onToggleWishlist={() => handleToggleWishlist(drink.id)}
                            topFiveRank={getTopFiveRank(drink.id)}
                            onToggleTopFive={() => {
                              void handleToggleTopFive(drink);
                            }}
                            onTriggerReview={() => setActiveReviewDrink(drink)}
                            onOpenLightbox={(url, title, subtitle) => setLightboxImage({ url, title, subtitle })}
                            currentUserId={user.uid}
                            isAdmin={isAdmin}
                            onRequestDeleteReview={(dId, dName, rev) =>
                              setReviewPendingDelete({ drinkId: dId, drinkName: dName, review: rev })
                            }
                            onToggleAvailability={
                              onUpdateDrinkAvailability
                                ? (isAvailable) => onUpdateDrinkAvailability(drink.id, isAvailable)
                                : undefined
                            }
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
                      userRating={drink.reviews.find((r) => r.userId === user.uid)?.rating}
                      isWishlisted={wishlist.has(drink.id)}
                      onToggleWishlist={() => handleToggleWishlist(drink.id)}
                      topFiveRank={getTopFiveRank(drink.id)}
                      onToggleTopFive={() => {
                        void handleToggleTopFive(drink);
                      }}
                      onTriggerReview={() => setActiveReviewDrink(drink)}
                      onOpenLightbox={(url, title, subtitle) => setLightboxImage({ url, title, subtitle })}
                      currentUserId={user.uid}
                      isAdmin={isAdmin}
                      onRequestDeleteReview={(dId, dName, rev) =>
                        setReviewPendingDelete({ drinkId: dId, drinkName: dName, review: rev })
                      }
                      onToggleAvailability={
                        onUpdateDrinkAvailability
                          ? (isAvailable) => onUpdateDrinkAvailability(drink.id, isAvailable)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="empty-state drinks-empty">
                <X size={32} />
                <h4>No drinks match your filters</h4>
                <p>Try refining your search keyword or selection criteria.</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="btn-secondary"
                    id="empty-clear-all-filters-btn"
                    data-testid="empty-clear-all-filters-btn"
                    style={{ marginTop: '12px' }}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : drinksLoading ? (
          <div className="loading-container event-drinks-loading" role="status" aria-live="polite">
            <div className="event-loading-visual">
              <progress
                aria-label={drinksRetrying ? 'Retrying event drinks load' : 'Loading event drinks'}
                className="loading-spinner"
              />
              <Loader2 className="event-loading-icon animate-spin" size={26} aria-hidden="true" />
            </div>
            <h4>{drinksRetrying ? 'Retrying connection...' : 'Loading event drinks...'}</h4>
            <p>
              {drinksRetrying
                ? 'Initial wait timed out — retrying automatically (attempt 2 of 2)...'
                : 'Fetching tap list and taster reviews for this event.'}
            </p>
          </div>
        ) : drinksError ? (
          <div className="empty-state drinks-empty drinks-error-state" role="alert">
            <AlertCircle size={32} />
            <h4>Could not load event drinks</h4>
            <p>{drinksError}</p>
            {onRetryDrinks && (
              <button
                type="button"
                className="btn-secondary btn-retry-drinks"
                onClick={onRetryDrinks}
              >
                <RotateCcw size={15} />
                <span>Retry Loading Drinks</span>
              </button>
            )}
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
        drink={
          activeReviewDrink
            ? event.drinks?.find((d) => d.id === activeReviewDrink.id) ?? activeReviewDrink
            : null
        }
        eventId={event.id}
        user={user}
        onClose={() => setActiveReviewDrink(null)}
        onSubmitReview={onAddReview}
        onDeleteReview={handleDeleteFromSheet}
        onToggleAvailability={
          onUpdateDrinkAvailability && activeReviewDrink
            ? (isAvailable) => onUpdateDrinkAvailability(activeReviewDrink.id, isAvailable)
            : undefined
        }
      />

      {/* Batch Beers Upload Dialog */}
      <BatchUploadModal
        isOpen={isBatchUploadOpen}
        onClose={() => {
          setIsBatchUploadOpen(false);
          setInitialBatchFile(null);
        }}
        onConfirmUpload={(drinks) => {
          onAddDrinksBatch(drinks);
          setIsBatchUploadOpen(false);
          setInitialBatchFile(null);
          setBatchSuccessMessage(`Successfully imported ${drinks.length} ${drinks.length === 1 ? 'beer' : 'beers'}!`);
          setTimeout(() => setBatchSuccessMessage(''), 5000);
        }}
        eventName={event.name}
        existingDrinks={event.drinks}
        initialFile={initialBatchFile}
      />

      {/* Top 5 Swap Dialog when list is at capacity */}
      <TopFiveSwapModal
        candidateDrink={swapCandidateDrink}
        topFiveDrinkIds={topFiveDrinkIds}
        drinks={event.drinks ?? []}
        userUid={user.uid}
        onClose={() => setSwapCandidateDrink(null)}
        onSwap={(removeId, addId) => {
          void swapTopFive(removeId, addId);
        }}
      />

      {/* Review Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={reviewPendingDelete !== null}
        title="Delete Review"
        message={
          <>
            Delete your review for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {reviewPendingDelete?.drinkName}
            </strong>
            ? This action cannot be undone.
          </>
        }
        confirmLabel="Delete Review"
        onConfirm={handleConfirmDeleteReview}
        onCancel={() => setReviewPendingDelete(null)}
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
  userRating?: number;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  topFiveRank: number | null;
  onToggleTopFive: () => void;
  currentUserId: string;
  isAdmin?: boolean;
  onRequestDeleteReview?: (drinkId: string, drinkName: string, review: BeerReview) => void;
  onToggleAvailability?: (isAvailable: boolean) => void;
}

const BeerDrinkCard: React.FC<BeerDrinkCardProps> = ({
  drink,
  userRating,
  isWishlisted,
  onToggleWishlist,
  topFiveRank,
  onToggleTopFive,
  onTriggerReview,
  onOpenLightbox,
  currentUserId,
  isAdmin,
  onRequestDeleteReview,
  onToggleAvailability,
}) => {
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);

  // Calculate Average Rating
  const avgRating = drink.reviews.length > 0
    ? (drink.reviews.reduce((acc, r) => acc + r.rating, 0) / drink.reviews.length).toFixed(1)
    : null;
  const flavorTags = topTags(drink.reviews);

  return (
    <div className={`beer-card ${drink.isAvailable === false ? 'is-ran-out' : ''} ${topFiveRank !== null ? 'is-top-five' : ''}`}>
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
            {topFiveRank !== null && (
              <span
                className={`top-five-card-badge ${userRating !== undefined ? 'tried' : ''}`}
                title={
                  userRating !== undefined
                    ? `Top 5 Pick #${topFiveRank} — Tried (${userRating.toFixed(1)}/10)`
                    : `Top 5 Must-Try Pick #${topFiveRank}`
                }
              >
                <Trophy size={11} />
                <span>Top #{topFiveRank}</span>
                {userRating !== undefined && <Check size={11} />}
              </span>
            )}
            {drink.isAvailable === false && (
              <span className="beer-status-badge badge-ran-out" title="This beer has run out">
                <Ban size={11} /> Ran Out
              </span>
            )}
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
          {avgRating && (
            <div className="avg-rating-badge">
              <Beer className="star-filled" size={18} fill="currentColor" />
              <span className="avg-val">{avgRating}</span>
              <span className="avg-val-scale" style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.85 }}>/10</span>
            </div>
          )}
          
          <button 
            type="button" 
            className={`btn-add-review-trigger ${drink.isAvailable === false ? 'is-unavailable' : ''} ${userRating !== undefined ? 'has-user-rating' : ''}`}
            onClick={drink.isAvailable === false ? undefined : onTriggerReview}
            disabled={drink.isAvailable === false}
            aria-disabled={drink.isAvailable === false}
            title={
              drink.isAvailable === false
                ? 'This beer has run out and is marked complete. New reviews are closed.'
                : userRating !== undefined
                  ? `You rated ${userRating.toFixed(1)}/10 — tap to edit`
                  : 'Rate and review this beer'
            }
          >
            {drink.isAvailable === false ? (
              <>
                <Ban size={14} />
                <span>{userRating !== undefined ? `Rated ${userRating.toFixed(1)} • Ran Out` : 'Ran Out • Closed'}</span>
              </>
            ) : userRating !== undefined ? (
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
              className={`share-btn top-five-btn ${topFiveRank !== null ? 'active' : ''}`}
              onClick={onToggleTopFive}
              aria-pressed={topFiveRank !== null}
              aria-label={
                topFiveRank !== null
                  ? `Remove ${drink.name} from Top 5 (currently #${topFiveRank})`
                  : `Add ${drink.name} to Top 5 wishlist`
              }
              title={
                topFiveRank !== null
                  ? `Remove from Top 5 (#${topFiveRank})`
                  : 'Add to Top 5 Must-Try wishlist'
              }
            >
              <Trophy size={14} />
              <span>{topFiveRank !== null ? `#${topFiveRank}` : 'Top 5'}</span>
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
          </div>
        </div>
      </div>

      {/* Expanded Reviews Drawer */}
      {isReviewsOpen && (
        <div className="beer-reviews-drawer">
          <div className="reviews-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <h5 style={{ margin: 0 }}>Reviews ({drink.reviews.length})</h5>
              {drink.isAvailable === false && (
                <span className="beer-status-badge badge-ran-out" title="Marked complete / ran out">
                  <Ban size={10} /> Ran Out
                </span>
              )}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {onToggleAvailability && (
                <button
                  type="button"
                  className={`btn-toggle-availability ${drink.isAvailable === false ? 'is-ran-out' : ''}`}
                  onClick={() => onToggleAvailability(drink.isAvailable === false)}
                  title={drink.isAvailable === false ? 'Mark as available' : 'Mark as ran out / complete'}
                  aria-label={drink.isAvailable === false ? 'Mark beer as available' : 'Mark beer as ran out / complete'}
                >
                  {drink.isAvailable === false ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Mark Available</span>
                    </>
                  ) : (
                    <>
                      <Ban size={13} />
                      <span>Mark as Ran Out</span>
                    </>
                  )}
                </button>
              )}
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
          </div>

          {drink.isAvailable === false && (
            <div className="reviews-drawer-alert" role="status">
              <Ban size={14} />
              <span>This beer has run out. Reviews are closed.</span>
            </div>
          )}

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
                    <div className="review-header-right" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <div className="review-stars-fixed" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <StarRating rating={rev.rating} maxStars={10} size={11} />
                        <span className="review-rating-num" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {rev.rating.toFixed(1)}
                        </span>
                      </div>
                      {(isAdmin || (rev.userId && rev.userId === currentUserId)) && onRequestDeleteReview && (
                        <button
                          type="button"
                          className="btn-icon-delete-review"
                          onClick={() => onRequestDeleteReview(drink.id, drink.name, rev)}
                          title="Delete this review"
                          aria-label={`Delete review by ${rev.reviewer}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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

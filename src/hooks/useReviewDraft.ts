import { useState, useEffect, useCallback } from 'react';
import type { User } from 'firebase/auth';
import type { BeerDrink } from '../types';
import {
  uploadImageFile,
  sanitizeOrUploadImageUrl,
  isBase64DataUrl,
} from '../utils/imageUtils';
import { cleanTags } from '../utils/tastingTags';
import { clampAndSnapRating } from '../utils/ratingUtils';

const DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const PRESET_SERVING_SIZES = new Set([
  'Pint',
  'Half Pint',
  'Third Pint',
  'Can',
  'Bottle',
  'Flight / Sample',
]);

interface StoredReviewDraft {
  rating: number;
  comment: string;
  price: string;
  servingSize: string;
  customServingSize: string;
  imageUrl: string;
  tags: string[];
  draftId: string;
  savedAt: number;
}

export interface UseReviewDraftOptions {
  drink: BeerDrink | null;
  eventId: string;
  user: User;
  onSubmitReview: (
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
  onClose: () => void;
}

function makeUuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString();
}

function getDraftStorageKey(eventId: string, drinkId: string): string {
  return `kegswap_review_draft_${eventId}_${drinkId}`;
}

function readStoredDraft(eventId: string, drinkId: string): StoredReviewDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getDraftStorageKey(eventId, drinkId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReviewDraft;
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(getDraftStorageKey(eventId, drinkId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredDraft(eventId: string, drinkId: string, draft: StoredReviewDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      getDraftStorageKey(eventId, drinkId),
      JSON.stringify(draft)
    );
  } catch {
    // Ignore quota errors
  }
}

function removeStoredDraft(eventId: string, drinkId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(getDraftStorageKey(eventId, drinkId));
  } catch {
    // Ignore
  }
}

export function useReviewDraft({
  drink,
  eventId,
  user,
  onSubmitReview,
  onClose,
}: UseReviewDraftOptions) {
  const reviewerName = user.displayName || user.email || 'Anonymous Taster';

  const [rating, setRating] = useState<number>(8.0);
  const [comment, setComment] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [servingSize, setServingSize] = useState<string>('');
  const [customServingSize, setCustomServingSize] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string>(() => makeUuid());
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [restoredDraft, setRestoredDraft] = useState<boolean>(false);
  const [isEditingExisting, setIsEditingExisting] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Initialize state when drink opens
  useEffect(() => {
    if (!drink) return;

    setError('');
    setUploadingImage(false);
    setHasInteracted(false);

    // 1. Check for unsaved sessionStorage draft first
    const cached = readStoredDraft(eventId, drink.id);
    if (cached) {
      setRating(clampAndSnapRating(cached.rating));
      setComment(cached.comment);
      setPrice(cached.price);
      setServingSize(cached.servingSize);
      setCustomServingSize(cached.customServingSize);
      setImageUrl(cached.imageUrl);
      setTags(cached.tags);
      setDraftId(cached.draftId);
      setRestoredDraft(true);
      const existing = drink.reviews.find((r) => r.userId === user.uid);
      setIsEditingExisting(Boolean(existing));
      return;
    }

    // 2. Check if user has already reviewed this drink
    const existingReview = drink.reviews.find((r) => r.userId === user.uid);
    if (existingReview) {
      setRating(clampAndSnapRating(existingReview.rating));
      setComment(existingReview.comment || '');
      setPrice(existingReview.price || '');
      const existingSize = existingReview.servingSize || '';
      if (existingSize && !PRESET_SERVING_SIZES.has(existingSize)) {
        setServingSize('Other');
        setCustomServingSize(existingSize);
      } else {
        setServingSize(existingSize);
        setCustomServingSize('');
      }
      setImageUrl(existingReview.imageUrl || '');
      setTags(existingReview.tags ? [...existingReview.tags] : []);
      setDraftId(existingReview.id);
      setRestoredDraft(false);
      setIsEditingExisting(true);
      return;
    }

    // 3. Fresh review
    setRating(8.0);
    setComment('');
    setPrice('');
    setServingSize(drink.caskOrKeg === 'Can' ? 'Can' : drink.caskOrKeg === 'Bottle' ? 'Bottle' : '');
    setCustomServingSize('');
    setImageUrl('');
    setTags([]);
    setDraftId(makeUuid());
    setRestoredDraft(false);
    setIsEditingExisting(false);
  }, [drink, eventId, user.uid]);

  // Persist draft to sessionStorage whenever user interacts
  useEffect(() => {
    if (!drink || !hasInteracted) return;
    writeStoredDraft(eventId, drink.id, {
      rating,
      comment,
      price,
      servingSize,
      customServingSize,
      imageUrl,
      tags,
      draftId,
      savedAt: Date.now(),
    });
  }, [
    drink,
    eventId,
    hasInteracted,
    rating,
    comment,
    price,
    servingSize,
    customServingSize,
    imageUrl,
    tags,
    draftId,
  ]);

  const markInteracted = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (val: React.SetStateAction<T>) => {
      setHasInteracted(true);
      setter(val);
    };
  }, []);

  const handlePhotoFileSelect = async (file: File) => {
    if (!drink) return;
    setUploadingImage(true);
    setError('');
    setHasInteracted(true);
    try {
      const storagePath = `events/${eventId}/reviews/${draftId}.jpg`;
      const downloadUrl = await uploadImageFile(file, storagePath);
      setImageUrl(downloadUrl);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to upload photo';
      setError(errMsg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drink) return;
    if (rating < 0.5 || rating > 10.0) {
      setError('Rating must be between 0.5 and 10.0');
      return;
    }

    const effectiveServingSize =
      servingSize === 'Other' ? customServingSize.trim() : servingSize.trim();

    let finalImageUrl = imageUrl.trim() || undefined;
    if (finalImageUrl && isBase64DataUrl(finalImageUrl)) {
      try {
        setUploadingImage(true);
        finalImageUrl = await sanitizeOrUploadImageUrl(
          finalImageUrl,
          `events/${eventId}/reviews/${draftId}.jpg`
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to process review photo';
        setError(errMsg);
        setUploadingImage(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    }

    const cleanedTags = cleanTags(tags);

    onSubmitReview(
      drink.id,
      reviewerName.trim(),
      clampAndSnapRating(rating),
      comment.trim(),
      price.trim() || undefined,
      effectiveServingSize || undefined,
      finalImageUrl,
      draftId,
      cleanedTags
    );

    removeStoredDraft(eventId, drink.id);
    onClose();
  };

  const handleDiscardDraft = () => {
    if (!drink) return;
    removeStoredDraft(eventId, drink.id);
    setRestoredDraft(false);
    setHasInteracted(false);
    setRating(8.0);
    setComment('');
    setPrice('');
    setServingSize('');
    setCustomServingSize('');
    setImageUrl('');
    setTags([]);
    setDraftId(makeUuid());
  };

  return {
    reviewerName,
    rating,
    setRating: markInteracted(setRating),
    comment,
    setComment: markInteracted(setComment),
    price,
    setPrice: markInteracted(setPrice),
    servingSize,
    setServingSize: markInteracted(setServingSize),
    customServingSize,
    setCustomServingSize: markInteracted(setCustomServingSize),
    imageUrl,
    setImageUrl: markInteracted(setImageUrl),
    tags,
    setTags: markInteracted(setTags),
    uploadingImage,
    error,
    setError,
    restoredDraft,
    isEditingExisting,
    handlePhotoFileSelect,
    handleSubmit,
    handleDiscardDraft,
  };
}

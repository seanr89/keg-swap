import React, { useRef, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { BeerDrink } from '../../types';
import { X, Check, AlertCircle, RotateCcw, UserCheck } from 'lucide-react';
import { useReviewDraft } from '../../hooks/useReviewDraft';
import { RatingScrubber } from './RatingScrubber';
import { ServingFormatSelector } from './ServingFormatSelector';
import { TastingTagPicker } from './TastingTagPicker';
import { TastingNotesInput } from './TastingNotesInput';
import { ReviewPhotoControl } from './ReviewPhotoControl';

export interface ReviewBottomSheetProps {
  drink: BeerDrink | null;
  eventId: string;
  user: User;
  onClose: () => void;
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
}

const DISMISS_DISTANCE_PX = 100;
const DISMISS_VELOCITY_PX_MS = 0.55;

export const ReviewBottomSheet: React.FC<ReviewBottomSheetProps> = ({
  drink,
  eventId,
  user,
  onClose,
  onSubmitReview,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragStateRef = useRef<{
    startY: number;
    startTime: number;
    active: boolean;
  }>({ startY: 0, startTime: 0, active: false });

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  const {
    reviewerName,
    rating,
    setRating,
    comment,
    setComment,
    price,
    setPrice,
    servingSize,
    setServingSize,
    customServingSize,
    setCustomServingSize,
    imageUrl,
    setImageUrl,
    tags,
    setTags,
    uploadingImage,
    error,
    restoredDraft,
    isEditingExisting,
    handlePhotoFileSelect,
    handleSubmit,
    handleDiscardDraft,
  } = useReviewDraft({
    drink,
    eventId,
    user,
    onSubmitReview,
    onClose,
  });

  // Progressive enhancement: set `closedby="any"` attribute on native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute('closedby', 'any');
  }, []);

  // Sync React `drink` state with native modal `<dialog>`
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    setDragOffsetY(0);
    setIsDraggingSheet(false);

    if (drink) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [drink]);

  // Native Escape / close event & backdrop light-dismiss fallback for Safari
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      onClose();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (e.target === dialog) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Do not start sheet drag if clicking the close button
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startY: e.clientY,
      startTime: performance.now(),
      active: true,
    };
    setIsDraggingSheet(true);
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const deltaY = e.clientY - dragStateRef.current.startY;
    setDragOffsetY(Math.max(0, deltaY));
  };

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const deltaY = Math.max(0, e.clientY - dragStateRef.current.startY);
    const elapsed = Math.max(1, performance.now() - dragStateRef.current.startTime);
    const velocity = deltaY / elapsed;

    dragStateRef.current.active = false;
    setIsDraggingSheet(false);

    if (deltaY > DISMISS_DISTANCE_PX || (deltaY > 35 && velocity > DISMISS_VELOCITY_PX_MS)) {
      setDragOffsetY(0);
      onClose();
    } else {
      setDragOffsetY(0);
    }
  };

  const sheetTransformStyle: React.CSSProperties =
    dragOffsetY > 0
      ? {
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDraggingSheet ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }
      : {};

  return (
    <dialog
      ref={dialogRef}
      className="event-modal-dialog review-bottom-sheet"
      id="add-review-dialog"
      aria-labelledby="review-dialog-title"
      style={sheetTransformStyle}
    >
      {drink && (
        <>
          {/* Mobile Pull-to-Dismiss Drag Handle & Header */}
          <div
            className="sheet-drag-header"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
          >
            <div className="sheet-drag-handle" aria-hidden="true" />

            <div className="modal-header review-sheet-title-row">
              <div className="review-sheet-title-group">
                <h2 id="review-dialog-title">
                  {isEditingExisting ? `Update Review` : `Review ${drink.name}`}
                </h2>
                <p className="review-sheet-subtitle">
                  {isEditingExisting ? `${drink.name} • ` : ''}
                  {drink.brewery} • <strong>{drink.abv}</strong> • {drink.style}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Close review sheet"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="modal-form review-sheet-form">
            {error && (
              <div className="form-alert review-alert" role="alert">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {restoredDraft && (
              <div className="draft-restored-banner" role="status">
                <span>Unsaved review draft restored</span>
                <button
                  type="button"
                  className="btn-reset-draft"
                  onClick={handleDiscardDraft}
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              </div>
            )}

            {/* 1. Tactile 0.5-10.0 Rating Scrubber */}
            <RatingScrubber
              rating={rating}
              onChange={setRating}
              disabled={uploadingImage}
            />

            {/* 2. 1-Tap Serving Format Pills & Decimal Price Input */}
            <ServingFormatSelector
              servingSize={servingSize}
              customServingSize={customServingSize}
              price={price}
              onServingSizeChange={setServingSize}
              onCustomServingSizeChange={setCustomServingSize}
              onPriceChange={setPrice}
              disabled={uploadingImage}
            />

            {/* 3. Categorized Flavor Profile Tags */}
            <TastingTagPicker
              selectedTags={tags}
              onChange={setTags}
              disabled={uploadingImage}
            />

            {/* 4. Quick Impressions & Auto-Expanding Notes */}
            <TastingNotesInput
              comment={comment}
              onChange={setComment}
              disabled={uploadingImage}
            />

            {/* 5. Mobile Camera Capture & Photo Preview */}
            <ReviewPhotoControl
              imageUrl={imageUrl}
              uploading={uploadingImage}
              onFileSelect={handlePhotoFileSelect}
              onImageUrlChange={setImageUrl}
              disabled={uploadingImage}
            />

            {/* Reviewer Attribution Pill */}
            <div className="reviewer-attribution-row">
              <UserCheck size={14} />
              <span>
                Posting as <strong>{reviewerName}</strong>
              </span>
            </div>

            {/* Sticky Bottom Thumb-Zone Action Bar */}
            <div className="modal-actions review-sheet-actions">
              <button
                type="button"
                className="btn-secondary btn-sheet-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary btn-sheet-submit"
                disabled={uploadingImage}
              >
                <Check size={17} />
                <span>
                  {isEditingExisting
                    ? `Update (${rating.toFixed(1)}/10)`
                    : `Submit Review (${rating.toFixed(1)}/10)`}
                </span>
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
};

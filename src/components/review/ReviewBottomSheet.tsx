import React, { useRef, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { BeerDrink } from '../../types';
import { X, Check, AlertCircle, RotateCcw, UserCheck, ChevronDown, SlidersHorizontal, Trash2, Ban, CheckCircle2 } from 'lucide-react';
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
  onDeleteReview?: (drinkId: string, reviewId: string, imageUrl?: string) => void | Promise<void>;
  onToggleAvailability?: (isAvailable: boolean) => void | Promise<void>;
}

const DISMISS_DISTANCE_PX = 100;
const DISMISS_VELOCITY_PX_MS = 0.55;

export const ReviewBottomSheet: React.FC<ReviewBottomSheetProps> = ({
  drink,
  eventId,
  user,
  onClose,
  onSubmitReview,
  onDeleteReview,
  onToggleAvailability,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragStateRef = useRef<{
    startY: number;
    startTime: number;
    active: boolean;
  }>({ startY: 0, startTime: 0, active: false });

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    handleDeleteExistingReview,
  } = useReviewDraft({
    drink,
    eventId,
    user,
    onSubmitReview,
    onDeleteReview,
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
    setIsAdditionalOpen(false);
    setConfirmingDelete(false);

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

  const effectiveServingSize =
    servingSize === 'Other' ? customServingSize.trim() : servingSize.trim();
  const additionalItemsCount =
    (effectiveServingSize ? 1 : 0) +
    (price.trim() ? 1 : 0) +
    (tags.length > 0 ? 1 : 0) +
    (imageUrl.trim() ? 1 : 0);

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

          <form onSubmit={handleSubmit} className="modal-form review-sheet-form" noValidate>
            {drink.isAvailable === false ? (
              <div className="review-sheet-ran-out-banner" role="status">
                <div className="review-sheet-banner-content">
                  <Ban size={18} className="banner-icon" />
                  <div>
                    <p className="banner-title">Marked as Complete / Ran Out</p>
                    <p className="banner-desc">This beer has run out. Reviews are closed.</p>
                  </div>
                </div>
                {onToggleAvailability && (
                  <button
                    type="button"
                    className="btn-toggle-availability-sheet"
                    onClick={() => {
                      void onToggleAvailability(true);
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Mark Available</span>
                  </button>
                )}
              </div>
            ) : (
              onToggleAvailability && (
                <div className="review-sheet-availability-bar">
                  <span className="availability-status-text">Status: <strong>Available</strong></span>
                  <button
                    type="button"
                    className="btn-mark-ran-out-sheet"
                    onClick={() => {
                      void onToggleAvailability(false);
                    }}
                    title="Mark this beer as ran out / complete"
                  >
                    <Ban size={13} />
                    <span>Mark as Ran Out</span>
                  </button>
                </div>
              )
            )}

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

            {/* 2. Quick Impressions & Auto-Expanding Notes (Required) */}
            <TastingNotesInput
              comment={comment}
              onChange={setComment}
              disabled={uploadingImage}
              required
              hasError={error === 'Tasting notes are required'}
            />

            {/* 3. Collapsible Additional Feedback Section */}
            <details
              className="review-additional-feedback"
              open={isAdditionalOpen}
              onToggle={(e) => setIsAdditionalOpen(e.currentTarget.open)}
            >
              <summary className="review-additional-summary">
                <div className="review-additional-summary-text">
                  <span className="review-additional-title">
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    <span>Additional Feedback</span>
                  </span>
                  <span className="review-additional-subtitle">
                    Optional • Serving format, price, flavor tags &amp; photo
                  </span>
                </div>
                <div className="review-additional-summary-meta">
                  {additionalItemsCount > 0 && (
                    <span className="review-additional-count-badge">
                      {additionalItemsCount} added
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className="review-additional-chevron"
                    aria-hidden="true"
                  />
                </div>
              </summary>

              <div className="review-additional-content">
                {/* Serving Format Pills & Decimal Price Input */}
                <ServingFormatSelector
                  servingSize={servingSize}
                  customServingSize={customServingSize}
                  price={price}
                  onServingSizeChange={setServingSize}
                  onCustomServingSizeChange={setCustomServingSize}
                  onPriceChange={setPrice}
                  disabled={uploadingImage}
                />

                {/* Categorized Flavor Profile Tags */}
                <TastingTagPicker
                  selectedTags={tags}
                  onChange={setTags}
                  disabled={uploadingImage}
                />

                {/* Mobile Camera Capture & Photo Preview */}
                <ReviewPhotoControl
                  imageUrl={imageUrl}
                  uploading={uploadingImage}
                  onFileSelect={handlePhotoFileSelect}
                  onImageUrlChange={setImageUrl}
                  disabled={uploadingImage}
                />
              </div>
            </details>

            {/* Reviewer Attribution Pill */}
            <div className="reviewer-attribution-row">
              <UserCheck size={14} />
              <span>
                Posting as <strong>{reviewerName}</strong>
              </span>
            </div>

            {/* Delete Existing Review Section (with Confirmation Guardrail) */}
            {isEditingExisting && onDeleteReview && (
              <div className="review-sheet-delete-section">
                {confirmingDelete ? (
                  <div className="review-sheet-delete-confirm" role="alert">
                    <span className="review-sheet-delete-prompt">
                      Delete your review for <strong>{drink.name}</strong>? This cannot be undone.
                    </span>
                    <div className="review-sheet-delete-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => setConfirmingDelete(false)}
                      >
                        Keep Review
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-small"
                        onClick={() => {
                          void handleDeleteExistingReview();
                        }}
                      >
                        <Trash2 size={14} />
                        <span>Confirm Delete</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-delete-review-sheet"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 size={14} />
                    <span>Delete My Review</span>
                  </button>
                )}
              </div>
            )}

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
                className={`btn-primary btn-sheet-submit ${drink.isAvailable === false ? 'is-disabled' : ''}`}
                disabled={uploadingImage || drink.isAvailable === false}
                aria-disabled={uploadingImage || drink.isAvailable === false}
                title={drink.isAvailable === false ? 'This beer has run out. Reviews are closed.' : undefined}
              >
                {drink.isAvailable === false ? (
                  <>
                    <Ban size={17} />
                    <span>Ran Out • Reviews Closed</span>
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    <span>
                      {isEditingExisting
                        ? `Update (${rating.toFixed(1)}/10)`
                        : `Submit Review (${rating.toFixed(1)}/10)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
};

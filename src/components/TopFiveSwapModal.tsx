import React, { useEffect, useId, useMemo, useRef } from 'react';
import { ArrowLeftRight, Check, Trophy, X } from 'lucide-react';
import type { BeerDrink } from '../types';

export interface TopFiveSwapModalProps {
  candidateDrink: BeerDrink | null;
  topFiveDrinkIds: readonly string[];
  drinks: readonly BeerDrink[];
  userUid: string;
  onClose: () => void;
  onSwap: (removeDrinkId: string, addDrinkId: string) => void;
}

export const TopFiveSwapModal: React.FC<TopFiveSwapModalProps> = ({
  candidateDrink,
  topFiveDrinkIds,
  drinks,
  userUid,
  onClose,
  onSwap,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isOpen = candidateDrink !== null;

  const currentTopFiveDrinks = useMemo(() => {
    const byId = new Map<string, BeerDrink>();
    for (const d of drinks) {
      byId.set(d.id, d);
    }
    return topFiveDrinkIds
      .map((id, idx) => ({
        rank: idx + 1,
        id,
        drink: byId.get(id),
      }))
      .filter((entry): entry is { rank: number; id: string; drink: BeerDrink } =>
        Boolean(entry.drink)
      );
  }, [drinks, topFiveDrinkIds]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      onClose();
    };

    // Fallback for browsers without closedby support (e.g. Safari)
    const handleBackdropClick = (event: MouseEvent) => {
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;

        if (!isDialogContent) {
          dialog.close();
        }
      }
    };

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="event-modal-dialog top-five-swap-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      {candidateDrink && (
        <div className="modal-content">
          <div className="modal-header">
            <div className="modal-title-with-icon" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="top-five-trophy-badge" aria-hidden="true">
                <Trophy size={18} />
              </span>
              <h3 id={titleId} style={{ margin: 0 }}>
                Your Top 5 List is Full
              </h3>
            </div>
            <button
              type="button"
              className="btn-close-modal"
              onClick={onClose}
              aria-label="Close swap dialog"
            >
              <X size={20} />
            </button>
          </div>

          <div className="top-five-swap-body">
            <p className="top-five-swap-description">
              Your Top 5 list is full. Which beer would you like to swap out for{' '}
              <strong>{candidateDrink.name}</strong> ({candidateDrink.brewery} • {candidateDrink.abv})?
            </p>

            <div className="top-five-swap-list" role="list">
              {currentTopFiveDrinks.map(({ rank, drink }) => {
                const userReview = drink.reviews.find((r) => r.userId === userUid);
                const isTried = Boolean(userReview);

                return (
                  <div
                    key={drink.id}
                    className="top-five-swap-row"
                    role="listitem"
                  >
                    <div className="top-five-swap-row-info">
                      <span className="top-five-rank-badge">#{rank}</span>
                      <div className="top-five-swap-row-text">
                        <div className="top-five-swap-row-title">
                          <span>{drink.name}</span>
                          {isTried && (
                            <span className="top-five-status-badge tried">
                              <Check size={11} />
                              Tried ({userReview!.rating.toFixed(1)})
                            </span>
                          )}
                        </div>
                        <span className="top-five-swap-row-meta">
                          {drink.brewery} • {drink.style} • {drink.abv}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-swap-top-five"
                      onClick={() => {
                        onSwap(drink.id, candidateDrink.id);
                        onClose();
                      }}
                      aria-label={`Swap #${rank} ${drink.name} with ${candidateDrink.name}`}
                    >
                      <ArrowLeftRight size={14} />
                      <span>Swap #{rank}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              autoFocus
              onClick={onClose}
            >
              Keep Current Top 5
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
};

import React, { useId, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import type { BeerDrink } from '../types';
import { MAX_TOP_FIVE } from '../utils/wishlist';

export interface TopFiveHeroTrayProps {
  drinks: readonly BeerDrink[];
  topFiveDrinkIds: readonly string[];
  userUid: string;
  isFilteredByTopFive: boolean;
  onToggleFilterTopFive: () => void;
  onRemoveFromTopFive: (drinkId: string) => void;
  onMoveTopFive: (fromIndex: number, toIndex: number) => void;
  onTriggerReview: (drink: BeerDrink) => void;
}

export const TopFiveHeroTray: React.FC<TopFiveHeroTrayProps> = ({
  drinks,
  topFiveDrinkIds,
  userUid,
  isFilteredByTopFive,
  onToggleFilterTopFive,
  onRemoveFromTopFive,
  onMoveTopFive,
  onTriggerReview,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const trayBodyId = useId();

  const drinksById = useMemo(() => {
    const map = new Map<string, BeerDrink>();
    for (const d of drinks) {
      map.set(d.id, d);
    }
    return map;
  }, [drinks]);

  const selectedDrinks = useMemo(() => {
    const resolved: BeerDrink[] = [];
    for (const id of topFiveDrinkIds) {
      const found = drinksById.get(id);
      if (found && resolved.length < MAX_TOP_FIVE) {
        resolved.push(found);
      }
    }
    return resolved;
  }, [topFiveDrinkIds, drinksById]);

  const triedCount = useMemo(() => {
    return selectedDrinks.filter((drink) =>
      drink.reviews.some((rev) => rev.userId === userUid)
    ).length;
  }, [selectedDrinks, userUid]);

  const slots = useMemo(() => {
    return Array.from({ length: MAX_TOP_FIVE }, (_, idx) => ({
      rank: idx + 1,
      index: idx,
      drink: selectedDrinks[idx] ?? null,
    }));
  }, [selectedDrinks]);

  const allSelectedTried =
    selectedDrinks.length > 0 && triedCount === selectedDrinks.length;

  return (
    <section className="top-five-tray" aria-label="Top 5 Must-Try Wishlist">
      <div className="top-five-tray-header">
        <div className="top-five-tray-title-group">
          <span className="top-five-trophy-badge" aria-hidden="true">
            <Trophy size={16} />
          </span>
          <div>
            <div className="top-five-heading-row">
              <h4 className="top-five-tray-title">Top 5 Must-Try</h4>
              <span className="top-five-count-pill">
                {selectedDrinks.length}/{MAX_TOP_FIVE} selected
              </span>
              {selectedDrinks.length > 0 && (
                <span
                  className={`top-five-progress-pill ${allSelectedTried ? 'completed' : ''}`}
                >
                  {allSelectedTried && <Check size={12} />}
                  {triedCount}/{selectedDrinks.length} tried
                </span>
              )}
            </div>
            <p className="top-five-tray-subtitle">
              Prioritize up to 5 beers you don&apos;t want to miss at this event.
            </p>
          </div>
        </div>

        <div className="top-five-tray-actions">
          {selectedDrinks.length > 0 && (
            <button
              type="button"
              className={`top-five-filter-btn ${isFilteredByTopFive ? 'active' : ''}`}
              aria-pressed={isFilteredByTopFive}
              onClick={onToggleFilterTopFive}
            >
              <Trophy size={13} />
              <span>{isFilteredByTopFive ? 'Showing Top 5' : 'Filter Top 5'}</span>
            </button>
          )}
          <button
            type="button"
            className="top-five-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-controls={trayBodyId}
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Expand Top 5 tray' : 'Collapse Top 5 tray'}
          >
            <span>{isCollapsed ? 'Show Slots' : 'Hide'}</span>
            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div id={trayBodyId} className="top-five-slots-grid" role="list">
          {slots.map(({ rank, index, drink }) => {
            if (!drink) {
              return (
                <div
                  key={`empty-slot-${rank}`}
                  className="top-five-slot empty"
                  role="listitem"
                  aria-label={`Slot #${rank}: Empty`}
                >
                  <div className="top-five-slot-top">
                    <span className="top-five-rank-badge muted">#{rank}</span>
                    <span className="top-five-empty-label">Open Slot</span>
                  </div>
                  <p className="top-five-empty-hint">
                    Tap <strong>Top 5</strong> on any drink card below to claim slot #{rank}.
                  </p>
                </div>
              );
            }

            const userReview = drink.reviews.find((r) => r.userId === userUid);
            const isTried = Boolean(userReview);

            return (
              <div
                key={drink.id}
                className={`top-five-slot filled ${isTried ? 'is-tried' : ''}`}
                role="listitem"
                aria-label={`Slot #${rank}: ${drink.name} by ${drink.brewery}`}
              >
                <div className="top-five-slot-top">
                  <div className="top-five-slot-badges">
                    <span className="top-five-rank-badge">#{rank}</span>
                    {isTried ? (
                      <span className="top-five-status-badge tried">
                        <Check size={11} />
                        Tried • {userReview!.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="top-five-status-badge pending">Must-Try</span>
                    )}
                  </div>

                  <div className="top-five-slot-controls">
                    <button
                      type="button"
                      className="top-five-slot-icon-btn"
                      disabled={index === 0}
                      onClick={() => onMoveTopFive(index, index - 1)}
                      aria-label={`Move ${drink.name} up to #${rank - 1}`}
                      title={`Move up to #${rank - 1}`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      className="top-five-slot-icon-btn"
                      disabled={index === selectedDrinks.length - 1}
                      onClick={() => onMoveTopFive(index, index + 1)}
                      aria-label={`Move ${drink.name} down to #${rank + 1}`}
                      title={`Move down to #${rank + 1}`}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      className="top-five-slot-icon-btn remove"
                      onClick={() => onRemoveFromTopFive(drink.id)}
                      aria-label={`Remove ${drink.name} from Top 5`}
                      title="Remove from Top 5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="top-five-slot-body">
                  <h5 className="top-five-slot-name" title={drink.name}>
                    {drink.name}
                  </h5>
                  <p className="top-five-slot-meta">
                    <span>{drink.brewery}</span>
                    <span aria-hidden="true">•</span>
                    <span>{drink.abv}</span>
                  </p>
                </div>

                <button
                  type="button"
                  className={`top-five-slot-rate-btn ${isTried ? 'rated' : ''}`}
                  onClick={() => onTriggerReview(drink)}
                >
                  <Star size={12} fill={isTried ? 'currentColor' : 'none'} />
                  <span>{isTried ? 'Edit Rating' : 'Rate & Check Off'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

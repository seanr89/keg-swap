import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BeerDrink } from '../types';
import { TopFiveHeroTray } from './TopFiveHeroTray';
import { TopFiveSwapModal } from './TopFiveSwapModal';
import { useWishlist } from '../hooks/useWishlist';

type SnapshotCallback = (snapshot: { data: () => Record<string, unknown> | undefined }) => void;
let latestSnapshotCallback: SnapshotCallback | null = null;
const mockSetDoc = vi.fn(async () => Promise.resolve());

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  arrayUnion: (val: string) => ({ __op: 'arrayUnion', val }),
  arrayRemove: (val: string) => ({ __op: 'arrayRemove', val }),
  onSnapshot: (_ref: unknown, onNext: SnapshotCallback) => {
    latestSnapshotCallback = onNext;
    return () => {
      latestSnapshotCallback = null;
    };
  },
}));

vi.mock('../firebase', () => ({
  db: {},
}));

const makeDrinks = (count: number): BeerDrink[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: `drink-${idx + 1}`,
    name: `Craft Beer ${idx + 1}`,
    brewery: `Brewery ${idx + 1}`,
    location: 'Leeds, UK',
    abv: `${4.5 + idx * 0.5}%`,
    style: 'IPA',
    description: 'Delicious craft beer',
    reviews:
      idx === 0
        ? [
            {
              id: 'rev-1',
              reviewer: 'Test User',
              rating: 9.0,
              comment: 'Superb',
              createdAt: '2026-10-26T12:00:00Z',
              userId: 'user-1',
            },
          ]
        : [],
  }));

describe('TopFiveHeroTray', () => {
  it('renders 5 slots with filled and open states, progress badges, and handles reorder/remove/rate actions', () => {
    const drinks = makeDrinks(6);
    const onToggleFilter = vi.fn();
    const onRemove = vi.fn();
    const onMove = vi.fn();
    const onTriggerReview = vi.fn();

    render(
      <TopFiveHeroTray
        drinks={drinks}
        topFiveDrinkIds={['drink-1', 'drink-2']}
        userUid="user-1"
        isFilteredByTopFive={false}
        onToggleFilterTopFive={onToggleFilter}
        onRemoveFromTopFive={onRemove}
        onMoveTopFive={onMove}
        onTriggerReview={onTriggerReview}
      />
    );

    expect(screen.getByText('Top 5 Must-Try')).toBeInTheDocument();
    expect(screen.getByText('2/5 selected')).toBeInTheDocument();
    expect(screen.getByText('1/2 tried')).toBeInTheDocument();

    // Verify filled slots and tried status
    expect(screen.getByText('Craft Beer 1')).toBeInTheDocument();
    expect(screen.getByText(/Tried • 9\.0/)).toBeInTheDocument();
    expect(screen.getByText('Craft Beer 2')).toBeInTheDocument();

    // Verify 3 remaining open slots
    const openSlots = screen.getAllByText('Open Slot');
    expect(openSlots).toHaveLength(3);

    // Move drink-2 up to #1
    const moveUpBtn = screen.getByRole('button', { name: /Move Craft Beer 2 up to #1/i });
    fireEvent.click(moveUpBtn);
    expect(onMove).toHaveBeenCalledWith(1, 0);

    // Remove drink-1 from Top 5
    const removeBtn = screen.getByRole('button', { name: /Remove Craft Beer 1 from Top 5/i });
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith('drink-1');

    // Trigger review on drink-2
    const rateBtn = screen.getByRole('button', { name: /Rate & Check Off/i });
    fireEvent.click(rateBtn);
    expect(onTriggerReview).toHaveBeenCalledWith(drinks[1]);

    // Filter Top 5 button
    const filterBtn = screen.getByRole('button', { name: /Filter Top 5/i });
    fireEvent.click(filterBtn);
    expect(onToggleFilter).toHaveBeenCalledTimes(1);

    // Collapse / Expand tray
    const collapseBtn = screen.getByRole('button', { name: /Hide/i });
    fireEvent.click(collapseBtn);
    expect(screen.queryByText('Craft Beer 1')).not.toBeInTheDocument();
  });
});

describe('TopFiveSwapModal', () => {
  it('displays the current 5 drinks and swaps the selected slot with the candidate drink', () => {
    const drinks = makeDrinks(6);
    const onClose = vi.fn();
    const onSwap = vi.fn();

    render(
      <TopFiveSwapModal
        candidateDrink={drinks[5]}
        topFiveDrinkIds={['drink-1', 'drink-2', 'drink-3', 'drink-4', 'drink-5']}
        drinks={drinks}
        userUid="user-1"
        onClose={onClose}
        onSwap={onSwap}
      />
    );

    expect(screen.getByText('Your Top 5 List is Full')).toBeInTheDocument();
    expect(screen.getByText('Craft Beer 6')).toBeInTheDocument();

    const swapSlot3Btn = screen.getByRole('button', {
      name: /Swap #3 Craft Beer 3 with Craft Beer 6/i,
    });
    fireEvent.click(swapSlot3Btn);

    expect(onSwap).toHaveBeenCalledWith('drink-3', 'drink-6');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useWishlist hook with Top 5 support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestSnapshotCallback = null;
  });

  it('syncs topFiveDrinkIds from Firestore, computes ranks, and enforces the 5-drink cap', async () => {
    const { result } = renderHook(() => useWishlist('user-1', 'event-1'));

    act(() => {
      latestSnapshotCallback?.({
        data: () => ({
          drinkIds: ['d1', 'd2', 'd3', 'd4', 'd5'],
          topFiveDrinkIds: ['d1', 'd2', 'd3', 'd4', 'd5'],
        }),
      });
    });

    expect(result.current.topFiveDrinkIds).toEqual(['d1', 'd2', 'd3', 'd4', 'd5']);
    expect(result.current.getTopFiveRank('d1')).toBe(1);
    expect(result.current.getTopFiveRank('d5')).toBe(5);
    expect(result.current.getTopFiveRank('d6')).toBeNull();
    expect(result.current.isTopFive('d3')).toBe(true);

    // Attempting to add a 6th drink returns limit-reached without writing to Firestore
    let actionResult: string | undefined;
    await act(async () => {
      actionResult = await result.current.toggleTopFive('d6');
    });
    expect(actionResult).toBe('limit-reached');
    expect(mockSetDoc).not.toHaveBeenCalled();

    // Swapping d2 with d6 writes updated topFiveDrinkIds to Firestore
    await act(async () => {
      await result.current.swapTopFive('d2', 'd6');
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });
});

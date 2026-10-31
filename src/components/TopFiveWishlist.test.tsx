import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerDrink, BeerEvent } from '../types';
import { TopFiveHeroTray } from './TopFiveHeroTray';
import { TopFiveSwapModal } from './TopFiveSwapModal';
import { EventDetailScreen } from './EventDetailScreen';
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

    // Swapping d2 with d6 writes updated topFiveDrinkIds to Firestore and updates state immediately
    await act(async () => {
      await result.current.swapTopFive('d2', 'd6');
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(result.current.topFiveDrinkIds).toEqual(['d1', 'd6', 'd3', 'd4', 'd5']);
    expect(result.current.wishlist.has('d6')).toBe(true);
  });

  it('optimistically updates wishlist and Top 5 state immediately when adding, removing, and reordering', async () => {
    const { result } = renderHook(() => useWishlist('user-1', 'event-1'));

    // Add d1 to Top 5 before any snapshot arrives
    await act(async () => {
      const action = await result.current.toggleTopFive('d1');
      expect(action).toBe('added');
    });
    expect(result.current.topFiveDrinkIds).toEqual(['d1']);
    expect(result.current.wishlist.has('d1')).toBe(true);

    // Toggle d2 in general wishlist
    act(() => {
      result.current.toggle('d2');
    });
    expect(result.current.wishlist.has('d2')).toBe(true);

    // Remove d1 from Top 5
    await act(async () => {
      const action = await result.current.toggleTopFive('d1');
      expect(action).toBe('removed');
    });
    expect(result.current.topFiveDrinkIds).toEqual([]);
  });
});

describe('EventDetailScreen wishlist UI and filter controls refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestSnapshotCallback = null;
  });

  it('refreshes Top 5 hero tray, drink card badges, and filter controls when items are added or removed', async () => {
    const drinks: BeerDrink[] = [
      {
        id: 'drink-1',
        name: 'Northern Haze',
        brewery: 'Brewery One',
        location: 'Leeds',
        abv: '5.2%',
        style: 'IPA',
        type: 'Cask',
        caskOrKeg: 'Cask',
        isVegan: true,
        description: 'Hoppy pale',
        reviews: [],
      },
      {
        id: 'drink-2',
        name: 'Midnight Velvet',
        brewery: 'Brewery Two',
        location: 'York',
        abv: '6.8%',
        style: 'Stout',
        type: 'Rotating Keg',
        caskOrKeg: 'Keg',
        description: 'Rich roast',
        reviews: [],
      },
    ];

    const event: BeerEvent = {
      id: 'event-1',
      name: 'Autumn Tap Takeover',
      date: '2026-10-31',
      address: 'Leeds Dock',
      status: 'Ongoing',
      drinks,
    };

    const mockUser = { uid: 'user-1', displayName: 'Test User', email: 'test@example.com' } as User;

    render(
      <EventDetailScreen
        event={event}
        user={mockUser}
        onBack={vi.fn()}
        onAddDrink={vi.fn()}
        onAddReview={vi.fn()}
        onAddDrinksBatch={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    // Initial state: 0/5 selected in Top 5 and 0 in Wishlist
    expect(screen.getByText('0/5 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wishlist (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Top 5 (0/5)' })).toBeInTheDocument();

    // Add Northern Haze (drink-1) to Top 5
    const addTopFiveBtn = screen.getByRole('button', { name: /Add Northern Haze to Top 5 wishlist/i });
    await act(async () => {
      fireEvent.click(addTopFiveBtn);
    });

    // Hero tray and filter tabs immediately update
    expect(screen.getByText('1/5 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wishlist (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Top 5 (1/5)' })).toBeInTheDocument();

    // Filter by Top 5 using the filter tab
    fireEvent.click(screen.getByRole('button', { name: 'Top 5 (1/5)' }));
    expect(screen.getByText('Drinks Available (1)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Styles (1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'IPA (1)' })).toBeInTheDocument();

    // Remove the last Top 5 item via the Hero Tray remove button -> filter resets back to All (2)
    const removeFromTrayBtn = screen.getByRole('button', { name: /Remove Northern Haze from Top 5$/i });
    await act(async () => {
      fireEvent.click(removeFromTrayBtn);
    });

    expect(screen.getByText('0/5 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Top 5 (0/5)' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Drinks Available (2)')).toBeInTheDocument();

    // Verify search bar structure and styling without problematic inline flex height on mobile
    const searchInput = screen.getByRole('textbox', { name: /search drinks by name, brewery or style/i });
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveClass('search-input');
    const searchBarContainer = searchInput.closest('.search-bar');
    expect(searchBarContainer).not.toBeNull();
    expect((searchBarContainer as HTMLElement).style.flex).not.toContain('250px');
    const drinksToolbar = searchInput.closest('.toolbar');
    expect(drinksToolbar).toHaveClass('drinks-toolbar');
  });
});

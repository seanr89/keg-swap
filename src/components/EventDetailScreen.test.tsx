import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerEvent, BeerDrink } from '../types';
import { EventDetailScreen } from './EventDetailScreen';

vi.mock('../utils/imageUtils', () => ({
  uploadImageFile: vi.fn(),
  sanitizeOrUploadImageUrl: vi.fn((url: string) => Promise.resolve(url)),
  isBase64DataUrl: vi.fn(() => false),
}));

vi.mock('../hooks/useWishlist', () => ({
  useWishlist: () => ({
    wishlist: new Set<string>(),
    toggle: vi.fn(),
    topFiveDrinkIds: [],
    topFiveSet: new Set<string>(),
    getTopFiveRank: () => null,
    toggleTopFive: vi.fn(),
    swapTopFive: vi.fn(),
    moveTopFive: vi.fn(),
  }),
}));

const mockUser = {
  uid: 'user-1',
  displayName: 'Ale Explorer',
  email: 'ale@kegswap.local',
} as User;

const mockDrink: BeerDrink = {
  id: 'drink-1',
  name: 'Northern Star',
  brewery: 'North Brew',
  location: 'Leeds',
  abv: '5.2%',
  style: 'Porter',
  description: 'Rich roasted malt',
  reviews: [
    {
      id: 'rev-user-1',
      reviewer: 'Ale Explorer',
      rating: 9.0,
      comment: 'Top tier porter',
      createdAt: '2026-11-02T10:00:00Z',
      userId: 'user-1',
    },
    {
      id: 'rev-other',
      reviewer: 'Other User',
      rating: 7.5,
      comment: 'Decent pint',
      createdAt: '2026-11-01T10:00:00Z',
      userId: 'user-2',
    },
  ],
};

const mockEvent: BeerEvent = {
  id: 'event-1',
  name: 'Leeds Craft Festival',
  date: '2026-11-10',
  address: 'Leeds Corn Exchange',
  status: 'Upcoming',
  drinks: [mockDrink],
};

describe('EventDetailScreen review deletion', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('renders delete button only on own reviews and confirms deletion', async () => {
    const onDeleteReview = vi.fn();

    render(
      <EventDetailScreen
        event={mockEvent}
        user={mockUser}
        onBack={vi.fn()}
        onAddDrink={vi.fn()}
        onAddReview={vi.fn()}
        onDeleteReview={onDeleteReview}
        onAddDrinksBatch={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    // Expand reviews drawer
    const reviewsBtn = screen.getByRole('button', { name: /reviews \(2\)/i });
    fireEvent.click(reviewsBtn);

    // There should be a delete button for the user's review, but NOT for the other user's review
    const deleteReviewButtons = screen.getAllByRole('button', { name: /delete review by/i });
    expect(deleteReviewButtons).toHaveLength(1);
    expect(screen.getByRole('button', { name: /delete review by ale explorer/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete review by other user/i })).not.toBeInTheDocument();

    // Click delete review button -> opens confirmation dialog
    fireEvent.click(deleteReviewButtons[0]);

    // Check ConfirmDialog is open with drink name
    expect(screen.getByRole('heading', { name: 'Delete Review' })).toBeInTheDocument();
    expect(screen.getAllByText(/Northern Star/i).length).toBeGreaterThanOrEqual(2);

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'Delete Review' });
    fireEvent.click(confirmBtn);

    expect(onDeleteReview).toHaveBeenCalledWith('drink-1', 'rev-user-1', undefined);
  });

  it('allows marking a drink as ran out and disables adding reviews when unavailable', () => {
    const onUpdateDrinkAvailability = vi.fn();

    const { rerender } = render(
      <EventDetailScreen
        event={mockEvent}
        user={mockUser}
        onBack={vi.fn()}
        onAddDrink={vi.fn()}
        onAddReview={vi.fn()}
        onAddDrinksBatch={vi.fn()}
        onToggleAttendance={vi.fn()}
        onUpdateDrinkAvailability={onUpdateDrinkAvailability}
      />
    );

    // Expand reviews drawer
    const reviewsBtn = screen.getByRole('button', { name: /reviews \(2\)/i });
    fireEvent.click(reviewsBtn);

    // Toggle button should say "Mark as Ran Out"
    const markRanOutBtn = screen.getByRole('button', { name: /mark beer as ran out/i });
    expect(markRanOutBtn).toBeInTheDocument();
    fireEvent.click(markRanOutBtn);

    expect(onUpdateDrinkAvailability).toHaveBeenCalledWith('drink-1', false);

    // Re-render with drink marked unavailable (isAvailable: false)
    const unavailableDrink: BeerDrink = { ...mockDrink, isAvailable: false };
    const eventWithUnavailableDrink: BeerEvent = {
      ...mockEvent,
      drinks: [unavailableDrink],
    };

    rerender(
      <EventDetailScreen
        event={eventWithUnavailableDrink}
        user={mockUser}
        onBack={vi.fn()}
        onAddDrink={vi.fn()}
        onAddReview={vi.fn()}
        onAddDrinksBatch={vi.fn()}
        onToggleAttendance={vi.fn()}
        onUpdateDrinkAvailability={onUpdateDrinkAvailability}
      />
    );

    // Should display Ran Out badge
    expect(screen.getAllByText(/ran out/i).length).toBeGreaterThanOrEqual(1);

    // Rate & Review button should be disabled
    const reviewBtn = screen.getByRole('button', { name: /rated.*ran out/i });
    expect(reviewBtn).toBeDisabled();

    // Drawer button should now allow marking available
    const markAvailableBtn = screen.getByRole('button', { name: /mark beer as available/i });
    expect(markAvailableBtn).toBeInTheDocument();
    fireEvent.click(markAvailableBtn);

    expect(onUpdateDrinkAvailability).toHaveBeenCalledWith('drink-1', true);
  });

  it('filters drinks by brewery and resets when All Breweries is selected', () => {
    const multiBreweryEvent: BeerEvent = {
      ...mockEvent,
      drinks: [
        {
          id: 'drink-1',
          name: 'Northern Star',
          brewery: 'North Brew',
          location: 'Leeds',
          abv: '5.2%',
          style: 'Porter',
          description: 'Rich roasted malt',
          reviews: [],
        },
        {
          id: 'drink-2',
          name: 'Transmission',
          brewery: 'North Brew',
          location: 'Leeds',
          abv: '6.9%',
          style: 'IPA',
          description: 'Hazy IPA',
          reviews: [],
        },
        {
          id: 'drink-3',
          name: 'Sponge',
          brewery: 'Deya Brewing',
          location: 'Cheltenham',
          abv: '4.8%',
          style: 'Pale Ale',
          description: 'Juicy pale ale',
          reviews: [],
        },
      ],
    };

    render(
      <EventDetailScreen
        event={multiBreweryEvent}
        user={mockUser}
        onBack={vi.fn()}
        onAddDrink={vi.fn()}
        onAddReview={vi.fn()}
        onAddDrinksBatch={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    const brewerySelect = screen.getByRole('combobox', { name: /filter drinks by brewery/i });
    expect(brewerySelect).toBeInTheDocument();

    // Verify option labels and counts
    expect(screen.getByRole('option', { name: 'All Breweries (3)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Deya Brewing (1)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'North Brew (2)' })).toBeInTheDocument();

    // Filter by Deya Brewing
    fireEvent.change(brewerySelect, { target: { value: 'Deya Brewing' } });

    expect(screen.getByText('Sponge')).toBeInTheDocument();
    expect(screen.queryByText('Northern Star')).not.toBeInTheDocument();
    expect(screen.queryByText('Transmission')).not.toBeInTheDocument();

    // Filter by North Brew
    fireEvent.change(brewerySelect, { target: { value: 'North Brew' } });

    expect(screen.queryByText('Sponge')).not.toBeInTheDocument();
    expect(screen.getByText('Northern Star')).toBeInTheDocument();
    expect(screen.getByText('Transmission')).toBeInTheDocument();

    // Reset back to All Breweries
    fireEvent.change(brewerySelect, { target: { value: 'All Breweries' } });

    expect(screen.getByText('Sponge')).toBeInTheDocument();
    expect(screen.getByText('Northern Star')).toBeInTheDocument();
    expect(screen.getByText('Transmission')).toBeInTheDocument();
  });

  describe('Clear All filters toggle control in beer event section', () => {
    const multiDrinkEvent: BeerEvent = {
      ...mockEvent,
      drinks: [
        {
          id: 'drink-1',
          name: 'Northern Star',
          brewery: 'North Brew',
          location: 'Leeds',
          abv: '5.2%',
          style: 'Porter',
          type: 'Porter',
          caskOrKeg: 'Keg',
          isVegan: true,
          description: 'Rich roasted malt',
          reviews: [],
        },
        {
          id: 'drink-2',
          name: 'Transmission',
          brewery: 'North Brew',
          location: 'Leeds',
          abv: '6.9%',
          style: 'IPA',
          type: 'IPA',
          caskOrKeg: 'Cask',
          isGlutenFree: true,
          description: 'Hazy IPA',
          reviews: [],
        },
        {
          id: 'drink-3',
          name: 'Citra Sour',
          brewery: 'Vault City',
          location: 'Edinburgh',
          abv: '4.2%',
          style: 'Sour',
          type: 'Sour',
          caskOrKeg: 'Keg',
          description: 'Tart and refreshing',
          reviews: [],
        },
      ],
    };

    it('renders the Clear All toggle control in toolbar, disabled by default when no filters are active', () => {
      render(
        <EventDetailScreen
          event={multiDrinkEvent}
          user={mockUser}
          onBack={vi.fn()}
          onAddDrink={vi.fn()}
          onAddReview={vi.fn()}
          onAddDrinksBatch={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const clearAllBtn = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearAllBtn).toBeInTheDocument();
      expect(clearAllBtn).toBeDisabled();
      expect(clearAllBtn).toHaveAttribute('aria-pressed', 'false');
    });

    it('activates the Clear All toggle when search query or dropdown filters are applied, and clears all filters on click', () => {
      render(
        <EventDetailScreen
          event={multiDrinkEvent}
          user={mockUser}
          onBack={vi.fn()}
          onAddDrink={vi.fn()}
          onAddReview={vi.fn()}
          onAddDrinksBatch={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const clearAllBtn = screen.getByRole('button', { name: /clear all filters/i });
      const searchInput = screen.getByPlaceholderText(/search drinks by name/i);
      const typeSelect = screen.getByRole('combobox', { name: /filter drinks by type/i });
      const brewerySelect = screen.getByRole('combobox', { name: /filter drinks by brewery/i });

      // Apply a search filter
      fireEvent.change(searchInput, { target: { value: 'Transmission' } });

      // Only Transmission is visible
      expect(screen.getByText('Transmission')).toBeInTheDocument();
      expect(screen.queryByText('Northern Star')).not.toBeInTheDocument();
      expect(screen.queryByText('Citra Sour')).not.toBeInTheDocument();

      // Clear button is now enabled and pressed
      expect(clearAllBtn).toBeEnabled();
      expect(clearAllBtn).toHaveAttribute('aria-pressed', 'true');
      expect(clearAllBtn).toHaveTextContent(/Clear All/i);

      // Apply type and brewery filters
      fireEvent.change(typeSelect, { target: { value: 'IPA' } });
      fireEvent.change(brewerySelect, { target: { value: 'North Brew' } });

      // Click Clear All toggle button
      fireEvent.click(clearAllBtn);

      // All filters reset
      expect(searchInput).toHaveValue('');
      expect(typeSelect).toHaveValue('all');
      expect(brewerySelect).toHaveValue('All Breweries');
      expect(clearAllBtn).toBeDisabled();
      expect(clearAllBtn).toHaveAttribute('aria-pressed', 'false');

      // All 3 drinks are visible again
      expect(screen.getByText('Northern Star')).toBeInTheDocument();
      expect(screen.getByText('Transmission')).toBeInTheDocument();
      expect(screen.getByText('Citra Sour')).toBeInTheDocument();
    });

    it('displays Clear All Filters button in empty state when no drinks match and restores list on click', () => {
      render(
        <EventDetailScreen
          event={multiDrinkEvent}
          user={mockUser}
          onBack={vi.fn()}
          onAddDrink={vi.fn()}
          onAddReview={vi.fn()}
          onAddDrinksBatch={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search drinks by name/i);
      fireEvent.change(searchInput, { target: { value: 'NonExistentAle' } });

      // Empty state shown
      expect(screen.getByText(/no drinks match your filters/i)).toBeInTheDocument();

      // Empty state clear button is rendered
      const emptyClearBtn = screen.getByTestId('empty-clear-all-filters-btn');
      expect(emptyClearBtn).toBeInTheDocument();

      // Click the empty state clear button
      fireEvent.click(emptyClearBtn);

      // Search cleared and drinks returned
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Northern Star')).toBeInTheDocument();
      expect(screen.getByText('Transmission')).toBeInTheDocument();
      expect(screen.getByText('Citra Sour')).toBeInTheDocument();
    });

    it('resets show tabs, format, dietary, and sort filters when Clear All is clicked', () => {
      render(
        <EventDetailScreen
          event={multiDrinkEvent}
          user={mockUser}
          onBack={vi.fn()}
          onAddDrink={vi.fn()}
          onAddReview={vi.fn()}
          onAddDrinksBatch={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const clearAllBtn = screen.getByRole('button', { name: /clear all filters/i });
      const formatSelect = screen.getByRole('combobox', { name: /filter by serving format/i });
      const dietarySelect = screen.getByRole('combobox', { name: /filter by dietary info/i });
      const triedTab = screen.getByRole('button', { name: /tried/i });

      // Switch show tab to Tried
      fireEvent.click(triedTab);
      expect(triedTab).toHaveAttribute('aria-pressed', 'true');
      expect(clearAllBtn).toBeEnabled();

      // Select format Cask and dietary vegan
      fireEvent.change(formatSelect, { target: { value: 'Cask' } });
      fireEvent.change(dietarySelect, { target: { value: 'vegan' } });

      // Click clear all
      fireEvent.click(clearAllBtn);

      // Tab returns to All, selects return to default
      const allTab = screen.getByRole('button', { name: /^all \(/i });
      expect(allTab).toHaveAttribute('aria-pressed', 'true');
      expect(formatSelect).toHaveValue('all');
      expect(dietarySelect).toHaveValue('any');
      expect(clearAllBtn).toBeDisabled();
    });
  });
});

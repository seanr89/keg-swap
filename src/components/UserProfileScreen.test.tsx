import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerEvent, BeerReviewDoc } from '../types';
import { UserProfileScreen } from './UserProfileScreen';
import * as exportDiary from '../utils/exportDiary';

const mockStoredReviews: BeerReviewDoc[] = [
  {
    id: 'rev-1',
    reviewer: 'Ale Explorer',
    rating: 9.0,
    comment: 'Superb porter with coffee notes',
    createdAt: '2026-11-05T12:00:00Z',
    userId: 'user-1',
    eventId: 'event-1',
    drinkId: 'drink-1',
    drinkName: 'Northern Star',
    brewery: 'North Brew',
    style: 'Porter',
    price: '£5.50',
    servingSize: 'Pint',
    tags: ['Coffee', 'Roasty'],
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/rev1.jpg',
  },
];

let mockUserReviewsReturn: { reviews: BeerReviewDoc[]; loading: boolean } = {
  reviews: mockStoredReviews,
  loading: false,
};

vi.mock('../hooks/useUserReviews', () => ({
  useUserReviews: () => mockUserReviewsReturn,
}));

const mockUser = {
  uid: 'user-1',
  displayName: 'Ale Explorer',
  email: 'ale@kegswap.local',
  metadata: { creationTime: '2026-01-01T00:00:00Z' },
} as unknown as User;

const mockEvents: BeerEvent[] = [
  {
    id: 'event-1',
    name: 'Leeds Craft Festival',
    date: '2026-11-10',
    address: 'Leeds Corn Exchange',
    status: 'Upcoming',
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
        isGlutenFree: false,
        description: 'Rich roasted malt',
        reviews: [],
      },
    ],
  },
];

describe('UserProfileScreen review deletion', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('renders a delete button on diary reviews and opens ConfirmDialog', () => {
    const onDeleteReview = vi.fn();

    render(
      <UserProfileScreen
        user={mockUser}
        userProfile={null}
        allUsers={[]}
        events={mockEvents}
        theme="dark"
        onToggleTheme={vi.fn()}
        onSignOut={vi.fn()}
        onBack={vi.fn()}
        onNavigateToEvent={vi.fn()}
        onTogglePrivacy={vi.fn()}
        onOpenSearchModal={vi.fn()}
        onRemoveFriend={vi.fn()}
        onDeleteReview={onDeleteReview}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete review for northern star/i });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    // Confirm dialog should appear
    expect(screen.getByRole('heading', { name: 'Delete Review' })).toBeInTheDocument();
    expect(screen.getAllByText(/Northern Star/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Leeds Craft Festival/i).length).toBeGreaterThanOrEqual(1);

    // Confirm delete
    const confirmBtn = screen.getByRole('button', { name: 'Delete Review' });
    fireEvent.click(confirmBtn);

    expect(onDeleteReview).toHaveBeenCalledWith(
      'event-1',
      'drink-1',
      'rev-1',
      'https://firebasestorage.googleapis.com/v0/b/app/o/rev1.jpg'
    );
  });

  describe('Export Tasting History & Reviews section', () => {
    beforeEach(() => {
      mockUserReviewsReturn = {
        reviews: mockStoredReviews,
        loading: false,
      };
    });

    it('renders the dedicated Export Reviews section with format controls and metadata summary', () => {
      render(
        <UserProfileScreen
          user={mockUser}
          userProfile={null}
          allUsers={[]}
          events={mockEvents}
          theme="dark"
          onToggleTheme={vi.fn()}
          onSignOut={vi.fn()}
          onBack={vi.fn()}
          onNavigateToEvent={vi.fn()}
          onTogglePrivacy={vi.fn()}
          onOpenSearchModal={vi.fn()}
          onRemoveFriend={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: /export tasting history & reviews/i })).toBeInTheDocument();
      expect(screen.getAllByText(/1 Review/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Events Covered')).toBeInTheDocument();
      expect(screen.getByText('Date Range')).toBeInTheDocument();

      const csvTab = screen.getByRole('button', { name: /csv \(\.csv\)/i });
      const jsonTab = screen.getByRole('button', { name: /json \(\.json\)/i });
      expect(csvTab).toBeInTheDocument();
      expect(jsonTab).toBeInTheDocument();
      expect(csvTab).toHaveAttribute('aria-pressed', 'true');
      expect(jsonTab).toHaveAttribute('aria-pressed', 'false');

      const exportBtn = screen.getByRole('button', { name: /export reviews as csv/i });
      expect(exportBtn).toBeInTheDocument();
      expect(exportBtn).toBeEnabled();
    });

    it('toggles format to JSON and exports formatted JSON with complete event, brewery, beer, and review details', () => {
      const downloadSpy = vi.spyOn(exportDiary, 'downloadTextFile').mockImplementation(vi.fn());

      render(
        <UserProfileScreen
          user={mockUser}
          userProfile={null}
          allUsers={[]}
          events={mockEvents}
          theme="dark"
          onToggleTheme={vi.fn()}
          onSignOut={vi.fn()}
          onBack={vi.fn()}
          onNavigateToEvent={vi.fn()}
          onTogglePrivacy={vi.fn()}
          onOpenSearchModal={vi.fn()}
          onRemoveFriend={vi.fn()}
        />
      );

      const jsonTab = screen.getByRole('button', { name: /json \(\.json\)/i });
      fireEvent.click(jsonTab);

      expect(jsonTab).toHaveAttribute('aria-pressed', 'true');
      const exportBtn = screen.getByRole('button', { name: /export reviews as json/i });
      expect(exportBtn).toBeInTheDocument();

      fireEvent.click(exportBtn);

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [filename, mimeType, content] = downloadSpy.mock.calls[0];
      expect(filename).toMatch(/^keg-swap-reviews-\d{4}-\d{2}-\d{2}\.json$/);
      expect(mimeType).toBe('application/json');

      const parsed = JSON.parse(content);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        eventId: 'event-1',
        eventName: 'Leeds Craft Festival',
        eventDate: '2026-11-10',
        eventAddress: 'Leeds Corn Exchange',
        eventStatus: 'Upcoming',
        brewery: 'North Brew',
        breweryLocation: 'Leeds',
        drinkId: 'drink-1',
        drinkName: 'Northern Star',
        style: 'Porter',
        type: 'Porter',
        abv: '5.2%',
        caskOrKeg: 'Keg',
        isVegan: true,
        isGlutenFree: false,
        description: 'Rich roasted malt',
        reviewId: 'rev-1',
        rating: 9.0,
        comment: 'Superb porter with coffee notes',
        tastingTags: ['Coffee', 'Roasty'],
        servingSize: 'Pint',
        price: '£5.50',
      });

      // Accessible status message is displayed
      expect(screen.getByText(/successfully exported 1 review to/i)).toBeInTheDocument();
      downloadSpy.mockRestore();
    });

    it('exports CSV with RFC 4180 compliance including all event, brewery, beer, and review fields', () => {
      const downloadSpy = vi.spyOn(exportDiary, 'downloadTextFile').mockImplementation(vi.fn());

      render(
        <UserProfileScreen
          user={mockUser}
          userProfile={null}
          allUsers={[]}
          events={mockEvents}
          theme="dark"
          onToggleTheme={vi.fn()}
          onSignOut={vi.fn()}
          onBack={vi.fn()}
          onNavigateToEvent={vi.fn()}
          onTogglePrivacy={vi.fn()}
          onOpenSearchModal={vi.fn()}
          onRemoveFriend={vi.fn()}
        />
      );

      const exportBtn = screen.getByRole('button', { name: /export reviews as csv/i });
      fireEvent.click(exportBtn);

      expect(downloadSpy).toHaveBeenCalledTimes(1);
      const [filename, mimeType, content] = downloadSpy.mock.calls[0];
      expect(filename).toMatch(/^keg-swap-reviews-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(mimeType).toBe('text/csv');

      // CSV contains UTF-8 BOM
      expect(content.startsWith('\uFEFF')).toBe(true);
      // CSV contains enriched columns
      expect(content).toContain('"Leeds Craft Festival"');
      expect(content).toContain('"North Brew"');
      expect(content).toContain('"Northern Star"');
      expect(content).toContain('"Coffee; Roasty"');
      expect(content).toContain('"true"');
      expect(content).toContain('"false"');

      downloadSpy.mockRestore();
    });

    it('disables the export button when the user has zero reviews', () => {
      mockUserReviewsReturn = {
        reviews: [],
        loading: false,
      };

      render(
        <UserProfileScreen
          user={mockUser}
          userProfile={null}
          allUsers={[]}
          events={mockEvents}
          theme="dark"
          onToggleTheme={vi.fn()}
          onSignOut={vi.fn()}
          onBack={vi.fn()}
          onNavigateToEvent={vi.fn()}
          onTogglePrivacy={vi.fn()}
          onOpenSearchModal={vi.fn()}
          onRemoveFriend={vi.fn()}
        />
      );

      const exportBtn = screen.getByRole('button', { name: /no reviews logged yet to export/i });
      expect(exportBtn).toBeDisabled();
      expect(screen.getAllByText(/no reviews yet/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});

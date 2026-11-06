import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerEvent } from '../types';
import { UserProfileScreen } from './UserProfileScreen';

vi.mock('../hooks/useUserReviews', () => ({
  useUserReviews: () => ({
    reviews: [
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
        imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/rev1.jpg',
      },
    ],
    loading: false,
  }),
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
});

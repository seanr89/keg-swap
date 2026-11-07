import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerDrink } from '../../types';
import { ReviewBottomSheet } from './ReviewBottomSheet';

vi.mock('../../utils/imageUtils', () => ({
  uploadImageFile: vi.fn(),
  sanitizeOrUploadImageUrl: vi.fn((url: string) => Promise.resolve(url)),
  isBase64DataUrl: vi.fn(() => false),
}));

const mockUser = {
  uid: 'user-1',
  displayName: 'Ale Explorer',
  email: 'ale@kegswap.local',
} as User;

const mockDrink: BeerDrink = {
  id: 'drink-1',
  name: 'Nebula Haze',
  brewery: 'Cosmic Hops',
  location: 'Bristol',
  abv: '6.5%',
  style: 'NEIPA',
  description: 'Tropical and juicy',
  reviews: [],
};

describe('ReviewBottomSheet', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('places required Tasting Notes above the collapsible Additional Feedback section', () => {
    render(
      <ReviewBottomSheet
        drink={mockDrink}
        eventId="event-1"
        user={mockUser}
        onClose={vi.fn()}
        onSubmitReview={vi.fn()}
      />
    );

    const notesTextarea = screen.getByLabelText(/tasting notes/i);
    expect(notesTextarea).toBeRequired();
    expect(screen.getByText(/Required • 1-tap or type/i)).toBeInTheDocument();

    const additionalSummary = screen.getByText('Additional Feedback').closest('summary');
    expect(additionalSummary).toBeInTheDocument();
    const detailsEl = additionalSummary?.closest('details');
    expect(detailsEl).toBeInTheDocument();
    expect(detailsEl).not.toHaveAttribute('open');

    // Verify DOM order: Tasting Notes appears before Additional Feedback (and Serving Format)
    const position = notesTextarea.compareDocumentPosition(detailsEl!);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Serving Format, Price Paid, Flavor Profile Tags, and Drink Photo live inside Additional Feedback
    expect(detailsEl).toContainElement(screen.getByText('Serving Format'));
    expect(detailsEl).toContainElement(screen.getByLabelText(/Price Paid/i));
    expect(detailsEl).toContainElement(screen.getByText('Flavor Profile Tags'));
    expect(detailsEl).toContainElement(screen.getByText('Drink Photo'));
  });

  it('requires Tasting Notes before submitting and clears the error once notes are entered', () => {
    const onSubmitReview = vi.fn();
    const onClose = vi.fn();

    render(
      <ReviewBottomSheet
        drink={mockDrink}
        eventId="event-1"
        user={mockUser}
        onClose={onClose}
        onSubmitReview={onSubmitReview}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /submit review/i });
    fireEvent.click(submitBtn);

    expect(onSubmitReview).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Tasting notes are required');

    const notesTextarea = screen.getByLabelText(/tasting notes/i);
    expect(notesTextarea).toHaveClass('input-error');
    expect(notesTextarea).toHaveAttribute('aria-invalid', 'true');

    // Typing into Tasting Notes clears the validation error
    fireEvent.change(notesTextarea, { target: { value: 'Lush mango and stone fruit aroma.' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(notesTextarea).not.toHaveClass('input-error');

    fireEvent.click(submitBtn);
    expect(onSubmitReview).toHaveBeenCalledTimes(1);
    expect(onSubmitReview).toHaveBeenCalledWith(
      'drink-1',
      'Ale Explorer',
      8.0,
      'Lush mango and stone fruit aroma.',
      undefined,
      undefined,
      undefined,
      expect.any(String),
      undefined
    );
  });

  it('allows expanding Additional Feedback to select serving format, price, and flavor tags', () => {
    const onSubmitReview = vi.fn();

    render(
      <ReviewBottomSheet
        drink={mockDrink}
        eventId="event-1"
        user={mockUser}
        onClose={vi.fn()}
        onSubmitReview={onSubmitReview}
      />
    );

    // Use a 1-tap quick impression to satisfy required Tasting Notes
    fireEvent.click(screen.getByRole('button', { name: 'Juicy & tropical' }));

    // Expand Additional Feedback
    const detailsEl = screen.getByText('Additional Feedback').closest('details')!;
    detailsEl.open = true;
    fireEvent(detailsEl, new Event('toggle'));

    // Select Pint serving format, £5.50 preset price, and Hoppy tag
    fireEvent.click(screen.getByRole('button', { name: 'Pint' }));
    fireEvent.click(screen.getByRole('button', { name: '£5.50' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoppy' }));

    expect(screen.getByText('3 added')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(onSubmitReview).toHaveBeenCalledWith(
      'drink-1',
      'Ale Explorer',
      8.0,
      'Juicy & tropical.',
      '£5.50',
      'Pint',
      undefined,
      expect.any(String),
      ['Hoppy']
    );
  });

  it('allows deleting an existing review with a confirmation step', async () => {
    const onDeleteReview = vi.fn();
    const onClose = vi.fn();

    const drinkWithUserReview: BeerDrink = {
      ...mockDrink,
      reviews: [
        {
          id: 'review-123',
          reviewer: 'Ale Explorer',
          rating: 8.5,
          comment: 'Very tasty ale',
          createdAt: '2026-11-01T12:00:00Z',
          userId: 'user-1',
          imageUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/rev.jpg',
        },
      ],
    };

    render(
      <ReviewBottomSheet
        drink={drinkWithUserReview}
        eventId="event-1"
        user={mockUser}
        onClose={onClose}
        onSubmitReview={vi.fn()}
        onDeleteReview={onDeleteReview}
      />
    );

    // Initial state: "Delete My Review" button is visible for existing review
    const deleteBtn = screen.getByRole('button', { name: /delete my review/i });
    expect(deleteBtn).toBeInTheDocument();

    // Click Delete My Review -> confirmation prompt appears
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/Delete your review for/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep review/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument();

    // Test cancelling the deletion
    fireEvent.click(screen.getByRole('button', { name: /keep review/i }));
    expect(screen.queryByText(/Delete your review for/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete my review/i })).toBeInTheDocument();
    expect(onDeleteReview).not.toHaveBeenCalled();

    // Test confirming the deletion
    fireEvent.click(screen.getByRole('button', { name: /delete my review/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onDeleteReview).toHaveBeenCalledWith(
      'drink-1',
      'review-123',
      'https://firebasestorage.googleapis.com/v0/b/app/o/rev.jpg'
    );
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('allows marking beer as ran out and disables reviews when complete', () => {
    const onToggleAvailability = vi.fn();
    const onSubmitReview = vi.fn();

    const { rerender } = render(
      <ReviewBottomSheet
        drink={mockDrink}
        eventId="event-1"
        user={mockUser}
        onClose={vi.fn()}
        onSubmitReview={onSubmitReview}
        onToggleAvailability={onToggleAvailability}
      />
    );

    // Can mark as ran out
    const markRanOutBtn = screen.getByRole('button', { name: /mark as ran out/i });
    expect(markRanOutBtn).toBeInTheDocument();
    fireEvent.click(markRanOutBtn);
    expect(onToggleAvailability).toHaveBeenCalledWith(false);

    // Rerender as ran out (isAvailable: false)
    const ranOutDrink: BeerDrink = { ...mockDrink, isAvailable: false };
    rerender(
      <ReviewBottomSheet
        drink={ranOutDrink}
        eventId="event-1"
        user={mockUser}
        onClose={vi.fn()}
        onSubmitReview={onSubmitReview}
        onToggleAvailability={onToggleAvailability}
      />
    );

    // Ran out banner shown
    expect(screen.getByText(/marked as complete \/ ran out/i)).toBeInTheDocument();

    // Submit button is disabled
    const submitBtn = screen.getByRole('button', { name: /ran out • reviews closed/i });
    expect(submitBtn).toBeDisabled();

    // Can mark available again
    const markAvailableBtn = screen.getByRole('button', { name: /mark available/i });
    expect(markAvailableBtn).toBeInTheDocument();
    fireEvent.click(markAvailableBtn);
    expect(onToggleAvailability).toHaveBeenCalledWith(true);
  });
});

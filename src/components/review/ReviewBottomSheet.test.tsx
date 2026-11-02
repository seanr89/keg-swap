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
});

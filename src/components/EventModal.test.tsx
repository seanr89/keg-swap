import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventModal } from './EventModal';
import { SAMPLE_TEST_BEERS, SAMPLE_TEST_EVENT } from '../utils/testEventSeeder';
import type { EventLocation } from '../types';

const mockLocations: EventLocation[] = [
  {
    id: 'loc-1',
    name: 'The Rusty Nail Brewhouse',
    address: '123 Hops Ave, Portland, OR',
    city: 'Portland',
    mapsUrl: 'https://maps.google.com/?q=Rusty+Nail',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'loc-2',
    name: 'Barrel & Cask Taproom',
    address: '456 Malt Blvd, Seattle, WA',
    city: 'Seattle',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('EventModal', () => {
  it('pre-fills test event data and includes 10 test beers when clicking the quick fill template button', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(<EventModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    const quickFillBtn = screen.getByRole('button', { name: /load test event template/i });
    expect(quickFillBtn).toBeInTheDocument();

    fireEvent.click(quickFillBtn);

    const nameInput = screen.getByLabelText(/event name/i) as HTMLInputElement;
    expect(nameInput.value).toBe(SAMPLE_TEST_EVENT.name);

    const addressInput = screen.getByLabelText(/location address/i) as HTMLInputElement;
    expect(addressInput.value).toBe(SAMPLE_TEST_EVENT.address);

    const testBeersCheckbox = screen.getByLabelText(/include 10 sample test beers/i) as HTMLInputElement;
    expect(testBeersCheckbox.checked).toBe(true);

    const submitBtn = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [submittedEvent, submittedDrinks] = onSubmit.mock.calls[0];

    expect(submittedEvent).toMatchObject({
      name: SAMPLE_TEST_EVENT.name,
      address: SAMPLE_TEST_EVENT.address,
      status: 'Upcoming',
    });
    expect(submittedDrinks).toEqual(SAMPLE_TEST_BEERS);
    expect(submittedDrinks).toHaveLength(10);
  });

  it('submits without test beers when the checkbox is not checked', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(<EventModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Regular Festival' } });
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/location address/i), { target: { value: 'Custom Hall' } });

    const submitBtn = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [submittedEvent, submittedDrinks] = onSubmit.mock.calls[0];

    expect(submittedEvent.name).toBe('Regular Festival');
    expect(submittedDrinks).toBeUndefined();
  });

  it('displays inline validation errors when submitting required fields empty', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(<EventModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /create event/i });
    fireEvent.click(submitBtn);

    expect(onSubmit).not.toHaveBeenCalled();

    // Check validation error messages
    expect(screen.getByText('Event name is required')).toBeInTheDocument();
    expect(screen.getByText('Event date is required')).toBeInTheDocument();
    expect(screen.getByText('Location address is required')).toBeInTheDocument();

    // Check input error classes
    expect(screen.getByLabelText(/event name/i)).toHaveClass('input-error');
    expect(screen.getByLabelText(/event date/i)).toHaveClass('input-error');
    expect(screen.getByLabelText(/location address/i)).toHaveClass('input-error');

    // Typing into name should clear name error
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Cider Fest' } });
    expect(screen.queryByText('Event name is required')).not.toBeInTheDocument();

    // Typing into date should clear date error
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-12-05' } });
    expect(screen.queryByText('Event date is required')).not.toBeInTheDocument();

    // Typing into address should clear address error
    fireEvent.change(screen.getByLabelText(/location address/i), { target: { value: 'Pint Street 5' } });
    expect(screen.queryByText('Location address is required')).not.toBeInTheDocument();
  });

  describe('Multi-day event scenarios', () => {
    it('handles switching between Single Day and Runs Over Days modes', () => {
      const onSubmit = vi.fn();
      render(<EventModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

      // Single day mode by default: no end date input
      expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();

      // Switch to multi-day
      fireEvent.click(screen.getByRole('button', { name: /runs over days/i }));
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();

      // Switch back to single day
      fireEvent.click(screen.getByRole('button', { name: /single day/i }));
      expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();
    });

    it('validates that end date is provided and not before start date for multi-day events', () => {
      const onSubmit = vi.fn();
      render(<EventModal isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Multi-Day Fest' } });
      fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-11-20' } });
      fireEvent.change(screen.getByLabelText(/location address/i), { target: { value: 'Festival Grounds' } });

      // Switch to multi-day
      fireEvent.click(screen.getByRole('button', { name: /runs over days/i }));

      // 1. Submit without end date
      fireEvent.click(screen.getByRole('button', { name: /create event/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('End date is required')).toBeInTheDocument();

      // 2. Submit with end date earlier than start date
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-11-18' } });
      fireEvent.click(screen.getByRole('button', { name: /create event/i }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('End date cannot be before the start date')).toBeInTheDocument();

      // 3. Submit with valid end date -> displays span calculation and submits
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2026-11-22' } });
      expect(screen.getByText(/event spans/i)).toHaveTextContent('Event spans 3 days');

      fireEvent.click(screen.getByRole('button', { name: /create event/i }));
      expect(onSubmit).toHaveBeenCalledTimes(1);

      const [submittedEvent] = onSubmit.mock.calls[0];
      expect(submittedEvent).toMatchObject({
        name: 'Multi-Day Fest',
        date: '2026-11-20',
        endDate: '2026-11-22',
        address: 'Festival Grounds',
      });
    });
  });

  describe('Managed location selection', () => {
    it('populates address and map link when selecting a managed venue from dropdown', () => {
      render(
        <EventModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          locations={mockLocations}
        />
      );

      const venueSelect = screen.getByLabelText(/managed venue/i);
      expect(venueSelect).toBeInTheDocument();

      // Select "The Rusty Nail Brewhouse"
      fireEvent.change(venueSelect, { target: { value: 'loc-1' } });

      const addressInput = screen.getByLabelText(/location address/i) as HTMLInputElement;
      expect(addressInput.value).toBe('123 Hops Ave, Portland, OR');

      const mapsInput = screen.getByLabelText(/google maps pin location url/i) as HTMLInputElement;
      expect(mapsInput.value).toBe('https://maps.google.com/?q=Rusty+Nail');
    });
  });
});

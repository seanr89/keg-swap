import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EventModal } from './EventModal';
import { SAMPLE_TEST_BEERS, SAMPLE_TEST_EVENT } from '../utils/testEventSeeder';

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
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import type { User } from 'firebase/auth';
import type { BeerEvent } from '../types';
import { useEventDrinks } from './useEventDrinks';
import { EventDetailScreen } from '../components/EventDetailScreen';

type SnapshotHandler = (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
type ErrorHandler = (err: Error) => void;

interface ListenerEntry {
  target: string;
  onNext: SnapshotHandler;
  onError: ErrorHandler;
  unsubscribed: boolean;
}

let listeners: ListenerEntry[] = [];

vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn((ref: { type?: string }, onNext: SnapshotHandler, onError: ErrorHandler) => {
    const entry: ListenerEntry = {
      target: ref?.type || 'unknown',
      onNext,
      onError,
      unsubscribed: false,
    };
    listeners.push(entry);
    return () => {
      entry.unsubscribed = true;
    };
  }),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('../utils/eventData', () => ({
  drinksCollection: vi.fn((eventId: string) => ({ type: `drinks:${eventId}` })),
  reviewsGroup: vi.fn(() => ({ type: 'reviewsGroup' })),
  assembleDrinks: vi.fn((_legacy, drinks: Array<{ id: string; name: string }>, reviews: unknown[]) =>
    drinks.map((d) => ({ ...d, reviews }))
  ),
}));

vi.mock('../firebase', () => ({
  db: {},
  storage: {},
}));

describe('useEventDrinks (effective wait + single retry)', () => {
  beforeEach(() => {
    listeners = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('starts in loading state when an event is selected and resolves once snapshots arrive', () => {
    const { result } = renderHook(() =>
      useEventDrinks('event-1', undefined, { waitTimeoutMs: 2000, retryDelayMs: 500 })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.retrying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(listeners).toHaveLength(2);

    act(() => {
      listeners[0].onNext({
        docs: [{ id: 'drink-1', data: () => ({ name: 'Session Pale', brewery: 'Hops Co', location: 'Leeds', abv: '4.2%', style: 'Pale', description: 'Crisp' }) }],
      });
      listeners[1].onNext({
        docs: [],
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.retrying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.drinks).toHaveLength(1);
  });

  it('waits the effective timeout and performs a single retry when initial snapshots stall', () => {
    const { result } = renderHook(() =>
      useEventDrinks('event-1', undefined, { waitTimeoutMs: 2000, retryDelayMs: 500 })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.retrying).toBe(false);
    expect(listeners).toHaveLength(2);

    // Advance past first effective wait window -> triggers single automatic retry (attempt 2 of 2)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(listeners[0].unsubscribed).toBe(true);
    expect(listeners[1].unsubscribed).toBe(true);
    expect(result.current.loading).toBe(true);
    expect(result.current.retrying).toBe(true);
    expect(listeners).toHaveLength(4); // 2 initial + 2 retry subscriptions

    // Retry succeeds before the second wait timeout
    act(() => {
      listeners[2].onNext({
        docs: [{ id: 'drink-2', data: () => ({ name: 'Amber Cask', brewery: 'Malt Works', location: 'York', abv: '4.5%', style: 'Bitter', description: 'Malty' }) }],
      });
      listeners[3].onNext({
        docs: [],
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.retrying).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.drinks).toHaveLength(1);
  });

  it('stops after the single retry if the second attempt also times out, and supports manual retry()', () => {
    const { result } = renderHook(() =>
      useEventDrinks('event-1', undefined, { waitTimeoutMs: 2000, retryDelayMs: 500 })
    );

    // First attempt times out -> triggers single retry
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.retrying).toBe(true);
    expect(listeners).toHaveLength(4);

    // Second attempt (the single retry) also times out -> stops retrying and sets error
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.retrying).toBe(false);
    expect(result.current.error).toMatch(/Unable to load event drinks after retrying/i);
    expect(listeners).toHaveLength(4); // No further automatic retries

    // Manual retry resets state and starts fresh
    act(() => {
      result.current.retry();
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(listeners).toHaveLength(6);
  });

  it('waits retryDelayMs before performing a single retry when a snapshot errors immediately', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useEventDrinks('event-1', undefined, { waitTimeoutMs: 3000, retryDelayMs: 800 })
    );

    // Simulate transient error on initial attempt
    act(() => {
      listeners[0].onError(new Error('Network unavailable'));
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.retrying).toBe(true);
    // Still only 2 listeners until retryDelayMs elapses
    expect(listeners).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Single retry subscribed after effective wait
    expect(listeners).toHaveLength(4);

    consoleSpy.mockRestore();
  });
});

describe('EventDetailScreen loading icon and retry UI', () => {
  const mockUser = { uid: 'user-1', displayName: 'Taster', email: 'taster@kegswap.local' } as User;
  const mockEvent: BeerEvent = {
    id: 'event-1',
    name: 'Autumn Cask Fest',
    date: '2026-11-10',
    address: '10 Brewery Lane',
    status: 'Ongoing',
    drinks: [],
  };

  it('displays the loading spinner icon and retry status message when drinksLoading is true', () => {
    const { rerender } = render(
      React.createElement(EventDetailScreen, {
        event: mockEvent,
        drinksLoading: true,
        drinksRetrying: false,
        user: mockUser,
        onBack: vi.fn(),
        onAddDrink: vi.fn(),
        onAddReview: vi.fn(),
        onAddDrinksBatch: vi.fn(),
        onToggleAttendance: vi.fn(),
      })
    );

    expect(screen.getByRole('progressbar', { name: /Loading event drinks/i })).toBeInTheDocument();
    expect(screen.getByText(/Loading event drinks.../i)).toBeInTheDocument();

    rerender(
      React.createElement(EventDetailScreen, {
        event: mockEvent,
        drinksLoading: true,
        drinksRetrying: true,
        user: mockUser,
        onBack: vi.fn(),
        onAddDrink: vi.fn(),
        onAddReview: vi.fn(),
        onAddDrinksBatch: vi.fn(),
        onToggleAttendance: vi.fn(),
      })
    );

    expect(screen.getByRole('progressbar', { name: /Retrying event drinks load/i })).toBeInTheDocument();
    expect(screen.getByText(/attempt 2 of 2/i)).toBeInTheDocument();
  });

  it('displays error message and Retry button when single retry is exhausted', () => {
    const onRetryDrinks = vi.fn();

    render(
      React.createElement(EventDetailScreen, {
        event: mockEvent,
        drinksLoading: false,
        drinksRetrying: false,
        drinksError: 'Unable to load event drinks after retrying. Please check your connection and try again.',
        onRetryDrinks,
        user: mockUser,
        onBack: vi.fn(),
        onAddDrink: vi.fn(),
        onAddReview: vi.fn(),
        onAddDrinksBatch: vi.fn(),
        onToggleAttendance: vi.fn(),
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/Could not load event drinks/i);
    const retryBtn = screen.getByRole('button', { name: /Retry Loading Drinks/i });
    fireEvent.click(retryBtn);
    expect(onRetryDrinks).toHaveBeenCalledTimes(1);
  });
});

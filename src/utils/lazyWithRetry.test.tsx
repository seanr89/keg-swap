import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lazyWithRetry } from './lazyWithRetry';
import { render, screen } from '@testing-library/react';
import React, { Suspense } from 'react';

describe('lazyWithRetry', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders successfully when dynamic import resolves', async () => {
    const MockComponent = () => <div>Loaded Content</div>;
    const factory = vi.fn().mockResolvedValue({ default: MockComponent });

    const LazyComponent = lazyWithRetry(factory, 'test-chunk');

    render(
      <Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </Suspense>
    );

    expect(await screen.findByText('Loaded Content')).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('keg_swap_reload_test-chunk')).toBeNull();
  });

  it('triggers window.location.reload and sets sessionStorage flag on first import failure', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    const error = new TypeError('Failed to fetch dynamically imported module: https://kegswap.raffrock.com/assets/test.js');
    const factory = vi.fn().mockRejectedValue(error);

    const LazyComponent = lazyWithRetry(factory, 'event-detail');

    render(
      <Suspense fallback={<div>Loading Event...</div>}>
        <LazyComponent />
      </Suspense>
    );

    expect(screen.getByText('Loading Event...')).toBeInTheDocument();
    // Allow promises to microtask
    await vi.waitFor(() => {
      expect(sessionStorage.getItem('keg_swap_reload_event-detail')).toBe('true');
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  it('throws the error if already reloaded and import fails again', async () => {
    sessionStorage.setItem('keg_swap_reload_failing-chunk', 'true');

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    const error = new TypeError('Failed to fetch dynamically imported module');
    const factory = vi.fn().mockRejectedValue(error);

    const LazyComponent = lazyWithRetry(factory, 'failing-chunk');

    // React will catch and propagate the error
    let caughtError: unknown = null;
    class CatchBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
      constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError(err: unknown) {
        caughtError = err;
        return { hasError: true };
      }
      render() {
        return this.state.hasError ? <div>Error Caught</div> : this.props.children;
      }
    }

    render(
      <CatchBoundary>
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </Suspense>
      </CatchBoundary>
    );

    expect(await screen.findByText('Error Caught')).toBeInTheDocument();
    expect(caughtError).toBe(error);
    expect(reloadMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('keg_swap_reload_failing-chunk')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const ThrowingComponent = ({ message = 'Crash test' }: { message?: string }) => {
    throw new Error(message);
  };

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders chunk error message when dynamic import error occurs', () => {
    // Suppress console.error in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="TypeError: Failed to fetch dynamically imported module: https://kegswap.raffrock.com/assets/EventDetailScreen-BYFbD0ID.js" />
      </ErrorBoundary>
    );

    expect(screen.getByText('App Update Available')).toBeInTheDocument();
    expect(
      screen.getByText(/A newer version of Keg Swap has been deployed/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
  });

  it('renders generic error message for other unexpected errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent message="Some generic render error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onReset when Return to Events button is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowingComponent message="Crash" />
      </ErrorBoundary>
    );

    const returnBtn = screen.getByRole('button', { name: /Return to Events/i });
    await userEvent.click(returnBtn);

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MobileBottomNav } from './MobileBottomNav';

describe('MobileBottomNav', () => {
  it('renders all 5 navigation slots correctly', () => {
    render(
      <MobileBottomNav
        activeTab="events"
        onSelectEvents={vi.fn()}
        onOpenFriends={vi.fn()}
        onAddEvent={vi.fn()}
        onSelectDiary={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument();
    expect(screen.getByText('Diary')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    const { rerender } = render(
      <MobileBottomNav
        activeTab="events"
        onSelectEvents={vi.fn()}
        onOpenFriends={vi.fn()}
        onAddEvent={vi.fn()}
        onSelectDiary={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const eventsBtn = screen.getByRole('button', { name: /events/i });
    expect(eventsBtn).toHaveClass('active');

    rerender(
      <MobileBottomNav
        activeTab="diary"
        onSelectEvents={vi.fn()}
        onOpenFriends={vi.fn()}
        onAddEvent={vi.fn()}
        onSelectDiary={vi.fn()}
        onSelectProfile={vi.fn()}
      />
    );

    const diaryBtn = screen.getByRole('button', { name: /diary/i });
    expect(diaryBtn).toHaveClass('active');
    expect(eventsBtn).not.toHaveClass('active');
  });

  it('triggers the respective callbacks when buttons are clicked', () => {
    const onSelectEvents = vi.fn();
    const onOpenFriends = vi.fn();
    const onAddEvent = vi.fn();
    const onSelectDiary = vi.fn();
    const onSelectProfile = vi.fn();

    render(
      <MobileBottomNav
        activeTab={null}
        onSelectEvents={onSelectEvents}
        onOpenFriends={onOpenFriends}
        onAddEvent={onAddEvent}
        onSelectDiary={onSelectDiary}
        onSelectProfile={onSelectProfile}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /events/i }));
    expect(onSelectEvents).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /friends/i }));
    expect(onOpenFriends).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /add event/i }));
    expect(onAddEvent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /diary/i }));
    expect(onSelectDiary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /profile/i }));
    expect(onSelectProfile).toHaveBeenCalledTimes(1);
  });
});

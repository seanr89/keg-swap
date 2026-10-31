import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { User } from 'firebase/auth';
import type { BeerEvent } from '../types';
import { EventCard } from './EventCard';

const mockUser = {
  uid: 'user-123',
  displayName: 'Ale Fan',
  email: 'ale@kegswap.local',
} as unknown as User;

const sampleEvent: BeerEvent = {
  id: 'evt-1',
  name: 'Portland Craft Ale Fest',
  date: '2026-11-10',
  endDate: '2026-11-12',
  address: '450 Waterfront Way, Portland, OR',
  status: 'Upcoming',
  url: 'https://portlandcraftale.org',
  mapsUrl: 'https://maps.google.com/?q=Portland',
  attendees: ['user-123'],
};

describe('EventCard', () => {
  it('renders event details, attendance badge, dates, and links correctly', () => {
    const onRequestDelete = vi.fn();
    const onStatusChange = vi.fn();
    const onSelect = vi.fn();
    const onToggleAttendance = vi.fn();

    const { container } = render(
      <EventCard
        event={sampleEvent}
        user={mockUser}
        canDelete={true}
        onRequestDelete={onRequestDelete}
        onStatusChange={onStatusChange}
        onSelect={onSelect}
        onToggleAttendance={onToggleAttendance}
      />
    );

    // Event title
    expect(screen.getByText('Portland Craft Ale Fest')).toBeInTheDocument();

    // Status badge
    const statusBadge = container.querySelector('.status-badge');
    expect(statusBadge).toHaveTextContent('Upcoming');

    // Address
    expect(screen.getByText('450 Waterfront Way, Portland, OR')).toBeInTheDocument();

    // Official website link
    const websiteLink = screen.getByRole('link', { name: /event website/i });
    expect(websiteLink).toHaveAttribute('href', 'https://portlandcraftale.org');

    // Google Maps link
    const mapsLink = screen.getByTitle('Open location pin in Google Maps');
    expect(mapsLink).toHaveAttribute('href', 'https://maps.google.com/?q=Portland');

    // Attendance button (user is attending)
    const attendBtn = screen.getByRole('button', { name: /attending/i });
    expect(attendBtn).toBeInTheDocument();

    fireEvent.click(attendBtn);
    expect(onToggleAttendance).toHaveBeenCalledWith('evt-1');
  });

  it('renders "Attend" when user is not in attendees list', () => {
    const otherUser = { uid: 'user-999' } as unknown as User;

    render(
      <EventCard
        event={sampleEvent}
        user={otherUser}
        canDelete={false}
        onRequestDelete={vi.fn()}
        onStatusChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /attend/i })).toHaveTextContent('Attend');
  });

  it('calls onStatusChange when selecting a new status from the dropdown', () => {
    const onStatusChange = vi.fn();

    render(
      <EventCard
        event={sampleEvent}
        user={mockUser}
        canDelete={true}
        onRequestDelete={vi.fn()}
        onStatusChange={onStatusChange}
        onSelect={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    const select = screen.getByLabelText(/change status:/i);
    expect(select).toHaveValue('Upcoming');

    fireEvent.change(select, { target: { value: 'Ongoing' } });
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenCalledWith('evt-1', 'Ongoing');
  });

  it('triggers onSelect when card is clicked', () => {
    const onSelect = vi.fn();

    render(
      <EventCard
        event={sampleEvent}
        user={mockUser}
        canDelete={true}
        onRequestDelete={vi.fn()}
        onStatusChange={vi.fn()}
        onSelect={onSelect}
        onToggleAttendance={vi.fn()}
      />
    );

    const card = screen.getByText('Portland Craft Ale Fest').closest('.event-card');
    expect(card).toBeInTheDocument();
    fireEvent.click(card!);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('handles delete button click when canDelete is true', () => {
    const onRequestDelete = vi.fn();

    const { container } = render(
      <EventCard
        event={sampleEvent}
        user={mockUser}
        canDelete={true}
        onRequestDelete={onRequestDelete}
        onStatusChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    // Card header delete button
    const deleteBtn = container.querySelector('#delete-evt-1')!;
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(sampleEvent);

    // Swipe delete button
    const swipeDeleteBtn = container.querySelector('#swipe-delete-evt-1')!;
    expect(swipeDeleteBtn).toBeInTheDocument();

    fireEvent.click(swipeDeleteBtn);
    expect(onRequestDelete).toHaveBeenCalledTimes(2);
    expect(onRequestDelete).toHaveBeenLastCalledWith(sampleEvent);
  });

  it('does not render delete buttons when canDelete is false', () => {
    const { container } = render(
      <EventCard
        event={sampleEvent}
        user={mockUser}
        canDelete={false}
        onRequestDelete={vi.fn()}
        onStatusChange={vi.fn()}
        onSelect={vi.fn()}
        onToggleAttendance={vi.fn()}
      />
    );

    expect(container.querySelector('#delete-evt-1')).not.toBeInTheDocument();
    expect(container.querySelector('#swipe-delete-evt-1')).not.toBeInTheDocument();
  });

  describe('Touch swipe gestures', () => {
    it('reveals delete action when swiped left past threshold and snaps back on tap outside', () => {
      render(
        <EventCard
          event={sampleEvent}
          user={mockUser}
          canDelete={true}
          onRequestDelete={vi.fn()}
          onStatusChange={vi.fn()}
          onSelect={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const card = screen.getByText('Portland Craft Ale Fest').closest('.event-card')!;

      // Initial state: offset 0px
      expect(card).toHaveStyle({ transform: 'translateX(0px)' });

      // Swipe left: touchStart at 200, move to 130 (diffX = -70 < -50)
      fireEvent.touchStart(card, { touches: [{ clientX: 200 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 130 }] });
      fireEvent.touchEnd(card);

      // Card should be revealed and shifted by -80px
      expect(card).toHaveStyle({ transform: 'translateX(-80px)' });

      // Tap outside card -> snaps back to 0px
      fireEvent.click(document.body);
      expect(card).toHaveStyle({ transform: 'translateX(0px)' });
    });

    it('snaps back when swiped right while revealed', () => {
      render(
        <EventCard
          event={sampleEvent}
          user={mockUser}
          canDelete={true}
          onRequestDelete={vi.fn()}
          onStatusChange={vi.fn()}
          onSelect={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const card = screen.getByText('Portland Craft Ale Fest').closest('.event-card')!;

      // 1. Swipe left to reveal
      fireEvent.touchStart(card, { touches: [{ clientX: 200 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 130 }] });
      fireEvent.touchEnd(card);
      expect(card).toHaveStyle({ transform: 'translateX(-80px)' });

      // 2. Swipe right to close (diffX = 150 - 100 = 50 > 30)
      fireEvent.touchStart(card, { touches: [{ clientX: 100 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 150 }] });
      fireEvent.touchEnd(card);
      expect(card).toHaveStyle({ transform: 'translateX(0px)' });
    });

    it('triggers onRequestDelete on deep left swipe when already revealed', () => {
      const onRequestDelete = vi.fn();

      render(
        <EventCard
          event={sampleEvent}
          user={mockUser}
          canDelete={true}
          onRequestDelete={onRequestDelete}
          onStatusChange={vi.fn()}
          onSelect={vi.fn()}
          onToggleAttendance={vi.fn()}
        />
      );

      const card = screen.getByText('Portland Craft Ale Fest').closest('.event-card')!;

      // 1. Swipe left to reveal
      fireEvent.touchStart(card, { touches: [{ clientX: 200 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 130 }] });
      fireEvent.touchEnd(card);
      expect(card).toHaveStyle({ transform: 'translateX(-80px)' });

      // 2. Deep swipe left (diffX = 50 - 100 = -50 < -40)
      fireEvent.touchStart(card, { touches: [{ clientX: 100 }] });
      fireEvent.touchMove(card, { touches: [{ clientX: 50 }] });
      fireEvent.touchEnd(card);

      expect(onRequestDelete).toHaveBeenCalledWith(sampleEvent);
      expect(card).toHaveStyle({ transform: 'translateX(0px)' });
    });
  });
});

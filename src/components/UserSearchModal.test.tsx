import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UserSearchModal } from './UserSearchModal';
import type { UserProfile } from '../types';

const mockUsers: UserProfile[] = [
  {
    uid: 'user-2',
    displayName: 'Bob Brewer',
    email: 'bob@kegswap.local',
    isPublic: true,
    friendCode: 'KEG-BOB2',
  },
];

describe('UserSearchModal (QR Code, Friend Code, Scanner & Public Search)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  it('displays the current user QR code and friend code in the "My QR & Code" tab and syncs directory', () => {
    const onSyncFriendCode = vi.fn(async () => 'KEG-7X9B');

    render(
      <UserSearchModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserId="user-1"
        currentUserDisplayName="Alice"
        currentUserFriendCode="KEG-7X9B"
        currentUserFriends={[]}
        publicUsers={mockUsers}
        initialTab="my-code"
        onSyncFriendCode={onSyncFriendCode}
        onAddFriend={vi.fn()}
        onRemoveFriend={vi.fn()}
      />
    );

    expect(screen.getByTestId('my-friend-code')).toHaveTextContent('KEG-7X9B');
    expect(screen.getByRole('img', { name: /QR code for friend code KEG-7X9B/i })).toBeInTheDocument();
    expect(onSyncFriendCode).toHaveBeenCalledTimes(1);

    // Copy code button feedback
    fireEvent.click(screen.getByRole('button', { name: /Copy Code/i }));
    expect(screen.getByText(/Copied Code!/i)).toBeInTheDocument();
  });

  it('allows entering a friend code manually to resolve a friend (including private accounts) and connect mutually', async () => {
    const privateUser: UserProfile = {
      uid: 'private-uid-99',
      displayName: 'Stealth Hopper',
      email: 'stealth@kegswap.local',
      isPublic: false,
      friendCode: 'KEG-9X2M',
    };

    const onLookupFriendByCode = vi.fn(async (code: string) =>
      code === 'KEG-9X2M' ? privateUser : null
    );
    const onAddFriend = vi.fn();

    render(
      <UserSearchModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserId="user-1"
        currentUserFriendCode="KEG-7X9B"
        currentUserFriends={[]}
        publicUsers={mockUsers}
        initialTab="scan-code"
        onLookupFriendByCode={onLookupFriendByCode}
        onAddFriend={onAddFriend}
        onRemoveFriend={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/Enter Friend Code or Invite Link/i);
    // Enter bare lowercase suffix without prefix
    fireEvent.change(input, { target: { value: '9x2m' } });
    fireEvent.click(screen.getByRole('button', { name: /Look Up/i }));

    await waitFor(() => {
      expect(onLookupFriendByCode).toHaveBeenCalledWith('KEG-9X2M');
      expect(screen.getByTestId('resolved-friend-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Stealth Hopper')).toBeInTheDocument();

    // Click Connect Friend
    fireEvent.click(screen.getByRole('button', { name: /Connect Friend/i }));
    expect(onAddFriend).toHaveBeenCalledWith('private-uid-99', {
      mutual: true,
      friendProfile: privateUser,
    });
    expect(screen.getByText(/Connected as Friends/i)).toBeInTheDocument();
  });

  it('automatically switches to scan-code and looks up initialFriendCode from a deep link (?addFriend=CODE)', async () => {
    const onClearInitialFriendCode = vi.fn();

    render(
      <UserSearchModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserId="user-1"
        currentUserFriendCode="KEG-7X9B"
        currentUserFriends={[]}
        publicUsers={mockUsers}
        initialTab="search"
        initialFriendCode="KEG-BOB2"
        onClearInitialFriendCode={onClearInitialFriendCode}
        onAddFriend={vi.fn()}
        onRemoveFriend={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('resolved-friend-card')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Brewer')).toBeInTheDocument();
    expect(onClearInitialFriendCode).toHaveBeenCalledTimes(1);
  });

  it('shows helpful message when entering own friend code or unknown code', async () => {
    render(
      <UserSearchModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserId="user-1"
        currentUserFriendCode="KEG-7X9B"
        currentUserFriends={[]}
        publicUsers={mockUsers}
        initialTab="scan-code"
        onAddFriend={vi.fn()}
        onRemoveFriend={vi.fn()}
      />
    );

    const input = screen.getByLabelText(/Enter Friend Code or Invite Link/i);

    // Own code
    fireEvent.change(input, { target: { value: 'KEG-7X9B' } });
    fireEvent.click(screen.getByRole('button', { name: /Look Up/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/your own Friend Code/i);

    // Unknown code
    fireEvent.change(input, { target: { value: 'KEG-ZZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: /Look Up/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No user found with code "KEG-ZZZZ"/i);
  });
});

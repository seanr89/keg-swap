import React, { useRef, useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import { Search, UserPlus, UserCheck, UserMinus, X, Globe, ShieldAlert } from 'lucide-react';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserFriends: string[];
  publicUsers: UserProfile[];
  onAddFriend: (friendUid: string) => void;
  onRemoveFriend: (friendUid: string) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUserFriends,
  publicUsers,
  onAddFriend,
  onRemoveFriend,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        setSearchQuery('');
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle native close events (e.g. Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  // Filter public users excluding current user
  const searchableUsers = publicUsers.filter(
    (u) => u.uid !== currentUserId && u.isPublic !== false
  );

  const filteredUsers = searchableUsers.filter((u) => {
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return true;
    const nameMatch = u.displayName?.toLowerCase().includes(queryLower);
    const emailMatch = u.email?.toLowerCase().includes(queryLower);
    return nameMatch || emailMatch;
  });

  return (
    <dialog ref={dialogRef} className="policy-modal-dialog search-users-dialog" id="user-search-dialog">
      <div className="modal-header">
        <div className="modal-title-with-icon">
          <Globe className="modal-title-icon text-amber" size={24} />
          <div>
            <h2 className="modal-title" style={{ margin: 0 }}>Find Friends</h2>
            <p className="modal-subtitle" style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Search for public accounts to add to your friend list
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-close-modal"
          onClick={onClose}
          aria-label="Close user search"
        >
          <X size={20} />
        </button>
      </div>

      <div className="modal-body" style={{ paddingTop: '16px', paddingBottom: '24px' }}>
        {/* Search Bar */}
        <div className="search-bar-wrapper" style={{ marginBottom: '20px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search public users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Users List */}
        <div className="user-search-results-list">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const isFriend = currentUserFriends.includes(u.uid);
              const avatarLetter = u.displayName
                ? u.displayName.charAt(0).toUpperCase()
                : u.email
                ? u.email.charAt(0).toUpperCase()
                : 'U';

              return (
                <div key={u.uid} className="user-search-card">
                  <div className="user-search-info">
                    <div className="profile-avatar user-search-avatar">
                      {avatarLetter}
                    </div>
                    <div>
                      <h4 className="user-search-name">{u.displayName || 'Ale Connoisseur'}</h4>
                      <p className="user-search-email">{u.email}</p>
                    </div>
                  </div>

                  {isFriend ? (
                    <button
                      type="button"
                      className="btn-secondary btn-small friend-status-btn active"
                      onClick={() => onRemoveFriend(u.uid)}
                      title="Click to remove friend"
                    >
                      <UserCheck size={14} className="icon-check" />
                      <UserMinus size={14} className="icon-minus" />
                      <span>Friends</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary btn-small"
                      onClick={() => onAddFriend(u.uid)}
                    >
                      <UserPlus size={14} />
                      <span>Add Friend</span>
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="profile-reviews-empty" style={{ padding: '32px 16px' }}>
              <ShieldAlert className="empty-icon text-muted" size={40} />
              <h4 style={{ margin: '12px 0 4px' }}>No public users found</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {searchQuery
                  ? `No public profiles match "${searchQuery}".`
                  : 'There are no other public accounts registered yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};

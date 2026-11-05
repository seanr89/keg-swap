import React, { useRef, useEffect, useState, useId, useMemo, useCallback } from 'react';
import type { UserProfile } from '../types';
import {
  Search,
  UserPlus,
  UserCheck,
  UserMinus,
  X,
  Globe,
  ShieldAlert,
  QrCode,
  ScanLine,
  Copy,
  Check,
  Share2,
  Camera,
  CameraOff,
  Lock,
} from 'lucide-react';
import {
  buildFriendInviteUrl,
  deriveFriendCodeFromUid,
  parseScannedFriendPayload,
} from '../utils/friendCode';
import { buildQrSvgPath, generateQrMatrix } from '../utils/qrCode';

export type FriendModalTab = 'search' | 'my-code' | 'scan-code';

interface BarcodeDetectionResult {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectionResult[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUserDisplayName?: string;
  currentUserFriendCode?: string;
  currentUserFriends: string[];
  publicUsers: UserProfile[];
  initialTab?: FriendModalTab;
  initialFriendCode?: string | null;
  onClearInitialFriendCode?: () => void;
  onSyncFriendCode?: () => Promise<string | null>;
  onLookupFriendByCode?: (code: string) => Promise<UserProfile | null>;
  onAddFriend: (
    friendUid: string,
    options?: { mutual?: boolean; friendProfile?: UserProfile }
  ) => void;
  onRemoveFriend: (friendUid: string) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUserDisplayName,
  currentUserFriendCode,
  currentUserFriends,
  publicUsers,
  initialTab = 'search',
  initialFriendCode = null,
  onClearInitialFriendCode,
  onSyncFriendCode,
  onLookupFriendByCode,
  onAddFriend,
  onRemoveFriend,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchInputId = useId();
  const codeInputId = useId();
  const codeHintId = useId();

  const [activeTab, setActiveTab] = useState<FriendModalTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // Share / copy state
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'code' | 'link'>('idle');

  // Scan / code lookup state
  const [codeInput, setCodeInput] = useState('');
  const [lookupStatus, setLookupStatus] = useState<
    'idle' | 'loading' | 'found' | 'not_found' | 'invalid' | 'self' | 'connected'
  >('idle');
  const [resolvedFriend, setResolvedFriend] = useState<UserProfile | null>(null);
  const [lookupErrorMessage, setLookupErrorMessage] = useState('');

  // Camera scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const myFriendCode = useMemo(
    () => currentUserFriendCode || deriveFriendCodeFromUid(currentUserId),
    [currentUserFriendCode, currentUserId]
  );

  const inviteUrl = useMemo(() => buildFriendInviteUrl(myFriendCode), [myFriendCode]);

  const qrSvg = useMemo(() => {
    const matrix = generateQrMatrix(inviteUrl);
    return buildQrSvgPath(matrix, 4);
  }, [inviteUrl]);

  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const performCodeLookup = useCallback(
    async (rawCodeOrUrl: string) => {
      const parsedCode = parseScannedFriendPayload(rawCodeOrUrl);
      if (!parsedCode) {
        setResolvedFriend(null);
        setLookupStatus('invalid');
        setLookupErrorMessage(
          'Please enter a valid friend code (e.g. KEG-7X9B) or invite link.'
        );
        return;
      }

      setCodeInput(parsedCode);
      setLookupErrorMessage('');

      if (parsedCode.toUpperCase() === myFriendCode.toUpperCase()) {
        setResolvedFriend(null);
        setLookupStatus('self');
        setLookupErrorMessage("That's your own Friend Code! Share it with a friend to connect.");
        return;
      }

      setLookupStatus('loading');

      let found: UserProfile | null = null;
      if (onLookupFriendByCode) {
        found = await onLookupFriendByCode(parsedCode);
      } else {
        found =
          publicUsers.find((u) => {
            const uCode = (u.friendCode || deriveFriendCodeFromUid(u.uid)).toUpperCase();
            return uCode === parsedCode;
          }) || null;
      }

      if (!found) {
        setResolvedFriend(null);
        setLookupStatus('not_found');
        setLookupErrorMessage(
          `No user found with code "${parsedCode}". Ask your friend to open their "My QR & Code" tab first.`
        );
        return;
      }

      if (found.uid === currentUserId) {
        setResolvedFriend(null);
        setLookupStatus('self');
        setLookupErrorMessage("That's your own Friend Code! Share it with a friend to connect.");
        return;
      }

      setResolvedFriend(found);
      setLookupStatus('found');
    },
    [currentUserId, myFriendCode, onLookupFriendByCode, publicUsers]
  );

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      setSearchQuery('');
      setCopyFeedback('idle');
      setCameraError(null);

      if (initialFriendCode) {
        setActiveTab('scan-code');
        void performCodeLookup(initialFriendCode);
        onClearInitialFriendCode?.();
      } else {
        setActiveTab(initialTab);
        setCodeInput('');
        setResolvedFriend(null);
        setLookupStatus('idle');
        setLookupErrorMessage('');
      }
    } else {
      stopCameraScanner();
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [
    isOpen,
    initialTab,
    initialFriendCode,
    onClearInitialFriendCode,
    performCodeLookup,
    stopCameraScanner,
  ]);

  // Publish friend code to directory when viewing My Code tab
  useEffect(() => {
    if (isOpen && activeTab === 'my-code' && onSyncFriendCode) {
      void onSyncFriendCode();
    }
    if (activeTab !== 'scan-code') {
      stopCameraScanner();
    }
  }, [isOpen, activeTab, onSyncFriendCode, stopCameraScanner]);

  // Handle native close events (e.g. Escape key) and Safari light-dismiss fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      stopCameraScanner();
      onClose();
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.bottom &&
        rect.left <= event.clientX &&
        event.clientX <= rect.right;
      if (!isInside) {
        dialog.close();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose, stopCameraScanner]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(myFriendCode);
      }
      setCopyFeedback('code');
      setTimeout(() => setCopyFeedback('idle'), 2500);
    } catch {
      setCopyFeedback('code');
    }
  };

  const handleShareInvite = async () => {
    const shareTitle = 'Connect on Keg Swap';
    const shareText = `Add ${currentUserDisplayName || 'me'} as a friend on Keg Swap using code ${myFriendCode}!`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch {
        // User cancelled native share sheet or unsupported; fall back to copying URL
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      }
      setCopyFeedback('link');
      setTimeout(() => setCopyFeedback('idle'), 2500);
    } catch {
      setCopyFeedback('link');
    }
  };

  const startCameraScanner = async () => {
    setCameraError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(
        'Camera access is not available on this device. Please enter your friend’s code below or scan with your native phone camera app.'
      );
      return;
    }

    const BarcodeDetectorCtor = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      if (!BarcodeDetectorCtor) {
        setCameraError(
          'Live QR detection is not supported by this browser. Point your phone’s native Camera app at the QR code, or enter the 8-character code below.'
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = barcodes[0].rawValue;
            const parsed = parseScannedFriendPayload(raw);
            if (parsed) {
              if (typeof navigator.vibrate === 'function') {
                navigator.vibrate(50);
              }
              stopCameraScanner();
              void performCodeLookup(parsed);
            }
          }
        } catch {
          // Ignore transient frame detection errors
        }
      }, 250);
    } catch {
      stopCameraScanner();
      setCameraError(
        'Could not access camera. Check browser permissions or enter your friend’s code manually below.'
      );
    }
  };

  const handleManualLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performCodeLookup(codeInput);
  };

  const handleConnectResolvedFriend = () => {
    if (!resolvedFriend) return;
    onAddFriend(resolvedFriend.uid, {
      mutual: true,
      friendProfile: resolvedFriend,
    });
    setLookupStatus('connected');
  };

  // Filter public users excluding current user
  const searchableUsers = publicUsers.filter(
    (u) => u.uid !== currentUserId && u.isPublic !== false
  );

  const filteredUsers = searchableUsers.filter((u) => {
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return true;
    const nameMatch = u.displayName?.toLowerCase().includes(queryLower);
    const emailMatch = u.email?.toLowerCase().includes(queryLower);
    const codeMatch = u.friendCode?.toLowerCase().includes(queryLower);
    return Boolean(nameMatch || emailMatch || codeMatch);
  });

  const isResolvedAlreadyFriend = Boolean(
    resolvedFriend && currentUserFriends.includes(resolvedFriend.uid)
  );

  return (
    <dialog
      ref={dialogRef}
      className="policy-modal-dialog search-users-dialog"
      id="user-search-dialog"
      aria-labelledby="user-search-dialog-title"
      closedby="any"
    >
      <div className="modal-header">
        <div className="modal-title-with-icon">
          <Globe className="modal-title-icon text-amber" size={24} />
          <div>
            <h2 className="modal-title" id="user-search-dialog-title" style={{ margin: 0 }}>
              Find &amp; Connect Friends
            </h2>
            <p className="modal-subtitle" style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Scan a QR code in person, enter a friend code, or search public profiles
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

      {/* Mode Navigation Tabs */}
      <div className="friend-modal-tabs" role="tablist" aria-label="Friend connection methods">
        <button
          type="button"
          role="tab"
          id="friend-tab-my-code"
          aria-selected={activeTab === 'my-code'}
          aria-controls="friend-panel-my-code"
          className={`friend-modal-tab ${activeTab === 'my-code' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-code')}
        >
          <QrCode size={15} aria-hidden="true" />
          <span>My QR &amp; Code</span>
        </button>
        <button
          type="button"
          role="tab"
          id="friend-tab-scan-code"
          aria-selected={activeTab === 'scan-code'}
          aria-controls="friend-panel-scan-code"
          className={`friend-modal-tab ${activeTab === 'scan-code' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan-code')}
        >
          <ScanLine size={15} aria-hidden="true" />
          <span>Scan / Enter Code</span>
        </button>
        <button
          type="button"
          role="tab"
          id="friend-tab-search"
          aria-selected={activeTab === 'search'}
          aria-controls="friend-panel-search"
          className={`friend-modal-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <Search size={15} aria-hidden="true" />
          <span>Public Search</span>
        </button>
      </div>

      <div className="modal-body" style={{ paddingTop: '16px', paddingBottom: '24px' }}>
        {/* TAB 1: MY QR & FRIEND CODE */}
        {activeTab === 'my-code' && (
          <div
            id="friend-panel-my-code"
            role="tabpanel"
            aria-labelledby="friend-tab-my-code"
            className="friend-qr-panel"
          >
            <div className="friend-qr-card">
              <div className="friend-qr-svg-wrapper">
                <svg
                  role="img"
                  aria-label={`QR code for friend code ${myFriendCode}`}
                  viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
                  className="friend-qr-svg"
                  shapeRendering="crispEdges"
                >
                  <title>{`Keg Swap Friend QR Code (${myFriendCode})`}</title>
                  <rect width={qrSvg.viewBoxSize} height={qrSvg.viewBoxSize} className="friend-qr-bg" rx="2" />
                  <path d={qrSvg.pathData} className="friend-qr-fg" />
                </svg>
              </div>

              <div className="friend-code-badge-box">
                <span className="friend-code-label">Your Friend Code</span>
                <strong className="friend-code-value" data-testid="my-friend-code">
                  {myFriendCode}
                </strong>
              </div>

              <p className="friend-qr-helper">
                Show this QR code or share your 8-character code with a friend standing nearby to connect immediately—even if your profile is set to Private.
              </p>

              <div className="friend-qr-actions">
                <button
                  type="button"
                  className="btn-secondary friend-qr-action-btn"
                  onClick={handleCopyCode}
                >
                  {copyFeedback === 'code' ? (
                    <>
                      <Check size={16} aria-hidden="true" />
                      <span>Copied Code!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} aria-hidden="true" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-primary friend-qr-action-btn"
                  onClick={handleShareInvite}
                >
                  {copyFeedback === 'link' ? (
                    <>
                      <Check size={16} aria-hidden="true" />
                      <span>Invite Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={16} aria-hidden="true" />
                      <span>Share Invite Link</span>
                    </>
                  )}
                </button>
              </div>

              <div role="status" aria-live="polite" className="visually-hidden">
                {copyFeedback === 'code'
                  ? `Copied friend code ${myFriendCode} to clipboard`
                  : copyFeedback === 'link'
                  ? 'Copied friend invite link to clipboard'
                  : ''}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SCAN QR OR ENTER CODE */}
        {activeTab === 'scan-code' && (
          <div
            id="friend-panel-scan-code"
            role="tabpanel"
            aria-labelledby="friend-tab-scan-code"
            className="friend-scan-panel"
          >
            {/* Camera QR Scanner Box */}
            <div className="friend-scanner-section">
              {!isScanning ? (
                <button
                  type="button"
                  className="btn-secondary friend-camera-toggle-btn"
                  onClick={startCameraScanner}
                >
                  <Camera size={18} aria-hidden="true" />
                  <span>Scan Friend’s QR Code with Camera</span>
                </button>
              ) : (
                <div className="friend-camera-viewport-wrapper">
                  <div className="friend-camera-viewport">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="friend-camera-video"
                      aria-label="QR code camera scanner viewfinder"
                    />
                    <div className="friend-camera-reticle" aria-hidden="true" />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-small friend-camera-stop-btn"
                    onClick={stopCameraScanner}
                  >
                    <CameraOff size={15} aria-hidden="true" />
                    <span>Stop Camera</span>
                  </button>
                </div>
              )}

              {cameraError && (
                <p role="alert" className="friend-camera-error">
                  {cameraError}
                </p>
              )}
            </div>

            {/* Manual Friend Code Form */}
            <form onSubmit={handleManualLookupSubmit} className="friend-code-lookup-form">
              <label htmlFor={codeInputId} className="friend-code-input-label">
                Enter Friend Code or Invite Link
              </label>
              <span id={codeHintId} className="friend-code-input-hint">
                Enter your friend’s code (e.g. KEG-7X9B or 7X9B) to connect directly.
              </span>
              <div className="friend-code-input-row">
                <input
                  id={codeInputId}
                  name="friendCode"
                  type="text"
                  className="search-input friend-code-text-input"
                  placeholder="KEG-7X9B"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (lookupStatus === 'invalid' || lookupStatus === 'not_found' || lookupStatus === 'self') {
                      setLookupStatus('idle');
                      setLookupErrorMessage('');
                    }
                  }}
                  aria-describedby={codeHintId}
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <button type="submit" className="btn-primary friend-code-lookup-btn">
                  Look Up
                </button>
              </div>
            </form>

            {/* Lookup Error Message */}
            {lookupErrorMessage && (
              <div role="alert" className="friend-lookup-alert">
                <ShieldAlert size={18} aria-hidden="true" />
                <span>{lookupErrorMessage}</span>
              </div>
            )}

            {/* Resolved Friend Confirmation Card */}
            {resolvedFriend && (
              <div className="friend-resolved-card" data-testid="resolved-friend-card">
                <div className="user-search-info">
                  <div className="profile-avatar user-search-avatar">
                    {(resolvedFriend.displayName || resolvedFriend.email || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="friend-resolved-name-row">
                      <h4 className="user-search-name">
                        {resolvedFriend.displayName || 'Ale Connoisseur'}
                      </h4>
                      <span className="friend-resolved-code-pill">
                        {resolvedFriend.friendCode || deriveFriendCodeFromUid(resolvedFriend.uid)}
                      </span>
                    </div>
                    <p className="user-search-email">
                      {resolvedFriend.email || (
                        <span className="friend-private-indicator">
                          <Lock size={11} aria-hidden="true" /> Direct Friend Code Match
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {isResolvedAlreadyFriend || lookupStatus === 'connected' ? (
                  <div className="friend-connected-actions">
                    <span className="friend-connected-badge" role="status" aria-live="polite">
                      <UserCheck size={15} aria-hidden="true" />
                      <span>Connected as Friends</span>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-primary btn-small"
                    onClick={handleConnectResolvedFriend}
                  >
                    <UserPlus size={14} aria-hidden="true" />
                    <span>Connect Friend</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PUBLIC USER SEARCH */}
        {activeTab === 'search' && (
          <div
            id="friend-panel-search"
            role="tabpanel"
            aria-labelledby="friend-tab-search"
          >
            {/* Search Bar */}
            <div className="search-bar-wrapper" style={{ marginBottom: '20px' }}>
              <label htmlFor={searchInputId} className="visually-hidden">
                Search public users by name or email
              </label>
              <Search className="search-icon" size={18} aria-hidden="true" />
              <input
                id={searchInputId}
                name="userSearch"
                type="text"
                className="search-input"
                placeholder="Search public users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
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
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
                    {searchQuery
                      ? `No public profiles match "${searchQuery}".`
                      : 'There are no other public accounts registered yet.'}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    onClick={() => setActiveTab('scan-code')}
                  >
                    <ScanLine size={14} aria-hidden="true" />
                    <span>Connect via QR / Friend Code instead</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
};

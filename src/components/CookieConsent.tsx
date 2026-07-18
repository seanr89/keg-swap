import React from 'react';
import { Cookie } from 'lucide-react';

interface CookieConsentProps {
  isVisible: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onOpenSettings: () => void;
}

export const CookieConsent: React.FC<CookieConsentProps> = ({
  isVisible,
  onAcceptAll,
  onRejectAll,
  onOpenSettings,
}) => {
  if (!isVisible) return null;

  return (
    <div className="cookie-banner-container" id="cookie-consent-banner">
      <div className="cookie-banner-content">
        <div className="cookie-banner-text-wrapper">
          <div className="cookie-banner-icon-container">
            <Cookie className="cookie-banner-icon animate-float" size={24} />
          </div>
          <div className="cookie-banner-text">
            <h4>We respect your privacy</h4>
            <p>
              We use cookies and local storage to secure your account session (essential) and remember your 
              color theme preference (functional). You can choose to accept all, decline non-essential cookies, or manage settings. 
              Read more in our{' '}
              <button type="button" className="cookie-banner-link-btn" onClick={onOpenSettings}>
                Privacy & Cookie Policy
              </button>
              .
            </p>
          </div>
        </div>
        <div className="cookie-banner-actions">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onOpenSettings}
            id="cookie-btn-settings"
          >
            Settings
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onRejectAll}
            id="cookie-btn-decline"
          >
            Necessary Only
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={onAcceptAll}
            id="cookie-btn-accept"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
};

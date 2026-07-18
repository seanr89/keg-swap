import React, { useRef, useEffect, useState } from 'react';
import { X, Shield, Cookie, Info } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  consent: { necessary: boolean; preferences: boolean };
  onSaveConsent: (preferencesAccepted: boolean) => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  consent,
  onSaveConsent,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [prefAccepted, setPrefAccepted] = useState(consent.preferences);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        setPrefAccepted(consent.preferences);
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, consent.preferences]);

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

  const handleSave = () => {
    onSaveConsent(prefAccepted);
    onClose();
  };

  return (
    <dialog ref={dialogRef} className="policy-modal-dialog" id="privacy-policy-dialog">
      <div className="modal-header">
        <div className="modal-title-with-icon">
          <Shield className="modal-title-icon" size={20} />
          <h2>Privacy & Cookie Settings</h2>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>
      </div>

      <div className="modal-body policy-modal-body">
        <section className="policy-section">
          <h3>UK & EU Privacy Information</h3>
          <p>
            Under the EU General Data Protection Regulation (GDPR) and the UK GDPR / Data Protection Act 2018, 
            we are committed to protecting your personal data and ensuring transparency in how we handle information.
          </p>
        </section>

        <section className="policy-section">
          <h3>Your Rights under GDPR</h3>
          <p>You have the following rights regarding your personal data:</p>
          <ul className="policy-list">
            <li><strong>Right of Access:</strong> Obtain a copy of your personal data we store.</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to Erasure (Right to be Forgotten):</strong> Request deletion of your account and all associated events, drinks, and reviews.</li>
            <li><strong>Right to Withdraw Consent:</strong> Change or withdraw your cookie and storage preferences at any time.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h3>Data Collection & Processing</h3>
          <ul className="policy-list">
            <li><strong>Authentication:</strong> When you register or sign in, we process your name and email via Google Firebase Authentication to secure your account.</li>
            <li><strong>User-Generated Content:</strong> All events, drinks, and beer reviews you add are stored securely in our Firebase Firestore database to provide the board functionality.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h3>Storage Preferences & Cookies</h3>
          <p>
            We use browser storage (cookies and local storage) to ensure our services run smoothly and to remember your preferences. 
            You can customize your settings below:
          </p>

          <div className="consent-options">
            {/* Necessary Storage */}
            <div className="consent-option-card essential">
              <div className="consent-option-header">
                <div className="option-title-container">
                  <Cookie size={16} className="option-icon" />
                  <h4>Necessary Storage (Always Active)</h4>
                </div>
                <span className="badge badge-essential">Required</span>
              </div>
              <p className="option-description">
                Required for core website security, session persistence, and system operations. 
                This includes Firebase Auth state to keep you logged in. It does not track you across websites.
              </p>
            </div>

            {/* Functional Preferences */}
            <div className="consent-option-card">
              <div className="consent-option-header">
                <div className="option-title-container">
                  <Info size={16} className="option-icon" />
                  <h4>Preference Storage (Theme Settings)</h4>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={prefAccepted}
                    onChange={(e) => setPrefAccepted(e.target.checked)}
                    id="consent-toggle-preferences"
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="option-description">
                Allows us to remember your preferences between visits. 
                Specifically, this saves your dark/light theme choices (`keg_swap_theme` in local storage) 
                so you don't have to toggle it on every reload.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} id="btn-save-consent">
          Save Settings
        </button>
      </div>
    </dialog>
  );
};

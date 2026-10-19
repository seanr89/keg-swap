import React, { useState, useRef } from 'react';
import { Camera, Trash2, RefreshCw, Link as LinkIcon } from 'lucide-react';

export interface ReviewPhotoControlProps {
  imageUrl: string;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onImageUrlChange: (url: string) => void;
  disabled?: boolean;
}

export const ReviewPhotoControl: React.FC<ReviewPhotoControlProps> = ({
  imageUrl,
  uploading,
  onFileSelect,
  onImageUrlChange,
  disabled = false,
}) => {
  const [showUrlField, setShowUrlField] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    e.target.value = '';
  };

  return (
    <div className="form-group review-photo-control" style={{ margin: 0 }}>
      <div className="review-section-label-row">
        <span className="form-label" style={{ margin: 0 }}>
          Drink Photo
        </span>
        <span className="review-optional-hint">Optional</span>
      </div>

      {/* Accessible visually-hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id="review-photo-capture"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />

      {imageUrl ? (
        <div className="review-photo-preview-card">
          <img
            src={imageUrl}
            alt="Drink check-in preview"
            className="review-photo-preview-img"
          />
          <div className="review-photo-preview-actions">
            <span className="review-photo-ready-text">Photo attached</span>
            <div className="review-photo-btn-group">
              <label
                htmlFor="review-photo-capture"
                className="btn-secondary btn-photo-action"
              >
                <RefreshCw size={14} />
                <span>Retake</span>
              </label>
              <button
                type="button"
                className="btn-remove-image"
                onClick={() => onImageUrlChange('')}
                disabled={disabled || uploading}
                title="Remove attached photo"
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="review-photo-empty-actions">
          <div className="review-photo-trigger-row">
            <label
              htmlFor="review-photo-capture"
              className={`btn-camera-snap ${uploading ? 'uploading' : ''}`}
            >
              <Camera size={18} />
              <span>{uploading ? 'Compressing & Uploading...' : 'Snap Photo of Drink'}</span>
            </label>

            <button
              type="button"
              className={`btn-toggle-photo-url ${showUrlField ? 'active' : ''}`}
              onClick={() => setShowUrlField((prev) => !prev)}
              disabled={disabled || uploading}
              title="Paste image URL instead"
              aria-expanded={showUrlField}
            >
              <LinkIcon size={16} />
              <span>URL</span>
            </button>
          </div>

          {showUrlField && (
            <input
              type="url"
              className="form-input mobile-touch-input"
              placeholder="Paste image link (https://...)"
              aria-label="Paste image link"
              value={imageUrl}
              disabled={disabled || uploading}
              onChange={(e) => onImageUrlChange(e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  );
};

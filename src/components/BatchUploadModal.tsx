import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { BeerDrink } from '../types';
import { parseBatchBeerJson } from '../utils/batchBeerParser';
import { 
  Upload, 
  X, 
  Check, 
  AlertTriangle, 
  FileText, 
  Search, 
  Trash2, 
  FileCode, 
  Beer,
  RefreshCw,
  Info
} from 'lucide-react';

export interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmUpload: (drinks: Omit<BeerDrink, 'id' | 'reviews'>[]) => void;
  eventName: string;
  existingDrinks?: BeerDrink[];
  initialFile?: File | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  isOpen,
  onClose,
  onConfirmUpload,
  eventName,
  existingDrinks = [],
  initialFile = null,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [parsedDrinks, setParsedDrinks] = useState<Omit<BeerDrink, 'id' | 'reviews'>[]>([]);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [showSampleSchema, setShowSampleSchema] = useState<boolean>(false);

  const resetState = useCallback(() => {
    setFileName('');
    setFileSize(0);
    setParsedDrinks([]);
    setSkippedCount(0);
    setErrorMessage('');
    setIsDragging(false);
    setSearchQuery('');
    setSelectedStyle('all');
    setShowSampleSchema(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseBatchBeerJson(text);
      if (result.error) {
        setErrorMessage(result.error);
        setParsedDrinks([]);
        setSkippedCount(result.skippedCount);
      } else {
        setParsedDrinks(result.validDrinks);
        setSkippedCount(result.skippedCount);
        setErrorMessage('');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read file from disk. Please try again.');
    };
    reader.readAsText(file);
  }, []);

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        resetState();
        if (initialFile) {
          processFile(initialFile);
        }
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, initialFile, processFile, resetState]);

  // Handle native close events (Escape key) and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
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

    dialog.addEventListener('close', handleNativeClose);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleRemoveDrink = (indexToRemove: number) => {
    setParsedDrinks((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Duplicate detection against existing event drinks
  const existingDrinkMap = useMemo(() => {
    const map = new Set<string>();
    for (const d of existingDrinks) {
      map.add(`${d.name.toLowerCase().trim()}|||${d.brewery.toLowerCase().trim()}`);
    }
    return map;
  }, [existingDrinks]);

  const duplicateCount = useMemo(() => {
    return parsedDrinks.filter((d) => 
      existingDrinkMap.has(`${d.name.toLowerCase().trim()}|||${d.brewery.toLowerCase().trim()}`)
    ).length;
  }, [parsedDrinks, existingDrinkMap]);

  // Unique styles for filter pills
  const availableStyles = useMemo(() => {
    const styles = new Set<string>();
    for (const d of parsedDrinks) {
      if (d.style) styles.add(d.style);
    }
    return Array.from(styles).sort();
  }, [parsedDrinks]);

  // Filtered drinks based on search and style
  const filteredDrinks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return parsedDrinks.filter((drink) => {
      if (selectedStyle !== 'all' && drink.style !== selectedStyle) {
        return false;
      }
      if (!query) return true;
      return (
        drink.name.toLowerCase().includes(query) ||
        drink.brewery.toLowerCase().includes(query) ||
        drink.style.toLowerCase().includes(query) ||
        drink.location.toLowerCase().includes(query) ||
        drink.description.toLowerCase().includes(query)
      );
    });
  }, [parsedDrinks, searchQuery, selectedStyle]);

  // Summary counts
  const veganCount = useMemo(() => parsedDrinks.filter((d) => d.isVegan).length, [parsedDrinks]);
  const glutenFreeCount = useMemo(() => parsedDrinks.filter((d) => d.isGlutenFree).length, [parsedDrinks]);

  const handleConfirm = () => {
    if (parsedDrinks.length === 0) return;
    onConfirmUpload(parsedDrinks);
  };

  return (
    <dialog
      ref={dialogRef}
      className="event-modal-dialog batch-upload-dialog"
      aria-labelledby="batch-upload-modal-title"
      closedby="any"
    >
      <div className="modal-header">
        <div className="modal-title-with-icon">
          <Beer className="modal-title-icon text-amber" size={24} />
          <div>
            <h2 id="batch-upload-modal-title" className="modal-title" style={{ margin: 0 }}>
              Batch Upload Beers
            </h2>
            <p className="modal-subtitle" style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Preview and verify records from beers.json before importing
            </p>
          </div>
        </div>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>

      <div className="modal-body batch-modal-body">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          id="batch-modal-file-input"
        />

        {/* State A: No file loaded or error with no valid drinks */}
        {parsedDrinks.length === 0 ? (
          <div className="batch-upload-empty-state">
            <div
              className={`batch-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Upload JSON file"
            >
              <div className="batch-dropzone-icon-wrap">
                <Upload size={38} className="dropzone-icon text-amber" />
              </div>
              <h3 className="batch-dropzone-title">Select or drop a beers.json file</h3>
              <p className="batch-dropzone-subtitle">
                Choose a JSON file of beer records to preview before saving to <strong>{eventName}</strong>
              </p>
              <button
                type="button"
                className="btn-primary batch-browse-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <FileText size={16} />
                <span>Browse File</span>
              </button>
              <span className="batch-dropzone-hint">
                Accepts .json file matching Keg Swap catalog format
              </span>
            </div>

            {errorMessage && (
              <div className="batch-error-banner" role="alert">
                <AlertTriangle size={18} className="text-danger" />
                <div className="batch-error-text">
                  <strong>Validation Error:</strong> {errorMessage}
                </div>
              </div>
            )}

            {/* Expandable schema sample help */}
            <div className="batch-schema-help">
              <button
                type="button"
                className="batch-schema-toggle"
                onClick={() => setShowSampleSchema(!showSampleSchema)}
              >
                <FileCode size={15} />
                <span>{showSampleSchema ? 'Hide expected beers.json schema' : 'View expected beers.json schema'}</span>
              </button>

              {showSampleSchema && (
                <div className="batch-schema-content animate-slide-down">
                  <p className="batch-schema-note">
                    Your JSON file must contain an array of beer objects with these required fields:
                  </p>
                  <pre className="batch-code-preview">
{`[
  {
    "name": "Northern Monk Faith",
    "brewery": "Northern Monk Brew Co",
    "location": "Leeds",
    "abv": "5.4%",
    "style": "Hazy Pale Ale",
    "description": "Juicy, tropical pale ale packed with Citra and Mosaic hops.",
    "type": "Cask",
    "isVegan": true,
    "caskOrKeg": "Keg"
  }
]`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* State B: Valid drinks parsed — Preview list & potential count */
          <div className="batch-preview-state">
            {/* Top file meta & Change File button */}
            <div className="batch-file-meta-bar">
              <div className="batch-file-info">
                <FileText size={16} className="text-amber" />
                <span className="batch-file-name" title={fileName}>{fileName}</span>
                <span className="batch-file-size">({formatBytes(fileSize)})</span>
              </div>
              <button
                type="button"
                className="btn-secondary batch-change-file-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Choose a different JSON file"
              >
                <RefreshCw size={13} />
                <span>Change File</span>
              </button>
            </div>

            {/* Potential Count Callout Banner */}
            <div className="batch-potential-count-card">
              <div className="batch-count-header">
                <div className="batch-count-badge">
                  <Check size={18} />
                  <span>{parsedDrinks.length}</span>
                </div>
                <div className="batch-count-titles">
                  <h3 className="batch-count-title">
                    {parsedDrinks.length} {parsedDrinks.length === 1 ? 'Beer' : 'Beers'} Ready to Upload
                  </h3>
                  <p className="batch-count-subtitle">
                    Target Event: <strong>{eventName}</strong>
                  </p>
                </div>
              </div>

              {/* Status Pills: Invalid skipped & duplicates warning */}
              <div className="batch-status-pills">
                {skippedCount > 0 && (
                  <span className="batch-pill pill-warning" title="Items in JSON missing mandatory fields">
                    <AlertTriangle size={13} />
                    <span>{skippedCount} invalid {skippedCount === 1 ? 'item' : 'items'} skipped</span>
                  </span>
                )}
                {duplicateCount > 0 && (
                  <span className="batch-pill pill-info" title="Beers that already exist in this event">
                    <Info size={13} />
                    <span>{duplicateCount} {duplicateCount === 1 ? 'beer' : 'beers'} already in event</span>
                  </span>
                )}
                <span className="batch-pill pill-neutral">
                  <span>{availableStyles.length} {availableStyles.length === 1 ? 'style' : 'styles'}</span>
                </span>
                {veganCount > 0 && (
                  <span className="batch-pill pill-neutral">
                    <span>🌱 {veganCount} Vegan</span>
                  </span>
                )}
                {glutenFreeCount > 0 && (
                  <span className="batch-pill pill-neutral">
                    <span>🌾 {glutenFreeCount} Gluten-Free</span>
                  </span>
                )}
              </div>
            </div>

            {/* Search and Style Filter */}
            <div className="batch-filter-toolbar">
              <div className="batch-search-box">
                <Search size={15} className="batch-search-icon" />
                <input
                  type="text"
                  placeholder="Filter preview beers by name, brewery, style..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="batch-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="batch-search-clear"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {availableStyles.length > 1 && (
                <div className="batch-style-select-wrapper">
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="batch-style-select"
                    aria-label="Filter by style"
                  >
                    <option value="all">All Styles ({parsedDrinks.length})</option>
                    {availableStyles.map((style) => {
                      const count = parsedDrinks.filter((d) => d.style === style).length;
                      return (
                        <option key={style} value={style}>
                          {style} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* List of records to be uploaded */}
            <div className="batch-preview-list" role="list" aria-label="Beers to upload">
              {filteredDrinks.length === 0 ? (
                <div className="batch-no-results">
                  <p>No beers match your filter &ldquo;{searchQuery}&rdquo;</p>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStyle('all');
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredDrinks.map((drink, index) => {
                  const originalIndex = parsedDrinks.indexOf(drink);
                  const isDuplicate = existingDrinkMap.has(
                    `${drink.name.toLowerCase().trim()}|||${drink.brewery.toLowerCase().trim()}`
                  );

                  return (
                    <div key={`${drink.name}-${drink.brewery}-${index}`} className="batch-beer-row" role="listitem">
                      {drink.imageUrl && (
                        <img
                          src={drink.imageUrl}
                          alt={drink.name}
                          className="batch-beer-thumb"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                      
                      <div className="batch-beer-details">
                        <div className="batch-beer-top-row">
                          <h4 className="batch-beer-name">{drink.name}</h4>
                          <span className="batch-beer-abv">{drink.abv}</span>
                        </div>
                        
                        <div className="batch-beer-meta">
                          <span className="batch-beer-brewery">{drink.brewery}</span>
                          <span className="batch-beer-divider">•</span>
                          <span className="batch-beer-location">{drink.location}</span>
                        </div>

                        <div className="batch-beer-badges">
                          <span className="batch-badge badge-style">{drink.style}</span>
                          {drink.type && drink.type !== 'Unknown' && (
                            <span className="batch-badge badge-type">{drink.type}</span>
                          )}
                          {drink.caskOrKeg && (
                            <span className="batch-badge badge-format">{drink.caskOrKeg}</span>
                          )}
                          {drink.isVegan && (
                            <span className="batch-badge badge-vegan" title="Vegan">🌱 Vegan</span>
                          )}
                          {drink.isGlutenFree && (
                            <span className="batch-badge badge-gf" title="Gluten-Free">🌾 Gluten-Free</span>
                          )}
                          {isDuplicate && (
                            <span className="batch-badge badge-duplicate" title="This beer is already in the event list">
                              Already in Event
                            </span>
                          )}
                        </div>

                        {drink.description && (
                          <p className="batch-beer-desc">{drink.description}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="batch-remove-row-btn"
                        onClick={() => handleRemoveDrink(originalIndex)}
                        title="Exclude this beer from upload"
                        aria-label={`Exclude ${drink.name} from upload`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Modal actions footer */}
        <div className="modal-actions batch-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          {parsedDrinks.length > 0 && (
            <button
              type="button"
              className="btn-primary batch-upload-confirm-btn"
              onClick={handleConfirm}
            >
              <Upload size={16} />
              <span>
                Upload {parsedDrinks.length} {parsedDrinks.length === 1 ? 'Beer' : 'Beers'}
              </span>
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};

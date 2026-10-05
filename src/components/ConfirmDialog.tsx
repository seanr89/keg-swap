import React, { useRef, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync React open state with native dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native close (Esc key or light-dismiss) is treated as cancel
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => onCancel();
    dialog.addEventListener('close', handleNativeClose);

    // Fallback for browsers that do not support closedby="any" (e.g. Safari)
    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= event.clientY && event.clientY <= rect.bottom &&
        rect.left <= event.clientX && event.clientX <= rect.right;
      if (!isInside) dialog.close();
    };
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="event-modal-dialog admin-confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      closedby="any"
    >
      <div className="modal-header">
        <h2 id="confirm-dialog-title">{title}</h2>
        <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="Cancel">
          <X size={20} />
        </button>
      </div>
      <div style={{ padding: '16px 24px 24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px' }}>
          {message}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} id="confirm-dialog-confirm-btn">
            <Trash2 size={15} />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
};

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title, message, and buttons when isOpen is true', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Event"
        message="Are you sure you want to delete this event?"
        confirmLabel="Yes, Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Delete Event' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this event?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Delete' })).toBeInTheDocument();
    expect(container.querySelector('.btn-secondary')).toHaveTextContent('Cancel');
    expect(container.querySelector('.modal-close-btn')).toBeInTheDocument();
  });

  it('triggers onConfirm when clicking the confirm button', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Delete Event"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('triggers onCancel when clicking the cancel button or header close button', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm Action"
        message="Proceed?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Click secondary Cancel button
    const cancelBtn = container.querySelector('.btn-secondary')!;
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Click header close button
    const closeBtn = container.querySelector('.modal-close-btn')!;
    fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('triggers onCancel on native dialog close event', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Close Test"
        message="Testing native close event"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog', { hidden: true });
    fireEvent(dialog, new Event('close'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

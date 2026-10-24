import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BatchUploadModal } from './BatchUploadModal';
import { SAMPLE_TEST_BEERS } from '../utils/testEventSeeder';

describe('BatchUploadModal', () => {
  it('loads 10 sample test beers into preview when clicking the quick sample load button', () => {
    const onConfirmUpload = vi.fn();
    const onClose = vi.fn();

    render(
      <BatchUploadModal
        isOpen={true}
        onClose={onClose}
        onConfirmUpload={onConfirmUpload}
        eventName="Sample Test Festival"
      />
    );

    const loadSampleBtn = screen.getByRole('button', { name: /load 10 sample test beers/i });
    expect(loadSampleBtn).toBeInTheDocument();

    fireEvent.click(loadSampleBtn);

    // Verify preview headline matches 10 beers
    expect(screen.getByText(/10 Beers Ready to Upload/i)).toBeInTheDocument();

    // Verify beer names from SAMPLE_TEST_BEERS are rendered in preview
    expect(screen.getByText('Pale Fire')).toBeInTheDocument();
    expect(screen.getByText('Northern Monk')).toBeInTheDocument();
    expect(screen.getByText('Midnight Porter')).toBeInTheDocument();
    expect(screen.getByText('Citra Haze IPA')).toBeInTheDocument();

    // Confirm upload button triggers onConfirmUpload with the 10 drinks
    const uploadBtn = screen.getByRole('button', { name: /upload 10 beers/i });
    expect(uploadBtn).toBeInTheDocument();

    fireEvent.click(uploadBtn);

    expect(onConfirmUpload).toHaveBeenCalledTimes(1);
    const uploadedDrinks = onConfirmUpload.mock.calls[0][0];
    expect(uploadedDrinks).toEqual(SAMPLE_TEST_BEERS);
    expect(uploadedDrinks).toHaveLength(10);
  });
});

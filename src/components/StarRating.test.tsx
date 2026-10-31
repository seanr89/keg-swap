import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('renders static beer glasses in non-interactive mode', () => {
    const { container } = render(<StarRating rating={3.5} maxStars={5} />);

    // In static mode, buttons should not be present
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const staticItems = container.querySelectorAll('.star-static-item');
    expect(staticItems).toHaveLength(5);

    // 3.5 stars out of 5:
    // glass 1: filled
    // glass 2: filled
    // glass 3: filled
    // glass 4: half
    // glass 5: empty
    expect(staticItems[0]).toHaveClass('filled');
    expect(staticItems[1]).toHaveClass('filled');
    expect(staticItems[2]).toHaveClass('filled');
    expect(staticItems[3]).toHaveClass('half');
    expect(staticItems[4]).toHaveClass('empty');
  });

  it('renders rating value text when showValueText is true', () => {
    render(<StarRating rating={7.5} maxStars={10} showValueText />);

    expect(screen.getByText('7.5 / 10')).toBeInTheDocument();
  });

  it('renders interactive buttons when interactive is true', () => {
    render(<StarRating rating={4} maxStars={5} interactive />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Rate 0.5 or 1 beer glasses');
    expect(buttons[4]).toHaveAttribute('aria-label', 'Rate 4.5 or 5 beer glasses');
  });

  it('triggers onChange with full glass rating when clicking the right half of a beer glass', () => {
    const handleChange = vi.fn();
    render(<StarRating rating={0} maxStars={5} interactive onChange={handleChange} />);

    const buttons = screen.getAllByRole('button');
    const targetGlass = buttons[2]; // glassIndex 2 -> 3 glasses

    // Mock bounding rect: width 20px, left 10px
    vi.spyOn(targetGlass, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 0,
      right: 30,
      bottom: 20,
      width: 20,
      height: 20,
      x: 10,
      y: 0,
      toJSON: () => {},
    });

    // Click at clientX = 25 (x = 15, >= width / 2 of 10 -> full glass)
    fireEvent.click(targetGlass, { clientX: 25 });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(3.0);
  });

  it('triggers onChange with half glass rating when clicking the left half of a beer glass', () => {
    const handleChange = vi.fn();
    render(<StarRating rating={0} maxStars={5} interactive onChange={handleChange} />);

    const buttons = screen.getAllByRole('button');
    const targetGlass = buttons[2]; // glassIndex 2 -> 2.5 or 3.0 glasses

    vi.spyOn(targetGlass, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 0,
      right: 30,
      bottom: 20,
      width: 20,
      height: 20,
      x: 10,
      y: 0,
      toJSON: () => {},
    });

    // Click at clientX = 14 (x = 4, < width / 2 of 10 -> half glass)
    fireEvent.click(targetGlass, { clientX: 14 });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(2.5);
  });

  it('updates display rating on mouseMove and resets on mouseLeave', () => {
    render(<StarRating rating={2.0} maxStars={5} interactive showValueText />);

    expect(screen.getByText('2.0 / 5')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    const targetGlass = buttons[3]; // glassIndex 3 -> 3.5 or 4.0 glasses

    vi.spyOn(targetGlass, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 20,
      bottom: 20,
      width: 20,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Hover over left half (x = 5 < 10 -> 3.5)
    fireEvent.mouseMove(targetGlass, { clientX: 5 });
    expect(screen.getByText('3.5 / 5')).toBeInTheDocument();

    // Hover over right half (x = 15 >= 10 -> 4.0)
    fireEvent.mouseMove(targetGlass, { clientX: 15 });
    expect(screen.getByText('4.0 / 5')).toBeInTheDocument();

    // Mouse leaves star container -> resets to original rating
    const starsContainer = screen.getByText('4.0 / 5').parentElement?.querySelector('.star-rating-stars');
    expect(starsContainer).toBeInTheDocument();
    fireEvent.mouseLeave(starsContainer!);

    expect(screen.getByText('2.0 / 5')).toBeInTheDocument();
  });
});

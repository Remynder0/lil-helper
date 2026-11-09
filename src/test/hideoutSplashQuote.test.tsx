import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HideoutSplashQuote } from '../components/HideoutSplashQuote';

describe('HideoutSplashQuote component (Official Deadlock Valve Oracle Splash Text)', () => {
  it('renders the hideout quote with an exclamation mark when missing', () => {
    render(<HideoutSplashQuote quote="Hating Mildred In The Hideout" visible={true} />);

    const element = screen.getByTestId('hideout-splash-quote');
    expect(element).toBeDefined();
    expect(screen.getByText('Hating Mildred In The Hideout!')).toBeDefined();
  });

  it('preserves existing punctuation without appending duplicate exclamation marks', () => {
    render(<HideoutSplashQuote quote="Chilling In The Hideout!" visible={true} />);
    expect(screen.getByText('Chilling In The Hideout!')).toBeDefined();

    render(<HideoutSplashQuote quote="Where is Lash?" visible={true} />);
    expect(screen.getByText('Where is Lash?')).toBeDefined();
  });

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <HideoutSplashQuote quote="Investigating The Hideout" visible={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when quote is empty', () => {
    const { container } = render(<HideoutSplashQuote quote="" visible={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('uses exclusively the official Valve Oracle typeface', () => {
    render(<HideoutSplashQuote quote="Exploring The Hideout" visible={true} />);

    const spanText = screen.getByText('Exploring The Hideout!');
    expect(spanText.className).toContain('font-deadlock-oracle');
  });

  it('applies occult animation class and custom classes behind interface (z-[5])', () => {
    render(
      <HideoutSplashQuote
        quote="Playing With Ava In The Hideout"
        visible={true}
        className="custom-test-class"
      />
    );

    const root = screen.getByTestId('hideout-splash-quote');
    expect(root.className).toContain('custom-test-class');
    expect(root.className).toContain('z-[5]');
    expect(root.className).toContain('pointer-events-none');

    const animatedInner = root.querySelector('.animate-occult-splash');
    expect(animatedInner).not.toBeNull();
  });
});

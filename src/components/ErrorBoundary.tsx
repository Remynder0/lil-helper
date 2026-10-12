import React, { Component, ErrorInfo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Label shown in the default fallback UI (e.g. "History", "Analytics") */
  section?: string;
  /** Optional callback invoked when an error is caught */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// ─── ErrorBoundary ────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.section ? ` — ${this.props.section}` : ''}]`, error, info);
    this.props.onError?.(error, info);
  }

  reset(): void {
    this.setState({ error: null });
  }

  render(): React.ReactNode {
    const { error } = this.state;
    const { children, fallback, section } = this.props;

    if (!error) return children;

    if (fallback) return fallback(error, this.reset);

    // ── Default fallback UI ──────────────────────────────────────────────────
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 rounded-sm border border-deadlock-ritual/50 bg-deadlock-panel/80 px-8 py-10 text-center"
      >
        {/* Sigil / icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-deadlock-ritual/60 bg-deadlock-dark/60">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6 text-deadlock-ritual"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        {/* Heading */}
        <div>
          <p className="text-sm font-medium text-deadlock-steam">
            {section ? `${section} — ` : ''}Unexpected Error
          </p>
          <p className="mt-1 text-xs text-deadlock-muted line-clamp-2 max-w-xs">
            {error.message || 'Something went wrong rendering this section.'}
          </p>
        </div>

        {/* Reset button */}
        <button
          type="button"
          onClick={this.reset}
          className="rounded-sm border border-deadlock-border bg-deadlock-dark px-4 py-1.5 text-xs text-deadlock-accent hover:border-deadlock-accent/60 hover:text-deadlock-steam transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;

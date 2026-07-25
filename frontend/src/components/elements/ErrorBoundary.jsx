/*
 * JewelloSoft Community Edition
 * Copyright (c) 2026 Sudeepta Bhakat
 * Licensed under the JewelloSoft Community License.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', padding: '2rem', textAlign: 'center',
      }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2.75rem', color: 'var(--color-danger, #dc2626)', marginBottom: 16 }} />
        <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary, #1a1a1a)' }}>Something went wrong on this page</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--text-muted, #64748b)', maxWidth: 480 }}>
          The rest of the app is still running. You can retry this page or switch to another section from the menu.
        </p>
        {this.state.error?.message && (
          <pre style={{
            maxWidth: 560, overflow: 'auto', textAlign: 'left', fontSize: 12,
            background: 'var(--bg-tertiary, #f1f5f9)', border: '1px solid var(--border-primary, #e2e8f0)',
            borderRadius: 6, padding: '10px 14px', color: 'var(--text-secondary, #475569)', marginBottom: 20,
          }}>
            {String(this.state.error.message)}
          </pre>
        )}
        <button className="btn btn--primary" onClick={this.handleReset}>
          <i className="fa-solid fa-rotate-right" style={{ marginRight: 8 }} />
          Try Again
        </button>
      </div>
    );
  }
}

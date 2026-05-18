import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💥 ErrorBoundary capturó:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#050505',
          color: '#FFFFFF',
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              letterSpacing: '0.5em',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            MIDNIGHT
          </h1>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 9,
              letterSpacing: '0.6em',
              color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
            }}
          >
            Worldwide
          </p>
        </div>

        <p
          style={{
            maxWidth: 360,
            fontSize: 14,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.7)',
            margin: '0 0 28px',
          }}
        >
          Algo no se cargó como esperábamos. Tu información está segura — solo
          necesitamos volver a empezar.
        </p>

        <button
          onClick={this.handleReload}
          style={{
            background: '#FFFFFF',
            color: '#050505',
            border: 'none',
            padding: '14px 28px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;

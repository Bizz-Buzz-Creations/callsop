import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo);
    // Optional: Log error to monitoring service
  }

  componentDidUpdate() {
    if (this.state.hasError) {
      window.location.href = "/fallback.html";
    }
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default AppErrorBoundary;

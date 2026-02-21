import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // ✅ Explicit constructor — avoids implicit state inference issues
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  // ✅ Static lifecycle — called when any child throws during render
  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  // ✅ Called after render — good place to log errors to a service
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <p>Something went wrong. Please refresh.</p>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

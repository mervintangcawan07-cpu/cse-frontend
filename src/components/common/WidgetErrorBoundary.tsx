// Relative Path: src/components/common/WidgetErrorBoundary.tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WidgetErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-3 my-2 backdrop-blur-sm">
          <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-lg">
            ⚠️
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
              {this.props.fallbackTitle || "This widget is temporarily unavailable"}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              {this.props.fallbackMessage ||
                "A minor issue occurred while displaying this section. The rest of your dashboard is running normally."}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-300 font-extrabold text-xs rounded-xl border border-amber-500/40 transition cursor-pointer"
          >
            🔄 Try Reloading Widget
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

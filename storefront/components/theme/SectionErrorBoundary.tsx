"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  sectionType: string;
  scopeName?: string;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error(`SectionError (${this.props.sectionType}):`, error, errorInfo);
    }
  }

  public render() {
    const label = this.props.scopeName ?? this.props.sectionType;

    if (this.state.hasError) {
      if (process.env.NODE_ENV === "development") {
        return (
          <div className={this.props.compact ? "p-3 border border-red-300 rounded-lg bg-red-50/80" : "p-4 m-4 border-2 border-red-500 rounded-xl bg-red-50 relative shadow-sm"}>
            <h3 className="font-bold text-red-700 flex items-center gap-2">
              <AlertCircle size={20} />
              Error rendering: {label}
            </h3>
            <p className="text-red-900 mt-2 text-sm max-h-40 overflow-auto">
              {this.state.error?.message}
            </p>
          </div>
        );
      }
      return null; // Production: Hide the broken section smoothly
    }

    return this.props.children;
  }
}
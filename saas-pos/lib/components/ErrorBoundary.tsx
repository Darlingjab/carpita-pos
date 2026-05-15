"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Texto descriptivo de la sección, para el mensaje de error */
  section?: string;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

/**
 * Captura errores de renderizado en el subárbol y muestra un fallback amigable.
 * Permite al usuario recargar la página sin perder el resto del estado de sesión.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "Error desconocido" };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary]", this.props.section ?? "unknown", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-black text-red-900">
          Algo salió mal en {this.props.section ?? "esta sección"}
        </h2>
        <p className="mt-2 text-sm text-red-800">{this.state.errorMessage}</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          onClick={() => window.location.reload()}
        >
          Recargar página
        </button>
      </div>
    );
  }
}

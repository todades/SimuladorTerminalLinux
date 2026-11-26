// ============================================================
// 🛡️ ERROR BOUNDARY — Evita la pantalla en negro
// Captura errores de render y ofrece recuperación
// ============================================================

import { Component, ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null; info: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UPTA Lab] Error de render:', error, info);
    this.setState({ info: info.componentStack?.slice(0, 600) ?? '' });
  }

  private reset = () => this.setState({ error: null, info: '' });

  private hardReset = () => {
    // Limpia solo el estado volátil, conserva usuarios registrados
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('upta_progress') || k.startsWith('upta_impersonate'))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#13161f] border-2 border-[#f87171]/40 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🐧💥</div>
          <h1 className="text-lg font-bold text-white font-ui mb-2">
            Algo falló en el laboratorio
          </h1>
          <p className="text-sm text-[#94a3b8] font-body mb-4">
            Se produjo un error inesperado al dibujar esta vista. Tus datos de
            usuario están a salvo.
          </p>

          <pre className="bg-[#0e111a] border border-[#1f2430] rounded-xl p-3 text-[10px] font-terminal text-[#f87171] text-left overflow-auto max-h-36 mb-4">
            {this.state.error.message}
            {this.state.info && `\n${this.state.info}`}
          </pre>

          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 py-2.5 rounded-xl bg-[#0e111a] border border-[#1f2430] text-[#94a3b8] hover:text-white text-sm font-semibold font-ui smooth-transition"
            >
              Reintentar
            </button>
            <button
              onClick={this.hardReset}
              className="flex-[2] py-2.5 rounded-xl btn-mission text-white text-sm font-bold font-ui smooth-transition"
            >
              🔄 Reiniciar sesión del laboratorio
            </button>
          </div>
        </div>
      </div>
    );
  }
}

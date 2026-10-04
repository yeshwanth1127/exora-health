import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

interface ActionProps {
  onGoHome?: () => void;
}

export function PageLoading({ label = 'Loading this page' }: { label?: string }) {
  return <section role="status" aria-live="polite" className="mx-auto min-h-[60vh] max-w-7xl px-5 py-16 sm:px-10 lg:px-16">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="max-w-3xl motion-safe:animate-pulse">
      <div className="mb-8 h-3 w-28 rounded-full bg-[#d8e6d7]" />
      <div className="mb-4 h-12 w-full max-w-xl rounded-xl bg-[#dce9da]" />
      <div className="mb-8 h-12 w-3/4 rounded-xl bg-[#e7efe4]" />
      <div className="mb-3 h-4 w-full max-w-2xl rounded-full bg-[#e0eadd]" />
      <div className="mb-12 h-4 w-2/3 rounded-full bg-[#e0eadd]" />
      <div className="grid gap-5 sm:grid-cols-3">
        {[0, 1, 2].map(item => <div key={item} className="h-48 rounded-2xl bg-[#e7efe4]" />)}
      </div>
    </div>
  </section>;
}

export function PageNotFound({ onGoHome, title = 'We couldn’t find that page', description = 'The link may be outdated, or the address may have a typo.' }: ActionProps & { title?: string; description?: string }) {
  return <section className="mx-auto flex min-h-[60vh] max-w-7xl flex-col justify-center px-5 py-20 sm:px-10 lg:px-16">
    <p className="mb-5 text-xs font-bold tracking-[.2em] text-[#5f8067]">404 · PAGE NOT FOUND</p>
    <h1 className="max-w-2xl text-4xl font-medium leading-tight tracking-[-.045em] text-[#17372b] sm:text-6xl">{title}</h1>
    <p className="mt-6 max-w-lg text-base leading-relaxed text-[#5c7061]">{description}</p>
    {onGoHome && <button type="button" onClick={onGoHome} className="mt-9 inline-flex w-fit items-center gap-2 rounded-full bg-[#24553c] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#173f2d]"><ArrowLeft size={17} /> Back to home</button>}
  </section>;
}

export function PageFailure({ onGoHome, onRetry, title = 'This page couldn’t load', description = 'Please try again. If the problem continues, you can return to the homepage.' }: ActionProps & { onRetry?: () => void; title?: string; description?: string }) {
  return <section role="alert" className="mx-auto flex min-h-[60vh] max-w-7xl flex-col justify-center px-5 py-20 sm:px-10 lg:px-16">
    <p className="mb-5 text-xs font-bold tracking-[.2em] text-[#886c42]">SOMETHING WENT WRONG</p>
    <h1 className="max-w-2xl text-4xl font-medium leading-tight tracking-[-.045em] text-[#17372b] sm:text-6xl">{title}</h1>
    <p className="mt-6 max-w-lg text-base leading-relaxed text-[#5c7061]">{description}</p>
    <div className="mt-9 flex flex-wrap gap-3">
      {onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-[#24553c] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#173f2d]"><RefreshCw size={17} /> Try again</button>}
      {onGoHome && <button type="button" onClick={onGoHome} className="inline-flex items-center gap-2 rounded-full border border-[#9fb5a2] px-6 py-3.5 text-sm font-semibold text-[#24553c] hover:bg-[#e8f0e5]">Back to home <ArrowRight size={17} /></button>}
    </div>
  </section>;
}

interface BoundaryProps extends ActionProps {
  children: ReactNode;
  onRetry?: () => void;
  fallbackTitle?: string;
  fallbackDescription?: string;
}
interface BoundaryState {
  failed: boolean;
  error?: Error;
}

export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { failed: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page rendering failed', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ failed: false, error: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.failed) {
      return (
        <PageFailure
          onGoHome={this.props.onGoHome}
          onRetry={this.handleRetry}
          title={this.props.fallbackTitle}
          description={this.props.fallbackDescription}
        />
      );
    }
    return this.props.children;
  }
}

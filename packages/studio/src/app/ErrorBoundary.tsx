import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button.js";
import { Icon } from "./Icon.js";

/** Props for {@link ErrorBoundary}. */
export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /**
   * The recovery action behind the notice's button. Defaults to a full page
   * reload; injectable so a test can observe it without navigating.
   */
  readonly reload?: () => void;
}

/** The boundary's only state: the caught value, or `undefined` while the tree renders normally. */
export interface ErrorBoundaryState {
  readonly message: string | undefined;
}

/**
 * Reduce a caught value to one line of display copy. React hands the boundary
 * whatever was thrown, which is not guaranteed to be an `Error`, so a plain
 * string throw or a thrown object still has to read as something.
 */
function describeError(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  if (typeof error === "string" && error !== "") {
    return error;
  }
  return "An unknown error was thrown during render.";
}

/**
 * The top-level render guard for the dashboard. React unmounts the whole tree
 * when a render throws and nothing catches it, which leaves a blank page with
 * no explanation and no way out. This catches that throw and renders a
 * terminal notice instead, in the tone of the session-expired screen: a
 * `role="alert"` full-screen block naming the failure, with a reload as the
 * recovery path.
 *
 * It catches render, lifecycle, and constructor throws from the subtree below
 * it. Event handlers, async callbacks, and work scheduled out of an effect all
 * throw outside React's render pass and never reach here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { message: undefined };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: describeError(error) };
  }

  /**
   * The console is the only report destination: Studio is a local tool served
   * over loopback and nothing here is sent anywhere. The component stack is
   * what actually names the faulting component, so it is logged alongside.
   */
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Verbatra Studio: a render error was caught by the error boundary.", error, info);
  }

  private readonly handleReload = (): void => {
    const { reload } = this.props;
    if (reload !== undefined) {
      reload();
      return;
    }
    window.location.reload();
  };

  override render(): ReactNode {
    const { message } = this.state;
    if (message === undefined) {
      return this.props.children;
    }
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center" role="alert">
        <div className="max-w-md">
          <Icon name="alert" size={20} className="mx-auto mb-3 text-danger" />
          <h1 className="mb-3 text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="mb-4 text-muted-foreground">
            The dashboard stopped rendering. Reloading usually clears it. If it comes back, the
            browser console has the full details.
          </p>
          <p className="mb-4 rounded-md border-s-[3px] border-danger bg-danger-soft px-4 py-3 text-start font-mono text-xs text-danger">
            {message}
          </p>
          <Button variant="primary" size="md" onClick={this.handleReload}>
            Reload the dashboard
          </Button>
        </div>
      </div>
    );
  }
}

/** A controller whose async `stop()` a {@link stoppableSession} waits on before resolving `done`. */
export interface StoppableController {
  stop(): Promise<void>;
}

/** A long-running session with a stop-request/second-force protocol. Matches WatchSession/StudioSession. */
export interface StoppableSession {
  /** Resolves with the process exit code once stopped (or once startup failed). */
  readonly done: Promise<number>;
  /** First call begins stopping; a second call while the first is still in flight forces `130`. */
  requestStop(): void;
}

export interface StoppableSessionOptions<C extends StoppableController> {
  /**
   * Resolves once the controller is ready to stop, or rejects if it never becomes ready (a startup
   * failure). May settle asynchronously (a controller not yet available) or already-settled (a
   * controller already in hand).
   */
  getController(): Promise<C>;
  /** Called once, the first time a stop is requested, before the controller may even be ready. */
  onStopRequested?: () => void;
  /**
   * Reports a failure, either the controller never became ready or its `stop()` rejected, and returns
   * the exit code the session resolves with.
   */
  onFailure(error: unknown): number;
}

/**
 * Shared stop/session state machine for a long-running command (`watch`, `studio`): the first
 * {@link StoppableSession.requestStop} begins stopping, waiting for the controller if it is not ready
 * yet, and resolves `0` on a clean stop or `options.onFailure`'s exit code on a rejected stop or a
 * startup failure; a second `requestStop` while the first is still in flight forces exit `130`. A stop
 * requested after a startup failure is a no-op, since the session is already resolved by then.
 */
export function stoppableSession<C extends StoppableController>(
  options: StoppableSessionOptions<C>,
): StoppableSession {
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });

  let controller: C | undefined;
  let stopping = false;
  let startupFailed = false;

  const stopController = (c: C): void => {
    void c
      .stop()
      .then(() => resolveDone(0))
      .catch((error: unknown) => resolveDone(options.onFailure(error)));
  };

  options
    .getController()
    .then((c) => {
      controller = c;
      if (stopping) {
        stopController(c);
      }
    })
    .catch((error: unknown) => {
      startupFailed = true;
      resolveDone(options.onFailure(error));
    });

  const requestStop = (): void => {
    if (startupFailed) {
      return;
    }
    if (!stopping) {
      stopping = true;
      options.onStopRequested?.();
      if (controller !== undefined) {
        stopController(controller);
      }
      return;
    }
    resolveDone(130);
  };

  return { done, requestStop };
}

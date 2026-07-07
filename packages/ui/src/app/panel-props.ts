/** Every panel receives `refreshToken`; it changes once per live-refresh event and most panels ignore it. */
export interface PanelProps {
  readonly refreshToken: number;
}

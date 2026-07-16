/** The props every page panel receives. `refreshToken` changes once per live-refresh event. */
export interface PanelProps {
  readonly refreshToken: number;
}

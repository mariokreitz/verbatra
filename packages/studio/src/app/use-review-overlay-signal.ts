import { useEffect, useState } from "react";
import { reviewOverlayStore } from "./api.js";

export function useReviewOverlaySignal(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => reviewOverlayStore.subscribe(() => setTick((current) => current + 1)), []);

  return tick;
}

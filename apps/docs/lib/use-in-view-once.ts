"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

export function useInViewOnce<T extends Element>(
  threshold: number,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            break;
          }
        }
      },
      { threshold },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [threshold, inView]);

  return [ref, inView];
}

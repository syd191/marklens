import { useEffect, type DependencyList } from "react";

export function useDebouncedEffect(effect: () => void, delay: number, deps: DependencyList) {
  useEffect(() => {
    const handle = window.setTimeout(effect, delay);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

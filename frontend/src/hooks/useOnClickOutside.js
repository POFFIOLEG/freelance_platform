import { useEffect, useRef } from "react";

/**
 * Вызов onOutside при mousedown вне любого из переданных ref-контейнеров.
 * Ref-объекты стабильны; колбэк всегда берётся из ref, чтобы не пересоздавать подписку.
 */
export function useOnClickOutside(onOutside, ...refs) {
  const cbRef = useRef(onOutside);
  cbRef.current = onOutside;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const handler = (event) => {
      const nodes = refsRef.current.map((r) => r?.current).filter(Boolean);
      if (nodes.length === 0) return;
      if (nodes.some((node) => node.contains(event.target))) return;
      cbRef.current();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
}

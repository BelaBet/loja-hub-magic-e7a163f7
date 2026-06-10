import { useEffect, useRef, useCallback } from "react";

interface Options {
  onScan: (code: string) => void;
  debounceMs?: number;
  minLength?: number;
  enabled?: boolean;
}

/**
 * Captura leituras de scanner USB/Bluetooth (modo teclado HID).
 * Funciona com qualquer leitor que emita Enter ao final.
 */
export function useBarcodeScanner({
  onScan,
  debounceMs = 80,
  minLength = 4,
  enabled = true,
}: Options) {
  const bufferRef = useRef<string>("");
  const lastKeyRef = useRef<number>(0);

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = "";
    if (code.length >= minLength) onScan(code);
  }, [onScan, minLength]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const now = Date.now();
      if (e.key === "Enter") {
        flush();
        return;
      }
      if (e.key.length === 1) {
        if (now - lastKeyRef.current > debounceMs && bufferRef.current.length > 0) {
          bufferRef.current = "";
        }
        bufferRef.current += e.key;
        lastKeyRef.current = now;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, debounceMs, flush]);
}
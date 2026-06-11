import { useEffect, useRef, useState, useCallback } from "react";

interface WSStats {
  cpu: number;
  memory: number;
  disk: number;
  network: { rxBytes: number; txBytes: number };
  uptime: string;
  ts: number;
}

export function useWebSocket() {
  const [stats, setStats] = useState<WSStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const [networkHistory, setNetworkHistory] = useState<{ rx: number[]; tx: number[] }>({ rx: [], tx: [] });

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const maxRetry = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/v1/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryRef.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "stats" && msg.data) {
          const d = msg.data as WSStats;
          setStats(d);
          setCpuHistory((prev) => [...prev.slice(-59), d.cpu]);
          setMemoryHistory((prev) => [...prev.slice(-59), d.memory]);
          if (d.network) {
            setNetworkHistory((prev) => ({
              rx: [...prev.rx.slice(-59), d.network.rxBytes ?? 0],
              tx: [...prev.tx.slice(-59), d.network.txBytes ?? 0],
            }));
          }
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
      if (retryRef.current < maxRetry) {
        const delay = Math.min(1000 * Math.pow(2, retryRef.current), 16000);
        retryRef.current++;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { stats, connected, cpuHistory, memoryHistory, networkHistory };
}

import { useEffect, useRef } from "react";
import type { TaskInfo } from "@/features/storage/api";
import { useTaskLogsQuery } from "@/features/storage/api";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface TaskProgressProps {
  task: TaskInfo | null;
  loading: boolean;
  error: string | null;
  onCancel?: () => void;
}

export function TaskProgress({ task, loading, error, onCancel }: TaskProgressProps) {
  const termRef = useRef<HTMLDivElement>(null);

  const isRunning = task?.status === "pending" || task?.status === "running";

  // Use TanStack Query for log polling -- automatically stops when task is terminal
  const logsQuery = useTaskLogsQuery(task?.id ?? null, task?.status);
  const logs = logsQuery.data?.data ?? [];

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [logs]);

  if (!task && !loading && !error) return null;

  const status = task?.status ?? "pending";
  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isCancelled = status === "cancelled";

  return (
    <div className="space-y-3">
      {/* Status header */}
      <div className="flex items-center gap-2">
        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
        {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        {(isFailed || error) && <XCircle className="h-4 w-4 text-red-400" />}
        {isCancelled && <AlertCircle className="h-4 w-4 text-amber-400" />}
        <span className="text-sm font-medium text-foreground">
          {isRunning && "Running..."}
          {isCompleted && "Completed"}
          {isFailed && "Failed"}
          {isCancelled && "Cancelled"}
          {loading && !task && "Starting..."}
        </span>
      </div>

      {/* Terminal-style log output */}
      {logs.length > 0 && (
        <div
          ref={termRef}
          className="max-h-64 overflow-y-auto rounded-lg border border-border p-3 font-mono text-xs leading-5"
          style={{ backgroundColor: "#0a0a0a", color: "#22c55e" }}
        >
          {logs.map((entry) => (
            <div
              key={entry.id}
              style={{
                color: entry.stream === "stderr" ? "#ef4444" : entry.stream === "system" ? "#60a5fa" : "#22c55e",
              }}
            >
              {entry.content}
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {(error || (isFailed && task?.error_msg)) && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <p className="text-xs text-red-400">{error || task?.error_msg}</p>
        </div>
      )}

      {/* Cancel button */}
      {isRunning && onCancel && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs">
            Cancel Task
          </Button>
        </div>
      )}
    </div>
  );
}

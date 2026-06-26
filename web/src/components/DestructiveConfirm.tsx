import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskProgress } from "@/components/TaskProgress";
import { useTaskQuery, cancelTask } from "@/features/storage/api";
import { AlertTriangle } from "lucide-react";

interface DestructiveConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title: string;
  description: string;
  deviceName: string;
  confirmVerb?: string;
  loading?: boolean;
  taskId?: number | null;
}

/**
 * A safety dialog for destructive disk operations.
 * Requires the user to type the device name and enter their password.
 * After submission, shows TaskProgress while the task runs.
 */
export function DestructiveConfirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  deviceName,
  confirmVerb = "Proceed",
  loading = false,
  taskId = null,
}: DestructiveConfirmProps) {
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const queryClient = useQueryClient();

  const taskQuery = useTaskQuery(taskId);
  const task = taskQuery.data?.data ?? null;
  const polling = taskQuery.isLoading && taskId != null;
  const taskError = taskQuery.error instanceof Error ? taskQuery.error.message : null;

  const cancel = () => {
    if (taskId != null) {
      cancelTask(taskId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      }).catch(() => {});
    }
  };

  const nameMatches = typedName === deviceName;
  const canSubmit = nameMatches && password.length > 0 && !loading;
  const showProgress = taskId != null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onConfirm(password);
    }
  };

  const handleClose = () => {
    if (!loading && !polling) {
      setTypedName("");
      setPassword("");
      onClose();
    }
  };

  const isTerminal = task?.status === "completed" || task?.status === "failed" || task?.status === "cancelled";

  return (
    <Modal open={open} onClose={handleClose} title={title} size="sm">
      {showProgress ? (
        <div className="space-y-4">
          <TaskProgress task={task} loading={polling} error={taskError} onCancel={cancel} />
          {isTerminal && (
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Red warning banner */}
          <div className="flex gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-400">
                Destructive Operation
              </p>
              <p className="text-xs text-red-400/80">{description}</p>
            </div>
          </div>

          {/* Device name confirmation */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Type <span className="font-mono text-foreground">{deviceName}</span> to confirm
            </label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={deviceName}
              className="font-mono text-sm"
              autoFocus
              disabled={loading}
            />
            {typedName.length > 0 && !nameMatches && (
              <p className="text-[11px] text-red-400">Device name does not match</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Password confirmation
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="text-sm"
              disabled={loading}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canSubmit}
            >
              {loading ? "Processing..." : confirmVerb}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

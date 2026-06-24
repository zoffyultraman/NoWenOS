import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { getFileInfo, changePermissions, changeOwner, type FileDetails } from "./api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/toast";

interface PermissionsDialogProps {
  path: string;
  onClose: () => void;
}

const BIT_PERMS = [
  { name: "read", bit: 2 },
  { name: "write", bit: 1 },
  { name: "execute", bit: 0 },
] as const;

function modeToBits(octal: string): boolean[] {
  const num = parseInt(octal, 8);
  const bits: boolean[] = [];
  for (let i = 8; i >= 0; i--) {
    bits.push((num & (1 << i)) !== 0);
  }
  return bits;
}

function bitsToOctal(bits: boolean[]): string {
  let num = 0;
  for (let i = 0; i < 9; i++) {
    if (bits[i]) {
      num |= 1 << (8 - i);
    }
  }
  return num.toString(8).padStart(3, "0");
}

export default function PermissionsDialog({ path, onClose }: PermissionsDialogProps) {
  const t = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [modeInput, setModeInput] = useState("755");
  const [permissionBits, setPermissionBits] = useState<boolean[]>(Array(9).fill(false));
  const [inputMode, setInputMode] = useState<"checkbox" | "numeric">("checkbox");
  const [recursive, setRecursive] = useState(false);
  const [ownerInput, setOwnerInput] = useState("");
  const [groupInput, setGroupInput] = useState("");

  const detailsQuery = useQuery({
    queryKey: ["fileDetails", path],
    queryFn: () => getFileInfo(path),
    enabled: !!path,
  });

  const details: FileDetails | undefined = detailsQuery.data?.data;

  // Sync from fetched details
  useEffect(() => {
    if (details) {
      setModeInput(details.modeOctal);
      setPermissionBits(modeToBits(details.modeOctal));
      setOwnerInput(details.owner);
      setGroupInput(details.group);
    }
  }, [details]);

  const handleNumericChange = useCallback((value: string) => {
    // Only allow digits 0-7
    const clean = value.replace(/[^0-7]/g, "").slice(0, 3);
    setModeInput(clean);
    if (clean.length === 3) {
      setPermissionBits(modeToBits(clean));
    }
  }, []);

  const handleBitToggle = useCallback(
    (index: number) => {
      setPermissionBits((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        const octal = bitsToOctal(next);
        setModeInput(octal);
        return next;
      });
    },
    [],
  );

  const chmodMutation = useMutation({
    mutationFn: () => changePermissions(path, modeInput, recursive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fileDetails", path] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success(t("permissions.permChanged"));
    },
    onError: (err: Error) => toast.error(err.message || t("permissions.permFailed")),
  });

  const chownMutation = useMutation({
    mutationFn: () => changeOwner(path, ownerInput, groupInput, recursive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fileDetails", path] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast.success(t("permissions.ownerChanged"));
    },
    onError: (err: Error) => toast.error(err.message || t("permissions.ownerFailed")),
  });

  function handleApplyPermissions() {
    if (modeInput.length !== 3) {
      toast.error(t("permissions.invalidMode"));
      return;
    }
    chmodMutation.mutate();
  }

  function handleApplyOwner() {
    chownMutation.mutate();
  }

  if (detailsQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-card rounded-xl border border-border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-muted-foreground">{t("permissions.loading")}</p>
        </div>
      </div>
    );
  }

  if (detailsQuery.isError || !details) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="bg-card rounded-xl border border-border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-destructive">{t("permissions.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
            {t("permissions.close")}
          </Button>
        </div>
      </div>
    );
  }

  const groups = [
    { label: t("permissions.owner"), offset: 0 },
    { label: t("permissions.group"), offset: 3 },
    { label: t("permissions.others"), offset: 6 },
  ];

  const permLabels = [
    t("permissions.read"),
    t("permissions.write"),
    t("permissions.execute"),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{t("permissions.title")}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-xs" title={details.path}>
              {details.name}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* File Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{t("permissions.type")}:</span>{" "}
              <span className="font-medium">{details.isDir ? t("permissions.directory") : t("permissions.file")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("permissions.size")}:</span>{" "}
              <span className="font-medium">{formatSize(details.size)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("permissions.owner")}:</span>{" "}
              <span className="font-medium">{details.owner}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("permissions.group")}:</span>{" "}
              <span className="font-medium">{details.group}</span>
            </div>
          </div>

          {/* Current Permission Display */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <span className="font-mono text-lg tracking-widest font-semibold">{details.mode}</span>
            <span className="text-muted-foreground ml-3 text-sm">({details.modeOctal})</span>
          </div>

          {/* Mode Input Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("permissions.mode")}:</span>
            <button
              onClick={() => setInputMode("checkbox")}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                inputMode === "checkbox" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("permissions.checkboxMode")}
            </button>
            <button
              onClick={() => setInputMode("numeric")}
              className={`text-xs px-3 py-1 rounded-lg transition-colors ${
                inputMode === "numeric" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("permissions.numericMode")}
            </button>
          </div>

          {/* Checkbox Mode */}
          {inputMode === "checkbox" && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
                <span className="px-3 py-2" />
                {permLabels.map((lbl) => (
                  <span key={lbl} className="px-3 py-2 text-center">
                    {lbl}
                  </span>
                ))}
              </div>
              {groups.map((group) => (
                <div
                  key={group.label}
                  className="grid grid-cols-4 border-t border-border items-center"
                >
                  <span className="px-3 py-2.5 text-sm font-medium">{group.label}</span>
                  {BIT_PERMS.map((_perm, pi) => {
                    const bitIndex = group.offset + pi;
                    return (
                      <div key={pi} className="flex items-center justify-center py-2.5">
                        <button
                          onClick={() => handleBitToggle(bitIndex)}
                          className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                            permissionBits[bitIndex]
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-muted/30 hover:border-muted-foreground"
                          }`}
                        >
                          {permissionBits[bitIndex] && (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Numeric Mode */}
          {inputMode === "numeric" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{t("permissions.octal")}:</span>
              <input
                type="text"
                value={modeInput}
                onChange={(e) => handleNumericChange(e.target.value)}
                maxLength={3}
                className="w-20 h-9 rounded-md border border-border bg-muted/50 px-3 py-1 text-center font-mono text-lg shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-sm text-muted-foreground font-mono">
                {modeInput.length === 3 ? `(${parseInt(modeInput, 8).toString(2).padStart(9, "0")})` : ""}
              </span>
            </div>
          )}

          {/* Recursive Option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              onClick={() => setRecursive(!recursive)}
              className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                recursive
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border bg-muted/30 hover:border-muted-foreground"
              }`}
            >
              {recursive && (
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className="text-sm">{t("permissions.recursive")}</span>
          </label>

          {/* Apply Permissions */}
          <Button
            onClick={handleApplyPermissions}
            disabled={chmodMutation.isPending || modeInput.length !== 3}
            className="w-full rounded-xl"
          >
            {chmodMutation.isPending ? t("permissions.applying") : t("permissions.applyPermissions")}
          </Button>

          {/* Owner/Group Section */}
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-sm font-semibold">{t("permissions.changeOwner")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("permissions.owner")}</label>
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder={details.owner}
                  className="w-full h-9 rounded-md border border-border bg-muted/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("permissions.group")}</label>
                <input
                  type="text"
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  placeholder={details.group}
                  className="w-full h-9 rounded-md border border-border bg-muted/50 px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleApplyOwner}
              disabled={chownMutation.isPending}
              className="w-full rounded-xl"
            >
              {chownMutation.isPending ? t("permissions.applying") : t("permissions.applyOwner")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

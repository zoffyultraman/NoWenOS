import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { readFileContent, writeFileContent } from "@/features/files/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  X,
  Save,
  RotateCcw,
  FileCode,
  Clock,
  AlertCircle,
  CheckCircle2,
  Settings2,
} from "lucide-react";

interface FileEditorProps {
  path: string;
  name: string;
  onClose: () => void;
}

export function FileEditor({ path, name, onClose }: FileEditorProps) {
  const toast = useToast();
  const t = useTranslation();
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [wordWrap, setWordWrap] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);

  const fileQuery = useQuery({
    queryKey: ["file-content", path],
    queryFn: () => readFileContent(path),
  });

  const serverData = fileQuery.data?.data;

  // Initialize content when loaded
  useEffect(() => {
    if (serverData?.content !== undefined) {
      setContent(serverData.content);
      setOriginalContent(serverData.content);
      setIsDirty(false);
    }
  }, [serverData?.content]);

  // Track dirty state
  useEffect(() => {
    setIsDirty(content !== originalContent);
  }, [content, originalContent]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !saveMutation.isPending) {
          saveMutation.mutate();
        }
      }
      if (e.key === "Escape") {
        if (isDirty) {
          if (window.confirm(t("files.unsavedConfirm"))) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, content]);

  // Auto-save
  useEffect(() => {
    if (autoSave && isDirty && !saveMutation.isPending) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveMutation.mutate();
      }, 3000);
    }
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [autoSave, isDirty, content]);

  const saveMutation = useMutation({
    mutationFn: () => writeFileContent(path, content),
    onSuccess: (resp) => {
      setOriginalContent(content);
      setIsDirty(false);
      toast.success(t("files.savedSuccess"));
      if (resp?.data) {
        // Update modTime from server response
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || t("files.saveFailedEditor"));
    },
  });

  const handleRevert = useCallback(() => {
    if (window.confirm(t("files.revertConfirm"))) {
      setContent(originalContent);
      setIsDirty(false);
    }
  }, [originalContent]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
    },
    []
  );

  // Sync line number scroll with textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Handle Tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.substring(0, start) + "  " + content.substring(end);
        setContent(newContent);
        // Restore cursor position
        requestAnimationFrame(() => {
          textarea.selectionStart = start + 2;
          textarea.selectionEnd = start + 2;
        });
      }
    },
    [content]
  );

  const lines = content.split("\n");
  const lineCount = lines.length;
  const cursorLine = textareaRef.current
    ? content.substring(0, textareaRef.current.selectionStart).split("\n")
        .length
    : 1;

  const language = serverData?.language ?? "plaintext";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col border-border bg-background shadow-2xl">
        {/* Header */}
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileCode className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{name}</h3>
                {isDirty && (
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" title={t("files.unsavedChanges")} />
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">{path}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8 p-0"
              title={t("files.editorSettings")}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Settings Bar (collapsible) */}
        {showSettings && (
          <div className="flex items-center gap-4 border-b border-border px-4 py-2 bg-muted/30 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-muted-foreground">{t("files.autoSave")}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wordWrap}
                onChange={(e) => setWordWrap(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-muted-foreground">{t("files.wordWrap")}</span>
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{t("files.fontSize")}:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
              >
                {[10, 11, 12, 13, 14, 15, 16, 18].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Editor Body */}
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          {fileQuery.isLoading && (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              {t("files.loadingFile")}
            </div>
          )}

          {fileQuery.isError && (
            <div className="flex items-center justify-center p-12 text-destructive">
              <AlertCircle className="mr-2 h-4 w-4" />
              {t("files.loadFailedEditor")}
            </div>
          )}

          {serverData && !fileQuery.isLoading && !fileQuery.isError && (
            <div className="flex flex-1 overflow-hidden">
              {/* Line numbers */}
              <div
                ref={lineCountRef}
                className="shrink-0 select-none overflow-hidden border-r border-border bg-muted/30 py-2 text-right"
                style={{ width: Math.max(40, String(lineCount).length * 10 + 16) }}
              >
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className="px-2 text-muted-foreground/60"
                    style={{ fontSize: `${fontSize}px`, lineHeight: "1.5", height: `${fontSize * 1.5}px` }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="flex-1 resize-none bg-transparent p-2 outline-none"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: "1.5",
                  whiteSpace: wordWrap ? "pre-wrap" : "pre",
                  overflowWrap: wordWrap ? "break-word" : "normal",
                  tabSize: 2,
                }}
                value={content}
                onChange={handleContentChange}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                data-gramm="false"
              />
            </div>
          )}
        </CardContent>

        {/* Footer / Status Bar */}
        {serverData && !fileQuery.isLoading && !fileQuery.isError && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2 bg-muted/20">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{language}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>{lineCount} {t("files.lines")}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>{t("files.line")} {cursorLine}</span>
              {isDirty && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-3 w-3" />
                    {t("files.modifiedEditor")}
                  </span>
                </>
              )}
              {!isDirty && content === originalContent && content !== "" && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    {t("files.saved")}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRevert}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  {t("files.revert")}
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!isDirty || saveMutation.isPending}
                className="h-7 text-xs"
              >
                <Save className="mr-1 h-3 w-3" />
                {saveMutation.isPending ? t("common.saving") : t("common.save")}
                <kbd className="ml-1.5 rounded border border-border/50 bg-muted/50 px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                  Ctrl+S
                </kbd>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2 } from "lucide-react";
import { downloadFile, previewFile, type PreviewResult } from "@/features/files/api";

interface FilePreviewProps {
  path: string;
  name: string;
  onClose: () => void;
}

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("nowenos-session");
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.token ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export function FilePreview({ path, name, onClose }: FilePreviewProps) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fallback for types the preview API doesn't support (video, audio, etc.)
  const fileUrl = `/api/v1/files/download?path=${encodeURIComponent(path)}`;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const videoExtensions = new Set(["mp4", "webm", "ogg"]);
  const audioExtensions = new Set(["mp3", "wav", "ogg", "flac", "aac"]);

  useEffect(() => {
    // For video/audio, use the download endpoint directly (no preview API needed)
    if (videoExtensions.has(ext) || audioExtensions.has(ext)) {
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    previewFile(path)
      .then((res) => {
        setPreview(res.data);
      })
      .catch((err) => {
        setError(err?.message || "Failed to load preview");
      })
      .finally(() => setLoading(false));
  }, [path, ext]);

  let body: React.ReactNode;

  if (loading) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading preview...</p>
      </div>
    );
  } else if (error) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-destructive">
        <p className="text-sm">{error}</p>
        <Button size="sm" variant="outline" onClick={() => downloadFile(path)}>
          Download instead
        </Button>
      </div>
    );
  } else if (preview?.type === "image") {
    body = (
      <div className="flex items-center justify-center p-4">
        <img
          src={preview.content}
          alt={name}
          className="max-h-[70vh] max-w-full rounded-lg object-contain"
        />
      </div>
    );
  } else if (preview?.type === "pdf") {
    const pdfUrl = preview.url || fileUrl;
    const token = getToken();
    const src = token ? `${pdfUrl}&token=${encodeURIComponent(token)}` : pdfUrl;
    body = (
      <iframe
        src={src}
        className="h-[70vh] w-full rounded-lg border-0"
        title={name}
      />
    );
  } else if (preview?.type === "text") {
    body = (
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">
        {preview.content}
      </pre>
    );
  } else if (videoExtensions.has(ext)) {
    const token = getToken();
    const authHeaders: HeadersInit = {};
    if (token) authHeaders["Authorization"] = `Bearer ${token}`;
    body = (
      <div className="flex items-center justify-center p-4">
        <video
          src={fileUrl}
          controls
          className="max-h-[70vh] max-w-full rounded-lg"
          crossOrigin="use-credentials"
        />
      </div>
    );
  } else if (audioExtensions.has(ext)) {
    body = (
      <div className="flex items-center justify-center p-8">
        <audio src={fileUrl} controls crossOrigin="use-credentials" />
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-muted-foreground">
        <p className="text-sm">Preview not available for .{ext} files</p>
        <Button size="sm" onClick={() => downloadFile(path)}>
          Download
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold truncate">{name}</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadFile(path)}
              className="h-7 text-xs"
            >
              <Download className="mr-1 h-3 w-3" />
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto">{body}</div>
      </div>
    </div>
  );
}

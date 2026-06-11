import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { downloadFile } from "@/features/files/api";

interface FilePreviewProps {
  path: string;
  name: string;
  onClose: () => void;
}

const textExtensions = new Set([
  "txt", "md", "json", "yaml", "yml", "xml", "csv", "log", "sh", "py", "js", "ts", "tsx", "go", "html", "css", "env", "conf", "cfg", "ini", "toml",
]);
const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"]);
const videoExtensions = new Set(["mp4", "webm", "ogg"]);
const audioExtensions = new Set(["mp3", "wav", "ogg", "flac", "aac"]);
const pdfExtensions = new Set(["pdf"]);

function getExt(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
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
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ext = getExt(name);

  const fileUrl = `/api/v1/files/download?path=${encodeURIComponent(path)}`;
  const authHeaders: HeadersInit = {};
  const token = getToken();
  if (token) authHeaders["Authorization"] = `Bearer ${token}`;

  useEffect(() => {
    if (textExtensions.has(ext)) {
      setLoading(true);
      fetch(fileUrl, { headers: authHeaders })
        .then((r) => {
          if (!r.ok) throw new Error("Failed");
          return r.text();
        })
        .then((t) => setContent(t))
        .catch(() => setError("Failed to load file"))
        .finally(() => setLoading(false));
    }
  }, [path, ext]);

  let body: React.ReactNode;

  if (imageExtensions.has(ext)) {
    body = (
      <div className="flex items-center justify-center p-4">
        <img
          src={fileUrl}
          alt={name}
          className="max-h-[70vh] max-w-full rounded-lg object-contain"
          style={{ authHeaders } as React.ImgHTMLAttributes<HTMLImageElement>}
          crossOrigin="use-credentials"
        />
      </div>
    );
  } else if (ext === "pdf") {
    body = (
      <iframe src={fileUrl} className="h-[70vh] w-full rounded-lg border-0" title={name} />
    );
  } else if (videoExtensions.has(ext)) {
    body = (
      <div className="flex items-center justify-center p-4">
        <video src={fileUrl} controls className="max-h-[70vh] max-w-full rounded-lg" crossOrigin="use-credentials" />
      </div>
    );
  } else if (audioExtensions.has(ext)) {
    body = (
      <div className="flex items-center justify-center p-8">
        <audio src={fileUrl} controls crossOrigin="use-credentials" />
      </div>
    );
  } else if (textExtensions.has(ext)) {
    body = loading ? (
      <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>
    ) : error ? (
      <div className="flex items-center justify-center p-8 text-destructive">{error}</div>
    ) : (
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm">{content}</pre>
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold truncate">{name}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => downloadFile(path)} className="h-7 text-xs">Download</Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-auto">{body}</div>
      </div>
    </div>
  );
}

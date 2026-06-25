interface BreadcrumbNavProps {
  path: string;
  onNavigate: (p: string) => void;
}

export function BreadcrumbNav({ path, onNavigate }: BreadcrumbNavProps) {
  const parts = path.split("/").filter(Boolean);
  const segments: { label: string; path: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    segments.push({ label: parts[i], path: parts.slice(0, i + 1).join("/") });
  }
  return (
    <div className="flex items-center gap-1 text-sm overflow-x-auto">
      <button onClick={() => onNavigate(".")} className="text-muted-foreground hover:text-foreground shrink-0">~</button>
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1 shrink-0">
          <span className="text-muted-foreground">/</span>
          {i === segments.length - 1 ? (
            <span className="font-medium text-foreground">{seg.label}</span>
          ) : (
            <button onClick={() => onNavigate(seg.path)} className="text-muted-foreground hover:text-foreground">{seg.label}</button>
          )}
        </span>
      ))}
    </div>
  );
}

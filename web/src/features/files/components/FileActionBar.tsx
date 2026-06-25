import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Archive, Trash2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface SearchResult {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
}

interface FileActionBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (q: string) => void;
  searchResults: SearchResult[] | null;
  setSearchResults: (r: SearchResult[] | null) => void;
  onNavigate: (path: string) => void;
  onPreview: (file: { path: string; name: string }) => void;
  selectedPaths: Set<string>;
  onBatchCompress: () => void;
  onBatchDelete: () => void;
}

export function FileActionBar({
  searchQuery, setSearchQuery, onSearch,
  searchResults, setSearchResults,
  onNavigate, onPreview,
  selectedPaths, onBatchCompress, onBatchDelete,
}: FileActionBarProps) {
  const t = useTranslation();

  return (
    <>
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); onSearch(e.target.value); }}
            placeholder={t("files.searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-muted/50 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {selectedPaths.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedPaths.size} {t("files.selected")}</span>
            <Button variant="outline" size="sm" onClick={onBatchCompress} className="h-8 text-xs">
              <Archive className="mr-1 h-3 w-3" />{t("files.compress")}
            </Button>
            <Button variant="destructive" size="sm" onClick={onBatchDelete} className="h-8 text-xs">
              <Trash2 className="mr-1 h-3 w-3" />{t("files.batchDelete")}
            </Button>
          </div>
        )}
      </div>

      {searchResults && (
        <Card className="border-border mx-4 mt-2">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("files.searchResults")} ({searchResults.length})</p>
            {searchResults.length === 0 && <p className="text-xs text-muted-foreground">{t("files.noResults")}</p>}
            {searchResults.map((f) => (
              <button
                key={f.path}
                onClick={() => {
                  if (f.isDir) { onNavigate(f.path); setSearchResults(null); setSearchQuery(""); }
                  else { onPreview({ path: f.path, name: f.name }); }
                }}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 text-sm w-full text-left"
              >
                <span className="truncate">{f.path}</span>
              </button>
            ))}
            <button onClick={() => setSearchResults(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">{t("files.closeResults")}</button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

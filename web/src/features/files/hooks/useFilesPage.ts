import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import {
  browseFiles,
  uploadFile,
  deleteFile,
  createDirectory,
  renameFile,
  searchFiles,
  compressFiles,
  extractFile,
} from "@/features/files/api";
import { trashFile } from "@/features/recycle/api";
import { useToast } from "@/stores/toast";

interface SearchResult {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
}

export function useFilesPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [currentPath, setCurrentPath] = useState(".");
  const [showMkdir, setShowMkdir] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string } | null>(null);
  const [permissionsFile, setPermissionsFile] = useState<{ path: string; name: string } | null>(null);
  const [movingFile, setMovingFile] = useState<{ path: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; name: string } | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [fileInputEl, setFileInputEl] = useState<HTMLInputElement | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filesQuery = useQuery({
    queryKey: ["files", currentPath],
    queryFn: () => browseFiles(currentPath),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ path, file }: { path: string; file: globalThis.File }) => uploadFile(path, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      toast.success(t("files.uploadSuccess"));
    },
    onError: () => toast.error(t("files.uploadFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (path: string) => deleteFile(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      toast.success(t("files.deleteSuccess"));
    },
    onError: () => toast.error(t("files.deleteFailed")),
  });

  const mkdirMutation = useMutation({
    mutationFn: ({ parentPath, dirName }: { parentPath: string; dirName: string }) =>
      createDirectory(parentPath, dirName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      setNewDirName("");
      setShowMkdir(false);
      toast.success(t("files.folderCreated"));
    },
    onError: () => toast.error(t("files.folderFailed")),
  });

  const renameMutation = useMutation({
    mutationFn: ({ path, newName }: { path: string; newName: string }) => renameFile(path, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      setRenamingPath(null);
      setNewName("");
      toast.success(t("files.renameSuccess"));
    },
    onError: () => toast.error(t("files.renameFailed")),
  });

  const compressMutation = useMutation({
    mutationFn: ({ paths, dest }: { paths: string[]; dest: string }) => compressFiles(paths, dest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      setSelectedPaths(new Set());
      toast.success(t("files.compressSuccess"));
    },
    onError: () => toast.error(t("files.compressFailed")),
  });

  const extractMutation = useMutation({
    mutationFn: ({ path, dir }: { path: string; dir: string }) => extractFile(path, dir),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      toast.success(t("files.extractSuccess"));
    },
    onError: () => toast.error(t("files.extractFailed")),
  });

  const trashMutation = useMutation({
    mutationFn: (path: string) => trashFile(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentPath] });
      toast.success(t("files.trashSuccess"));
    },
    onError: () => toast.error(t("files.trashFailed")),
  });

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const result = filesQuery.data?.data;

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        uploadMutation.mutate({ path: currentPath, file: files[i] });
      }
    }
  }

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    try {
      const res = await searchFiles(currentPath, q);
      setSearchResults(res.data ?? []);
    } catch { setSearchResults([]); }
  }

  function toggleSelect(path: string) {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }

  function toggleSelectAll() {
    const entries = result?.entries ?? [];
    if (selectedPaths.size === entries.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(entries.map((e) => e.path)));
    }
  }

  function handleBatchDelete() {
    setBatchDeleteConfirm(true);
  }

  function confirmBatchDelete() {
    for (const p of selectedPaths) trashMutation.mutate(p);
    setSelectedPaths(new Set());
    setBatchDeleteConfirm(false);
  }

  function handleBatchCompress() {
    const dest = currentPath + "/archive-" + Date.now() + ".tar.gz";
    compressMutation.mutate({ paths: Array.from(selectedPaths), dest });
  }

  function handleNavigate(path: string) {
    setCurrentPath(path);
  }

  function handleGoUp() {
    if (result?.parent) {
      setCurrentPath(result.parent);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadMutation.mutate({ path: currentPath, file: f });
    e.target.value = "";
  }

  function handleDownload(filePath: string) {
    // downloadFile is a direct call, not a mutation
    import("@/features/files/api").then(({ downloadFile }) => downloadFile(filePath));
  }

  function handleDelete(filePath: string, name: string) {
    setDeleteConfirm({ path: filePath, name });
  }

  function confirmDelete() {
    if (deleteConfirm) {
      trashMutation.mutate(deleteConfirm.path);
      setDeleteConfirm(null);
    }
  }

  function handleMkdir() {
    if (!newDirName.trim()) return;
    mkdirMutation.mutate({ parentPath: currentPath, dirName: newDirName.trim() });
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  return {
    // State
    currentPath, setCurrentPath,
    showMkdir, setShowMkdir,
    newDirName, setNewDirName,
    renamingPath, setRenamingPath,
    newName, setNewName,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    selectedPaths, setSelectedPaths,
    isDragging,
    previewFile, setPreviewFile,
    permissionsFile, setPermissionsFile,
    movingFile, setMovingFile,
    deleteConfirm, setDeleteConfirm,
    batchDeleteConfirm, setBatchDeleteConfirm,
    fileInputEl, setFileInputEl,
    openMenu, setOpenMenu,
    result,
    // Mutations
    filesQuery, uploadMutation, deleteMutation, mkdirMutation,
    renameMutation, compressMutation, extractMutation, trashMutation,
    // Handlers
    handleDragOver, handleDragLeave, handleDrop,
    handleSearch, toggleSelect, toggleSelectAll,
    handleBatchDelete, confirmBatchDelete, handleBatchCompress,
    handleNavigate, handleGoUp, handleUpload, handleDownload,
    handleDelete, confirmDelete, handleMkdir, formatSize,
  };
}

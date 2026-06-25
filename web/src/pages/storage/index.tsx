import { useState } from "react";
import { DisksTab } from "@/features/storage/components/DisksTab";
import { RAIDTab } from "@/features/storage/components/RAIDTab";
import { LVMTab } from "@/features/storage/components/LVMTab";
import { ZFSTab } from "@/features/storage/components/ZFSTab";
import { useTranslation } from "@/hooks/useTranslation";
import { HardDrive, Layers, Box, Waves } from "lucide-react";

type Tab = "disks" | "raid" | "lvm" | "zfs";

export default function StoragePage() {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("disks");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "disks", label: t("storage.tabDisks"), icon: <HardDrive className="h-4 w-4" /> },
    { key: "raid", label: t("storage.tabRaid"), icon: <Layers className="h-4 w-4" /> },
    { key: "lvm", label: t("storage.tabLvm"), icon: <Box className="h-4 w-4" /> },
    { key: "zfs", label: t("storage.tabZfs"), icon: <Waves className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("storage.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("storage.subtitle")}</p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "disks" && <DisksTab />}
      {activeTab === "raid" && <RAIDTab />}
      {activeTab === "lvm" && <LVMTab />}
      {activeTab === "zfs" && <ZFSTab />}
    </div>
  );
}

import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, HardDrive, FolderOpen, Container, Users,
  Share2, ScrollText, Bell, Settings, MonitorDot, Link,
} from "lucide-react";

// Lazy import wrappers
import { DashboardApp, FilesApp, StorageApp, DockerApp, UsersApp,
  SharesApp, LogsApp, AlertsApp, SystemApp, SettingsApp, FileSharesApp } from "./apps";

export interface AppDefinition {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  component: ComponentType;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  dock: boolean;
  color: string;
}

export const appRegistry: AppDefinition[] = [
  {
    id: "dashboard",
    titleKey: "nav.dashboard",
    icon: LayoutDashboard,
    component: DashboardApp,
    defaultWidth: 1200,
    defaultHeight: 760,
    minWidth: 800,
    minHeight: 500,
    dock: true,
    color: "cyan",
  },
  {
    id: "files",
    titleKey: "nav.files",
    icon: FolderOpen,
    component: FilesApp,
    defaultWidth: 1100,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 450,
    dock: true,
    color: "cyan",
  },
  {
    id: "storage",
    titleKey: "nav.storage",
    icon: HardDrive,
    component: StorageApp,
    defaultWidth: 1100,
    defaultHeight: 720,
    minWidth: 700,
    minHeight: 450,
    dock: true,
    color: "orange",
  },
  {
    id: "docker",
    titleKey: "nav.docker",
    icon: Container,
    component: DockerApp,
    defaultWidth: 1200,
    defaultHeight: 760,
    minWidth: 800,
    minHeight: 500,
    dock: true,
    color: "purple",
  },
  {
    id: "shares",
    titleKey: "nav.shares",
    icon: Share2,
    component: SharesApp,
    defaultWidth: 1000,
    defaultHeight: 680,
    minWidth: 650,
    minHeight: 400,
    dock: true,
    color: "green",
  },
  {
    id: "fileshares",
    titleKey: "nav.fileshares",
    icon: Link,
    component: FileSharesApp,
    defaultWidth: 900,
    defaultHeight: 650,
    minWidth: 600,
    minHeight: 400,
    dock: false,
    color: "cyan",
  },
  {
    id: "users",
    titleKey: "nav.users",
    icon: Users,
    component: UsersApp,
    defaultWidth: 900,
    defaultHeight: 650,
    minWidth: 600,
    minHeight: 400,
    dock: true,
    color: "purple",
  },
  {
    id: "logs",
    titleKey: "nav.logs",
    icon: ScrollText,
    component: LogsApp,
    defaultWidth: 1100,
    defaultHeight: 700,
    minWidth: 700,
    minHeight: 450,
    dock: true,
    color: "green",
  },
  {
    id: "alerts",
    titleKey: "nav.alerts",
    icon: Bell,
    component: AlertsApp,
    defaultWidth: 1000,
    defaultHeight: 680,
    minWidth: 650,
    minHeight: 400,
    dock: true,
    color: "orange",
  },
  {
    id: "system",
    titleKey: "nav.system",
    icon: MonitorDot,
    component: SystemApp,
    defaultWidth: 1000,
    defaultHeight: 700,
    minWidth: 650,
    minHeight: 400,
    dock: false,
    color: "cyan",
  },
  {
    id: "settings",
    titleKey: "nav.settings",
    icon: Settings,
    component: SettingsApp,
    defaultWidth: 900,
    defaultHeight: 680,
    minWidth: 600,
    minHeight: 450,
    dock: false,
    color: "purple",
  },
];

export function getApp(id: string): AppDefinition | undefined {
  return appRegistry.find((a) => a.id === id);
}

export const dockApps = appRegistry.filter((a) => a.dock);
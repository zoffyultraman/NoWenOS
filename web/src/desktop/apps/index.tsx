import DashboardPage from "@/pages/dashboard";
import FilesPage from "@/pages/files";
import StoragePage from "@/pages/storage";
import DockerPage from "@/pages/docker";
import UsersPage from "@/pages/users";
import SharesPage from "@/pages/shares";
import LogsPage from "@/pages/logs";
import AlertsPage from "@/pages/alerts";
import SystemPage from "@/pages/system";
import SettingsPage from "@/pages/settings";

// Thin wrappers that re-use existing page components inside windows
export function DashboardApp() { return <DashboardPage />; }
export function FilesApp() { return <FilesPage />; }
export function StorageApp() { return <StoragePage />; }
export function DockerApp() { return <DockerPage />; }
export function UsersApp() { return <UsersPage />; }
export function SharesApp() { return <SharesPage />; }
export function LogsApp() { return <LogsPage />; }
export function AlertsApp() { return <AlertsPage />; }
export function SystemApp() { return <SystemPage />; }
export function SettingsApp() { return <SettingsPage />; }
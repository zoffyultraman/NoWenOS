import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTaskSchema, type CreateTaskFormData } from "@/features/cron/schemas";
import {
  fetchTasks, createTask, updateTask, deleteTask,
  toggleTask, runTask,
} from "@/features/cron/api";
import type { ScheduledTask } from "@/features/cron/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/stores/toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Clock, Plus, Trash2, X, ToggleLeft, ToggleRight,
  Pencil, Play, CheckCircle, XCircle, Loader2, HelpCircle,
} from "lucide-react";

const emptyForm: CreateTaskFormData = { name: "", command: "", schedule: "" };

export default function CronPage() {
  const t = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: emptyForm,
  });

  const tasksQuery = useQuery({ queryKey: ["cron-tasks"], queryFn: fetchTasks });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-tasks"] });
      setShowForm(false);
      reset(emptyForm);
      toast.success(t("cron.taskCreated"));
    },
    onError: (err: Error) => toast.error(err.message || t("cron.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateTaskFormData }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-tasks"] });
      setShowForm(false);
      setEditId(null);
      reset(emptyForm);
      toast.success(t("cron.taskUpdated"));
    },
    onError: (err: Error) => toast.error(err.message || t("cron.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-tasks"] });
      toast.success(t("cron.taskDeleted"));
    },
    onError: (err: Error) => toast.error(err.message || t("cron.deleteFailed")),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => toggleTask(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-tasks"] });
      toast.success(t("cron.taskToggled"));
    },
    onError: (err: Error) => toast.error(err.message || t("cron.toggleFailed")),
  });

  const runMutation = useMutation({
    mutationFn: runTask,
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ["cron-tasks"] });
      const status = resp.data?.lastStatus;
      if (status === "success") {
        toast.success(t("cron.runSuccess"));
      } else {
        toast.error(t("cron.runFailed"));
      }
    },
    onError: (err: Error) => toast.error(err.message || t("cron.runFailed")),
  });

  const tasks = tasksQuery.data?.data ?? [];

  function onSubmit(data: CreateTaskFormData) {
    if (editId !== null) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function handleEdit(task: ScheduledTask) {
    setEditId(task.id);
    reset({ name: task.name, command: task.command, schedule: task.schedule });
    setShowForm(true);
  }

  function handleDelete(id: number, name: string) {
    if (confirm(t("cron.deleteConfirm").replace("{name}", name))) {
      deleteMutation.mutate(id);
    }
  }

  function statusIcon(status: string) {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "success": return t("cron.statusSuccess");
      case "failed": return t("cron.statusFailed");
      case "running": return t("cron.statusRunning");
      default: return t("cron.statusNever");
    }
  }

  function formatTime(timeStr: string) {
    if (!timeStr) return "--";
    try {
      return new Date(timeStr).toLocaleString();
    } catch {
      return timeStr;
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("cron.title")}</h1>
          <p className="text-muted-foreground">{t("cron.subtitle")}</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); setEditId(null); reset(emptyForm); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("cron.addTask")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editId !== null ? t("cron.editTask") : t("cron.newTask")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("cron.taskName")}</Label>
                  <Input {...register("name")} placeholder={t("cron.namePlaceholder")} className="mt-1" />
                  {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>{t("cron.cronExpression")}</Label>
                  <Input {...register("schedule")} placeholder="*/5 * * * *" className="mt-1" />
                  {errors.schedule && <p className="mt-1 text-xs text-destructive">{errors.schedule.message}</p>}
                </div>
                <div>
                  <Label>{t("cron.command")}</Label>
                  <Input {...register("command")} placeholder="/usr/bin/backup.sh" className="mt-1" />
                  {errors.command && <p className="mt-1 text-xs text-destructive">{errors.command.message}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("cron.expressionHelp")}</p>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId !== null ? t("cron.updateTask") : t("cron.createTask")}
                </Button>
                <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditId(null); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tasksQuery.isLoading && <p className="text-sm text-muted-foreground">{t("cron.loading")}</p>}
      {tasks.length === 0 && !tasksQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{t("cron.noTasks")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("cron.firstTask")}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className="border-border bg-card transition-all duration-200 hover:border-border/80">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={"flex h-10 w-10 items-center justify-center rounded-xl transition-all " + (task.enabled ? "bg-amber-500/10 text-amber-400 shadow-sm shadow-amber-500/10" : "bg-muted text-muted-foreground")}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{task.name}</p>
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-amber-400 font-mono">
                        {task.schedule}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{task.command}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    {statusIcon(task.lastStatus)}
                    <span className="text-xs text-muted-foreground">{statusLabel(task.lastStatus)}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => runMutation.mutate(task.id)} disabled={runMutation.isPending} className="h-8 w-8 p-0" title={t("cron.runNow")}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate({ id: task.id, enabled: !task.enabled })} className="h-8 w-8 p-0" title={task.enabled ? t("common.disable") : t("common.enable")}>
                    {task.enabled ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(task)} className="h-8 w-8 p-0" title={t("common.edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id, task.name)} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t("common.delete")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-6 pl-14 text-xs text-muted-foreground">
                <span>{t("cron.lastRun")}: {formatTime(task.lastRun)}</span>
                <span>{t("cron.nextRun")}: {formatTime(task.nextRun)}</span>
                {task.output && (
                  <span className="truncate max-w-md" title={task.output}>
                    {t("cron.output")}: {task.output.slice(0, 80)}{task.output.length > 80 ? "..." : ""}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

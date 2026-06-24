import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-green-500/10 text-green-500 border-green-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  danger: "bg-red-500/10 text-red-500 border-red-500/20",
  info: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  muted: "bg-muted text-muted-foreground border-border",
};

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", variantStyles[variant], className)} {...props} />;
}

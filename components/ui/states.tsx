import * as React from "react";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  title = fr.empty.title,
  description = fr.empty.description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-10 text-center", className)}>
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = fr.error.title, description, action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-danger bg-surface p-10 text-center">
      <p className="text-base font-semibold text-danger">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

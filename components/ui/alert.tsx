import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert" role="alert" className={cn("rounded-lg border p-4 text-sm", className)} {...props} />;
}
export function AlertTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="alert-title" className={cn("mb-1 font-medium", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("text-sm leading-relaxed", className)} {...props} />;
}

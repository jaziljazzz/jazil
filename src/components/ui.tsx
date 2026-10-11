"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { STAGE_META } from "@/lib/constants";
import type { Stage } from "@/lib/types";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-600 disabled:bg-brand/40",
  secondary: "bg-surface text-ink border border-line hover:bg-bg disabled:text-muted",
  ghost: "text-ink hover:bg-black/5 disabled:text-muted",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/40",
  success: "bg-success text-white hover:bg-success/90 disabled:bg-success/40",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }>(
  function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed select-none",
          size === "sm" && "h-8 px-3 text-[13px]",
          size === "md" && "h-11 md:h-9 px-4 text-sm",
          size === "lg" && "h-12 px-5 text-[15px]",
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {loading && <span className="size-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
        {children}
      </button>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-11 md:h-9 w-full rounded-lg border border-line bg-surface px-3 outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15",
        className,
      )}
      {...rest}
    />
  );
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/15",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 md:h-9 w-full rounded-lg border border-line bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string | null; children: ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-[12px] text-muted">{hint}</span>}
      {error && <span className="block text-[12px] text-danger">{error}</span>}
    </label>
  );
}

export function Chip({ active, onClick, children, tone, className, count }: { active?: boolean; onClick?: () => void; children: ReactNode; tone?: "danger" | "warning" | "info" | "success"; className?: string; count?: number }) {
  const toneCls =
    tone === "danger" ? "border-danger/30 text-danger bg-danger-50" :
    tone === "warning" ? "border-warning/30 text-warning bg-warning-50" :
    tone === "success" ? "border-success/30 text-success bg-success-50" :
    tone === "info" ? "border-info/30 text-info bg-info-50" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 md:h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
        active ? "border-brand bg-brand text-white" : toneCls || "border-line bg-surface text-ink hover:bg-bg",
        className,
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular rounded-full px-1.5 text-[11px]", active ? "bg-white/20" : "bg-black/5")}>{count}</span>
      )}
    </button>
  );
}

export function StageChip({ stage, className }: { stage: Stage; className?: string }) {
  const m = STAGE_META[stage];
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap", className)}
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

export function Badge({ tone = "muted", children, className }: { tone?: "danger" | "warning" | "info" | "success" | "muted"; children: ReactNode; className?: string }) {
  const cls = {
    danger: "bg-danger-50 text-danger",
    warning: "bg-warning-50 text-warning",
    info: "bg-info-50 text-info",
    success: "bg-success-50 text-success",
    muted: "bg-black/5 text-muted",
  }[tone];
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap", cls, className)}>{children}</span>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[12px] border border-line bg-surface", className)}>{children}</div>;
}

export function StatCard({ label, value, sub, tone, href, onClick, active }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "warning" | "info" | "success"; href?: string; onClick?: () => void; active?: boolean }) {
  const toneCls =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "info" ? "text-info" : tone === "success" ? "text-success" : "text-ink";
  const ring =
    active && tone === "danger" ? "ring-2 ring-danger/40 border-danger/40" :
    active && tone === "warning" ? "ring-2 ring-warning/40 border-warning/40" :
    active && tone === "info" ? "ring-2 ring-info/40 border-info/40" : active ? "ring-2 ring-brand/30" : "";
  const inner = (
    <>
      <div className={cn("tabular text-[28px] font-semibold leading-none", toneCls)}>{value}</div>
      <div className="mt-1.5 text-[12px] text-muted">{label}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </>
  );
  const cls = cn("block rounded-[12px] border border-line bg-surface p-3.5 text-left transition-shadow hover:shadow-sm", ring);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, "w-full")}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

export function EmptyState({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand">{icon}</div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "?";
  return <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand", className)}>{initials}</span>;
}

/** Bottom sheet on phone, centred dialog on desktop. Primary button pinned at the bottom. */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-fade" onClick={onClose} />
      <div
        className={cn(
          "animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl md:rounded-2xl",
          wide ? "md:max-w-2xl" : "md:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3 md:px-5 md:pt-4">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full text-muted hover:bg-black/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-4 py-3 md:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[16px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger">{children}</p>;
}

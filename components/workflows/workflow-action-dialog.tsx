"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type WorkflowActionValues = Record<string, string | number | boolean>;

export type WorkflowActionResult<TData = unknown> =
  | { ok: true; data?: TData }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type WorkflowFieldBase<TValues extends WorkflowActionValues> = {
  name: Extract<keyof TValues, string>;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
};

export type WorkflowTextField<TValues extends WorkflowActionValues> = WorkflowFieldBase<TValues> & {
  type: "text" | "email";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
};

export type WorkflowTextareaField<TValues extends WorkflowActionValues> = WorkflowFieldBase<TValues> & {
  type: "textarea";
  placeholder?: string;
  rows?: number;
  minLength?: number;
  maxLength?: number;
};

export type WorkflowNumberField<TValues extends WorkflowActionValues> = WorkflowFieldBase<TValues> & {
  type: "number";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type WorkflowSelectField<TValues extends WorkflowActionValues> = WorkflowFieldBase<TValues> & {
  type: "select";
  placeholder?: string;
  options: Array<{ label: string; value: string }>;
};

export type WorkflowCheckboxField<TValues extends WorkflowActionValues> = WorkflowFieldBase<TValues> & {
  type: "checkbox";
};

export type WorkflowActionField<TValues extends WorkflowActionValues> =
  | WorkflowTextField<TValues>
  | WorkflowTextareaField<TValues>
  | WorkflowNumberField<TValues>
  | WorkflowSelectField<TValues>
  | WorkflowCheckboxField<TValues>;

export type WorkflowActionDialogProps<TValues extends WorkflowActionValues, TData = unknown> = {
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  trigger: {
    label: string;
    loadingLabel?: string;
    variant?: "primary" | "secondary" | "ghost";
    icon?: ReactNode;
  };
  confirmationButton: {
    label: string;
    loadingLabel: string;
    tone?: "primary" | "warning" | "danger";
  };
  cancelLabel?: string;
  fields: WorkflowActionField<TValues>[] | ((values: TValues) => WorkflowActionField<TValues>[]);
  initialValues: TValues;
  onValuesChange?: (values: TValues, changedField: Extract<keyof TValues, string>) => TValues;
  action: (values: TValues) => Promise<WorkflowActionResult<TData>>;
  validate?: (values: TValues) => Partial<Record<keyof TValues, string>>;
  successToast: {
    title: string;
    description?: string | ((data: TData | undefined) => string);
  };
  errorToast?: {
    title: string;
    fallbackDescription: string;
  };
  onSuccess?: (data: TData | undefined) => void | Promise<void>;
  canCloseWhileLoading?: boolean;
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

const toneClasses = {
  primary: "",
  warning: "bg-amber-600 text-white hover:bg-amber-700",
  danger: "bg-red-700 text-white hover:bg-red-800",
} as const;

const fieldClassName = "mt-2 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function WorkflowActionDialog<TValues extends WorkflowActionValues, TData = unknown>({
  title,
  description,
  size = "md",
  trigger,
  confirmationButton,
  cancelLabel = "Cancel",
  fields,
  initialValues,
  onValuesChange,
  action,
  validate,
  successToast,
  errorToast,
  onSuccess,
  canCloseWhileLoading = false,
}: WorkflowActionDialogProps<TValues, TData>) {
  const { pushToast } = useToast();
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<TValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (!isSubmitting || canCloseWhileLoading)) closeDialog();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function closeDialog() {
    if (isSubmitting && !canCloseWhileLoading) return;
    setOpen(false);
    setValues(initialValues);
    setFieldErrors({});
    setFormError(null);
    window.setTimeout(() => triggerRef.current?.querySelector("button")?.focus(), 0);
  }

  function updateValue(name: Extract<keyof TValues, string>, value: string | number | boolean) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      return onValuesChange?.(next, name) ?? next;
    });
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setFormError(null);
  }

  function validateFields() {
    const errors: Record<string, string> = {};
    for (const field of resolvedFields) {
      const value = values[field.name];
      const empty = typeof value === "string" ? !value.trim() : value === undefined || value === null || value === false;
      if (field.required && empty) errors[field.name] = `${field.label} is required.`;
      if ((field.type === "text" || field.type === "email" || field.type === "textarea") && typeof value === "string") {
        if (field.minLength && value.trim().length < field.minLength) errors[field.name] = `${field.label} must be at least ${field.minLength} characters.`;
        if (field.maxLength && value.length > field.maxLength) errors[field.name] = `${field.label} must be no more than ${field.maxLength} characters.`;
      }
      if (field.type === "number" && typeof value === "number") {
        if (field.min !== undefined && value < field.min) errors[field.name] = `${field.label} must be at least ${field.min}.`;
        if (field.max !== undefined && value > field.max) errors[field.name] = `${field.label} must be no more than ${field.max}.`;
      }
    }
    const customErrors = validate?.(values) ?? {};
    for (const [name, message] of Object.entries(customErrors)) {
      if (typeof message === "string" && message) errors[name] = message;
    }
    return errors;
  }

  const resolvedFields = typeof fields === "function" ? fields(values) : fields;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateFields();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const result = await action(values);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        pushToast({ title: errorToast?.title ?? "Action failed", description: result.error || errorToast?.fallbackDescription });
        return;
      }

      setOpen(false);
      setValues(initialValues);
      setFieldErrors({});
      const toastDescription = typeof successToast.description === "function" ? successToast.description(result.data) : successToast.description;
      pushToast({ title: successToast.title, description: toastDescription });
      await onSuccess?.(result.data);
      window.setTimeout(() => triggerRef.current?.querySelector("button")?.focus(), 0);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : errorToast?.fallbackDescription ?? "The action could not be completed.";
      setFormError(message);
      pushToast({ title: errorToast?.title ?? "Action failed", description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <span ref={triggerRef}>
        <Button type="button" variant={trigger.variant} onClick={() => setOpen(true)}>
          {trigger.icon}
          {isSubmitting ? trigger.loadingLabel ?? trigger.label : trigger.label}
        </Button>
      </span>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-slate-950/60 p-2 sm:p-4" role="presentation">
          <Card role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className={cn("flex max-h-[calc(100dvh-1rem)] min-h-0 w-full flex-col sm:max-h-[90vh] dark:border-slate-800 dark:bg-slate-900", sizeClasses[size])}>
            <CardHeader className="shrink-0">
              <CardTitle id={titleId} className="dark:text-white">{title}</CardTitle>
              {description ? <CardDescription id={descriptionId} className="dark:text-slate-400">{description}</CardDescription> : null}
            </CardHeader>
            <div className="min-h-0 flex-1">
              <form className="flex h-full min-h-0 flex-col" onSubmit={(event) => void handleSubmit(event)}>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-3">
                {resolvedFields.map((field, index) => {
                  const value = values[field.name];
                  const error = fieldErrors[field.name];
                  const commonProps = { id: `${titleId}-${field.name}`, name: field.name, disabled: isSubmitting || field.disabled, "aria-invalid": Boolean(error), "aria-describedby": error ? `${titleId}-${field.name}-error` : undefined };
                  return (
                    <label key={field.name} className={field.type === "checkbox" ? "flex items-start gap-3" : "block"}>
                      {field.type === "checkbox" ? (
                        <input ref={index === 0 ? firstFieldRef as React.RefObject<HTMLInputElement> : undefined} {...commonProps} type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(field.name, event.target.checked)} className="mt-1 h-4 w-4 rounded border-brand-line" />
                      ) : null}
                      <span className={field.type === "checkbox" ? "block flex-1" : "block"}>
                        <span className="text-sm font-bold text-brand-ink dark:text-white">{field.label}</span>
                        {field.description ? <span className="mt-1 block text-xs text-slate-500">{field.description}</span> : null}
                        {field.type === "textarea" ? <textarea ref={index === 0 ? firstFieldRef as React.RefObject<HTMLTextAreaElement> : undefined} {...commonProps} value={String(value ?? "")} rows={field.rows ?? 4} minLength={field.minLength} maxLength={field.maxLength} required={field.required} placeholder={field.placeholder} onChange={(event) => updateValue(field.name, event.target.value)} className={cn(fieldClassName, "resize-y")} /> : null}
                        {field.type === "text" || field.type === "email" ? <input ref={index === 0 ? firstFieldRef as React.RefObject<HTMLInputElement> : undefined} {...commonProps} type={field.type} value={String(value ?? "")} minLength={field.minLength} maxLength={field.maxLength} required={field.required} placeholder={field.placeholder} onChange={(event) => updateValue(field.name, event.target.value)} className={fieldClassName} /> : null}
                        {field.type === "number" ? <input ref={index === 0 ? firstFieldRef as React.RefObject<HTMLInputElement> : undefined} {...commonProps} type="number" value={String(value ?? "")} min={field.min} max={field.max} step={field.step} required={field.required} placeholder={field.placeholder} onChange={(event) => updateValue(field.name, event.target.value === "" ? "" : event.target.valueAsNumber)} className={fieldClassName} /> : null}
                        {field.type === "select" ? <select ref={index === 0 ? firstFieldRef as React.RefObject<HTMLSelectElement> : undefined} {...commonProps} value={String(value ?? "")} required={field.required} onChange={(event) => updateValue(field.name, event.target.value)} className={fieldClassName}><option value="">{field.placeholder ?? "Select an option"}</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : null}
                        {error ? <span id={`${titleId}-${field.name}-error`} className="mt-1 block text-sm font-semibold text-red-700 dark:text-red-300">{error}</span> : null}
                      </span>
                    </label>
                  );
                })}
                {formError ? <p className="text-sm font-semibold text-red-700 dark:text-red-300">{formError}</p> : null}
                </div>
                <div className="flex shrink-0 justify-end gap-3 border-t border-brand-line bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <Button type="button" variant="ghost" disabled={isSubmitting && !canCloseWhileLoading} onClick={closeDialog}>{cancelLabel}</Button>
                  <Button type="submit" disabled={isSubmitting} className={toneClasses[confirmationButton.tone ?? "primary"]}>{isSubmitting ? confirmationButton.loadingLabel : confirmationButton.label}</Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

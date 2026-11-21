import type { ChangeEvent, ReactNode } from "react";
import styles from "./Rsvp.module.css";

type Base = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: Base & { children: ReactNode }) {
  return (
    <div className={styles.field} data-invalid={error ? "true" : undefined}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional ? <span className={styles.optional}> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextProps = Base & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
};

export function TextField({
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  maxLength = 200,
  required,
  placeholder,
  ...base
}: TextProps) {
  return (
    <FieldShell {...base}>
      <input
        id={base.id}
        name={base.id}
        className={styles.input}
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        aria-invalid={base.error ? true : undefined}
        aria-describedby={describedBy(base.id, base.hint, base.error)}
      />
    </FieldShell>
  );
}

type AreaProps = Base & {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
};

export function TextArea({ value, onChange, maxLength = 1000, rows = 3, placeholder, ...base }: AreaProps) {
  return (
    <FieldShell {...base}>
      <textarea
        id={base.id}
        name={base.id}
        className={`${styles.input} ${styles.textarea}`}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={base.error ? true : undefined}
        aria-describedby={describedBy(base.id, base.hint, base.error)}
      />
    </FieldShell>
  );
}

type SelectProps = Base & {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
};

export function SelectField({ value, onChange, options, placeholder = "Please choose", ...base }: SelectProps) {
  return (
    <FieldShell {...base}>
      <div className={styles.selectWrap}>
        <select
          id={base.id}
          name={base.id}
          className={`${styles.input} ${styles.select}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={base.error ? true : undefined}
          aria-describedby={describedBy(base.id, base.hint, base.error)}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}

type CheckProps = {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
};

export function Checkbox({ id, label, checked, onChange, description }: CheckProps) {
  return (
    <label htmlFor={id} className={styles.check}>
      <input
        id={id}
        type="checkbox"
        className={styles.checkInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.checkBox} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="12" height="12">
          <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.checkText}>
        <span>{label}</span>
        {description ? <span className={styles.checkDesc}>{description}</span> : null}
      </span>
    </label>
  );
}

type ButtonProps = {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "quiet";
  onClick?: () => void;
};

export function Button({
  children,
  loading = false,
  loadingLabel,
  disabled = false,
  type = "button",
  variant = "primary",
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={variant === "primary" ? styles.button : styles.quietButton}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

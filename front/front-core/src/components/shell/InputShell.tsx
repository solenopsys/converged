import type { CSSProperties, KeyboardEvent, ChangeEvent } from "react";

export interface InputShellProps {
  /** Current input value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Is input disabled */
  disabled?: boolean;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Callback when Enter pressed (without Shift) */
  onSubmit?: (value: string) => void;
  /** Callback when input focused */
  onFocus?: () => void;
  /** Additional class */
  className?: string;
}

/**
 * InputShell - поле ввода чата без effector
 *
 * Глупый компонент - принимает данные через props.
 * Для SSR: disabled, placeholder visible
 * Для SPA: подключает handlers из effector
 */
export function InputShell({
  value = "",
  placeholder = "Напишите сообщение...",
  disabled = false,
  onChange,
  onSubmit,
  onFocus,
  className = "",
}: InputShellProps) {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit?.(value);
      }
    }
  };

  const textareaStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    resize: "none",
    border: "none",
    background: "transparent",
    outline: "none",
    padding: 0,
    margin: 0,
    fontSize: "14px",
    fontFamily: "inherit",
    color: "inherit",
    lineHeight: 1.5,
  };

  return (
    <div
      className={`input-shell ${className}`}
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        style={textareaStyle}
        aria-label={placeholder}
      />
    </div>
  );
}

export default InputShell;

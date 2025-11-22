"use client";

import { observable } from "@solenopsys/converged-reactive";

import { cn } from "@/lib/utils";

type SliderValue = number[];

type SliderProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: SliderValue;
  defaultValue?: SliderValue;
  onValueChange?: (value: SliderValue) => void;
};

function Slider({
  className,
  value,
  defaultValue = [0],
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onChange,
  disabled,
  ...props
}: SliderProps) {
  const initial = defaultValue[0] ?? min;
  const internalValue = observable(initial);
  const isControlled = Array.isArray(value);
  const current = () => (isControlled ? value![0] ?? min : internalValue());

  const setValue = (next: number) => {
    if (!isControlled) {
      internalValue(next);
    }
    onValueChange?.([next]);
  };

  const handleChange = (event: Event & { currentTarget: HTMLInputElement }) => {
    const next = Number(event.currentTarget.value);
    setValue(next);
    onChange?.(event as never);
  };

  const percentage = ((current() - min) / (max - min || 1)) * 100;

  return (
    <div
      data-slot="slider"
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
    >
      <div className="bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full">
        <div
          className="bg-primary absolute inset-y-0"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current()}
        onInput={handleChange}
        disabled={disabled}
        data-slot="slider-input"
        className="absolute inset-0 h-1.5 w-full cursor-pointer opacity-0"
        {...props}
      />
      <div
        className="border-primary bg-background ring-ring/50 pointer-events-none absolute size-4 rounded-full border shadow-sm transition-[color,box-shadow] translate-x-[-50%]"
        style={{
          left: `calc(${percentage}% )`,
        }}
      />
    </div>
  );
}

export { Slider };

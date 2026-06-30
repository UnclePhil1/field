import { MinusIcon, PlusIcon, CoinIcon } from '../../components/Icons';

interface StakeStepperProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max: number;
  disabled?: boolean;
}

export function StakeStepper({ value, onChange, step = 25, min = 25, max, disabled }: StakeStepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center justify-between rounded-[13px] border border-edge bg-pitch-deep/50 p-1.5">
      <StepBtn label="Decrease stake" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))}>
        <MinusIcon size={18} />
      </StepBtn>
      <div className="flex items-center gap-1.5">
        <CoinIcon size={15} className="text-grass" />
        <span className="tabular text-base font-extrabold text-chalk">{value.toLocaleString('en-US')}</span>
      </div>
      <StepBtn label="Increase stake" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + step))}>
        <PlusIcon size={18} />
      </StepBtn>
    </div>
  );
}

function StepBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-12 place-items-center rounded-[10px] bg-turf-2 text-chalk-dim transition-colors hover:text-chalk disabled:opacity-40 disabled:hover:text-chalk-dim"
    >
      {children}
    </button>
  );
}

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, disabled, ...rest },
  ref
) {
  return (
    <label className={cn(styles.wrap, className)} aria-disabled={disabled || undefined}>
      <input ref={ref} type="checkbox" role="switch" className={styles.input} disabled={disabled} {...rest} />
      <span className={styles.track}>
        <span className={styles.knob} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
});

export default Switch;

import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconMinus } from '@/components/icons';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, disabled, ...rest },
  forwardedRef
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cn(styles.wrap, className)}
      aria-disabled={disabled || undefined}
    >
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="checkbox"
        className={styles.input}
        disabled={disabled}
        {...rest}
      />
      <span className={styles.box}>
        <span className={styles.check}>
          {indeterminate ? <IconMinus size={12} strokeWidth={2.5} /> : <IconCheck size={12} strokeWidth={2.5} />}
        </span>
      </span>
      {label && <span>{label}</span>}
    </label>
  );
});

export default Checkbox;

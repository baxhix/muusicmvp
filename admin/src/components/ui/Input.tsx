import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Input.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  inputSize?: InputSize;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  invalid?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    errorText,
    required,
    inputSize = 'md',
    leadingIcon,
    trailingIcon,
    invalid,
    className,
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasError = invalid || Boolean(errorText);

  return (
    <label className={styles.field} htmlFor={inputId}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </span>
      )}
      <div className={styles.inputWrap}>
        {leadingIcon && (
          <span className={cn(styles.adornment, styles.leading)}>{leadingIcon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          className={cn(
            styles.input,
            styles[inputSize],
            leadingIcon && styles.hasLeading,
            trailingIcon && styles.hasTrailing,
            hasError && styles.invalid,
            className
          )}
          {...rest}
        />
        {trailingIcon && (
          <span className={cn(styles.adornment, styles.trailing)}>{trailingIcon}</span>
        )}
      </div>
      {errorText ? (
        <span className={styles.error}>{errorText}</span>
      ) : helperText ? (
        <span className={styles.helper}>{helperText}</span>
      ) : null}
    </label>
  );
});

export default Input;

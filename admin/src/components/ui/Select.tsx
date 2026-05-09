import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconChevronDown } from '@/components/icons';
import styles from './Input.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  invalid?: boolean;
  options: SelectOption[];
  placeholder?: string;
  inputSize?: 'sm' | 'md' | 'lg';
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    helperText,
    errorText,
    required,
    invalid,
    options,
    placeholder,
    inputSize = 'md',
    className,
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hasError = invalid || Boolean(errorText);

  return (
    <label className={styles.field} htmlFor={selectId}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </span>
      )}
      <div className={styles.inputWrap}>
        <select
          ref={ref}
          id={selectId}
          aria-invalid={hasError || undefined}
          className={cn(
            styles.input,
            styles[inputSize],
            styles.hasTrailing,
            hasError && styles.invalid,
            className
          )}
          style={{ appearance: 'none', WebkitAppearance: 'none' }}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={cn(styles.adornment, styles.trailing, styles.selectChevron)}>
          <IconChevronDown size={14} />
        </span>
      </div>
      {errorText ? (
        <span className={styles.error}>{errorText}</span>
      ) : helperText ? (
        <span className={styles.helper}>{helperText}</span>
      ) : null}
    </label>
  );
});

export default Select;

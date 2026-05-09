import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import styles from './Input.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  invalid?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, errorText, required, invalid, className, id, ...rest },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hasError = invalid || Boolean(errorText);

  return (
    <label className={styles.field} htmlFor={textareaId}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </span>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={hasError || undefined}
        className={cn(styles.input, styles.textarea, hasError && styles.invalid, className)}
        {...rest}
      />
      {errorText ? (
        <span className={styles.error}>{errorText}</span>
      ) : helperText ? (
        <span className={styles.helper}>{helperText}</span>
      ) : null}
    </label>
  );
});

export default Textarea;

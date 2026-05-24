import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconMinus } from '@/components/icons';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

/**
 * Checkbox com binding EXPLÍCITO via htmlFor (não implícito por
 * nesting). Cada instância gera um id único via useId pra
 * eliminar qualquer ambiguidade de label binding em DOMs grandes
 * com muitos checkboxes coexistindo (file lists, bulk bars, etc).
 *
 * Bug histórico: usar label sem htmlFor (binding implícito por
 * descendant) funcionava na maioria dos casos mas tinha edge
 * cases onde clicks em elementos não-relacionados disparavam o
 * binding. Solução: explicit-by-default.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, disabled, id, ...rest },
  forwardedRef
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const innerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cn(styles.wrap, className)}
      htmlFor={inputId}
      aria-disabled={disabled || undefined}
    >
      <input
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={inputId}
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

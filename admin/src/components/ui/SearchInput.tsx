import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconSearch } from '@/components/icons';
import styles from './Input.module.css';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  pill?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { pill = false, className, placeholder = 'Buscar...', ...rest },
  ref
) {
  return (
    <div className={styles.inputWrap}>
      <span className={cn(styles.adornment, styles.leading)}>
        <IconSearch size={14} />
      </span>
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(styles.input, styles.md, styles.hasLeading, pill && styles.searchPill, className)}
        {...rest}
      />
    </div>
  );
});

export default SearchInput;

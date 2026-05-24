import { useEffect, useState } from 'react';

/**
 * Retorna `value` com atraso de `delayMs`. Útil pra desacoplar
 * digitação no input (que precisa ficar snappy) de operações
 * pesadas que dependem do valor — refetch de API, filter sobre
 * lista grande, etc.
 *
 * Exemplo:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebouncedValue(search, 300);
 *   useEffect(() => { refetch(debouncedSearch); }, [debouncedSearch]);
 *
 * Default 250ms — ponto cego entre "rápido o bastante pra parecer
 * instantâneo" e "lento o bastante pra não disparar a cada tecla".
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import styles from './layout.module.css';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <TopBar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

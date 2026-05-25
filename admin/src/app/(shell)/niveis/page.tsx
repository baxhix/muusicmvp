'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import {
  IconStar,
  IconUsers,
  IconCheckCircle,
  IconChevronRight,
} from '@/components/icons';
import { NIVEIS_DATA, type NivelTier } from '@/data/mock/niveis';
import { formatNumber } from '@/lib/format';
import styles from './page.module.css';

/**
 * Hub de níveis — lista os 4 tiers (Top 1 / 10 / 50 / 100) como
 * cards com cor temática, contagem de membros, contagem de
 * benefícios ativos e CTA pra entrar no editor.
 *
 * Clique no card → /niveis/[tier] (página dedicada com tabs
 * Benefícios + Membros).
 *
 * O conceito de tier é deterministicamente derivado do ranking em
 * fanpoints — o admin só edita os BENEFÍCIOS atribuídos a cada
 * tier, não a regra de elegibilidade.
 */
export default function NiveisHubPage() {
  const router = useRouter();

  /* Agregados globais — soma das contagens dos 4 tiers pros KPIs
   * no topo. Top 1 conta como 1 slot, etc. */
  const totals = {
    capacity: NIVEIS_DATA.reduce((acc, t) => acc + t.capacity, 0),
    members: NIVEIS_DATA.reduce((acc, t) => acc + t.members.length, 0),
    benefits: NIVEIS_DATA.reduce(
      (acc, t) => acc + t.benefits.filter((b) => b.enabled).length,
      0,
    ),
    benefitsTotal: NIVEIS_DATA.reduce((acc, t) => acc + t.benefits.length, 0),
  };

  function openTier(tier: NivelTier) {
    router.push(`/niveis/${tier}`);
  }

  return (
    <>
      <PageHeader
        title="Níveis de superfãs"
        description="Configure os benefícios atribuídos a cada nível (Top 1, Top 10, Top 50, Top 100). A elegibilidade é automática — derivada do ranking em fanpoints. Aqui você define o que cada grupo recebe."
      />

      <div className={styles.body}>
        <div className={styles.kpiGrid}>
          <StatCard
            icon={<IconStar size={14} />}
            value="4"
            label="Níveis configurados"
          />
          <StatCard
            icon={<IconUsers size={14} />}
            value={formatNumber(totals.members)}
            label="Membros nos rankings"
            secondary={`de até ${totals.capacity} slots`}
          />
          <StatCard
            icon={<IconCheckCircle size={14} />}
            value={`${totals.benefits} / ${totals.benefitsTotal}`}
            label="Benefícios ativos"
          />
        </div>

        <div className={styles.tierGrid}>
          {NIVEIS_DATA.map((tier) => {
            const activeBenefits = tier.benefits.filter((b) => b.enabled).length;
            return (
              <button
                type="button"
                key={tier.tier}
                className={styles.tierCard}
                onClick={() => openTier(tier.tier)}
                style={
                  {
                    '--tier-color': tier.color,
                  } as React.CSSProperties
                }
              >
                <div className={styles.tierHead}>
                  <span className={styles.tierLabel}>{tier.label}</span>
                  <span className={styles.tierCapacity}>
                    {tier.capacity === 1
                      ? '1 slot'
                      : `${tier.capacity} slots`}
                  </span>
                </div>
                <p className={styles.tierTagline}>{tier.tagline}</p>

                <div className={styles.tierStats}>
                  <div className={styles.tierStat}>
                    <span className={styles.tierStatLabel}>Membros</span>
                    <span className={styles.tierStatValue}>
                      {tier.members.length}
                      <span className={styles.tierStatTotal}>
                        / {tier.capacity}
                      </span>
                    </span>
                  </div>
                  <div className={styles.tierStat}>
                    <span className={styles.tierStatLabel}>Benefícios</span>
                    <span className={styles.tierStatValue}>
                      {activeBenefits}
                      <span className={styles.tierStatTotal}>
                        / {tier.benefits.length}
                      </span>
                    </span>
                  </div>
                </div>

                <div className={styles.tierFooter}>
                  <span className={styles.tierCta}>Gerenciar nível</span>
                  <IconChevronRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </>
  );
}

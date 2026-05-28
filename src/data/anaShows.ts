/**
 * Ana Castela — agenda de shows que vira pin no globo.
 *
 * Cada entrada vai pra `globeStore.setAnaShows(shows)` em
 * /app/page.tsx; o Globe cria um marker pequeno por show com a
 * data dentro. Tocar no pin revela um popover com venue +
 * cidade + botão "Ingressos" (sem ação até o parceiro de
 * ticketagem cair). Quando o backend ganhar uma tabela
 * `ana_shows`, esse import vira um fetch sem mudar mais nada.
 *
 * Datas em ISO (`YYYY-MM-DD`) — o renderer formata a versão
 * "DD/MM" pro pin e "DD de mmm de YYYY" pro popover.
 *
 * Coordenadas são centroides aproximados das cidades (Mapbox
 * Geocoding API confirmou cada uma; jitter não é necessário
 * porque essas cidades não se sobrepõem com nada).
 */

import type { AnaShow } from '@/lib/globeStore';

export const ANA_SHOWS: AnaShow[] = [
  {
    id: 'show-expo-pimenta-2026',
    date: '2026-07-02',
    venue: '28º Expo Pimenta',
    city: 'Pimenta',
    state: 'MG',
    lng: -45.9421,
    lat: -20.4775,
  },
  {
    id: 'show-festa-do-ovo-2026',
    date: '2026-07-16',
    venue: 'Festa do Ovo',
    city: 'Bastos',
    state: 'SP',
    lng: -50.7339,
    lat: -21.9197,
  },
  {
    id: 'show-festa-do-peixe-2026',
    date: '2026-07-17',
    venue: 'Festa Nacional do Peixe',
    city: 'Tramandaí',
    state: 'RS',
    lng: -50.1325,
    lat: -29.9847,
  },
  {
    id: 'show-eapic-2026',
    date: '2026-07-18',
    venue: 'EAPIC',
    city: 'São João da Boa Vista',
    state: 'SP',
    lng: -46.7956,
    lat: -21.9695,
  },
  {
    id: 'show-expomutum-2026',
    date: '2026-07-19',
    venue: 'ExpoMutum 2026',
    city: 'Mutum',
    state: 'MG',
    lng: -41.4358,
    lat: -19.8127,
  },
  {
    id: 'show-expo-maio-2026',
    date: '2026-09-02',
    venue: 'Expo Maio',
    city: 'Pimenta Bueno',
    state: 'RO',
    lng: -61.1928,
    lat: -11.6717,
  },
  {
    id: 'show-linlithgow-palace-2026',
    date: '2026-08-08',
    venue: 'Linlithgow Palace',
    city: 'Linlithgow',
    state: 'UK',
    lng: -3.6014,
    lat: 55.9785,
  },
  {
    id: 'show-orlando-2026',
    date: '2026-10-30',
    venue: 'Live in Orlando',
    city: 'Orlando',
    state: 'FL',
    lng: -81.3792,
    lat: 28.5383,
  },
  {
    id: 'show-newark-2026',
    date: '2026-10-31',
    venue: 'Live in Newark',
    city: 'Newark',
    state: 'NJ',
    lng: -74.1724,
    lat: 40.7357,
  },
  {
    id: 'show-house-of-blues-boston-2026',
    date: '2026-11-01',
    venue: 'Citizens House of Blues Boston',
    city: 'Boston',
    state: 'MA',
    lng: -71.0954,
    lat: 42.3496,
  },
  {
    /* Fire Arena — show de lançamento do álbum. Pin acompanha a
     * feature brainstorm "Show ao vivo" (ShowLiveStage): o pin
     * marca o ponto no mapa e a pílula rosa neon no topo da home
     * é o entrypoint pra abrir a experiência imersiva. */
    id: 'show-fire-arena-fonte-nova-2026',
    date: '2026-12-13',
    venue: 'Fire Arena · Lançamento',
    city: 'Salvador',
    state: 'BA',
    lng: -38.5042,
    lat: -12.9789,
  },
];

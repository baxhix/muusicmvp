/**
 * Fanverse Search — dados mocados pra alimentar o overlay
 * `FanverseSearch` (página de "Analisando atividade do mundo").
 *
 * Tudo aqui é placeholder pra UI; quando o backend tiver os
 * endpoints reais de actividade global (top listeners do momento,
 * counts de mesma música/álbum, distribuição por país, etc.),
 * substituir cada export por um fetch via SWR ou hook similar.
 *
 * IDs de avatar via i.pravatar.cc/seed=... pra fotos reproduzíveis
 * sem precisar de upload local.
 */

export interface FanverseListener {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface FanverseSearchUser {
  id: string;
  name: string;
  role: 'super-fa' | 'fa' | 'curioso';
  city: string;
  country: string;
  avatarUrl: string;
  isListening: boolean;
  isLiked: boolean;
}

export interface FanverseMatch {
  id: string;
  name: string;
  avatarUrl: string;
  copy: string;
}

export interface FanverseSearchSnapshot {
  /** Top 12 ouvintes ativos (avatares no cluster do topo). */
  topListeners: FanverseListener[];
  /** Quantas pessoas ouvindo a MESMA música que o usuário agora. */
  sameSongCount: number;
  /** Quantas pessoas ouvindo o MESMO álbum agora. */
  sameAlbumCount: number;
  /** Quantos países simultaneamente conectados ao Fanverse. */
  countriesCount: number;
  /** Total de pessoas ativas no Fanverse Ana Castela neste instante. */
  peopleCount: number;
  /** Matches de afinidade (carrossel com gradient pill). */
  matches: FanverseMatch[];
  /** Lista navegável de usuários ativos com cidade + país. */
  users: FanverseSearchUser[];
}

/* Helper pra montar URLs do pravatar com seed determinístico (mesma
 * pessoa entre reloads). */
function avatarFor(seed: string): string {
  return `https://i.pravatar.cc/120?u=${encodeURIComponent(seed)}`;
}

const TOP_LISTENERS: FanverseListener[] = [
  { id: 'l-01', name: 'Daniel Mendonça', avatarUrl: avatarFor('daniel-amsterdam') },
  { id: 'l-02', name: 'Renata Prado',    avatarUrl: avatarFor('renata-toledo') },
  { id: 'l-03', name: 'Fernanda De Mari', avatarUrl: avatarFor('fernanda-amsterdam') },
  { id: 'l-04', name: 'Lucas Ferreira',  avatarUrl: avatarFor('lucas-sp') },
  { id: 'l-05', name: 'Beatriz Costa',   avatarUrl: avatarFor('bia-rj') },
  { id: 'l-06', name: 'Mateus Lima',     avatarUrl: avatarFor('mateus-poa') },
  { id: 'l-07', name: 'Julia Cardoso',   avatarUrl: avatarFor('julia-bsb') },
  { id: 'l-08', name: 'Caio Santos',     avatarUrl: avatarFor('caio-mg') },
  { id: 'l-09', name: 'Helena Vieira',   avatarUrl: avatarFor('helena-cwb') },
  { id: 'l-10', name: 'Rafael Oliveira', avatarUrl: avatarFor('rafa-ssa') },
  { id: 'l-11', name: 'Sofia Almeida',   avatarUrl: avatarFor('sofia-rec') },
  { id: 'l-12', name: 'Pedro Henrique',  avatarUrl: avatarFor('pedro-bel') },
];

const MATCHES: FanverseMatch[] = [
  {
    id: 'm-01',
    name: 'Daniel',
    avatarUrl: avatarFor('daniel-amsterdam'),
    copy: 'Você e {name} ouvem a mesma música sempre',
  },
  {
    id: 'm-02',
    name: 'Renata',
    avatarUrl: avatarFor('renata-toledo'),
    copy: 'Você e {name} curtem o mesmo álbum: Boiadeira',
  },
  {
    id: 'm-03',
    name: 'Fernanda',
    avatarUrl: avatarFor('fernanda-amsterdam'),
    copy: 'Você e {name} são superfãs há 2 anos',
  },
  {
    id: 'm-04',
    name: 'Lucas',
    avatarUrl: avatarFor('lucas-sp'),
    copy: 'Você e {name} foram aos mesmos 3 shows',
  },
];

const USERS: FanverseSearchUser[] = [
  { id: 'u-01', name: 'Renata Prado',    role: 'super-fa', city: 'Toledo',    country: 'PR',     avatarUrl: avatarFor('renata-toledo'),    isListening: true,  isLiked: false },
  { id: 'u-02', name: 'Daniel Mendonça', role: 'fa',       city: 'Amesterdam', country: 'Holanda', avatarUrl: avatarFor('daniel-amsterdam'), isListening: true,  isLiked: false },
  { id: 'u-03', name: 'Fernanda De Mari', role: 'fa',      city: 'Amesterdam', country: 'Holanda', avatarUrl: avatarFor('fernanda-amsterdam'), isListening: true, isLiked: true },
  { id: 'u-04', name: 'Lucas Ferreira',  role: 'super-fa', city: 'São Paulo',  country: 'SP',     avatarUrl: avatarFor('lucas-sp'),         isListening: false, isLiked: false },
  { id: 'u-05', name: 'Beatriz Costa',   role: 'fa',       city: 'Rio de Janeiro', country: 'RJ',  avatarUrl: avatarFor('bia-rj'),          isListening: true,  isLiked: false },
  { id: 'u-06', name: 'Mateus Lima',     role: 'curioso',  city: 'Porto Alegre', country: 'RS',   avatarUrl: avatarFor('mateus-poa'),       isListening: true,  isLiked: false },
  { id: 'u-07', name: 'Julia Cardoso',   role: 'super-fa', city: 'Brasília',   country: 'DF',     avatarUrl: avatarFor('julia-bsb'),        isListening: true,  isLiked: true },
  { id: 'u-08', name: 'Caio Santos',     role: 'fa',       city: 'Belo Horizonte', country: 'MG', avatarUrl: avatarFor('caio-mg'),          isListening: false, isLiked: false },
  { id: 'u-09', name: 'Helena Vieira',   role: 'fa',       city: 'Curitiba',   country: 'PR',     avatarUrl: avatarFor('helena-cwb'),       isListening: true,  isLiked: false },
  { id: 'u-10', name: 'Rafael Oliveira', role: 'super-fa', city: 'Salvador',   country: 'BA',     avatarUrl: avatarFor('rafa-ssa'),         isListening: true,  isLiked: false },
  { id: 'u-11', name: 'Sofia Almeida',   role: 'curioso',  city: 'Recife',     country: 'PE',     avatarUrl: avatarFor('sofia-rec'),        isListening: false, isLiked: false },
  { id: 'u-12', name: 'Pedro Henrique',  role: 'fa',       city: 'Belém',      country: 'PA',     avatarUrl: avatarFor('pedro-bel'),        isListening: true,  isLiked: true },
  { id: 'u-13', name: 'Carolina Rocha',  role: 'fa',       city: 'Florianópolis', country: 'SC',  avatarUrl: avatarFor('carol-fln'),        isListening: true,  isLiked: false },
  { id: 'u-14', name: 'Bruno Castro',    role: 'super-fa', city: 'Goiânia',    country: 'GO',     avatarUrl: avatarFor('bruno-gyn'),        isListening: true,  isLiked: false },
  { id: 'u-15', name: 'Manuela Pinto',   role: 'fa',       city: 'Lisboa',     country: 'Portugal', avatarUrl: avatarFor('manu-lis'),       isListening: true,  isLiked: true },
  { id: 'u-16', name: 'Thiago Moraes',   role: 'fa',       city: 'Madri',      country: 'Espanha', avatarUrl: avatarFor('thiago-mad'),      isListening: false, isLiked: false },
  { id: 'u-17', name: 'Amanda Souza',    role: 'curioso',  city: 'Nashville',  country: 'EUA',    avatarUrl: avatarFor('amanda-nsh'),       isListening: true,  isLiked: false },
  { id: 'u-18', name: 'Rodrigo Tavares', role: 'super-fa', city: 'Buenos Aires', country: 'Argentina', avatarUrl: avatarFor('rodrigo-ba'), isListening: true,  isLiked: false },
  { id: 'u-19', name: 'Larissa Nunes',   role: 'fa',       city: 'Tokyo',      country: 'Japão',  avatarUrl: avatarFor('lari-tyo'),         isListening: true,  isLiked: false },
  { id: 'u-20', name: 'Gabriel Dias',    role: 'fa',       city: 'Berlim',     country: 'Alemanha', avatarUrl: avatarFor('gabriel-ber'),    isListening: false, isLiked: false },
];

export const FANVERSE_SEARCH_SNAPSHOT: FanverseSearchSnapshot = {
  topListeners: TOP_LISTENERS,
  sameSongCount: 455,
  sameAlbumCount: 1766,
  countriesCount: 42,
  peopleCount: 3654,
  matches: MATCHES,
  users: USERS,
};

export const ROLE_LABEL: Record<FanverseSearchUser['role'], string> = {
  'super-fa': 'Super Fã',
  fa: 'Fã',
  curioso: 'Curioso',
};

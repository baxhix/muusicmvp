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
  /** Suffix da frase — o prefix "Você e {name}" é renderizado em
   * bold branco pelo componente; este campo carrega só o resto
   * (cinza regular). Ex.: "ouvem a mesma música sempre". */
  suffix: string;
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
  { id: 'm-01', name: 'Daniel',   avatarUrl: avatarFor('daniel-amsterdam'),  suffix: 'ouvem a mesma música sempre' },
  { id: 'm-02', name: 'Renata',   avatarUrl: avatarFor('renata-toledo'),     suffix: 'curtem o mesmo álbum: Boiadeira' },
  { id: 'm-03', name: 'Fernanda', avatarUrl: avatarFor('fernanda-amsterdam'),suffix: 'são superfãs há 2 anos' },
  { id: 'm-04', name: 'Lucas',    avatarUrl: avatarFor('lucas-sp'),          suffix: 'foram aos mesmos 3 shows' },
  { id: 'm-05', name: 'Beatriz',  avatarUrl: avatarFor('bia-rj'),            suffix: 'compartilham 8 playlists' },
  { id: 'm-06', name: 'Julia',    avatarUrl: avatarFor('julia-bsb'),         suffix: 'curtem Pipoco há mais tempo' },
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
  /* Lote 2 (u-21 → u-40) — pra paginação de 20 em 20. */
  { id: 'u-21', name: 'Marina Sales',    role: 'super-fa', city: 'Fortaleza',  country: 'CE',     avatarUrl: avatarFor('marina-for'),       isListening: true,  isLiked: false },
  { id: 'u-22', name: 'Vinícius Lopes',  role: 'fa',       city: 'Natal',      country: 'RN',     avatarUrl: avatarFor('vini-nat'),         isListening: true,  isLiked: false },
  { id: 'u-23', name: 'Camila Reis',     role: 'fa',       city: 'Cuiabá',     country: 'MT',     avatarUrl: avatarFor('camila-cgb'),       isListening: false, isLiked: true  },
  { id: 'u-24', name: 'Felipe Araújo',   role: 'curioso',  city: 'Manaus',     country: 'AM',     avatarUrl: avatarFor('felipe-mao'),       isListening: true,  isLiked: false },
  { id: 'u-25', name: 'Isadora Coelho',  role: 'super-fa', city: 'Vitória',    country: 'ES',     avatarUrl: avatarFor('isa-vix'),          isListening: true,  isLiked: false },
  { id: 'u-26', name: 'Henrique Alves',  role: 'fa',       city: 'João Pessoa', country: 'PB',    avatarUrl: avatarFor('henrique-jpa'),     isListening: false, isLiked: false },
  { id: 'u-27', name: 'Letícia Barbosa', role: 'fa',       city: 'Maceió',     country: 'AL',     avatarUrl: avatarFor('leticia-mcz'),      isListening: true,  isLiked: true  },
  { id: 'u-28', name: 'Eduardo Cunha',   role: 'fa',       city: 'Aracaju',    country: 'SE',     avatarUrl: avatarFor('edu-aju'),          isListening: true,  isLiked: false },
  { id: 'u-29', name: 'Patrícia Ramos',  role: 'super-fa', city: 'Teresina',   country: 'PI',     avatarUrl: avatarFor('paty-the'),         isListening: true,  isLiked: false },
  { id: 'u-30', name: 'Igor Macedo',     role: 'fa',       city: 'Campinas',   country: 'SP',     avatarUrl: avatarFor('igor-cps'),         isListening: false, isLiked: false },
  { id: 'u-31', name: 'Vanessa Borges',  role: 'fa',       city: 'Santos',     country: 'SP',     avatarUrl: avatarFor('vanessa-stz'),      isListening: true,  isLiked: true  },
  { id: 'u-32', name: 'Marcelo Ribeiro', role: 'curioso',  city: 'Joinville',  country: 'SC',     avatarUrl: avatarFor('marcelo-jvl'),      isListening: true,  isLiked: false },
  { id: 'u-33', name: 'Aline Cavalcante', role: 'super-fa', city: 'Londrina',  country: 'PR',     avatarUrl: avatarFor('aline-ldb'),        isListening: true,  isLiked: false },
  { id: 'u-34', name: 'Diego Martins',   role: 'fa',       city: 'Uberlândia', country: 'MG',     avatarUrl: avatarFor('diego-udi'),        isListening: false, isLiked: false },
  { id: 'u-35', name: 'Bianca Teixeira', role: 'fa',       city: 'Porto',      country: 'Portugal', avatarUrl: avatarFor('bia-prt'),        isListening: true,  isLiked: true  },
  { id: 'u-36', name: 'Otávio Pacheco',  role: 'fa',       city: 'Barcelona',  country: 'Espanha', avatarUrl: avatarFor('otavio-bcn'),      isListening: true,  isLiked: false },
  { id: 'u-37', name: 'Sabrina Moreira', role: 'super-fa', city: 'Buenos Aires', country: 'Argentina', avatarUrl: avatarFor('sabrina-bue'), isListening: true,  isLiked: false },
  { id: 'u-38', name: 'Murilo Freitas',  role: 'fa',       city: 'Santiago',   country: 'Chile',  avatarUrl: avatarFor('murilo-scl'),       isListening: false, isLiked: false },
  { id: 'u-39', name: 'Tatiana Lara',    role: 'fa',       city: 'Cidade do México', country: 'México', avatarUrl: avatarFor('tati-mex'),  isListening: true,  isLiked: false },
  { id: 'u-40', name: 'Yasmin Carvalho', role: 'curioso',  city: 'Miami',      country: 'EUA',    avatarUrl: avatarFor('yasmin-mia'),       isListening: true,  isLiked: false },
  /* Lote 3 (u-41 → u-60). */
  { id: 'u-41', name: 'Augusto Vargas',  role: 'super-fa', city: 'Houston',    country: 'EUA',    avatarUrl: avatarFor('augusto-hou'),      isListening: true,  isLiked: false },
  { id: 'u-42', name: 'Mariana Rios',    role: 'fa',       city: 'Boston',     country: 'EUA',    avatarUrl: avatarFor('mari-bos'),         isListening: true,  isLiked: true  },
  { id: 'u-43', name: 'Renan Pires',     role: 'fa',       city: 'Toronto',    country: 'Canadá', avatarUrl: avatarFor('renan-yyz'),        isListening: false, isLiked: false },
  { id: 'u-44', name: 'Débora Brandão',  role: 'fa',       city: 'Montreal',   country: 'Canadá', avatarUrl: avatarFor('debora-yul'),       isListening: true,  isLiked: false },
  { id: 'u-45', name: 'Tiago Nogueira',  role: 'super-fa', city: 'Paris',      country: 'França', avatarUrl: avatarFor('tiago-par'),        isListening: true,  isLiked: false },
  { id: 'u-46', name: 'Cecília Lopes',   role: 'fa',       city: 'Roma',       country: 'Itália', avatarUrl: avatarFor('cecilia-rom'),      isListening: true,  isLiked: false },
  { id: 'u-47', name: 'Joaquim Andrade', role: 'curioso',  city: 'Milão',      country: 'Itália', avatarUrl: avatarFor('joaquim-mil'),      isListening: false, isLiked: false },
  { id: 'u-48', name: 'Nathalia Brito',  role: 'fa',       city: 'Dublin',     country: 'Irlanda', avatarUrl: avatarFor('nath-dub'),         isListening: true,  isLiked: true  },
  { id: 'u-49', name: 'Leonardo Faria',  role: 'super-fa', city: 'Edimburgo',  country: 'Escócia', avatarUrl: avatarFor('leo-edi'),         isListening: true,  isLiked: false },
  { id: 'u-50', name: 'Roberta Quintão', role: 'fa',       city: 'Estocolmo',  country: 'Suécia', avatarUrl: avatarFor('roberta-arn'),      isListening: true,  isLiked: false },
  { id: 'u-51', name: 'André Magalhães', role: 'fa',       city: 'Copenhague', country: 'Dinamarca', avatarUrl: avatarFor('andre-cph'),    isListening: false, isLiked: false },
  { id: 'u-52', name: 'Priscila Veloso', role: 'super-fa', city: 'Oslo',       country: 'Noruega', avatarUrl: avatarFor('priscila-osl'),     isListening: true,  isLiked: true  },
  { id: 'u-53', name: 'Wesley Sampaio',  role: 'fa',       city: 'Praga',      country: 'Tchéquia', avatarUrl: avatarFor('wesley-prg'),     isListening: true,  isLiked: false },
  { id: 'u-54', name: 'Janaína Tavora',  role: 'fa',       city: 'Viena',      country: 'Áustria', avatarUrl: avatarFor('janaina-vie'),     isListening: true,  isLiked: false },
  { id: 'u-55', name: 'Fábio Drummond',  role: 'curioso',  city: 'Budapeste',  country: 'Hungria', avatarUrl: avatarFor('fabio-bud'),       isListening: false, isLiked: false },
  { id: 'u-56', name: 'Cristiane Lemos', role: 'super-fa', city: 'Atenas',     country: 'Grécia', avatarUrl: avatarFor('cris-ath'),         isListening: true,  isLiked: false },
  { id: 'u-57', name: 'Ricardo Galvão',  role: 'fa',       city: 'Cape Town',  country: 'África do Sul', avatarUrl: avatarFor('ricardo-cpt'), isListening: true, isLiked: false },
  { id: 'u-58', name: 'Antonia Quintela', role: 'fa',      city: 'Marraquexe', country: 'Marrocos', avatarUrl: avatarFor('antonia-rak'),    isListening: true,  isLiked: true  },
  { id: 'u-59', name: 'Sérgio Vasques',  role: 'fa',       city: 'Dubai',      country: 'EAU',    avatarUrl: avatarFor('sergio-dxb'),       isListening: false, isLiked: false },
  { id: 'u-60', name: 'Luana Brandt',    role: 'super-fa', city: 'Mumbai',     country: 'Índia',  avatarUrl: avatarFor('luana-bom'),        isListening: true,  isLiked: false },
  /* Lote 4 (u-61 → u-80). */
  { id: 'u-61', name: 'Davi Spinola',    role: 'fa',       city: 'Singapura',  country: 'Singapura', avatarUrl: avatarFor('davi-sin'),     isListening: true,  isLiked: false },
  { id: 'u-62', name: 'Olivia Maciel',   role: 'fa',       city: 'Hong Kong',  country: 'China',  avatarUrl: avatarFor('olivia-hkg'),       isListening: true,  isLiked: true  },
  { id: 'u-63', name: 'Geovana Pessoa',  role: 'super-fa', city: 'Seul',       country: 'Coreia do Sul', avatarUrl: avatarFor('geovana-icn'), isListening: false, isLiked: false },
  { id: 'u-64', name: 'Arthur Vidal',    role: 'fa',       city: 'Bangkok',    country: 'Tailândia', avatarUrl: avatarFor('arthur-bkk'),   isListening: true,  isLiked: false },
  { id: 'u-65', name: 'Larissa Vianna',  role: 'curioso',  city: 'Bali',       country: 'Indonésia', avatarUrl: avatarFor('lari-dps'),     isListening: true,  isLiked: false },
  { id: 'u-66', name: 'Gustavo Penna',   role: 'fa',       city: 'Sydney',     country: 'Austrália', avatarUrl: avatarFor('gustavo-syd'),  isListening: true,  isLiked: false },
  { id: 'u-67', name: 'Stella Bahia',    role: 'super-fa', city: 'Melbourne',  country: 'Austrália', avatarUrl: avatarFor('stella-mel'),   isListening: false, isLiked: false },
  { id: 'u-68', name: 'Vitor Hugo',      role: 'fa',       city: 'Auckland',   country: 'Nova Zelândia', avatarUrl: avatarFor('vitor-akl'), isListening: true, isLiked: true  },
  { id: 'u-69', name: 'Carmen Espósito', role: 'fa',       city: 'Lima',       country: 'Peru',   avatarUrl: avatarFor('carmen-lim'),       isListening: true,  isLiked: false },
  { id: 'u-70', name: 'Igor Castilho',   role: 'fa',       city: 'Bogotá',     country: 'Colômbia', avatarUrl: avatarFor('igor-bog'),      isListening: false, isLiked: false },
  { id: 'u-71', name: 'Mirela Pádua',    role: 'super-fa', city: 'Quito',      country: 'Equador', avatarUrl: avatarFor('mirela-uio'),     isListening: true,  isLiked: false },
  { id: 'u-72', name: 'Caetano Velho',   role: 'fa',       city: 'Montevidéu', country: 'Uruguai', avatarUrl: avatarFor('caetano-mvd'),    isListening: true,  isLiked: true  },
  { id: 'u-73', name: 'Bárbara Rezende', role: 'fa',       city: 'Assunção',   country: 'Paraguai', avatarUrl: avatarFor('barbara-asu'),   isListening: true,  isLiked: false },
  { id: 'u-74', name: 'Heitor Magnani',  role: 'curioso',  city: 'La Paz',     country: 'Bolívia', avatarUrl: avatarFor('heitor-lpb'),     isListening: false, isLiked: false },
  { id: 'u-75', name: 'Letícia Vasconcelos', role: 'super-fa', city: 'Cartagena', country: 'Colômbia', avatarUrl: avatarFor('let-ctg'),   isListening: true,  isLiked: false },
  { id: 'u-76', name: 'Renan Albuquerque', role: 'fa',     city: 'Havana',     country: 'Cuba',   avatarUrl: avatarFor('renan-hav'),        isListening: true,  isLiked: false },
  { id: 'u-77', name: 'Bruna Caetano',   role: 'fa',       city: 'San José',   country: 'Costa Rica', avatarUrl: avatarFor('bruna-sjo'),   isListening: true,  isLiked: true  },
  { id: 'u-78', name: 'Marcos Pellegrini', role: 'fa',     city: 'Cidade do Cabo', country: 'África do Sul', avatarUrl: avatarFor('marcos-cpt2'), isListening: false, isLiked: false },
  { id: 'u-79', name: 'Bárbara Ottoni',  role: 'super-fa', city: 'Cancún',     country: 'México', avatarUrl: avatarFor('barbara-cun'),      isListening: true,  isLiked: false },
  { id: 'u-80', name: 'Sandra Lacerda',  role: 'fa',       city: 'Tel Aviv',   country: 'Israel', avatarUrl: avatarFor('sandra-tlv'),       isListening: true,  isLiked: false },
  /* +20 users pra cobrir o teto de 100 que o infinite loading
   * consome. Mantém o mix curioso/fa/super-fa + variedade
   * geográfica em sintonia com o resto da lista. */
  { id: 'u-81', name: 'Igor Bertolazzi', role: 'fa',       city: 'Florença',   country: 'Itália', avatarUrl: avatarFor('igor-flr'),         isListening: true,  isLiked: false },
  { id: 'u-82', name: 'Helena Bastos',   role: 'super-fa', city: 'Recife',     country: 'Brasil', avatarUrl: avatarFor('helena-rec'),       isListening: true,  isLiked: true  },
  { id: 'u-83', name: 'Tomás Vieira',    role: 'curioso',  city: 'Porto',      country: 'Portugal', avatarUrl: avatarFor('tomas-opo'),      isListening: false, isLiked: false },
  { id: 'u-84', name: 'Liz Tavares',     role: 'fa',       city: 'Salvador',   country: 'Brasil', avatarUrl: avatarFor('liz-ssa'),          isListening: true,  isLiked: false },
  { id: 'u-85', name: 'Murilo Bittencourt', role: 'fa',    city: 'Brasília',   country: 'Brasil', avatarUrl: avatarFor('murilo-bsb'),       isListening: false, isLiked: false },
  { id: 'u-86', name: 'Cecília Pessoa',  role: 'super-fa', city: 'Curitiba',   country: 'Brasil', avatarUrl: avatarFor('cecilia-cwb'),      isListening: true,  isLiked: true  },
  { id: 'u-87', name: 'Bento Aragão',    role: 'fa',       city: 'Lima',       country: 'Peru',   avatarUrl: avatarFor('bento-lim'),        isListening: true,  isLiked: false },
  { id: 'u-88', name: 'Maitê Pádua',     role: 'fa',       city: 'Belém',      country: 'Brasil', avatarUrl: avatarFor('maite-bel'),        isListening: false, isLiked: false },
  { id: 'u-89', name: 'Augusto Tafur',   role: 'curioso',  city: 'Asunción',   country: 'Paraguai', avatarUrl: avatarFor('augusto-asu'),    isListening: false, isLiked: false },
  { id: 'u-90', name: 'Vitória Camargo', role: 'super-fa', city: 'Goiânia',    country: 'Brasil', avatarUrl: avatarFor('vitoria-gyn'),      isListening: true,  isLiked: true  },
  { id: 'u-91', name: 'Otávio Saldanha', role: 'fa',       city: 'Vancouver',  country: 'Canadá', avatarUrl: avatarFor('otavio-yvr'),       isListening: true,  isLiked: false },
  { id: 'u-92', name: 'Joana Pacheco',   role: 'fa',       city: 'Maceió',     country: 'Brasil', avatarUrl: avatarFor('joana-mcz'),        isListening: false, isLiked: false },
  { id: 'u-93', name: 'Davi Wanderley',  role: 'fa',       city: 'Manaus',     country: 'Brasil', avatarUrl: avatarFor('davi-mao'),         isListening: true,  isLiked: false },
  { id: 'u-94', name: 'Olívia Bezerra',  role: 'super-fa', city: 'Natal',      country: 'Brasil', avatarUrl: avatarFor('olivia-nat'),       isListening: true,  isLiked: true  },
  { id: 'u-95', name: 'Bernardo Coutinho', role: 'curioso',city: 'Estocolmo',  country: 'Suécia', avatarUrl: avatarFor('bernardo-arn'),     isListening: false, isLiked: false },
  { id: 'u-96', name: 'Antonella Faria', role: 'fa',       city: 'Quito',      country: 'Equador', avatarUrl: avatarFor('antonella-uio'),   isListening: true,  isLiked: false },
  { id: 'u-97', name: 'Vicente Romão',   role: 'fa',       city: 'Joinville',  country: 'Brasil', avatarUrl: avatarFor('vicente-jvl'),      isListening: false, isLiked: false },
  { id: 'u-98', name: 'Catarina Vianna', role: 'super-fa', city: 'Praga',      country: 'Tchéquia', avatarUrl: avatarFor('catarina-prg'),   isListening: true,  isLiked: true  },
  { id: 'u-99', name: 'Henrique Caldas', role: 'fa',       city: 'Belo Horizonte', country: 'Brasil', avatarUrl: avatarFor('henrique-cnf'), isListening: true,  isLiked: false },
  { id: 'u-100', name: 'Yasmin Calixto', role: 'fa',       city: 'Aracaju',    country: 'Brasil', avatarUrl: avatarFor('yasmin-aju'),       isListening: true,  isLiked: false },
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

import type { LiveBadgeData, BadgePositionSet } from '@/types';

export const liveBadges: LiveBadgeData[] = [
  {
    id: 'mariana',
    name: 'Mariana Lopes',
    song: 'Olha Onde Eu Tô',
    initials: 'ML',
    bg: 'linear-gradient(135deg,#1a3050,#2d6aad)',
    img: 'https://i.pravatar.cc/72?img=23',
  },
  {
    id: 'joaopedro',
    name: 'João Pedro',
    song: 'Erramos',
    initials: 'JP',
    bg: 'linear-gradient(135deg,#1a4030,#2dad6a)',
    img: 'https://i.pravatar.cc/72?img=11',
  },
  {
    id: 'camila',
    name: 'Camila F.',
    song: 'Aqui e Agora',
    initials: 'CF',
    bg: 'linear-gradient(135deg,#301a50,#6a2dad)',
    img: 'https://i.pravatar.cc/72?img=49',
  },
];

// Badge position sets per filter tab: [all, nearby, taste, friends]
export const badgeSets: BadgePositionSet[][] = [
  [
    { left: '8%',  top: '28%' },
    { left: '18%', top: '55%' },
    { left: '64%', top: '32%' },
  ],
  [
    { left: '26%', top: '22%' },
    { left: '38%', top: '52%' },
    { left: '58%', top: '20%' },
  ],
  [
    { left: '5%',  top: '18%' },
    { left: '32%', top: '62%' },
    { left: '60%', top: '38%' },
  ],
  [
    { left: '14%', top: '42%' },
    { left: '22%', top: '65%' },
    { left: '52%', top: '48%' },
  ],
];

export const pulseDots = [
  { left: '52%', top: '38%' },
  { left: '43%', top: '58%' },
  { right: '35%', top: '44%' },
];

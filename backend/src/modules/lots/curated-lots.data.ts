export interface CuratedArtworkSeed {
  externalItemId: string;
  title: string;
  description: string;
  imageUrl: string;
  attributesJson: {
    artist: string;
    dateDisplay: string;
    medium: string;
    origin: string;
  };
}

export const CURATED_ARTWORKS_POOL: CuratedArtworkSeed[] = [
  {
    externalItemId: 'artic-27992',
    title: 'A Sunday on La Grande Jatte — Georges Seurat',
    description: 'Obra-prima máxima do pontilhismo francês do século XIX retratando a ilha no Sena.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/1280px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg',
    attributesJson: {
      artist: 'Georges Seurat',
      dateDisplay: '1884–1886',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-24645',
    title: 'The Great Wave off Kanagawa — Katsushika Hokusai',
    description: 'Xilogravura japonesa original da série Trinta e Seis Vistas do Monte Fuji.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg',
    attributesJson: {
      artist: 'Katsushika Hokusai',
      dateDisplay: '1831',
      medium: 'Woodblock print (ukiyo-e)',
      origin: 'Japan',
    },
  },
  {
    externalItemId: 'artic-28560',
    title: 'The Bedroom in Arles — Vincent van Gogh',
    description: 'Estudo pós-impressionista vibrante do quarto de Van Gogh na Casa Amarela.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg/1280px-Vincent_van_Gogh_-_De_slaapkamer_-_Google_Art_Project.jpg',
    attributesJson: {
      artist: 'Vincent van Gogh',
      dateDisplay: '1889',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-20684',
    title: 'Paris Street; Rainy Day — Gustave Caillebotte',
    description: 'Perspectiva monumental da Place de Dublin em Paris num dia chuvoso.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg/1280px-Gustave_Caillebotte_-_Paris_Street%3B_Rainy_Day_-_Google_Art_Project.jpg',
    attributesJson: {
      artist: 'Gustave Caillebotte',
      dateDisplay: '1877',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-111628',
    title: 'Nighthawks — Edward Hopper',
    description: 'Pintura icônica do realismo norte-americano retratando um diner noturno.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nighthawks_by_Edward_Hopper_1942.jpg/1280px-Nighthawks_by_Edward_Hopper_1942.jpg',
    attributesJson: {
      artist: 'Edward Hopper',
      dateDisplay: '1942',
      medium: 'Oil on canvas',
      origin: 'United States',
    },
  },
  {
    externalItemId: 'artic-6565',
    title: 'American Gothic — Grant Wood',
    description: 'Retrato histórico da resiliência rural norte-americana do século XX.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg/1024px-Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg',
    attributesJson: {
      artist: 'Grant Wood',
      dateDisplay: '1930',
      medium: 'Oil on beaverboard',
      origin: 'United States',
    },
  },
  {
    externalItemId: 'artic-16568',
    title: 'Water Lilies (Nymphéas) — Claude Monet',
    description: 'Pintura impressionista luminosa do jardim aquático de Giverny.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg/1280px-Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg',
    attributesJson: {
      artist: 'Claude Monet',
      dateDisplay: '1906',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-15468',
    title: 'The Starry Night — Vincent van Gogh',
    description: 'Paisagem noturna em espirais retratando a vista de Saint-Rémy-de-Provence.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1280px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    attributesJson: {
      artist: 'Vincent van Gogh',
      dateDisplay: '1889',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-80607',
    title: 'Wanderer above the Sea of Fog — Caspar David Friedrich',
    description: 'Obra emblemática do Romantismo alemão contemplando a imensidão das montanhas.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg/1024px-Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg',
    attributesJson: {
      artist: 'Caspar David Friedrich',
      dateDisplay: '1818',
      medium: 'Oil on canvas',
      origin: 'Germany',
    },
  },
  {
    externalItemId: 'artic-109439',
    title: 'Girl with a Pearl Earring — Johannes Vermeer',
    description: 'Tronie barroco holandês célebre pelo domínio da luz e olhar enigmático.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/1024px-1665_Girl_with_a_Pearl_Earring.jpg',
    attributesJson: {
      artist: 'Johannes Vermeer',
      dateDisplay: '1665',
      medium: 'Oil on canvas',
      origin: 'Netherlands',
    },
  },
  {
    externalItemId: 'artic-14598',
    title: 'The Kiss (Der Kuss) — Gustav Klimt',
    description: 'Composição simbolista da Fase Dourada vienense com aplicação de folhas de ouro.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/1024px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg',
    attributesJson: {
      artist: 'Gustav Klimt',
      dateDisplay: '1907–1908',
      medium: 'Oil and gold leaf on canvas',
      origin: 'Austria',
    },
  },
  {
    externalItemId: 'artic-34181',
    title: 'Impression, Sunrise — Claude Monet',
    description: 'Tela histórica do porto de Le Havre que deu nome ao movimento Impressionista.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/1280px-Monet_-_Impression%2C_Sunrise.jpg',
    attributesJson: {
      artist: 'Claude Monet',
      dateDisplay: '1872',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-45829',
    title: 'Bal du moulin de la Galette — Pierre-Auguste Renoir',
    description: 'Retrato luminoso de uma tarde festiva no bairro de Montmartre em Paris.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Auguste_Renoir_-_Dance_at_Le_Moulin_de_la_Galette_-_Mus%C3%A9e_d%27Orsay_RF_2739_%28derivative_work_-_AutoContrast_edit_in_LCH_space%29.jpg/1280px-Auguste_Renoir_-_Dance_at_Le_Moulin_de_la_Galette_-_Mus%C3%A9e_d%27Orsay_RF_2739_%28derivative_work_-_AutoContrast_edit_in_LCH_space%29.jpg',
    attributesJson: {
      artist: 'Pierre-Auguste Renoir',
      dateDisplay: '1876',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-59214',
    title: 'The Night Watch — Rembrandt van Rijn',
    description: 'Monumental retrato de grupo do Século de Ouro Holandês em claro-escuro dramático.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/The_Night_Watch_-_HD.jpg/1280px-The_Night_Watch_-_HD.jpg',
    attributesJson: {
      artist: 'Rembrandt van Rijn',
      dateDisplay: '1642',
      medium: 'Oil on canvas',
      origin: 'Netherlands',
    },
  },
  {
    externalItemId: 'artic-73891',
    title: 'Las Meninas — Diego Velázquez',
    description: 'Complexa composição barroca espanhola retratando o ateliê real de Filipe IV.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/1024px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg',
    attributesJson: {
      artist: 'Diego Velázquez',
      dateDisplay: '1656',
      medium: 'Oil on canvas',
      origin: 'Spain',
    },
  },
  {
    externalItemId: 'artic-91204',
    title: 'Liberty Leading the People — Eugène Delacroix',
    description: 'Alegoria romântica monumental da Revolução de Julho de 1830 em Paris.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg/1280px-Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg',
    attributesJson: {
      artist: 'Eugène Delacroix',
      dateDisplay: '1830',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-99901',
    title: 'Composition VIII — Wassily Kandinsky',
    description: 'Obra abstrata geométrica fundamental do período da Bauhaus.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Vassily_Kandinsky%2C_1923_-_Composition_8%2C_oil_on_canvas%2C_140_x_201_cm%2C_Solomon_R._Guggenheim_Museum%2C_New_York.jpg/1280px-Vassily_Kandinsky%2C_1923_-_Composition_8%2C_oil_on_canvas%2C_140_x_201_cm%2C_Solomon_R._Guggenheim_Museum%2C_New_York.jpg',
    attributesJson: {
      artist: 'Wassily Kandinsky',
      dateDisplay: '1923',
      medium: 'Oil on canvas',
      origin: 'Russia / Germany',
    },
  },
  {
    externalItemId: 'artic-62104',
    title: 'The Birth of Venus — Sandro Botticelli',
    description: 'Ícone maior do Renascimento italiano pintado para a família Médici em Florença.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/1280px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg',
    attributesJson: {
      artist: 'Sandro Botticelli',
      dateDisplay: 'c. 1484–1486',
      medium: 'Tempera on canvas',
      origin: 'Italy',
    },
  },
  {
    externalItemId: 'artic-64812',
    title: 'The School of Athens — Raffaello Sanzio',
    description: 'Estudo renascentista reunindo os grandes filósofos e cientistas da Antiguidade Clássica.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/1280px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg',
    attributesJson: {
      artist: 'Raphael (Raffaello Sanzio)',
      dateDisplay: '1509–1511',
      medium: 'Fresco study',
      origin: 'Italy',
    },
  },
  {
    externalItemId: 'artic-71902',
    title: 'The Tower of Babel — Pieter Bruegel the Elder',
    description: 'Minuciosa pintura renascentista flamenga inspirada na arquitetura do Coliseu romano.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Pieter_Bruegel_the_Elder_-_The_Tower_of_Babel_%28Vienna%29_-_Google_Art_Project_-_edited.jpg/1280px-Pieter_Bruegel_the_Elder_-_The_Tower_of_Babel_%28Vienna%29_-_Google_Art_Project_-_edited.jpg',
    attributesJson: {
      artist: 'Pieter Bruegel the Elder',
      dateDisplay: '1563',
      medium: 'Oil on wood panel',
      origin: 'Flanders / Netherlands',
    },
  },
  {
    externalItemId: 'artic-83119',
    title: 'A Bar at the Folies-Bergère — Édouard Manet',
    description: 'Última grande obra de Édouard Manet retratando a vida noturna parisiense e seu jogo de espelhos.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Edouard_Manet%2C_A_Bar_at_the_Folies-Berg%C3%A8re.jpg/1280px-Edouard_Manet%2C_A_Bar_at_the_Folies-Berg%C3%A8re.jpg',
    attributesJson: {
      artist: 'Édouard Manet',
      dateDisplay: '1882',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-88420',
    title: 'Café Terrace at Night — Vincent van Gogh',
    description: 'Cena noturna vibrante da Place du Forum em Arles sob o céu estrelado do sul da França.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Vincent_Willem_van_Gogh_-_Cafe_Terrace_at_Night_%28Yorck%29.jpg/1024px-Vincent_Willem_van_Gogh_-_Cafe_Terrace_at_Night_%28Yorck%29.jpg',
    attributesJson: {
      artist: 'Vincent van Gogh',
      dateDisplay: '1888',
      medium: 'Oil on canvas',
      origin: 'France',
    },
  },
  {
    externalItemId: 'artic-94510',
    title: 'The Fighting Temeraire — J. M. W. Turner',
    description: 'Tributo romântico britânico ao navio de guerra HMS Temeraire rebocado ao pôr do sol.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg/1280px-The_Fighting_Temeraire%2C_JMW_Turner%2C_National_Gallery.jpg',
    attributesJson: {
      artist: 'J. M. W. Turner',
      dateDisplay: '1839',
      medium: 'Oil on canvas',
      origin: 'United Kingdom',
    },
  },
  {
    externalItemId: 'artic-97305',
    title: 'Breezing Up (A Fair Wind) — Winslow Homer',
    description: 'Pintura marítima clássica norte-americana celebrando o otimismo e a navegação a vela.',
    imageUrl:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Winslow_Homer_-_Breezing_Up_%28A_Fair_Wind%29_-_Google_Art_Project.jpg/1280px-Winslow_Homer_-_Breezing_Up_%28A_Fair_Wind%29_-_Google_Art_Project.jpg',
    attributesJson: {
      artist: 'Winslow Homer',
      dateDisplay: '1873–1876',
      medium: 'Oil on canvas',
      origin: 'United States',
    },
  },
];
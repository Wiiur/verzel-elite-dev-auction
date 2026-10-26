import { Injectable, Logger } from '@nestjs/common';

export interface ExternalCatalogItem {
  externalId: string;
  title: string;
  description: string;
  imageUrl: string;
  attributes: {
    artist: string;
    dateDisplay: string;
    medium: string;
    origin: string;
  };
}

@Injectable()
export class CatalogApiService {
  private readonly logger = new Logger(CatalogApiService.name);
  private readonly cache = new Map<string, ExternalCatalogItem[]>();

  private readonly fallbackItems: ExternalCatalogItem[] = [
    {
      externalId: 'artic-27992',
      title: 'A Sunday on La Grande Jatte',
      description: 'Obra-prima do pontilhismo francês do século XIX.',
      imageUrl: 'https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg',
      attributes: {
        artist: 'Georges Seurat',
        dateDisplay: '1884–1886',
        medium: 'Oil on canvas',
        origin: 'France',
      },
    },
    {
      externalId: 'artic-111628',
      title: 'Nighthawks',
      description: 'Pintura icónica retratando clientes num restaurante noturno.',
      imageUrl: 'https://www.artic.edu/iiif/2/831a05de-d3f6-f4fa-a460-23008dd58f9a/full/843,/0/default.jpg',
      attributes: {
        artist: 'Edward Hopper',
        dateDisplay: '1942',
        medium: 'Oil on canvas',
        origin: 'United States',
      },
    },
    {
      externalId: 'artic-28560',
      title: 'The Bedroom',
      description: 'Representação vibrante do quarto de Van Gogh em Arles.',
      imageUrl: 'https://www.artic.edu/iiif/2/25c31d8d-21a4-9ea1-1d73-6a2eca4dda7e/full/843,/0/default.jpg',
      attributes: {
        artist: 'Vincent van Gogh',
        dateDisplay: '1889',
        medium: 'Oil on canvas',
        origin: 'France',
      },
    },
  ];

  async searchArtworks(query = 'painting'): Promise<ExternalCatalogItem[]> {
    const cacheKey = query.trim().toLowerCase() || 'default';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(
        query,
      )}&fields=id,title,artist_title,date_display,medium_display,place_of_origin,image_id,thumbnail&limit=12`;

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP Status ${response.status}`);
      }

      const json = await response.json();
      const iiifUrl = json.config?.iiif_url || 'https://www.artic.edu/iiif/2';

      const items: ExternalCatalogItem[] = (json.data || [])
        .filter((item: any) => item.image_id)
        .map((item: any) => ({
          externalId: `artic-${item.id}`,
          title: item.title || 'Obra sem título',
          description:
            item.thumbnail?.alt_text ||
            `${item.medium_display || 'Obra de arte'} (${item.date_display || 'Data desconhecida'})`,
          imageUrl: `${iiifUrl}/${item.image_id}/full/843,/0/default.jpg`,
          attributes: {
            artist: item.artist_title || 'Artista Desconhecido',
            dateDisplay: item.date_display || 'N/A',
            medium: item.medium_display || 'N/A',
            origin: item.place_of_origin || 'N/A',
          },
        }));

      const result = items.length > 0 ? items : this.fallbackItems;
      this.cache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      this.logger.warn(
        `API Externa instável (${error?.message}). A retornar catálogo de contingência.`,
      );
      return this.fallbackItems;
    }
  }
}
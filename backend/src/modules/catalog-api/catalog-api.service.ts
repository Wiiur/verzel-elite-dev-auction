import { Injectable, Logger } from '@nestjs/common';
import { CURATED_ARTWORKS_POOL } from '../lots/curated-lots.data';

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

  /**
   * Encapsula URLs IIIF do Art Institute of Chicago no CDN proxy wsrv.nl
   * para evitar o bloqueio ERR_BLOCKED_BY_RESPONSE.NotSameOrigin 403 (Forbidden)
   */
  private toSafeImageUrl(rawUrl: string): string {
    if (rawUrl.startsWith('https://www.artic.edu/iiif/')) {
      return `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=800&output=jpg`;
    }
    return rawUrl;
  }

  private getFallbackCatalog(query?: string): ExternalCatalogItem[] {
    const q = (query || '').trim().toLowerCase();
    const filtered = CURATED_ARTWORKS_POOL.filter((art) =>
      !q || q === 'painting'
        ? true
        : art.title.toLowerCase().includes(q) ||
          art.attributesJson.artist.toLowerCase().includes(q),
    );

    const source = filtered.length > 0 ? filtered : CURATED_ARTWORKS_POOL;

    return source.slice(0, 12).map((art) => ({
      externalId: art.externalItemId,
      title: art.title,
      description: art.description,
      imageUrl: this.toSafeImageUrl(art.imageUrl),
      attributes: art.attributesJson,
    }));
  }

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
        .filter((item: any) => Boolean(item.image_id))
        .map((item: any) => {
          const externalId = `artic-${item.id}`;
          const curated = CURATED_ARTWORKS_POOL.find(
            (c) => c.externalItemId === externalId,
          );

          const rawIiifUrl = `${iiifUrl}/${item.image_id}/full/843,/0/default.jpg`;

          return {
            externalId,
            title: item.title || curated?.title || 'Obra sem título',
            description:
              item.thumbnail?.alt_text ||
              curated?.description ||
              `${item.medium_display || 'Obra de arte'} (${
                item.date_display || 'Data desconhecida'
              })`,
            imageUrl: curated
              ? curated.imageUrl
              : this.toSafeImageUrl(rawIiifUrl),
            attributes: {
              artist:
                item.artist_title ||
                curated?.attributesJson.artist ||
                'Artista Desconhecido',
              dateDisplay:
                item.date_display ||
                curated?.attributesJson.dateDisplay ||
                'N/A',
              medium:
                item.medium_display || curated?.attributesJson.medium || 'N/A',
              origin:
                item.place_of_origin || curated?.attributesJson.origin || 'N/A',
            },
          };
        });

      const result =
        items.length > 0 ? items : this.getFallbackCatalog(query);
      this.cache.set(cacheKey, result);
      return result;
    } catch (error: any) {
      this.logger.warn(
        `API Externa instável (${error?.message}). Retornando catálogo curado.`,
      );
      return this.getFallbackCatalog(query);
    }
  }
}
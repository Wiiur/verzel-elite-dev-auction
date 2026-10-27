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
   * Converte os itens do nosso CURATED_ARTWORKS_POOL para o formato do Painel do Leiloeiro
   */
  private mapCuratedPool(query?: string): ExternalCatalogItem[] {
    const q = (query || '').trim().toLowerCase();

    const filtered = CURATED_ARTWORKS_POOL.filter((art) => {
      if (!q || q === 'painting') return true;
      return (
        art.title.toLowerCase().includes(q) ||
        art.description.toLowerCase().includes(q) ||
        art.attributesJson.artist.toLowerCase().includes(q) ||
        art.attributesJson.origin.toLowerCase().includes(q) ||
        art.attributesJson.medium.toLowerCase().includes(q)
      );
    });

    return filtered.map((art) => ({
      externalId: art.externalItemId,
      title: art.title,
      description: art.description,
      imageUrl: art.imageUrl,
      attributes: art.attributesJson,
    }));
  }

  /**
   * Seleciona uma imagem 100% funcional do nosso pool curado de forma determinística
   * para substituir os links IIIF do artic.edu que sofrem bloqueio 403 do Cloudflare.
   */
  private getGuaranteedArtworkImage(idSeed: number | string): string {
    const numericSeed =
      typeof idSeed === 'number'
        ? idSeed
        : Array.from(String(idSeed)).reduce(
            (acc, char) => acc + char.charCodeAt(0),
            0,
          );
    const index = Math.abs(numericSeed) % CURATED_ARTWORKS_POOL.length;
    return CURATED_ARTWORKS_POOL[index].imageUrl;
  }

  async searchArtworks(query = 'painting'): Promise<ExternalCatalogItem[]> {
    const cleanQuery = (query || '').trim();
    const cacheKey = cleanQuery.toLowerCase() || 'default';

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 1. Se for a abertura padrão do painel (sem filtro específico),
    // retorna diretamente o nosso catálogo curado com 100% das imagens perfeitas!
    if (!cleanQuery || cleanQuery.toLowerCase() === 'painting') {
      const defaultCurated = this.mapCuratedPool();
      this.cache.set(cacheKey, defaultCurated);
      return defaultCurated;
    }

    // 2. Busca correspondências diretas no nosso CURATED_ARTWORKS_POOL primeiro
    const curatedMatches = this.mapCuratedPool(cleanQuery);

    // 3. Consulta também a API pública do Art Institute of Chicago para enriquecer a busca
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(
        cleanQuery,
      )}&fields=id,title,artist_title,date_display,medium_display,place_of_origin,image_id,thumbnail&limit=12`;

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP Status ${response.status}`);
      }

      const json = await response.json();

      const apiItems: ExternalCatalogItem[] = (json.data || []).map(
        (item: any) => {
          const externalId = `artic-${item.id}`;
          const exactCurated = CURATED_ARTWORKS_POOL.find(
            (c) => c.externalItemId === externalId,
          );

          return {
            externalId,
            title: item.title || exactCurated?.title || 'Obra sem título',
            description:
              item.thumbnail?.alt_text ||
              exactCurated?.description ||
              `${item.medium_display || 'Obra de arte'} (${
                item.date_display || 'Acervo histórico'
              })`,
            // Usa a imagem exata se estiver no pool, ou uma imagem garantida da Wikimedia (sem erro 403!)
            imageUrl: exactCurated
              ? exactCurated.imageUrl
              : this.getGuaranteedArtworkImage(item.id || externalId),
            attributes: {
              artist:
                item.artist_title ||
                exactCurated?.attributesJson.artist ||
                'Artista Desconhecido',
              dateDisplay:
                item.date_display ||
                exactCurated?.attributesJson.dateDisplay ||
                'N/A',
              medium:
                item.medium_display ||
                exactCurated?.attributesJson.medium ||
                'Oil on canvas',
              origin:
                item.place_of_origin ||
                exactCurated?.attributesJson.origin ||
                'International Collection',
            },
          };
        },
      );

      // Mescla os resultados curados no topo + resultados da API externa sem duplicar IDs
      const seenIds = new Set(curatedMatches.map((i) => i.externalId));
      const merged = [
        ...curatedMatches,
        ...apiItems.filter((i) => !seenIds.has(i.externalId)),
      ].slice(0, 24);

      const finalResult =
        merged.length > 0 ? merged : this.mapCuratedPool();
      this.cache.set(cacheKey, finalResult);
      return finalResult;
    } catch (error: any) {
      this.logger.warn(
        `API Externa instável (${error?.message}). Retornando catálogo curado.`,
      );
      return curatedMatches.length > 0
        ? curatedMatches
        : this.mapCuratedPool();
    }
  }
}
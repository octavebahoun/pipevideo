import { staticFile } from 'remotion';

/**
 * Résout le chemin d'un média vers une URL utilisable par Remotion.
 *
 * Deux modes, choisis d'après le storyboard :
 *
 * 1. `assetBaseUrl` défini (production) — les médias vivent sur Cloudflare R2 et
 *    sont lus DIRECTEMENT par les Lambdas. Rien ne transite par le poste local,
 *    et le déploiement du site ne réuploade pas des dizaines de mégaoctets sur S3
 *    à chaque rendu.
 *
 * 2. `assetBaseUrl` absent (rendu local) — comportement historique via
 *    `staticFile`, qui résout dans public/.
 *
 * Un chemin déjà absolu (http/https) est renvoyé tel quel : un storyboard peut
 * mélanger des médias R2 et des URL externes.
 */
export function mediaUrl(relativePath: string, assetBaseUrl?: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  if (assetBaseUrl) {
    const base = assetBaseUrl.replace(/\/$/, '');
    // Les chemins du storyboard sont relatifs à public/ ; on garde les
    // sous-dossiers (ex. "sounds/sfx/swoosh.mp3").
    const clean = relativePath.replace(/^\//, '');
    return `${base}/${clean}`;
  }

  return staticFile(relativePath);
}

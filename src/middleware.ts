import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Cette instance n'a AUCUNE interface : tout passe par Telegram → n8n.
 * Il n'y a donc plus de session navigateur à vérifier — le secret partagé est
 * la seule authentification, sur toutes les routes.
 *
 * Conséquence à ne pas perdre de vue : sans `N8N_WEBHOOK_SECRET` défini, toutes
 * les routes répondent 401. C'est délibéré (échec fermé) — un déploiement sans
 * secret laisserait n'importe qui déclencher des rendus, donc louer du GPU sur
 * le compte de l'utilisateur.
 */

function estAutorise(request: NextRequest): boolean {
  const attendu = process.env.N8N_WEBHOOK_SECRET;
  if (!attendu) return false;
  return request.headers.get('x-webhook-secret') === attendu;
}

export function middleware(request: NextRequest) {
  if (estAutorise(request)) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export const config = {
  // Seules les routes API existent désormais.
  matcher: ['/api/:path*'],
};

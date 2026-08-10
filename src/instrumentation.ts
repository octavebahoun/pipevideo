export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { prisma } = await import('@/lib/db');

  // activeRenders is an in-memory Map: it is always empty right after a server
  // restart, even if a render was genuinely in progress when the process died.
  // Any video still marked RENDERING at boot has no chance of ever completing
  // (its ChildProcess and 'close' callback are gone), so it would otherwise
  // stay stuck forever. Mark those as FAILED so they're visible and re-triggerable.
  try {
    const { count } = await prisma.video.updateMany({
      where: { status: 'RENDERING' },
      data: {
        status: 'FAILED',
        progressStep: 'Échec : rendu interrompu par un redémarrage du serveur',
      },
    });

    if (count > 0) {
      console.log(`[Startup] Marked ${count} stale RENDERING video(s) as FAILED after server restart.`);
    }
  } catch (err) {
    console.error('[Startup] Failed to clean up stale RENDERING videos:', err);
  }
}

/**
 * Notification « rendu terminé » vers n8n, qui relaie vers Telegram.
 *
 * DISTINCT de `notifyN8nPublish` volontairement : celui-ci annonce qu'une vidéo
 * est prête et consultable, sans rien engager sur YouTube. Le premier tamponne
 * `publishNotifiedAt`, ce qui signifie « la publication a été demandée » — le
 * réutiliser ici marquerait comme publiées des vidéos qui ne le sont pas, et
 * la requête de rattrapage (`status COMPLETED AND publishNotifiedAt IS NULL`)
 * cesserait de les retrouver.
 *
 * Les deux étapes resteront séparées même une fois la publication automatisée :
 * la validation humaine se fait sur le message Telegram.
 */

export type NotifyPayload = {
  videoId: string;
  /** 'COMPLETED' ou 'FAILED' — le workflow n8n choisit le message selon ce champ. */
  status: 'COMPLETED' | 'FAILED';
  /** Conversation à qui répondre. Absent = vidéo créée hors Telegram. */
  telegramChatId?: string | null;
  /** Message « ✅ Lancé… » à éditer plutôt qu'empiler, si le workflow le gère. */
  telegramMessageId?: string | null;
  /** URL publique R2/S3 de la vidéo finale. Absente si status = FAILED. */
  videoUrl?: string;
  title: string;
  /** Durée totale du pipeline, pour l'afficher dans le message. */
  durationSeconds?: number;
  /** Raison de l'échec, à afficher tel quel dans Telegram. */
  error?: string;
  /** Métadonnées YouTube, pour que l'étape de publication n'ait rien à recharger. */
  youtubeMetadata?: Record<string, any>;
};

/**
 * Poste vers le webhook n8n avec relances exponentielles.
 *
 * Ne lève jamais : un échec de notification ne doit pas faire échouer un rendu
 * qui a réussi. La vidéo reste COMPLETED en base, avec son URL — récupérable
 * depuis le dashboard même si Telegram n'a rien reçu.
 */
export async function notifyN8nRender(
  webhookUrl: string,
  payload: NotifyPayload,
  attempts = 3
): Promise<{ ok: boolean; status?: number; error?: string }> {
  let lastError = '';
  let lastStatus: number | undefined;

  const secret = process.env.N8N_WEBHOOK_SECRET;

  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Même en-tête que celui exigé dans l'autre sens (middleware.ts) :
          // le workflow n8n peut ainsi refuser un appel qui ne vient pas d'ici.
          ...(secret ? { 'x-webhook-secret': secret } : {}),
        },
        body: JSON.stringify(payload),
      });
      lastStatus = res.status;
      if (res.ok) return { ok: true, status: res.status };
      lastError = `n8n a répondu ${res.status}`;
    } catch (err: any) {
      lastError = err?.message || String(err);
    }

    if (i < attempts) {
      const delay = 2000 * 2 ** (i - 1); // 2s, puis 4s
      console.warn(
        `[n8n Notify] Tentative ${i}/${attempts} échouée (${lastError}), nouvelle tentative dans ${delay / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.error(
    `[n8n Notify] Abandon après ${attempts} tentatives pour la vidéo ${payload.videoId} : ${lastError}. ` +
      `La vidéo reste consultable dans le dashboard.`
  );
  return { ok: false, status: lastStatus, error: lastError };
}

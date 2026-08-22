# 🤖 Automatisation Telegram → vidéo

Chaîne de **création** de bout en bout : un message Telegram déclenche la
rédaction du script, la génération des médias et le montage, puis renvoie
l'URL de la vidéo dans la conversation.

La **publication YouTube n'est pas branchée** : c'est volontaire. La validation
se fait à l'œil sur le message Telegram, avant d'automatiser la mise en ligne.

## 🔁 Le trajet

```
Telegram ──► n8n « Création » ──► pipevideo ──► RunPod (GPU) ──► R2
                    │                  │                          │
              accusé immédiat          │                    AWS Lambda (montage)
                                       │                          │
Telegram ◄── n8n « Rendu terminé » ◄───┴──── POST N8N_RENDER_DONE_URL
```

Deux workflows séparés, parce que le pipeline dure **20 à 40 minutes** : aucune
requête HTTP ne reste ouverte aussi longtemps. Le premier lance et rend la main,
le second est rappelé à la fin.

## 📥 Installation

### 1. Importer les deux workflows

Dans n8n : *Workflows → Import from File*.

| Fichier | Rôle |
| --- | --- |
| `workflow-creation-telegram.json` | Trigger Telegram → DeepSeek → lance le rendu |
| `workflow-rendu-termine.json` | Reçoit la fin de rendu → poste l'URL |

Chaque nœud portant `"id": "REMPLACER"` dans ses `credentials` attend d'être
raccordé à un identifiant réel — n8n le signale par un bandeau rouge.

### 2. Créer les trois identifiants n8n

**Telegram API** — le token donné par [@BotFather](https://t.me/BotFather).

**DeepSeek** — un identifiant de type *OpenAI API* :
- API Key : ta clé DeepSeek
- **Base URL : `https://api.deepseek.com`** ← à ne pas oublier, sinon les appels
  partent chez OpenAI et échouent en 401.

**Header Auth** (`x-webhook-secret pipevideo`) — pour le webhook entrant :
- Name : `x-webhook-secret`
- Value : la même valeur que `N8N_WEBHOOK_SECRET` côté pipevideo

### 3. Coller le prompt DeepSeek

Ouvrir `prompt-deepseek.md`, copier tout le *System Message*, le coller dans le
nœud **DeepSeek — rédige le storyboard** à la place du texte
« COLLER ICI… ». Il est trop long pour tenir dans le JSON d'import sans le
rendre illisible.

### 4. Variables d'environnement de n8n

| Variable | Valeur |
| --- | --- |
| `PIPEVIDEO_URL` | `https://ton-serveur-aws` (sans slash final) |
| `N8N_WEBHOOK_SECRET` | le secret partagé, identique côté pipevideo |
| `TELEGRAM_CHAT_AUTORISE` | ton chat id — **le filtre qui protège ton GPU** |

Pour trouver ton chat id : écrire au bot, puis regarder `message.chat.id` dans
l'exécution n8n.

> ⚠️ `TELEGRAM_CHAT_AUTORISE` n'est pas décoratif. Un bot Telegram est joignable
> par n'importe qui connaissant son nom. Sans ce filtre, un inconnu peut
> déclencher des rendus — donc louer du GPU sur ton compte.

### 5. Variables à ajouter dans le `.env` de pipevideo

```bash
# URL de production du webhook « Rendu terminé » (n8n te la donne dans le nœud
# Webhook). Bien prendre /webhook/ et NON /webhook-test/ : la seconde ne vit que
# pendant une exécution manuelle et renvoie 404 le reste du temps.
N8N_RENDER_DONE_URL="https://ton-n8n/webhook/pipevideo-rendu-termine"

# Générateur de médias : 'runpod' (défaut) ou 'novita'.
MEDIA_PROVIDER="runpod"

# Rendu sur AWS Lambda plutôt qu'en local — indispensable, le montage local
# saturerait le CPU du serveur.
RENDER_ON_LAMBDA="true"
```

`N8N_WEBHOOK_SECRET` existe déjà. Il sert maintenant **dans les deux sens** :
n8n s'authentifie auprès de pipevideo, et pipevideo auprès de n8n.

### 6. Activer les workflows

Les deux, avec l'interrupteur *Active*. Un workflow inactif répond **404** sur
son URL de production — c'est la cause la plus fréquente de « n8n ne reçoit
rien ».

## ✅ Vérifier sans dépenser de GPU

Tester les routes une par une, avant de lancer une vraie génération.

```bash
SECRET=$(grep '^N8N_WEBHOOK_SECRET=' .env | cut -d= -f2- | tr -d '"')

# 1. Le secret est-il exigé ? → doit répondre 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhook/telegram \
  -H 'Content-Type: application/json' -d '{"topic":"test"}'

# 2. Création d'une vidéo → renvoie un videoId
curl -s -X POST http://localhost:3000/api/webhook/telegram \
  -H 'Content-Type: application/json' -H "x-webhook-secret: $SECRET" \
  -d '{"topic":"Le silence de Dieu","chatId":123456}'

# 3. Rendu sans storyboard → doit répondre 400, PAS 401
#    (401 signifierait que le secret n'est pas accepté sur /api/render)
curl -s -X POST http://localhost:3000/api/render \
  -H 'Content-Type: application/json' -H "x-webhook-secret: $SECRET" \
  -d '{"id":"<le videoId>"}'
```

Pour tester le message Telegram final sans générer de vidéo, appeler
directement le webhook de fin :

```bash
curl -X POST "$N8N_RENDER_DONE_URL" \
  -H 'Content-Type: application/json' -H "x-webhook-secret: $SECRET" \
  -d '{"videoId":"test","status":"COMPLETED","telegramChatId":"<ton chat id>",
       "videoUrl":"https://exemple/video.mp4","title":"Essai","durationSeconds":1500}'
```

## 🧯 Quand ça ne marche pas

| Symptôme | Cause probable |
| --- | --- |
| n8n reçoit 401 de pipevideo | `N8N_WEBHOOK_SECRET` différent des deux côtés |
| pipevideo reçoit 404 de n8n | workflow non activé, ou URL `/webhook-test/` |
| DeepSeek répond 401 | Base URL absente de l'identifiant OpenAI |
| Vidéo bloquée en `DRAFT` | Zod a rejeté le storyboard — énumération inventée ou `id` en double |
| Vidéo `COMPLETED`, aucun message | `N8N_RENDER_DONE_URL` non défini, ou workflow de fin inactif |
| Aucun message après 40 min | regarder les logs serveur : le pipeline tourne peut-être encore |

Une vidéo qui échoue **garde son storyboard**. Relancer le rendu depuis le
dashboard ne repasse pas par DeepSeek — donc ne recoûte pas de tokens.

## 💸 Ce que coûte une exécution

| Poste | Coût |
| --- | --- |
| DeepSeek (≈ 65 scènes) | quelques centimes |
| RunPod GPU (~50 images + 3 clips) | **0,35 à 0,70 $** |
| AWS Lambda (montage) | ~0,10 $ |
| **Total** | **≈ 0,50 à 0,85 $** |

Le kill switch de RunPod (`armKillSwitch`, 90 min) plafonne le pire cas autour
de 1,50 $ même si le processus meurt en cours de route.

## 🔜 Ensuite

La publication YouTube, en second workflow : le bot attend une réponse
*publier* et appelle `POST /api/publish`. La route existe déjà — à brancher
seulement une fois cette chaîne validée sur plusieurs vidéos.

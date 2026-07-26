# Guide des Voix dans Pipevideo

Ce document référence les voix configurées dans l'orchestrateur TTS (`src/tts.ts`), leurs identifiants d'origine et des recommandations sur quand les utiliser selon le genre et le ton de vos vidéos.

---

## 🔀 Choisir le moteur TTS (ElevenLabs ou Edge-TTS)

Le moteur est choisi via la variable `TTS_PROVIDER` dans `.env` (voir `.env.example`) :

```bash
TTS_PROVIDER=edge         # défaut : gratuit, Edge-TTS (Microsoft), qualité correcte
TTS_PROVIDER=elevenlabs   # payant, voix les plus naturelles — toujours disponible si besoin
```

Le champ `storyboard.voice` reste le seul levier dans les deux cas, mais son vocabulaire (les noms courts acceptés) diffère selon le moteur actif — voir les deux tableaux ci-dessous. Aucun changement de code n'est nécessaire pour basculer d'un moteur à l'autre : uniquement `.env`.

---

## 🎙️ Voix Edge-TTS (`TTS_PROVIDER=edge`, défaut)

| Nom dans `storyboard.json` | Voix Edge-TTS | Genre | Idéal pour... |
| :--- | :--- | :--- | :--- |
| **`remy`** *(Défaut)* | `fr-FR-RemyMultilingualNeural` | Masculin | Multilingue, dynamique |
| **`henri`** | `fr-FR-HenriNeural` | Masculin | Voix polyvalente, ton neutre/documentaire |
| **`denise`** | `fr-FR-DeniseNeural` | Féminin | Claire, posée |
| **`eloise`** | `fr-FR-EloiseNeural` | Féminin | Douce, jeune |
| **`vivienne`** | `fr-FR-VivienneMultilingualNeural` | Féminin | Multilingue, moderne |

Si `"voice"` est omis ou non reconnu avec `TTS_PROVIDER=edge`, le système bascule sur **`remy`** par défaut. Un identifiant Edge complet (ex: `en-US-GuyNeural`) peut aussi être passé directement.

---

## 🎙️ Voix ElevenLabs (`TTS_PROVIDER=elevenlabs`)

| Nom dans `storyboard.json` | Voice ID | Genre | Ton & Style | Idéal pour... |
| :--- | :--- | :--- | :--- | :--- |
| **`george`** *(Défaut)* | `JBFqnCBsd6RMkjVDRZzb` | Masculin | Grave, captivant, ton "documentaire Arte" | Shorts faits scientifiques, mystères, récits d'action |
| **`liam`** | `EmZGlxI7QPvCEMOkFhB9` | Masculin | Dynamique, jeune, fluide, voix-off web moderne | Storytelling court, TikTok / Reels dynamiques, crypto/tech |
| **`antoni`** | `ErXwobaYiN019PkySvjV` | Masculin | Chaleureux, posé, narratif passionné | Essais 16:9, documentaires historiques, récits intimes |
| **`anais`** | `5OnMHwgTFgvPVwE8jP6B` | Féminin | Expressive, claire, engageante | Sujets éducatifs, récits de vie, storytelling captivant |
| **`rachel`** | `or4EV8aZq78KWcXw48wd` | Féminin | Douce, naturelle, professionnelle | Documentaires nature, vidéos contemplatives, essais apaisants |

---

## 💡 Comment Configurer une Voix dans un Storyboard

Dans votre fichier `storyboard.json`, vous pouvez indiquer directement le nom court de la voix ou n'importe quel `voiceId` d'ElevenLabs :

```json
{
  "title": "Mon Nouveau Short",
  "voice": "liam",
  "scenes": [...]
}
```

Si le champ `"voice"` est omis, ou si son nom n'est pas reconnu (ex: un nom ElevenLabs comme `george` alors que `TTS_PROVIDER=edge`, le défaut), le système bascule automatiquement sur la voix **`remy`** (Edge-TTS) ou **`george`** (ElevenLabs), selon le moteur actif.

---

## ⚙️ Modèle & Timestamps Karaoké

* **ElevenLabs** : moteur `eleven_multilingual_v2`, méthode `convertWithTimestamps`. Intonation et accent français très naturels.
* **Edge-TTS** : timestamps mot-à-mot capturés via les événements `WordBoundary` du flux Edge (gratuit, qualité correcte, légèrement plus robotique qu'ElevenLabs).

Dans les deux cas, les horodatages au mot près (`scene.words`) sont recalculés automatiquement à chaque exécution de `npm run tts`, et la durée réelle (`scene.durationInSeconds`) est mesurée sur le fichier audio généré.

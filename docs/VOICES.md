# Guide des Voix ElevenLabs dans Pipevideo

Ce document référence les voix configurées dans l'orchestrateur TTS (`src/tts.ts`), leurs identifiants d'origine et des recommandations sur quand les utiliser selon le genre et le ton de vos vidéos.

---

## 🎙️ Liste des Voix Configurées

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

Si le champ `"voice"` est omis ou si une ancienne voix Edge-TTS (comme `fr-FR-HenriNeural`) est présente, le système bascule automatiquement sur la voix **`george`** par défaut.

---

## ⚙️ Modèle & Timestamps Karaoké

Toutes ces voix utilisent le moteur **`eleven_multilingual_v2`** couplé à la méthode `convertWithTimestamps`.
* **Rendu naturel** : L'intonation et l'accent français sont restitués naturellement sans effet robotique.
* **Karaoké instantané** : Les horodatages au mot près (`scene.words`) sont recalculés automatiquement à chaque exécution de `npm run tts`.

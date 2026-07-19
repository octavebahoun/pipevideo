# 🎧 Bibliothèque de sons (bruitages · ambiances · musiques)

Réserve **réutilisable** de sons pour habiller les vidéos : bruitages/SFX, nappes
d'ambiance et musiques. Elle est **partagée entre tous les projets** et **n'est jamais
effacée** par l'archivage (`npm run new-video`), contrairement aux médias de scène.

## 📁 Organisation

```
public/sounds/
├── README.md        ← ce fichier
├── _TEMPLATE.md     ← modèle à copier pour décrire un nouveau son
├── CATALOG.md       ← index généré par `npm run sounds` (NE PAS éditer à la main)
├── music/           ← musiques (nappes, piano, lofi, drones longs…)
├── sfx/             ← bruitages courts (glitch, boum, whoosh, clic, notif…)
└── ambient/         ← ambiances/textures longues et bouclables (pluie, ville, vent…)
```

## 📝 Convention : 1 son = 1 audio + 1 `.md` du MÊME nom

Chaque son est décrit par un fichier Markdown **portant le même nom** que l'audio :

```
sfx/heartbeat-slow.mp3   ← le son
sfx/heartbeat-slow.md    ← sa fiche (copiée depuis _TEMPLATE.md)
```

Le front-matter de la fiche (voir `_TEMPLATE.md`) contient : `type`, `duration`,
`loopable`, `mood`, `tags`, `usage`. Le corps décrit **quand** utiliser le son.
C'est cette fiche qui permet à l'agent de choisir le bon son sans écouter.

## 🔄 Ajouter un son

1. Déposer le fichier audio dans `music/`, `sfx/` ou `ambient/`.
2. Copier `_TEMPLATE.md` à côté, au même nom, et remplir la fiche.
3. Régénérer l'index :
   ```bash
   npm run sounds
   ```
   → met à jour `CATALOG.md` (tableau récap de tous les sons disponibles).

## 🎬 Utiliser un son dans une scène (storyboard.json)

Ajouter un tableau `sounds` à la scène. Le champ `src` est **relatif à `public/`**
(copie-le depuis la colonne `src` de `CATALOG.md`) :

```json
{
  "id": 3,
  "narration": "...",
  "mediaPath": "scene_3.mp4",
  "sounds": [
    { "src": "sounds/sfx/heartbeat-slow.mp3", "volume": 0.5, "loop": true, "fadeInSeconds": 1 },
    { "src": "sounds/sfx/glitch-hit.mp3", "volume": 0.7, "startInSeconds": 2.4 }
  ]
}
```

Champs d'un son de scène :

| Champ            | Défaut | Rôle                                                        |
| ---------------- | ------ | ----------------------------------------------------------- |
| `src`            | —      | Chemin dans `public/` (ex: `sounds/sfx/boum.mp3`). Requis.   |
| `volume`         | `0.6`  | Volume 0→1.                                                 |
| `startInSeconds` | `0`    | Décalage de démarrage, relatif au début de la scène.        |
| `loop`           | `false`| Boucler jusqu'à la fin de la scène (ambiances, drones).     |
| `fadeInSeconds`  | `0`    | Fondu d'entrée (montée).                                     |
| `fadeOutSeconds` | `0`    | Fondu de sortie (descente).                                 |

> La **voix off** reste gérée à part (Edge-TTS ou fichier fourni). `sounds` vient
> **par-dessus**. Pour une musique de fond unique sur TOUTE la vidéo, utiliser
> plutôt le champ global `music` du storyboard.

## 💡 Sons recommandés à constituer (ex. essai psychologique / anime sombre)

À sourcer puis décrire (les fiches guideront l'agent). Suggestions :

- **music/** : `synth-drone-dark` (nappe sombre bouclable), `piano-melancolique`,
  `lofi-nostalgique`, `guitare-acoustique-douce`, `piano-espoir`.
- **sfx/** : `heartbeat-slow` (battement sourd), `glitch-hit`, `riser-tension`
  (montée), `boum-impact`, `whoosh-transition`, `notification-scroll`,
  `verre-brise` (miroir qui éclate), `clic-souris`, `papier-froisse`.
- **ambient/** : `pluie-ville` (bouclable), `bourdonnement-neon`,
  `vent-rideaux`, `silence-textured` (fond « presque muet » oppressant).

> Je ne peux pas générer les fichiers audio moi-même : dépose-les (ou fais-les
> générer), ajoute une fiche `.md`, puis lance `npm run sounds`.

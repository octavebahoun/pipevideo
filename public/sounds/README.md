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
`loopable`, `mood`, `tags`, `usage`, et — pour la musique/le rythme — `key` (tonalité),
`bpm`, et `peaks` (secondes des pics d'impact, pour **caler un effet visuel** sur un
temps fort). Le corps décrit **quand** utiliser le son. C'est cette fiche qui permet à
l'agent de choisir le bon son sans écouter.

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

## 🗂️ Traçabilité à l'archivage (IMPORTANT pour l'agent)

Quand une vidéo est archivée (`npm run new-video` / `npm run archive`), les fichiers
audio de la bibliothèque **ne sont PAS copiés** dans `history/` (ils restent partagés
ici). À la place, la liste des sons utilisés — musique globale + `sounds` de chaque
scène — est consignée en **noms seuls** dans `history/<projet>/sounds-used.md`.
→ Conséquence : pour re-rendre une vidéo archivée, ses sons doivent toujours être
présents dans `public/sounds/`. Ne pas renommer/supprimer un son encore référencé.

## 💡 Choisir un son

La bibliothèque est déjà fournie — parcourir `CATALOG.md` (régénéré par `npm run sounds`),
qui liste chaque son avec `type`, `mood`, `usage`, `key`/`bpm` et `peaks` :
- **music/** : nappes cinématiques, vaporwave/planant, acoustique mélancolique…
- **sfx/** : pas, chocs, swoosh/transitions, jumpscare, actions du quotidien…
- **ambient/** : pluie, usine, campagne, arcade, tempête, souterrain…

Filtrer par `type` + `mood` + `usage`, et se servir des `peaks` d'un son pour
synchroniser un effet visuel (cut, flash, zoom) sur un impact précis.

> Pour AJOUTER un son : je ne génère pas les fichiers audio moi-même — dépose l'audio,
> ajoute une fiche `.md` (copie `_TEMPLATE.md`), puis lance `npm run sounds`.

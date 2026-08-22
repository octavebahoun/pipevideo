# 🙏 Sourcer les sons pour le contenu chrétien

Guide d'admission des nouveaux audio sur la branche `feat/contenu-chretien`.
Le format visé — méditation de **15 à 25 minutes**, voix off grave posée sur des
images fixes — impose des contraintes très différentes de l'essai documentaire
pour lequel la bibliothèque d'origine avait été constituée.

## 📁 Où déposer

```
public/sounds/
├── music/sacred/     ← nappes longues (le gros du besoin)
├── ambient/sacred/   ← textures de lieu (église, vent, cloches lointaines)
└── sfx/sacred/       ← ponctuations discrètes (harpe, page, chœur bref)
```

Les sons génériques restés à la racine de `music/`, `ambient/` et `sfx/` sont
toujours utilisables : `leberch-cinematic-space.mp3` sert déjà de nappe par défaut.

## ✅ Critères d'admission — musique

| Critère | Seuil | Pourquoi |
| --- | --- | --- |
| **Durée** | **> 4 min**, idéalement 6-8 | Sur 20 min de vidéo, un morceau de 30 s boucle 40 fois : l'oreille repère la couture et décroche. |
| **Dynamique** | plate, sans crescendo | La musique passe à `musicVolume: 0.10`, très bas. Un morceau qui monte de 20 dB noie la voix off au pire moment. |
| **Percussion** | aucune marquée | Un kick ou une caisse claire donne un tempo à un contenu qui doit respirer sans rythme. |
| **Boucle** | `loopable: true` de préférence | Une fin franche interdit de prolonger le morceau sur une scène plus longue que prévu. |
| **Tonalité** | mineure douce, ou modal | Le majeur triomphant convient à une fin de vidéo, rarement au corps d'une méditation. |

**À fuir** : les morceaux « epic cinematic » et « inspirational corporate » —
construits pour un climax à 1 min 30, exactement l'inverse du besoin.

**À chercher, mots-clés qui donnent de bons résultats** :
`ambient pad`, `drone`, `sacred`, `contemplative`, `hymn instrumental`,
`piano reverb slow`, `strings sustained`, `choir pad`, `worship background`.

## ✅ Critères d'admission — ambiances

Durée > 2 min et **bouclable proprement**. Ce sont des textures posées très bas
(`volume` 0.15-0.25) pour donner un lieu à la scène :

- intérieur d'église, réverbération de pierre
- cloches lointaines, carillon estompé
- vent sur une plaine, souffle d'air
- pluie sur une vitre (déjà couvert par `ambient/rain-water-dripping-fast.mp3`)

## ✅ Critères d'admission — SFX

Courts (< 4 s), **jamais agressifs**. Un seul par scène au maximum, sur un mot
fort. Ce qui marche : glissando de harpe, page de Bible qui tourne, note de cloche
unique, souffle de chœur, tintement discret.

## 📝 Procédure pour chaque fichier

1. Déposer l'audio dans le `sacred/` du bon type.
2. Copier `_TEMPLATE.md` à côté, **au même nom**, et remplir le front-matter.
   Le champ `usage` est le plus important : c'est lui qui permet de choisir un son
   sans le réécouter (ex. « sous une lecture de psaume », « sur le silence avant
   une révélation », « sur la prière finale »).
3. Régénérer l'index :
   ```bash
   npm run sounds
   ```
4. Pousser vers R2 pour que Lambda y accède :
   ```bash
   npm run sync:r2
   ```

## ⚠️ Deux pièges à connaître

**Les `.mp3` ne sont pas dans git** (`.gitignore` ligne 23 : `public/sounds/**/*.mp3`).
Seules les fiches `.md` sont versionnées. Cloner la branche sur le serveur AWS ne
ramènera donc **aucun audio** — les fichiers transitent par R2 via `npm run sync:r2`.
Prévoir de les y uploader avant le premier rendu distant.

**Ne jamais renommer ni supprimer un son encore référencé** par une vidéo archivée :
`history/<projet>/sounds-used.md` ne consigne que des noms, pas les fichiers.

## 📜 Licences

Noter la source dans le corps de la fiche `.md`. Pixabay et la YouTube Audio
Library sont utilisables sans attribution obligatoire, mais certains morceaux de
la seconde exigent un crédit — la mention figure sur la page de téléchargement.
Consigner alors le texte exact d'attribution, il devra apparaître dans la
description YouTube.

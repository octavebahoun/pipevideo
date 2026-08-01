# Transitions vidéo

8 types de transitions gérés dans le projet.

## Types

| Type | Durée | Description | Implémentation |
|------|-------|-------------|----------------|
| `fade` | 15 frames | Fondu croisé standard | `@remotion/transitions/fade` |
| `slide` | 15 frames | Glissement gauche/droite | `@remotion/transitions/slide` (`direction: 'from-right'`) |
| `wipe` | 20 frames | Volet vertical balayant l'écran | `@remotion/transitions/wipe` |
| `black` | 26 frames | Fondu au noir : sortant s'assombrit (1ʳᵉ moitié), entrant émerge du noir (2ᵉ moitié) | `transitions.tsx` — `fadeThroughBlack()` |
| `zoomPunch` | 18 frames | Sortant zoome vers le centre (scale 1→1.5), entrant démarre dézoomé (scale 1.5→1). Effet « coup » des edits musicaux | `transitions.tsx` — `zoomPunch()` |
| `whipPan` | 20 frames | Glissement avec flou horizontal (blur) qui culmine à mi-parcours, simulant un motion blur directionnel | `transitions.tsx` — `whipPan()` |
| `glitchCut` | 8 frames | Sortant se déforme (décalage RGB + bandes déplacées aléatoirement), entrant apparaît avec flash blanc. Très court, cut stylisé | `transitions.tsx` — `glitchCut()` |
| `particleDissolve` | 40 frames | La scène sortante se dissout en un nuage de particules lumineuses qui scintillent et se dispersent, puis converge et se recompose en la scène entrante. Transition douce et « propre » | `transitions.tsx` — `particleDissolve()` |
| `none` | 0 frames | Cut sec | — |

## Fonctionnement

- La transition est définie par scène via `scene.effects.transition` dans `storyboard.json`.
- Valeur par défaut : `fade`.
- Les transitions sont appliquées **avant** chaque scène (sauf la première, `index === 0` → pas de transition entrante).
- Elles chevauchent les scènes adjacentes grâce au composant `TransitionSeries` de `@remotion/transitions`.

## `matchCut`

Ajoute `"matchCut": true` dans `scene.effects` pour contraindre l'étape « Pause Média » **uniquement** (sans impact sur le rendu) :

```json
{
  "effects": {
    "transition": "zoomPunch",
    "matchCut": true
  }
}
```

Quand ce flag est vrai, le média de la scène doit racorcher avec la fin de la précédente (même composition, posture du sujet, etc.).

## Code clé

- **Sélection** : `Main.tsx:22-34` — `presentationForScene()` retourne la bonne présentation.
- **Durée** : `types.ts:175-191` — `transitionDurationFrames()` associe chaque type à sa durée.
- **Implémentations custom** : `transitions.tsx`
  - `FadeThroughBlack` (l. 19-37) — opacité en deux temps
  - `ZoomPunch` (l. 46-65) — scale 1→1.5 / 1.5→1
  - `WhipPan` (l. 73-97) — translateX + blur sinusoïdal
  - `GlitchCut` (l. 105-175) — RGB split + bandes clip-path + flash blanc entrant
  - `ParticleDissolve` (l. 230+) — 100 particules avec scatter, scintillement, et recomposition

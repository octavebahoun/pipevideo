# 🎬 Guide 2 — Créer ta première vraie vidéo, de zéro jusqu'au rendu

Ce guide suppose que `docs/GUIDE_INSTALLATION.md` est déjà validé (dépendances installées, `.env` configuré, premier rendu de test réussi sur AWS Lambda). On passe maintenant à une vraie vidéo, sur ton créneau : nature, plantes, insectes, paysages.

Tout le détail des règles créatives et techniques est dans **`.agents/skills/content-factory-nature/SKILL.md`** — ce guide en est le mode d'emploi pas à pas. Un projet d'exemple complet (script + prompts + storyboard) sur "le vol de la graine de pissenlit" est déjà présent dans le dépôt : regarde-le comme modèle avant de te lancer.

---

## Option A — Tu peux tout faire toi-même, étape par étape

### 1. Démarrer un nouveau projet propre
```bash
npm run new-video "Ton sujet (ex: Comment une fleur carnivore digère un insecte)"
```
Ça archive le projet d'exemple dans `history/` et crée un `storyboard.json` vierge avec ton titre.

### 2. Écrire le script
Dans `storyboard.json`, remplis `narration` pour chaque scène en suivant les règles du skill `content-factory-nature` (hook calme, curiosity gap, métaphore sensorielle, micro-fait au milieu, fin en boucle — voir le skill pour le détail et l'exemple du pissenlit). Écris aussi la version texte complète dans `script_voiceover.md`.

Ton et registre : calme, posé, sensoriel — pas de "FAUX" agressif, pas de vocabulaire militaire/HUD (ce n'est pas ce créneau).

### 3. Choisir vidéo ou image par scène
Vidéo par défaut (mouvement = profondeur). Image fixe pour les plans volontairement statiques (paysage figé, pause contemplative avant la fin). Voir le skill, section "Choix vidéo/image".

### 4. Écrire les prompts médias
Dans `media-prompts.md`, un prompt par scène avec le gabarit du skill (plan précis + ambiance sonore embarquée à décrire). Exemple dans le fichier déjà présent.

### 5. Générer les médias et les déposer
Génère les vidéos/images avec ton outil IA (Kling ou autre) à partir des prompts, puis dépose les fichiers dans `public/` (`scene_1.mp4`, `scene_2.jpg`, etc. — vérifie que `mediaPath` dans `storyboard.json` pointe bien dessus).

### 6. Générer la voix off
```bash
npm run tts
```
Voix Edge-TTS par défaut (`henri`), gratuite. Ça mesure aussi la durée réelle de chaque scène et capture les timings pour les sous-titres.

### 7. (Optionnel mais recommandé) Musique de fond calme
Si tu as un morceau calme à ajouter, dépose-le dans `public/sounds/music/` et référence-le dans le champ global `music` du storyboard (`musicVolume` bas, ≈ 0.15–0.25). Voir le skill pour le détail.

### 8. Vérifier les durées médias
```bash
npm run check-video
```
Compare la durée réelle de chaque clip à la durée requise par la voix off, et corrige automatiquement (`playbackRate`) si un clip est trop court.

### 9. Rendre la vidéo
```bash
npm run render          # en local
npm run render:lambda   # sur AWS (cloud, comme ton test du Guide 1)
```

### 10. Rédiger les métadonnées de publication
Remplis `metadata.md` (titres, description, hashtags, conseil miniature) avant de publier.

---

## Option B — Laisser ton agent IA tout dérouler pour toi

Tu peux aussi simplement dire à ton agent (Claude) :

> **"Crée une nouvelle vidéo sur [ton sujet]."**

L'agent va lire automatiquement le skill `content-factory-nature` et dérouler seul les étapes 1 à 4 et 6 à 10 ci-dessus (nouveau projet, script, storyboard, prompts médias, voix off, vérification des durées, rendu, métadonnées). Il te présentera le script et les prompts médias pour validation avant de continuer.

⚠️ La seule étape qu'un agent ne peut pas faire à ta place : **générer les vidéos/images avec l'outil IA (Kling, etc.) et les déposer dans `public/`** (étape 5) — ça reste à toi, l'agent te donnera les prompts précis à utiliser puis attendra que les fichiers soient déposés pour continuer (`npm run check-video` puis le rendu).

# 🛠️ Guide 1 — Installation & premier rendu distant (AWS Lambda)

Ce guide t'emmène de zéro (dépôt pas encore cloné) jusqu'à une **configuration AWS Lambda opérationnelle** — sans encore créer de vraie vidéo. L'objectif est de vérifier que toute la mécanique technique (dépendances, `.env`, AWS) fonctionne, sur la **même configuration que le compte principal** (même compte AWS, même fonction Lambda déjà déployée, même bucket S3).

Pour créer ta vraie première vidéo une fois cette étape validée, passe à `docs/GUIDE_PREMIERE_VIDEO.md`.

---

## 1. Prérequis

- **Node.js** (version 18+) et **npm** installés.
- **Git** installé.
- Une **clé d'accès AWS** (Access Key ID + Secret Access Key) — tu l'as déjà, puisqu'on utilise le **même compte AWS** que moi. Rien à créer de ton côté sur AWS : le compte, la fonction Lambda et le bucket S3 sont **déjà en place et partagés**.

## 2. Cloner le dépôt et se placer sur la branche `yannick`

```bash
git clone <URL du dépôt> pipevideo
cd pipevideo
git checkout yannick
```

## 3. Installer les dépendances

```bash
npm install
```

## 4. Configurer `.env`

Copie le fichier d'exemple puis édite-le :

```bash
cp .env.example .env
```

Champs à connaître (`.env` n'est jamais commité, chacun a le sien) :

```bash
# Moteur TTS : "edge" est déjà le défaut de cette branche (gratuit, voix "henri" par défaut).
# Tu peux laisser cette ligne telle quelle, ou la retirer entièrement.
TTS_PROVIDER=edge

# Pas besoin de clé ElevenLabs tant que tu restes sur Edge-TTS (gratuit).
ELEVENLABS_API_KEY=

# Laisse "false" : Remotion télécharge et gère lui-même son Chromium headless.
CHROME_EXECUTABLE_PATH=false

# Région AWS où la fonction Lambda partagée est déployée — garde EXACTEMENT la même
# région que moi, sinon `npm run render:lambda` ne trouvera pas la fonction.
REMOTION_AWS_REGION=us-east-1
```

## 5. Installer AWS CLI

- **Termux (Android)** : `pkg install python && pip install awscli`
- **Linux (Debian/Ubuntu)** : `sudo apt install awscli` (ou suis la doc officielle AWS si la version du dépôt est trop ancienne)
- **macOS** : `brew install awscli`
- **Windows** : installeur officiel AWS CLI v2

Vérifie l'installation :
```bash
aws --version
```

## 6. Configurer AWS CLI avec ta clé d'accès (déjà créée, compte partagé)

```bash
aws configure
```

Il va te demander 4 choses — tu as déjà tout, puisqu'on est sur le même compte AWS :
```
AWS Access Key ID [None]: <ta Access Key ID>
AWS Secret Access Key [None]: <ta Secret Access Key>
Default region name [None]: us-east-1
Default output format [None]: json
```

⚠️ **Ne crée rien de nouveau côté AWS** (pas de nouvelle fonction Lambda, pas de nouveau bucket) : tout est déjà déployé sur ce compte partagé, `aws configure` sert uniquement à connecter TA machine à CE compte.

## 7. Vérifier que la connexion AWS fonctionne

```bash
aws sts get-caller-identity
```
Ça doit renvoyer ton `Account`, `UserId` et `Arn` sans erreur. Si tu as une erreur `Unable to locate credentials`, relance `aws configure` et revérifie les valeurs saisies.

Vérifie aussi que la fonction Lambda partagée est bien visible depuis ta machine :
```bash
npx remotion lambda functions ls
```
Tu dois voir apparaître une fonction existante — **ne lance PAS** `npx remotion lambda functions deploy` toi-même (en redéployer une nouvelle par erreur créerait une fonction en double et des coûts inutiles). Si tu vois une erreur "Aucune fonction Lambda compatible", c'est presque toujours soit la région (`REMOTION_AWS_REGION`, étape 4), soit une version Remotion différente entre `package.json` et la fonction déployée — dans les deux cas, préviens plutôt que de déployer toi-même.

⚠️ **Versions Remotion figées, pas de `^`** : `package.json` épingle `@remotion/*` sur une version exacte (pas de plage `^x.y.z`), pour que ton install corresponde TOUJOURS exactement à la version embarquée dans la fonction Lambda partagée (`compatibleOnly: true` exige une correspondance stricte). Ne touche pas ces versions toi-même, même pour les mettre à jour — un décalage, même mineur (ex: `4.0.491` vs `4.0.498`), rend la fonction invisible pour `npm run render:lambda`.

## 8. Premier rendu distant

```bash
npm run tts
npm run render:lambda
```

Le `storyboard.json` présent dans le dépôt est l'exemple "le vol de la graine de pissenlit" (voir `docs/GUIDE_PREMIERE_VIDEO.md`) — il référence des fichiers médias (`scene_1.mp4`, etc.) qui ne sont pas encore dans `public/`, puisque personne ne les a générés. C'est **normal et attendu** que `npm run render:lambda` échoue à ce stade avec une erreur du type *"Assets référencés introuvables dans public/"* : ça confirme que la chaîne AWS (S3 + Lambda) est atteinte et fonctionne — il ne manque que les médias, pas la configuration.

- Erreur `Aucune fonction Lambda compatible` → vérifie `REMOTION_AWS_REGION` dans `.env` (doit correspondre exactement à la région où la fonction partagée est déployée), et vérifie que ton `npm install` a bien pris les versions exactes de `package.json` (`npx remotion versions` pour voir ce qui est réellement résolu).
- Erreur de credentials → revérifie `aws configure` (étape 6).
- Erreur "Assets référencés introuvables dans public/" → normal à ce stade (voir ci-dessus), pas un bug de configuration.

## 9. Étape suivante

Passe à **`docs/GUIDE_PREMIERE_VIDEO.md`** pour déposer de vrais médias et créer ta vraie première vidéo, du sujet jusqu'au rendu.

# 📝 Décision Technique : Pipeline d'Automatisation Vidéo

Ce document officialise les choix d'architecture et de modèle pour l'automatisation complète de la production et de la publication vidéo.

## 🏗️ Architecture Retenue

*   **n8n** : Orchestrateur central et planification (Cron).
*   **LLM** : Rédaction des scénarios, génération des invites (prompts) et structuration du `storyboard.json`.
*   **FLUX (API Image)** : Génération des images clés et illustrations haute fidélité.
*   **Seedance 1.5 Pro (via Novita AI)** : Génération des séquences vidéo 720p avec mouvement fluide.
*   **Remotion** : Assemblage, synchronisation voix/vidéo, effets (Ken Burns, tremblements), transitions et sous-titres animés.
*   **AWS Lambda** : Rendu serverless hautement parallélisé.
*   **YouTube Data API v3** : Publication et planification automatique.

---

## 🎥 Choix et Stratégie Vidéo

### Spécifications Novita AI (Seedance 1.5 Pro)
*   **Résolution** : 720p (idéal pour le format vertical 9:16 après recadrage ou format horizontal).
*   **Tarif indicatif** : ~0,026 $/seconde de vidéo générée.
*   **Coût estimé** : ~$3,12 pour 2 minutes d'animation continue (hors audio).

### 💡 Stratégie d'Optimisation des Coûts et de l'Engagement
Pour maximiser l'impact visuel tout en maintenant les coûts bas (~1$ à 1.5$ par vidéo), la pipeline utilisera une **approche hybride** :
1.  **Séquences Vidéo (Seedance)** : Réservées uniquement aux moments clés exigeant du mouvement complexe (ex: actions dynamiques, révélations).
2.  **Images animées (FLUX + Remotion)** : Pour les scènes narratives plus calmes, utilisation d'images de haute qualité animées dans Remotion via des zooms lents (effet Ken Burns), des filtres et des tremblements de caméra subtils.
3.  **Audio Séparé** : Synthèse vocale générée indépendamment pour optimiser le coût global et garantir une parfaite synchronisation des sous-titres.

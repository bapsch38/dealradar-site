# DealRadar — catalogue web

Catalogue statique des offres détectées par le dépôt privé `bapsch38/dealradar`.

## Fonctions disponibles

- **Sélection personnalisée** : choisis les catégories pour construire une sélection « Pour toi, aujourd'hui ».
- **Favoris** : conserve des offres dans le stockage local de ce navigateur.
- **Objectifs de prix** : définis un seuil par offre. La page vérifie le flux environ toutes les cinq minutes lorsqu'elle est visible et peut afficher une notification navigateur.
- **Indice de confiance indicatif** : estimation fondée sur les données disponibles (prix vérifié, cohérence des prix, historique, fraîcheur et source). Ce n'est ni une garantie ni une certification.
- **Historique des prix** : graphique affiché uniquement lorsque plusieurs observations sont présentes dans le flux.
- **Retours communautaires** : les liens d'une offre ouvrent un brouillon public GitHub pour signaler un prix correct, douteux, une offre expirée, une catégorie ou un lien incorrect. Il faut soumettre le brouillon pour publier le retour ; un compte GitHub est requis. Les retours sont triés automatiquement pour modération.

## Limites importantes

- Les favoris, préférences et objectifs de prix sont enregistrés **dans le navigateur et sur cet appareil** : ils ne se synchronisent pas entre appareils.
- Les objectifs de prix ne sont pas surveillés quand la page est fermée ; il s'agit de notifications locales, pas d'alertes serveur. Pour des alertes continues, utiliser le bot Telegram et ses préférences privées.
- Les retours GitHub sont publics. Ne pas y inclure d'informations personnelles.
- Le score de confiance est une heuristique, pas une preuve que le prix ou le stock est exact.
- Les offres, prix, images et historiques dépendent des informations disponibles dans le flux automatisé. Toujours vérifier la disponibilité et le prix final chez le marchand.

## Développement

Le fichier `features.js` contient les fonctionnalités côté navigateur. Le workflow `.github/workflows/check-site.yml` vérifie sa syntaxe et la présence des composants principaux. Les retours communautaires utilisent le modèle `.github/ISSUE_TEMPLATE/deal-feedback.md`.


## Compatibilité AliExpress

Le catalogue accepte les offres AliExpress via le même schéma `offers.json` que les autres sources : `title`, `url`, `price`, `reference_price`, `discount_percent`, `source` et `image_url`. L'interface affiche le nom de source reçu dynamiquement et ne nécessite pas de code spécifique par marchand. Le moteur doit laisser les prix absents lorsqu'ils ne sont pas fournis par une source fiable; aucune valeur ne doit être reconstituée ou inventée côté site.

# Monétisation DealRadar — état et mise en service

## Règle Pro côté interface
- Seuil initial : réduction **strictement supérieure à 40 %**.
- Une offre n'est verrouillée dans l'interface que si `price_verified === true` ET `reference_price_verified === true`, avec prix actuel et prix de référence exploitables.
- Les visiteurs non connectés et comptes gratuits voient le visuel et le verrou ; le clic renvoie vers `compte.html#pro-plan`.
- Les comptes dont l'API renvoie `plan: pro`, `premium` ou `admin` ne voient ni le verrou ni les emplacements publicitaires.

## Publicités
Le fichier `monetisation.js` prépare deux emplacements (haut de page et avant la grille d'offres). Ils restent désactivés tant que l'identifiant éditeur et les identifiants d'emplacements AdSense ne sont pas configurés. L'identifiant éditeur est actuellement vide exprès : aucune publicité n'est chargée et aucun revenu n'est généré.

Avant activation :
1. Créer et faire accepter le site dans un compte Google AdSense.
2. Configurer un CMP certifié compatible avec les exigences Google/TCF pour les visiteurs de l'EEE, et vérifier le refus aussi facilement que l'acceptation.
3. Renseigner l'identifiant éditeur et les identifiants de blocs publicitaires dans `monetisation.js`.
4. Tester les annonces sur le site publié, et vérifier qu'elles sont absentes pour les comptes Pro.

## Limite de sécurité importante
Le catalogue actuel est publié dans le fichier statique `offers.json`. Le verrouillage ajouté est donc **une restriction d'interface, pas encore un paywall sécurisé** : un utilisateur technique pourrait récupérer le JSON public et retrouver les informations. Avant de vendre Pro ou de promettre l'exclusivité des offres, déplacer les données sensibles des offres Pro derrière une route API authentifiée qui renvoie les détails complets uniquement au plan Pro, et ne publier dans le JSON statique que les champs autorisés (visuel/aperçu). Ne pas considérer la fonction comme prête pour la commercialisation tant que cette étape n'est pas terminée.

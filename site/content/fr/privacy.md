# Politique de confidentialité

*Dernière mise à jour : 7 novembre 2026*

Pavurio est une application de suivi des soins pour animaux. Cette politique explique ce que l'app conserve, où, et comment le supprimer. En bref : **les données de vos animaux restent sur votre téléphone, une copie de sauvegarde est conservée dans votre compte Pavurio pour pouvoir la restaurer, et nous ne vendons aucune donnée ni n'affichons de publicité.**

## Ce que Pavurio conserve

**Ce que vous saisissez.** Vos animaux (nom, espèce, apparence, anniversaire, date d'adoption), les soins que vous notez, les routines et rappels, les rendez-vous vétérinaires, les poids, les dossiers de santé, les moments (titres et légendes) et les réglages.

- Ces données sont enregistrées **sur votre téléphone**.
- Une **copie de sauvegarde** est conservée dans votre compte Pavurio (Google Firebase Cloud Firestore), pour les retrouver après un changement ou une réinitialisation de téléphone. Elle est liée à votre compte et lisible par vous seul.

**Les photos et pièces jointes** ajoutées aux dossiers et aux souvenirs sont enregistrées sur votre téléphone, et une **copie de sauvegarde** est conservée dans votre compte Pavurio (Google Firebase Cloud Storage) pour les retrouver avec le reste de vos données sur un nouveau téléphone. Elles sont liées à votre compte, lisibles par vous seul et ne sont partagées avec personne.

**Votre compte (Firebase Authentication).**

- Chaque installation reçoit automatiquement un identifiant aléatoire, pour que vos données soient sauvegardées dès le début.
- Si vous enregistrez votre compte, nous conservons aussi **l'adresse e-mail** de l'identifiant choisi : Google, Se connecter avec Apple, ou e-mail et mot de passe.
- Une adresse utilisée avec un mot de passe est confirmée par un code à 6 chiffres envoyé par e-mail. Le code n'est conservé que sous forme chiffrée (hachée) et expire au bout de 10 minutes. La réinitialisation du mot de passe fonctionne de la même façon.
- Avec Apple, vous pouvez masquer votre e-mail ; Apple nous transmet alors une adresse relais privée.
- Nous ne demandons pas votre nom.

**Rapports de plantage (Firebase Crashlytics).**

- Si l'app plante, un rapport technique est envoyé : modèle d'appareil, versions du système et de l'app, et ce que faisait l'app.
- Il est lié à l'identifiant aléatoire, jamais aux données de vos animaux.
- Vous pouvez le désactiver dans **Réglages → Compte → Envoyer les rapports de plantage**.

**Statistiques d'utilisation (Firebase Analytics).**

- Pour savoir quels écrans et quelles étapes sont utilisés (par exemple, combien de personnes terminent la configuration), l'app envoie des événements d'utilisation anonymes : nom de l'écran, type de soin noté, tranche d'âge et taille choisies pour le programme.
- Jamais le nom de votre animal, ses photos, vos notes ni aucun texte libre, et aucun identifiant publicitaire.
- Vous pouvez le désactiver dans **Réglages → Aider à améliorer Pavurio**.

**Achats.**

- Pavurio Pro s'achète via l'App Store ou Google Play ; nous ne voyons jamais vos moyens de paiement.
- Pour savoir si Pro est actif, nous utilisons **RevenueCat**, qui reçoit votre identifiant aléatoire et vos reçus d'achat.

**E-mails de notre part.**

- Nous envoyons les e-mails liés au compte : codes de connexion et de réinitialisation.
- Nous envoyons des conseils et nouveautés **seulement si vous cochez la case** à la création du compte. Chaque newsletter contient un lien de désinscription en un clic.
- Les e-mails sont envoyés via **Resend**, qui reçoit votre adresse et le message.

**Notifications.** Les rappels sont programmés sur votre téléphone ; aucun contenu ne nous est envoyé.

## Ce que Pavurio ne fait pas

- Pas de publicité ni de SDK publicitaire.
- Aucune vente ni partage de données personnelles.
- Aucun suivi entre applications ou sites.
- Aucun SDK d'analyse. Pavurio ne donne pas d'avis médical.

## Qui traite les données pour nous

| Service | Finalité | Données |
|---|---|---|
| Google Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, Crashlytics, Analytics) | compte, codes e-mail, sauvegarde, rapports de plantage, statistiques d'utilisation | identifiant, e-mail de connexion, choix newsletter, copie de sauvegarde (photos et pièces jointes comprises), rapports de plantage, événements d'utilisation anonymes |
| Resend | envoi des codes et, si vous l'acceptez, de la newsletter | adresse e-mail, contenu du message |
| RevenueCat | vérification de Pavurio Pro | identifiant, reçus d'achat |
| Apple / Google | connexion, paiements, distribution | selon leurs propres politiques |

Ces prestataires peuvent traiter des données hors de votre pays (par exemple aux États-Unis) selon leurs clauses de protection des données.

## Durée de conservation

- Votre compte et votre sauvegarde sont conservés tant que le compte existe.
- Crashlytics conserve les rapports jusqu'à 90 jours.
- Firebase Analytics conserve les statistiques d'utilisation jusqu'à 14 mois.
- La suppression du compte efface immédiatement le compte et la sauvegarde.

## Supprimer vos données

- **Dans l'app :** Réglages → Compte → **Supprimer le compte**. Cela supprime le compte, la sauvegarde et les données du téléphone.
- **Sans l'app :** voir [Supprimer votre compte](delete-account.html).
- **Données du téléphone uniquement :** Réglages → Vos données → Tout effacer, ou supprimez l'app.
- **Export :** vous pouvez tout exporter à tout moment (Réglages → Vos données → CSV / JSON).

## Vos droits

Vous pouvez demander l'accès, la rectification, l'export ou la suppression de vos données, ou vous opposer à leur utilisation, en écrivant à **lesepavistespro@gmail.com**. Dans l'UE/EEE ou au Royaume-Uni, vous pouvez aussi saisir votre autorité de protection des données (en France, la CNIL).

## Enfants

Pavurio ne s'adresse pas aux enfants de moins de 13 ans (16 ans dans l'UE) et nous ne collectons pas sciemment leurs données.

## Modifications

Nous mettrons à jour cette page et sa date en cas de changement. Les changements importants seront aussi signalés dans l'app.

**Contact :** lesepavistespro@gmail.com

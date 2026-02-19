# CVite Pro — Guide Complet
## Installation, Déploiement & Stratégie Commerciale

═══════════════════════════════════════════════════════
  STRUCTURE DU PROJET
═══════════════════════════════════════════════════════

cvite-server/
├── server/
│   └── index.js          ← Serveur Node.js (API + licences)
├── client/
│   └── index.html        ← Logiciel CV (ce que voient vos clients)
├── admin/
│   └── index.html        ← Votre panneau admin
├── db/
│   └── cvite.db          ← Base de données (créée automatiquement)
├── package.json
├── .env.example          ← À renommer en .env avec vos paramètres
└── GUIDE.md              ← Ce fichier


═══════════════════════════════════════════════════════
  ÉTAPE 1 — CONFIGURER LE FICHIER .env
═══════════════════════════════════════════════════════

Renommez .env.example en .env et remplissez :

  PORT=3000
  JWT_SECRET=UneCleTresLongueEtAleatoire64Caracteres!
  ADMIN_PASSWORD=VotreMotDePasseAdmin2024!
  DB_PATH=./db/cvite.db
  ALLOWED_ORIGIN=https://votre-domaine.com

⚠️  IMPORTANT : Changez OBLIGATOIREMENT JWT_SECRET et ADMIN_PASSWORD
     avant de déployer. Ne partagez jamais ces valeurs.


═══════════════════════════════════════════════════════
  ÉTAPE 2 — INSTALLER ET TESTER EN LOCAL
═══════════════════════════════════════════════════════

1. Installez Node.js (https://nodejs.org) version 18+
2. Ouvrez un terminal dans le dossier cvite-server/
3. Exécutez :

   npm install
   npm start

4. Ouvrez votre navigateur :
   • Logiciel client : http://localhost:3000
   • Panneau admin   : http://localhost:3000/admin

5. Connectez-vous à l'admin avec votre ADMIN_PASSWORD
6. Créez un client test, copiez la clé, testez sur le client


═══════════════════════════════════════════════════════
  ÉTAPE 3 — DÉPLOIEMENT EN LIGNE (Gratuit / Pas cher)
═══════════════════════════════════════════════════════

OPTION A — Render.com (RECOMMANDÉ — GRATUIT pour démarrer)
───────────────────────────────────────────────────────────
1. Créez un compte sur https://render.com
2. "New Web Service" → connectez votre dépôt GitHub
   (ou uploadez les fichiers manuellement)
3. Paramètres :
   - Build Command : npm install
   - Start Command : node server/index.js
   - Environment   : Node
4. Ajoutez vos variables d'environnement (.env) dans
   le tableau "Environment Variables" de Render
5. Déployez → vous obtenez une URL en https://xxxx.onrender.com
6. Partagez cette URL à vos clients

   Coût : 0€/mois (plan gratuit, dort après 15min d'inactivité)
           7€/mois (plan Starter, toujours actif)

OPTION B — Railway.app (5$/mois, très simple)
───────────────────────────────────────────────
1. https://railway.app → "New Project"
2. Uploadez le dossier ou connectez GitHub
3. Ajoutez les variables d'environnement
4. Déployer → URL automatique en https://

OPTION C — VPS OVH/Ionos (10-20€/mois, plus de contrôle)
───────────────────────────────────────────────────────────
1. Louez un VPS (OVH VPS Starter = 3,60€/mois)
2. Installez Node.js : sudo apt install nodejs npm
3. Copiez les fichiers via SFTP (FileZilla)
4. Installez PM2 : npm install -g pm2
5. Lancez : pm2 start server/index.js --name cvite
6. PM2 redémarre automatiquement le serveur si crash
7. Configurez Nginx en reverse proxy (port 80/443)
8. Activez HTTPS avec Let's Encrypt (gratuit)


═══════════════════════════════════════════════════════
  COMMENT FONCTIONNE LE SYSTÈME DE LICENCE
═══════════════════════════════════════════════════════

SCHÉMA DE FONCTIONNEMENT :

  [Client ouvre CVite Pro]
          │
          ▼
  [Envoi de la clé au serveur]
  POST /api/license/check { key: "CVITE-XXXXX-XXXXX" }
          │
          ▼
  [Serveur vérifie en base de données]
          │
          ├─ Clé invalide    → ❌ Écran de saisie
          ├─ Licence bloquée → 🔒 Écran rouge
          ├─ Licence expirée → ⏰ Écran d'expiration
          └─ Licence valide  → ✅ Accès accordé + bannière

LE BLOCAGE À DISTANCE FONCTIONNE AINSI :
  1. Vous cliquez "Bloquer" dans le panneau admin
  2. Le serveur met "blocked = 1" en base de données
  3. IMMÉDIATEMENT : toute nouvelle vérification renvoie "blocked"
  4. La prochaine fois que le client ouvre le logiciel → bloqué
  5. Même s'il a internet ou non, la vérification se fait au démarrage

SÉCURITÉ :
  - La clé est stockée localement (localStorage) pour ne pas demander
    à chaque ouverture, mais est RE-VÉRIFIÉE côté serveur à chaque fois
  - Si le serveur est injoignable (panne, pas d'internet), le client
    garde accès (mode "offline gracieux") pour ne pas pénaliser
    les clients honnêtes
  - Rate limiting : max 20 vérifications / 15min par IP
  - Historique complet de toutes les connexions dans l'admin


═══════════════════════════════════════════════════════
  UTILISATION DU PANNEAU ADMIN
═══════════════════════════════════════════════════════

CRÉER UN NOUVEAU CLIENT :
  1. Clients & Licences → "+ Nouveau client"
  2. Remplir : nom, email, entreprise, plan, durée (jours)
  3. Cliquer "Créer" → clé générée automatiquement (ex: CVITE-AB123-CD456-EF789)
  4. Copier la clé → l'envoyer au client par email
  5. Le client saisit la clé au premier lancement → accès accordé

BLOQUER UN CLIENT (non-paiement, fin de contrat...) :
  1. Trouver le client dans la liste
  2. Cliquer "🚫 Bloquer"
  3. Indiquer la raison (optionnel)
  4. Confirmer → BLOCAGE IMMÉDIAT
  5. Prochaine ouverture chez le client = écran rouge

PROLONGER UNE LICENCE :
  1. Cliquer "📅 Prolonger" sur le client
  2. Entrer le nombre de jours (ex: 30 pour 1 mois)
  3. La durée s'ajoute à l'expiration actuelle

RÉGÉNÉRER UNE CLÉ (si partagée illégalement) :
  1. Cliquer "🔄 Clé" sur le client
  2. Nouvelle clé générée, l'ancienne est invalidée
  3. Envoyer la nouvelle clé au client

VOIR L'HISTORIQUE D'UN CLIENT :
  1. Cliquer "📋" sur le client
  2. Voir toutes ses connexions, blocages, prolongations
  3. Utile pour prouver l'utilisation en cas de litige


═══════════════════════════════════════════════════════
  ENVOYER LA CLÉ AU CLIENT — EMAIL TYPE
═══════════════════════════════════════════════════════

Objet : Votre accès CVite Pro — Clé d'activation

Bonjour [Prénom],

Votre licence CVite Pro est prête !

🔑 VOTRE CLÉ D'ACTIVATION : CVITE-XXXXX-XXXXX-XXXXX

Comment activer :
  1. Ouvrez le lien : https://votre-domaine.com
  2. Entrez votre clé d'activation
  3. Cliquez "Activer" → vous avez accès !

Durée : 30 jours (renouvelable)
Accès : depuis n'importe quel navigateur

Bonne utilisation !
[Votre signature]


═══════════════════════════════════════════════════════
  STRATÉGIE DE PRIX — COMBIEN VENDRE ?
═══════════════════════════════════════════════════════

TARIFS RECOMMANDÉS :

  ┌──────────────────────────────────────────────────────┐
  │  OFFRE MENSUELLE      15€ à 25€ / mois               │
  │  • Accès complet                                      │
  │  • Mises à jour incluses                              │
  │  • Support email                                      │
  │  → Durée : 30 jours renouvelables                     │
  ├──────────────────────────────────────────────────────┤
  │  OFFRE ANNUELLE ⭐    150€ à 200€ / an                │
  │  • 2 mois offerts vs mensuel                          │
  │  • Support prioritaire                                │
  │  • Formation par visio incluse                        │
  │  → Durée : 365 jours                                  │
  ├──────────────────────────────────────────────────────┤
  │  MULTI-POSTES (5 licences)  60€ à 80€ / mois         │
  │  • Pour cabinets RH, agences recrutement              │
  │  • 5 comptes individuels                              │
  │  • Dashboard commun sur demande                       │
  │  → Durée : 30 jours x 5 licences                     │
  └──────────────────────────────────────────────────────┘

SIMULATION DE REVENUS MENSUELS :

   5 clients × 20€  =  100€/mois   →   1 200€/an
  10 clients × 20€  =  200€/mois   →   2 400€/an
  20 clients × 20€  =  400€/mois   →   4 800€/an
  30 clients × 20€  =  600€/mois   →   7 200€/an
  50 clients × 20€  = 1000€/mois   →  12 000€/an

COÛTS OPÉRATIONNELS :
  • Hébergement Render  :  0€ à 7€/mois
  • Nom de domaine      :  10€/an (~0,80€/mois)
  • Total               :  0,80€ à 7,80€/mois

MARGE NETTE : ~95-99% (logiciel déjà développé)

CIBLE PRINCIPALE :
  • TPE / PME (1-50 salariés)
  • Agences de recrutement
  • Cabinets RH / Conseils en emploi
  • Auto-entrepreneurs

OÙ TROUVER DES CLIENTS :
  • LinkedIn (publier des posts de démonstration)
  • Groupes Facebook TPE/PME
  • Réseaux professionnels locaux (CCI, BNI...)
  • Bouche à oreille via RH
  • Démo gratuite 7 jours (sans CB) pour convaincre


═══════════════════════════════════════════════════════
  QUESTIONS FRÉQUENTES
═══════════════════════════════════════════════════════

Q : Le client peut-il utiliser le logiciel sans internet ?
R : Si sa clé a déjà été validée une fois et que le serveur
    est injoignable, il garde accès (mode hors-ligne).
    Mais le blocage ne prend effet qu'à la prochaine connexion
    serveur réussie.

Q : Puis-je avoir plusieurs admins ?
R : Actuellement non, il y a un seul compte admin.
    Vous pouvez ajouter cette fonctionnalité si besoin.

Q : Comment sauvegarder la base de données ?
R : Le fichier db/cvite.db contient tout. Faites une copie
    régulière (cron job ou backup Render).

Q : Un client peut-il partager sa clé ?
R : Oui, mais vous pouvez régénérer sa clé depuis l'admin,
    ce qui invalide immédiatement l'ancienne.

Q : Puis-je personnaliser le logiciel avec mon logo ?
R : Oui, modifiez client/index.html (cherchez "CVite Pro")
    pour mettre votre marque.

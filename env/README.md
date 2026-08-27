# Notre maison — Espace familial

Application React/Vite + Supabase (Auth, PostgreSQL, RLS, Realtime, Storage).

## 1. Variables d'environnement

Copie `.env.example` en `.env` et renseigne (valeurs publiques Supabase — pas des secrets) :

```
VITE_SUPABASE_URL=https://etxxyidhizniewmmfgtw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-w0NK--lREaWRZ5nRJfy9w_WCi3GPcY
```

Ce sont les **seules** variables nécessaires côté frontend. La clé "anon/publishable" est conçue pour être publique : la sécurité réelle est assurée par les policies RLS déjà en place côté Supabase (isolation stricte par famille, testée).

## 2. Pousser sur GitHub

```bash
git init
git add .
git commit -m "Initial commit — Notre maison"
git remote add origin https://github.com/KINGPIC6/cotisation-familiale-.git
git branch -M main
git push -u origin main
```

## 3. Déploiement Vercel

Le projet Vercel `notre-maison` est déjà lié à ce dépôt GitHub. Une fois le push effectué, Vercel devrait détecter automatiquement le commit et lancer le build.

Dans Vercel → Project → Settings → Environment Variables, ajoute :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(mêmes valeurs que ci-dessus, pour les environnements Production **et** Preview).

Build command : `npm run build` — Output directory : `dist` — ces réglages sont normalement auto-détectés par Vercel pour un projet Vite.

## 4. Base de données Supabase

Déjà entièrement configurée et testée (voir le rapport de sécurité fourni séparément) :
- 9 tables avec RLS stricte, isolation par famille
- RPC sécurisées (création de famille, demandes d'adhésion, changement de rôle)
- Triggers de journalisation automatique (activity_logs, security_logs)
- Bucket Storage privé `receipts` avec policies par famille
- Realtime activé sur `contributions`, `expenses`, `activity_logs`, `members`

Aucune action supplémentaire n'est requise côté base de données pour déployer.

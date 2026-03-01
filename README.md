# sqadX.app

Eine benutzerfreundliche Team-Management-App für Sportvereine mit Fokus auf Terminverwaltung, Zu-/Absagen und Kaderverwaltung.

## Features

- ✅ **Terminverwaltung**: Trainings und Spiele einfach organisieren
- ✅ **Zu-/Absagen System**: Schnelle Rückmeldungen inkl. Trainer-Steuerung pro Spieler
- ✅ **Kaderverwaltung**: Spieler und Trainer verwalten
- ✅ **Statistiken**: Anwesenheitsquoten
- ✅ **Serientermine**: Wiederholungen mit Wochentagen und Enddatum
- 📱 **Progressive Web App**: Auf allen Geräten nutzbar
- 🔒 **Sicher**: Moderne Authentifizierung und Datenschutz

### Aktueller Produktstand (März 2026)

- Serientermine können beim Erstellen per **Ja/Nein** aktiviert werden, danach werden Wochentage und „bis wann“ gewählt.
- Beim Bearbeiten von Serienterminen ist der Scope auswählbar: **nur dieser Termin** oder **ganze Serie**.
- Wird ein Serientermin einzeln bearbeitet, wird er aus der Serie gelöst (eigenständiger Termin).
- Die Serieninformation wird in der normalen Termin-Detailansicht nicht mehr angezeigt, sondern nur im Bearbeitungsfluss.
- Trainer sehen in der Termin-Detailansicht den hinterlegten Absagegrund von Spielern.
- Spieler müssen bei eigener Absage einen Grund angeben; Trainer können Status für sich und Spieler ohne Pflichtgrund setzen.

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (Build Tool)
- Tailwind CSS (Styling)
- React Router (Navigation)
- React Query (Data Fetching)
- PWA Support

### Backend
- Node.js + Express + TypeScript
- SQLite / PostgreSQL
- JWT Authentication
- REST API

## Projekt-Struktur

```
.
├── frontend/          # React Frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node.js Backend
│   ├── src/
│   └── package.json
└── README.md
```

## Installation

### 🔥 TrueNAS Deployment (empfohlen für Produktion)

Complete setup mit automatischem JWT_SECRET, Backup und Updates:

```bash
# SSH zu deiner TrueNAS
ssh root@<TRUENAS-IP>

# Repository klonen
cd /mnt/DATA/docker
git clone https://github.com/mrsorbate/sqadx.app.git
cd sqadx.app

# Initial Setup (5-10 Min)
chmod +x setup-truenas-build.sh
./setup-truenas-build.sh

# Zugriff: http://<TRUENAS-IP>:18080
```

**Updates einspielen:**
```bash
chmod +x update-truenas.sh
./update-truenas.sh
```

📖 **Vollständiger Guide:** [TRUENAS-SETUP.md](TRUENAS-SETUP.md)

---

### Backend (lokal entwickeln)
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Entwicklung

Die App läuft standardmäßig auf:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Toast-Guideline (UI-Feedback)

Für konsistente Nutzer-Rückmeldungen im Frontend:

- `success`: Aktion erfolgreich abgeschlossen (z. B. erstellt, gespeichert, gelöscht)
- `info`: Neutraler Hinweis ohne Handlungsdruck
- `warning`: Benutzer kann selbst nachbessern (z. B. Dateityp/-größe)
- `error`: Technischer oder serverseitiger Fehler

Technische Basis:
- Globaler Provider: `frontend/src/lib/useToast.tsx`
- Anzeige-Komponente: `frontend/src/components/ToastMessage.tsx`
- Nutzung in Seiten: `const { showToast } = useToast()`

## Docker

Die App kann komplett per Docker gestartet werden (Frontend + Backend).

### Umgebungsvariablen
```bash
cp .env.example .env
```

Danach ggf. `JWT_SECRET`, `FRONTEND_PORT` und `BACKEND_PORT` in `.env` anpassen.

Für öffentliche Deployments (Domain/Reverse Proxy) zusätzlich `FRONTEND_URL` setzen,
z. B. `https://app.meinverein.de`, damit Einladungslinks immer die richtige URL enthalten.

### Starten
```bash
docker compose up --build
```

Danach läuft die App auf:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000

### Stoppen
```bash
docker compose down
```

### Mit Daten-Reset
```bash
docker compose down -v
```

Es werden zwei persistente Volumes verwendet:
- `backend_data` für SQLite-Datenbank
- `backend_uploads` für hochgeladene Bilder

### Docker + SSL (Produktion)

Für HTTPS mit automatischen Let's Encrypt Zertifikaten ist ein separater Stack enthalten.

Voraussetzungen:
- Domain zeigt per DNS auf den Server
- Ports `80` und `443` sind erreichbar

In `.env` setzen:
- `DOMAIN=app.meinverein.de`
- `ACME_EMAIL=admin@meinverein.de`
- `JWT_SECRET=<starkes-secret>`

Start:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Danach läuft die App unter:
- `https://<DOMAIN>`

Hinweise:
- `FRONTEND_URL` und `CORS_ORIGIN` werden im Prod-Stack automatisch auf `https://<DOMAIN>` gesetzt.
- Invite-Links werden damit ebenfalls korrekt als HTTPS-Domain erzeugt.
- Backend nutzt Security-Header (`helmet`) und Rate-Limits für API/Auth.

Optionale Feineinstellungen in `.env`:
- `JWT_EXPIRES_IN` (aktuell `1h` zum Testen, z. B. `7d`, `30d`, `12h`)
- `API_RATE_LIMIT_WINDOW_MS` (Standard `900000` = 15 Min)
- `API_RATE_LIMIT_MAX` (Standard `300` Requests/Window)
- `AUTH_RATE_LIMIT_MAX` (Standard `20` Requests/Window)
- `LOGIN_RATE_LIMIT_WINDOW_MS` (Standard `900000` = 15 Min)
- `LOGIN_RATE_LIMIT_MAX` (Standard `8` fehlgeschlagene Login-Versuche pro IP+Username)

## Lizenz

MIT

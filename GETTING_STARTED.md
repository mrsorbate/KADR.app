# 🚀 sqadX.app - Installation & Start

Eine moderne Team-Management-App für Sportvereine.

## ✅ Installation abgeschlossen!

Die App wurde erfolgreich eingerichtet und läuft bereits:

- **Backend API**: http://localhost:3000
- **Frontend App**: http://localhost:5174

## 📋 Erste Schritte

1. **Registrieren**: Öffne http://localhost:5174 und erstelle einen Account
   - Wähle "Trainer" als Rolle, um Teams erstellen zu können
   - Oder wähle "Spieler" um Teams beizutreten

2. **Team erstellen**: Als Trainer kannst du auf dem Dashboard ein Team erstellen

3. **Termine erstellen**: Gehe zu deinem Team → Termine → Termin erstellen

4. **Spieler einladen**: Weitere Benutzer müssen sich registrieren und können dann zu Teams hinzugefügt werden

5. **Serientermine nutzen**:
   - Beim Erstellen: „Serientermin“ auf Ja setzen, Wochentage wählen, Enddatum setzen
   - Beim Bearbeiten: entscheiden zwischen „nur dieser Termin“ oder „ganze Serie“

## 🎯 Hauptfunktionen

### ✅ Implementiert
- ✓ Benutzer-Authentifizierung (Login/Register)
- ✓ Rollen-System (Trainer/Spieler)
- ✓ Team-Verwaltung
- ✓ Terminverwaltung (Training/Spiele/Sonstiges)
- ✓ Zu-/Absagen System inkl. Trainer-Steuerung pro Spieler
- ✓ Kaderverwaltung (Spieler, Trainer, Staff)
- ✓ Anwesenheitsstatistiken
- ✓ Einladungs-System mit Links
- ✓ Serientermine mit Wochentagen + Enddatum

### 🔄 Aktueller Ablauf (März 2026)

- **Serientermine**
   - Seriendaten werden in der normalen Termin-Detailseite nicht angezeigt.
   - Beim Einzel-Bearbeiten eines Serientermins wird dieser Termin aus der Serie gelöst.

- **Absagen / Gründe**
   - Spieler müssen bei eigener Absage einen Grund angeben.
   - Trainer können in der Termin-Detailansicht den Status für sich und Spieler direkt per Klick setzen.
   - Ein Absagegrund ist für Trainer dabei optional.
   - Hinterlegte Absagegründe werden Trainern in der Teilnehmerliste bei „Abgesagt“ angezeigt.

### 📱 Features
- Progressive Web App (PWA) - kann auf dem Handy installiert werden
- Responsives Design - funktioniert auf allen Geräten
- Echtzeit-Übersicht der Zu-/Absagen
- Anwesenheitsstatistiken pro Spieler und Team

## 🛠️ Entwicklung

### Toast-Guideline (UI-Feedback)

Verwende im Frontend die globalen Toast-Typen konsistent:

- `success`: Aktion wurde erfolgreich abgeschlossen (z. B. gespeichert, erstellt, gelöscht)
- `info`: Neutrale Hinweise ohne Handlungsdruck
- `warning`: Benutzer kann Problem direkt selbst beheben (z. B. falscher Dateityp, Datei zu groß)
- `error`: Technischer oder serverseitiger Fehler (z. B. API fehlgeschlagen)

Technische Basis:
- Globaler Provider: `frontend/src/lib/useToast.tsx`
- Anzeige-Komponente: `frontend/src/components/ToastMessage.tsx`
- Verwendung in Seiten: `const { showToast } = useToast()`

### Server stoppen
Drücke `Ctrl+C` in den Terminal-Fenstern wo Backend und Frontend laufen

### Server neu starten
```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm run dev

# Oder beides gleichzeitig vom Root-Verzeichnis:
npm run dev
```

### Datenbank zurücksetzen
```bash
cd backend
rm database.sqlite
npm run dev  # Erstellt eine neue Datenbank
```

## 📁 Projekt-Struktur

```
.
├── backend/                 # Node.js + Express Backend
│   ├── src/
│   │   ├── database/       # SQLite Datenbank-Setup
│   │   ├── routes/         # API Routen (auth, teams, events, stats)
│   │   ├── middleware/     # Auth Middleware
│   │   ├── types/          # TypeScript Typen
│   │   └── index.ts        # Server Entry Point
│   └── database.sqlite     # SQLite Datenbank-Datei
│
├── frontend/               # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/    # React Komponenten
│   │   ├── pages/         # Seiten-Komponenten
│   │   ├── lib/           # API Client, Utils
│   │   ├── store/         # Zustand State Management
│   │   └── main.tsx       # App Entry Point
│   └── public/
│
└── README.md
```

## 🔐 Standard Demo-Daten

Beim ersten Start ist die Datenbank leer. Registriere dich mit:
- **Trainer-Account**: Kann Teams erstellen und verwalten
- **Spieler-Account**: Kann Teams beitreten und auf Termine reagieren

## 🚀 Produktion

### Backend bauen
```bash
cd backend
npm run build
npm start
```

### Frontend bauen
```bash
cd frontend
npm run build
# Build-Dateien sind in frontend/dist/
```

### Umgebungsvariablen für Produktion

**backend/.env**
```
PORT=3000
NODE_ENV=production
JWT_SECRET=ein-sehr-sicherer-geheimer-schluessel-hier
DATABASE_PATH=./database.sqlite
```

**frontend/.env.production**
```
VITE_API_URL=https://deine-api-domain.com
```

## 📊 API Dokumentation

Die REST API läuft auf http://localhost:3000/api

### Endpoints

- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Aktueller User

- `GET /api/teams` - Alle Teams
- `POST /api/teams` - Team erstellen
- `GET /api/teams/:id` - Team Details
- `GET /api/teams/:id/members` - Team Mitglieder

- `GET /api/events` - Events für Team
- `POST /api/events` - Event erstellen
- `GET /api/events/:id` - Event Details
- `POST /api/events/:id/response` - Zu-/Absage

- `GET /api/stats/team/:id` - Team Statistiken

## 🐛 Troubleshooting

### Backend startet nicht
- Prüfe ob Port 3000 frei ist: `lsof -i :3000`
- Prüfe .env Datei im backend/ Ordner

### Frontend startet nicht
- Prüfe ob Port 5173 oder 5174 frei ist
- Lösche node_modules und installiere neu: `rm -rf node_modules && npm install`

### Datenbank-Fehler
- Lösche database.sqlite und starte Backend neu
- Prüfe Schreibrechte im backend/ Ordner

## 📝 Lizenz

MIT

## 💡 Verbesserungsvorschläge

Mögliche Erweiterungen:
- [ ] Team-Chat/Messaging
- [ ] Dateiupload (Trainingsvideos, Dokumente)
- [ ] Push-Benachrichtigungen
- [ ] Kalender-Export (iCal)
- [ ] Spielanalyse-Tools
- [ ] Taktik-Board
- [ ] E-Mail Benachrichtigungen
- [ ] Mobile Apps (React Native)

---

**Viel Erfolg mit deiner Team-Management-App! ⚽**

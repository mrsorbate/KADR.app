# sqadX.app auf TrueNAS —  Kompletter Setup Guide

Diese Dokumentation erklärt, wie du sqadX.app auf deiner TrueNAS nutzt — mit automatischem Setup, Updates und Backups.

---

## 🚀 Schnellstart (5-10 Min)

### 1. SSH-Zugriff zur TrueNAS

```bash
ssh root@<TRUENAS-IP>
```

### 2. Repository klonen (oder aktualisieren wenn bereits vorhanden)

**Erste Mal:**
```bash
cd /mnt/DATA/docker
git clone https://github.com/mrsorbate/sqadx.app.git
cd sqadx.app
```

**Wenn Verzeichnis bereits existiert:**
```bash
cd /mnt/DATA/docker/sqadx.app
git pull
```

### 3. Initial Setup

```bash
chmod +x setup-truenas-build.sh
./setup-truenas-build.sh
```

Das Script macht automatisch:
- ✅ Verzeichnisse erstellen (`/mnt/DATA/docker/sqadx/`)
- ✅ Sicheres JWT_SECRET generiert
- ✅ `.env` mit allen Werten erstellt
- ✅ Docker Images gebaut
- ✅ Container gestartet

**Fertig!** → Öffne `http://<TRUENAS-IP>:18080`

---

## 🔄 Updates

Regelmäßig Updates einspielen mit einem Befehl:

```bash
cd /mnt/DATA/docker/sqadx.app
chmod +x update-truenas.sh
./update-truenas.sh
```

Das Script macht:
- ✅ Neuen Code von GitHub holen (`git pull`)
- ✅ Backup der `.env` erstellen
- ✅ Docker Images neu bauen
- ✅ Container neu starten
- ✅ Datenbank bleibt erhalten

---

## 📋 Was wird wo gespeichert?

| Was | Wo | Wichtig |
|-----|----|----|
| **Datenbank** | `/mnt/DATA/docker/sqadx/data/database.sqlite` | ⚠️ Backup regelmäßig |
| **Uploaded Bilder** | `/mnt/DATA/docker/sqadx/uploads/` | ⚠️ Wichtige Daten |
| **Config** | `.env` (root des Repos) | 🔑 Nicht löschen |
| **Docker Logs** | Container-Logs | 📝 Zum Debugging |

---

## 🛠️ Nützliche Befehle

### Status checken
```bash
cd /mnt/DATA/docker/sqadx.app
docker compose --env-file .env -f docker-compose.build.yml ps
```

### Logs live anschauen
```bash
docker compose --env-file .env -f docker-compose.build.yml logs -f
```

### Container stoppen
```bash
docker compose --env-file .env -f docker-compose.build.yml down
```

### Container neu starten
```bash
docker compose --env-file .env -f docker-compose.build.yml restart
```

### Port ändern (falls 18080 belegt)
```bash
# .env bearbeiten
nano .env
# Ändere: FRONTEND_PORT=28080
# Speichern: Ctrl+O, Enter, Ctrl+X

# Neu starten
./update-truenas.sh
```

---

## 💾 Backup & Recovery

### Automatische Backups
Das `update-truenas.sh`-Script erstellt vor jedem Update ein Backup:
```
.env.backup.20260220_133000
```

### Manuelles Backup der Datenbank

```bash
cp -v /mnt/DATA/docker/sqadx/data/database.sqlite \
      /mnt/DATA/docker/sqadx/data/database.sqlite.backup.$(date +%Y%m%d)
```

### Datenbank aus Backup wiederherstellen

```bash
cd /mnt/DATA/docker/sqadx.app
docker compose --env-file .env -f docker-compose.build.yml down

# Backup zurück-copy
cp /mnt/DATA/docker/sqadx/data/database.sqlite.backup.20260220 \
      /mnt/DATA/docker/sqadx/data/database.sqlite

# Neu starten
./setup-truenas-build.sh
```

---

## ⚠️ Troubleshooting

### "Container starten nicht"
```bash
cd /mnt/DATA/docker/sqadx.app
docker compose --env-file .env -f docker-compose.build.yml logs -f
# Suche nach Fehlermeldungen
```

### "Port 18080 bereits belegt"
Ändere den Port in `.env`:
```bash
nano .env
# Ändere: FRONTEND_PORT=28080
./update-truenas.sh
```

### "Datenbank-Fehler"
```bash
# Verzeichnis-Rechte checken
ls -la /mnt/DATA/docker/sqadx/data/

# Falls nötig:
chmod 755 /mnt/DATA/docker/sqadx/data
chmod 755 /mnt/DATA/docker/sqadx/uploads
```

### "Kompletter Neustart (Daten bleiben)"
```bash
cd /mnt/DATA/docker/sqadx.app
docker compose --env-file .env -f docker-compose.build.yml down
./setup-truenas-build.sh
```

### "Build fehlgeschlagen"
```bash
cd /mnt/DATA/docker/sqadx.app
docker compose --env-file .env -f docker-compose.build.yml down
./setup-truenas-build.sh
```

### "Repository existiert bereits" (`already exists...`)
Das Verzeichnis `/mnt/DATA/docker/sqadx.app` existiert bereits:
```bash
# Einfach in das bestehende Verzeichnis wechseln
cd /mnt/DATA/docker/sqadx.app

# Code aktualisieren
git pull

# Und neu starten
./setup-truenas-build.sh
```

### "Dubious ownership in repository" (Git-Fehler)
Ownership-Problem mit Git-Repository (häufig auf TrueNAS):
```bash
# Übergangsweise erlauben:
git config --global --add safe.directory /mnt/DATA/docker/sqadx.app

# Oder Ownership korrigieren (besser):
sudo chown -R $(whoami):$(whoami) /mnt/DATA/docker/sqadx.app

# Dann git pull versuchen
git pull
```

---

## 🔐 Sicherheit

### JWT_SECRET schützen
Deine `.env` enthält das JWT_SECRET — nicht in Public-Repos pushen!

```bash
# .env ist automatisch in .gitignore:
cat .gitignore | grep "^\.env"
```

### Bei kompromittiertem Secret
1. Neues Secret generieren: `openssl rand -base64 32`
2. In `.env` eintragen
3. `./update-truenas.sh` ausführen
4. Alle User müssen sich neu anmelden

---

## 📞 Support

- **GitHub Issues:** https://github.com/mrsorbate/sqadx.app/issues
- **Logs checken:** `docker compose --env-file .env -f docker-compose.build.yml logs -f`

---

## 📝 Cheat Sheet

| Aufgabe | Befehl |
|--------|--------|
| Initial Setup | `./setup-truenas-build.sh` |
| Update | `./update-truenas.sh` |
| Status | `docker compose --env-file .env -f docker-compose.build.yml ps` |
| Logs | `docker compose --env-file .env -f docker-compose.build.yml logs -f` |
| Stoppen | `docker compose --env-file .env -f docker-compose.build.yml down` |
| Neustarten | `docker compose --env-file .env -f docker-compose.build.yml restart` |
| Config ändern | `nano .env` → `./update-truenas.sh` |

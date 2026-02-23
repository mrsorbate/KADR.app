#!/bin/bash

# sqadX.app Update Script für TrueNAS
# Aktualisiert den Code, baut neue Docker Images und startet die Container neu

set -e

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔄 sqadX.app - Update${NC}\n"

# Fehler-Handler
error_exit() {
    echo -e "${RED}❌ Fehler: $1${NC}" >&2
    exit 1
}

get_env_value() {
    local key="$1"
    local file="$2"
    if [ ! -f "$file" ]; then
        return
    fi
    sed -nE "s|^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$|\1|p" "$file" | tail -n 1
}

set_or_append_env() {
    local key="$1"
    local value="$2"
    local file="$3"

    if grep -qE "^${key}=" "$file"; then
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file"
    else
        printf "\n%s=%s\n" "$key" "$value" >> "$file"
    fi
}

# Überprüfe, ob wir im korrekten Verzeichnis sind
if [ ! -f "docker-compose.build.yml" ]; then
    error_exit "Nicht im sqadx.app-Verzeichnis. Bitte ausführen im ./sqadx.app Ordner"
fi

# Backup erstellen (optional aber empfohlen)
echo -e "${BLUE}💾 Erstelle Backup der .env...${NC}"
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backup erstellt${NC}\n"
else
    echo -e "${YELLOW}⚠️  Keine .env zum Backup${NC}\n"
fi

# Git-Pull
echo -e "${BLUE}📥 Hole neue Code-Version...${NC}"
if ! git pull; then
    error_exit "Git Pull fehlgeschlagen. Überprüfe deine Internet-Verbindung oder lokale Änderungen."
fi
echo -e "${GREEN}✓ Code aktualisiert${NC}\n"

# Sicherstellen, dass api-fussball Basis-URL in Root-.env vorhanden ist
if [ -f ".env" ]; then
    ROOT_BASE_URL="$(get_env_value "FUSSBALL_API_BASE_URL" ".env")"

    if [ -z "$ROOT_BASE_URL" ]; then
        set_or_append_env "FUSSBALL_API_BASE_URL" "https://api-fussball.de/api" ".env"
        echo -e "${GREEN}✓ FUSSBALL_API_BASE_URL in Root-.env ergänzt${NC}"
    fi
fi

# Docker Compose - Bau & Restart
echo -e "${BLUE}🐳 Räume alte Container auf und starte neue Version...${NC}"
if [ -f ".env" ]; then
    docker compose --env-file .env -f docker-compose.build.yml down --remove-orphans >/dev/null 2>&1 || true

    if ! docker compose --env-file .env -f docker-compose.build.yml up -d --build --remove-orphans; then
        echo -e "${YELLOW}ℹ️  Mögliche Ursache: Port bereits belegt (z.B. 18080).${NC}"
        echo -e "${YELLOW}   Prüfen mit: docker ps --format 'table {{.Names}}\t{{.Ports}}'${NC}"
        error_exit "Docker Compose fehlgeschlagen. Check: docker compose --env-file .env -f docker-compose.build.yml logs"
    fi
else
    error_exit ".env-Datei nicht gefunden. Bitte erst Setup ausführen: ./setup-truenas-build.sh"
fi

echo -e "\n${GREEN}✅ Update erfolgreich!${NC}\n"

# Status anzeigen
echo -e "${BLUE}Container Status:${NC}"
docker compose --env-file .env -f docker-compose.build.yml ps

echo -e "\n${YELLOW}Tipps:${NC}"
echo "Logs anschauen:"
echo "  docker compose --env-file .env -f docker-compose.build.yml logs -f"
echo ""
echo "Bei Problemen: .env.backup.*-Datei zurück copy:"
echo "  cp .env.backup.* .env"
echo "  docker compose --env-file .env -f docker-compose.build.yml down"
echo "  ./setup-truenas-build.sh"
echo ""

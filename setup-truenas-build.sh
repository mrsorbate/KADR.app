#!/bin/bash

# sqadX.app Docker Setup für TrueNAS (lokales Build)
# Dieses Skript bereitet die Umgebung vor und startet die Container mit lokalem Build

set -e

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 sqadX.app - TrueNAS Setup (Build Mode)${NC}\n"

# Konfiguration
BASE_PATH="${BASE_PATH:-/mnt/DATA/docker/sqadx}"
FRONTEND_PORT="${FRONTEND_PORT:-18080}"
TRUENAS_IP="${TRUENAS_IP:-localhost}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.build.yml}"

# Fehler-Handler
error_exit() {
    echo -e "${RED}❌ Fehler: $1${NC}" >&2
    exit 1
}

ensure_env_key() {
    local key="$1"
    local value="$2"
    local file="$3"

    if ! grep -qE "^${key}=" "$file"; then
        printf "\n%s=%s\n" "$key" "$value" >> "$file"
    fi
}

# Verzeichnisse erstellen
echo -e "${BLUE}📁 Erstelle Datenverzeichnisse...${NC}"
mkdir -p "${BASE_PATH}/data" || error_exit "Kann nicht in ${BASE_PATH} schreiben"
mkdir -p "${BASE_PATH}/uploads" || error_exit "Kann nicht in ${BASE_PATH} schreiben"
echo -e "${GREEN}✓ Verzeichnisse erstellt${NC}\n"

# JWT_SECRET generieren, falls noch nicht vorhanden
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env existiert bereits, überspringe Secret-Generierung${NC}"
    echo -e "   Aktuelle Settings:"
    grep -E 'JWT_SECRET|FRONTEND_URL' "$ENV_FILE" || true

    ensure_env_key "FUSSBALL_API_BASE_URL" "https://api-fussball.de/api" "$ENV_FILE"
else
    echo -e "${BLUE}🔐 Generiere JWT_SECRET...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    
    cat > "$ENV_FILE" << EOF
# sqadX.app - Docker Compose Environment
# Generiert am: $(date)

BACKEND_PORT=3000
FRONTEND_PORT=${FRONTEND_PORT}
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
DATABASE_PATH=/app/data/database.sqlite
FRONTEND_URL=http://${TRUENAS_IP}:${FRONTEND_PORT}
TZ=Europe/Berlin

# Host Pfade
BACKEND_DATA_DIR=${BASE_PATH}/data
BACKEND_UPLOADS_DIR=${BASE_PATH}/uploads

# api-fussball.de Integration (optional: Base URL Override)
FUSSBALL_API_BASE_URL=https://api-fussball.de/api
EOF
    
    echo -e "${GREEN}✓ JWT_SECRET generiert und in .env gespeichert${NC}\n"
fi

# Docker Compose starten (mit lokalem Build)
echo -e "${BLUE}🐳 Baue und starte Docker Container...${NC}"
echo -e "${YELLOW}(Dies kann beim ersten Mal 5-10 Minuten dauern...)${NC}\n"

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build; then
    error_exit "Docker Compose ist fehlgeschlagen. Check Logs mit: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs"
fi

# Warte kurz, damit Container starten können
sleep 3

echo -e "\n${GREEN}✅ Setup erfolgreich!${NC}\n"
echo -e "${YELLOW}📍 sqadX.app erreichbar unter:${NC}"
echo -e "   ${GREEN}http://${TRUENAS_IP}:${FRONTEND_PORT}${NC}\n"

# Status anzeigen
echo -e "${BLUE}Container Status:${NC}"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo -e "\n${YELLOW}Befehle zum Debugging:${NC}"
echo "Logs anzeigen:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f"
echo ""
echo "Container neustarten:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE restart"
echo ""
echo "Container stoppen:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down"
echo ""

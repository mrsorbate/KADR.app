"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const init_1 = __importDefault(require("../database/init"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const HARDCODED_FUSSBALL_API_TOKEN = 'w1G797J1N7u8a0e1R0C8A1Z2e5TYQm1Sezgk0lBUik';
// Create uploads directory if it doesn't exist
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer for team picture uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'team-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
        }
    }
});
// All routes require authentication
router.use(auth_1.authenticate);
// Get all teams for current user
router.get('/', (req, res) => {
    try {
        const teams = init_1.default.prepare(`
      SELECT t.*, tm.role as my_role
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
      ORDER BY t.name
    `).all(req.user.id);
        res.json(teams);
    }
    catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});
// Get team details
router.get('/:id', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        // Check if user is member
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        const team = init_1.default.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(team);
    }
    catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});
// Get team settings
router.get('/:id/settings', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        const settings = init_1.default.prepare(`SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`).get(teamId);
        if (!settings) {
            return res.status(404).json({ error: 'Team not found' });
        }
        return res.json(settings);
    }
    catch (error) {
        console.error('Get team settings error:', error);
        return res.status(500).json({ error: 'Failed to fetch team settings' });
    }
});
// Update team settings (trainers only)
router.put('/:id/settings', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const hasFussballId = Object.prototype.hasOwnProperty.call(req.body, 'fussballde_id');
        const hasDefaultResponse = Object.prototype.hasOwnProperty.call(req.body, 'default_response');
        const hasDefaultRsvpDeadlineHours = Object.prototype.hasOwnProperty.call(req.body, 'default_rsvp_deadline_hours');
        const hasDefaultRsvpDeadlineHoursTraining = Object.prototype.hasOwnProperty.call(req.body, 'default_rsvp_deadline_hours_training');
        const hasDefaultRsvpDeadlineHoursMatch = Object.prototype.hasOwnProperty.call(req.body, 'default_rsvp_deadline_hours_match');
        const hasDefaultRsvpDeadlineHoursOther = Object.prototype.hasOwnProperty.call(req.body, 'default_rsvp_deadline_hours_other');
        const hasDefaultArrivalMinutes = Object.prototype.hasOwnProperty.call(req.body, 'default_arrival_minutes');
        const hasDefaultArrivalMinutesTraining = Object.prototype.hasOwnProperty.call(req.body, 'default_arrival_minutes_training');
        const hasDefaultArrivalMinutesMatch = Object.prototype.hasOwnProperty.call(req.body, 'default_arrival_minutes_match');
        const hasDefaultArrivalMinutesOther = Object.prototype.hasOwnProperty.call(req.body, 'default_arrival_minutes_other');
        const { fussballde_id, default_response, default_rsvp_deadline_hours, default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other, default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other, } = req.body;
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can update team settings' });
        }
        const team = init_1.default.prepare(`SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`).get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        let nextFussballId = team.fussballde_id;
        if (hasFussballId) {
            const normalizedFussballId = String(fussballde_id || '').trim().toUpperCase();
            if (normalizedFussballId && !/^[A-Z0-9]{16,40}$/.test(normalizedFussballId)) {
                return res.status(400).json({ error: 'Ungültiges fussball.de ID-Format' });
            }
            nextFussballId = normalizedFussballId || null;
        }
        const allowedDefaultResponses = new Set(['pending', 'accepted', 'tentative', 'declined']);
        let nextDefaultResponse = team.default_response;
        if (hasDefaultResponse) {
            const normalizedDefaultResponse = String(default_response || '').trim().toLowerCase() || 'pending';
            if (!allowedDefaultResponses.has(normalizedDefaultResponse)) {
                return res.status(400).json({ error: 'Ungültige Standard-Rückmeldung' });
            }
            nextDefaultResponse = normalizedDefaultResponse;
        }
        let nextDefaultRsvpDeadlineHours = team.default_rsvp_deadline_hours;
        if (hasDefaultRsvpDeadlineHours) {
            let normalizedRsvpDeadlineHours = null;
            if (default_rsvp_deadline_hours !== null && default_rsvp_deadline_hours !== undefined && String(default_rsvp_deadline_hours).trim() !== '') {
                normalizedRsvpDeadlineHours = parseInt(String(default_rsvp_deadline_hours), 10);
                if (!Number.isFinite(normalizedRsvpDeadlineHours) || normalizedRsvpDeadlineHours < 0 || normalizedRsvpDeadlineHours > 168) {
                    return res.status(400).json({ error: 'Standard-Rückmeldefrist muss zwischen 0 und 168 Stunden liegen' });
                }
            }
            nextDefaultRsvpDeadlineHours = normalizedRsvpDeadlineHours;
        }
        const normalizeRsvpHours = (value) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return null;
            }
            const parsed = parseInt(String(value), 10);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
                return 'invalid';
            }
            return parsed;
        };
        let nextDefaultRsvpDeadlineHoursTraining = team.default_rsvp_deadline_hours_training;
        if (hasDefaultRsvpDeadlineHoursTraining) {
            const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_training);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Rückmeldefrist Training muss zwischen 0 und 168 Stunden liegen' });
            }
            nextDefaultRsvpDeadlineHoursTraining = normalized;
        }
        let nextDefaultRsvpDeadlineHoursMatch = team.default_rsvp_deadline_hours_match;
        if (hasDefaultRsvpDeadlineHoursMatch) {
            const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_match);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Rückmeldefrist Spiel muss zwischen 0 und 168 Stunden liegen' });
            }
            nextDefaultRsvpDeadlineHoursMatch = normalized;
        }
        let nextDefaultRsvpDeadlineHoursOther = team.default_rsvp_deadline_hours_other;
        if (hasDefaultRsvpDeadlineHoursOther) {
            const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_other);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Rückmeldefrist Sonstiges muss zwischen 0 und 168 Stunden liegen' });
            }
            nextDefaultRsvpDeadlineHoursOther = normalized;
        }
        let nextDefaultArrivalMinutes = team.default_arrival_minutes;
        if (hasDefaultArrivalMinutes) {
            let normalizedArrivalMinutes = null;
            if (default_arrival_minutes !== null && default_arrival_minutes !== undefined && String(default_arrival_minutes).trim() !== '') {
                normalizedArrivalMinutes = parseInt(String(default_arrival_minutes), 10);
                if (!Number.isFinite(normalizedArrivalMinutes) || normalizedArrivalMinutes < 0 || normalizedArrivalMinutes > 240) {
                    return res.status(400).json({ error: 'Standard-Treffpunkt Minuten muss zwischen 0 und 240 liegen' });
                }
            }
            nextDefaultArrivalMinutes = normalizedArrivalMinutes;
        }
        const normalizeArrivalMinutes = (value) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return null;
            }
            const parsed = parseInt(String(value), 10);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) {
                return 'invalid';
            }
            return parsed;
        };
        let nextDefaultArrivalMinutesTraining = team.default_arrival_minutes_training;
        if (hasDefaultArrivalMinutesTraining) {
            const normalized = normalizeArrivalMinutes(default_arrival_minutes_training);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Training muss zwischen 0 und 240 liegen' });
            }
            nextDefaultArrivalMinutesTraining = normalized;
        }
        let nextDefaultArrivalMinutesMatch = team.default_arrival_minutes_match;
        if (hasDefaultArrivalMinutesMatch) {
            const normalized = normalizeArrivalMinutes(default_arrival_minutes_match);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Spiel muss zwischen 0 und 240 liegen' });
            }
            nextDefaultArrivalMinutesMatch = normalized;
        }
        let nextDefaultArrivalMinutesOther = team.default_arrival_minutes_other;
        if (hasDefaultArrivalMinutesOther) {
            const normalized = normalizeArrivalMinutes(default_arrival_minutes_other);
            if (normalized === 'invalid') {
                return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Sonstiges muss zwischen 0 und 240 liegen' });
            }
            nextDefaultArrivalMinutesOther = normalized;
        }
        init_1.default.prepare(`UPDATE teams
       SET fussballde_id = ?,
           default_response = ?,
           default_rsvp_deadline_hours = ?,
           default_rsvp_deadline_hours_training = ?,
           default_rsvp_deadline_hours_match = ?,
           default_rsvp_deadline_hours_other = ?,
           default_arrival_minutes = ?,
             default_arrival_minutes_training = ?,
             default_arrival_minutes_match = ?,
             default_arrival_minutes_other = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(nextFussballId, nextDefaultResponse || 'pending', nextDefaultRsvpDeadlineHours, nextDefaultRsvpDeadlineHoursTraining, nextDefaultRsvpDeadlineHoursMatch, nextDefaultRsvpDeadlineHoursOther, nextDefaultArrivalMinutes, nextDefaultArrivalMinutesTraining, nextDefaultArrivalMinutesMatch, nextDefaultArrivalMinutesOther, teamId);
        const updatedSettings = init_1.default.prepare(`SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`).get(teamId);
        return res.json(updatedSettings);
    }
    catch (error) {
        console.error('Update team settings error:', error);
        return res.status(500).json({ error: 'Failed to update team settings' });
    }
});
// Update fussball.de team id (trainers only)
router.post('/:id/import-next-games', async (req, res) => {
    try {
        const teamId = parseInt(req.params.id, 10);
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can import games' });
        }
        const team = init_1.default.prepare(`SELECT id, name, fussballde_id, default_response, default_rsvp_deadline_hours, default_rsvp_deadline_hours_match,
              default_arrival_minutes, default_arrival_minutes_match
       FROM teams WHERE id = ?`).get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        if (!team.fussballde_id) {
            return res.status(400).json({ error: 'Für dieses Team ist keine fussball.de ID hinterlegt' });
        }
        const envToken = HARDCODED_FUSSBALL_API_TOKEN;
        const apiBaseUrl = process.env.FUSSBALL_API_BASE_URL || 'https://api-fussball.de/api';
        if (!envToken) {
            return res.status(500).json({ error: 'FUSSBALL_API_TOKEN ist nicht konfiguriert' });
        }
        const response = await fetch(`${apiBaseUrl}/team/${encodeURIComponent(team.fussballde_id)}`, {
            method: 'GET',
            headers: {
                'x-auth-token': envToken,
            },
        });
        if (!response.ok) {
            return res.status(502).json({ error: `api-fussball.de Fehler (${response.status})` });
        }
        const payload = await response.json();
        const nextGames = Array.isArray(payload?.data?.nextGames) ? payload.data.nextGames : [];
        const pickFirstString = (...values) => {
            for (const value of values) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
            return '';
        };
        const parseRsvpHours = (value) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return null;
            }
            const parsed = parseInt(String(value), 10);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
                return null;
            }
            return parsed;
        };
        const parseArrivalMinutes = (value) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return null;
            }
            const parsed = parseInt(String(value), 10);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) {
                return null;
            }
            return parsed;
        };
        const defaultRsvpHours = parseRsvpHours(team.default_rsvp_deadline_hours_match) ?? parseRsvpHours(team.default_rsvp_deadline_hours);
        const defaultArrivalMinutes = parseArrivalMinutes(team.default_arrival_minutes_match) ?? parseArrivalMinutes(team.default_arrival_minutes);
        const parseGameDate = (game) => {
            const parseDateWithOptionalTime = (dateValue, timeValue) => {
                const dateText = String(dateValue || '').trim();
                const timeText = String(timeValue || '').trim();
                const normalizedTime = (() => {
                    if (!timeText)
                        return '19:00';
                    const clean = timeText.replace(/[^0-9:]/g, '');
                    const [hour, minute] = clean.split(':');
                    const hh = String(Math.min(23, Math.max(0, parseInt(hour || '0', 10) || 0))).padStart(2, '0');
                    const mm = String(Math.min(59, Math.max(0, parseInt(minute || '0', 10) || 0))).padStart(2, '0');
                    return `${hh}:${mm}`;
                })();
                const germanMatch = dateText.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
                if (germanMatch) {
                    const day = germanMatch[1].padStart(2, '0');
                    const month = germanMatch[2].padStart(2, '0');
                    const yearRaw = germanMatch[3];
                    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
                    const parsed = new Date(`${year}-${month}-${day}T${normalizedTime}`);
                    return isNaN(parsed.getTime()) ? null : parsed;
                }
                const isoLike = dateText.includes('T')
                    ? dateText
                    : `${dateText}T${normalizedTime}`;
                const parsed = new Date(isoLike);
                return isNaN(parsed.getTime()) ? null : parsed;
            };
            const timestampValue = game?.timestamp ?? game?.kickoff_timestamp ?? game?.match_timestamp;
            if (timestampValue !== undefined && timestampValue !== null && String(timestampValue).trim() !== '') {
                const numeric = Number(timestampValue);
                if (Number.isFinite(numeric)) {
                    const date = new Date(numeric > 1e12 ? numeric : numeric * 1000);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }
            const dateTimeRaw = pickFirstString(game?.datetime, game?.date_time, game?.kickoff_datetime, game?.matchDateTime, game?.start_time, game?.spielbeginn);
            if (dateTimeRaw) {
                const parsed = parseDateWithOptionalTime(dateTimeRaw);
                if (parsed) {
                    return parsed;
                }
            }
            const dateRaw = pickFirstString(game?.date, game?.match_date, game?.game_date, game?.matchDate, game?.datum);
            const timeRaw = pickFirstString(game?.time, game?.match_time, game?.kickoff, game?.kickoff_time, game?.uhrzeit);
            if (dateRaw && timeRaw) {
                const parsed = parseDateWithOptionalTime(dateRaw, timeRaw);
                if (parsed) {
                    return parsed;
                }
            }
            if (dateRaw) {
                const parsed = parseDateWithOptionalTime(dateRaw);
                if (parsed) {
                    return parsed;
                }
            }
            return null;
        };
        const members = init_1.default.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(teamId);
        const memberIds = members.map((member) => member.user_id);
        const allowedStatuses = new Set(['pending', 'accepted', 'tentative', 'declined']);
        const defaultResponseStatus = allowedStatuses.has(String(team.default_response || 'pending'))
            ? String(team.default_response || 'pending')
            : 'pending';
        const insertEventStmt = init_1.default.prepare(`INSERT INTO events (
        team_id, title, type, description, location, location_venue, location_street, location_zip_city,
        pitch_type, meeting_point, arrival_minutes, start_time, end_time, rsvp_deadline, duration_minutes,
        visibility_all, invite_all, created_by, external_game_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const insertResponseStmt = init_1.default.prepare('INSERT INTO event_responses (event_id, user_id, status) VALUES (?, ?, ?)');
        const existingEventByExternalIdStmt = init_1.default.prepare('SELECT id FROM events WHERE external_game_id = ? LIMIT 1');
        const updateImportedEventStmt = init_1.default.prepare(`UPDATE events
       SET title = ?,
         description = ?,
         location = ?,
         location_venue = ?,
         arrival_minutes = ?,
         start_time = ?,
         end_time = ?,
         rsvp_deadline = ?,
         duration_minutes = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`);
        const created = [];
        const updated = [];
        const skipped = [];
        const maxImport = Math.min(20, Math.max(1, Number(req.body?.limit) || 8));
        for (const game of nextGames.slice(0, maxImport)) {
            const gameDate = parseGameDate(game);
            if (!gameDate) {
                skipped.push({ reason: 'invalid_date', game: pickFirstString(game?.id, game?.match_id, game?.game_id, game?.title) || 'unknown' });
                continue;
            }
            const homeTeam = pickFirstString(game?.homeTeam, game?.home_team, game?.home, game?.hometeam, game?.heim, game?.team_home);
            const awayTeam = pickFirstString(game?.awayTeam, game?.away_team, game?.away, game?.awayteam, game?.gast, game?.team_away);
            const title = pickFirstString(game?.title, game?.match_title, homeTeam && awayTeam ? `${homeTeam} - ${awayTeam}` : '', awayTeam ? `Spiel gegen ${awayTeam}` : '', homeTeam ? `Spiel: ${homeTeam}` : '', 'Spiel');
            const gameIdRaw = pickFirstString(game?.id, game?.match_id, game?.game_id, game?.fixture_id, game?.event_id);
            const syntheticId = `${team.fussballde_id}:${gameDate.toISOString()}:${homeTeam}:${awayTeam}`;
            const externalGameId = gameIdRaw || syntheticId;
            const endDate = new Date(gameDate.getTime() + 120 * 60 * 1000);
            const rsvpDeadline = defaultRsvpHours === null
                ? null
                : new Date(gameDate.getTime() - defaultRsvpHours * 60 * 60 * 1000).toISOString();
            const venue = pickFirstString(game?.location, game?.venue, game?.stadium, game?.place, game?.sportfield);
            const description = pickFirstString(game?.competition, game?.competition_short, game?.league, game?.staffel) || null;
            const exists = existingEventByExternalIdStmt.get(externalGameId);
            if (exists) {
                updateImportedEventStmt.run(title, description, venue || null, venue || null, defaultArrivalMinutes, gameDate.toISOString(), endDate.toISOString(), rsvpDeadline, 120, exists.id);
                updated.push({
                    id: Number(exists.id),
                    title,
                    start_time: gameDate.toISOString(),
                });
                continue;
            }
            const result = insertEventStmt.run(teamId, title, 'match', description, venue || null, venue || null, null, null, null, null, defaultArrivalMinutes, gameDate.toISOString(), endDate.toISOString(), rsvpDeadline, 120, 1, 1, req.user.id, externalGameId);
            for (const userId of memberIds) {
                insertResponseStmt.run(result.lastInsertRowid, userId, defaultResponseStatus);
            }
            created.push({
                id: Number(result.lastInsertRowid),
                title,
                start_time: gameDate.toISOString(),
            });
        }
        return res.json({
            success: true,
            imported: created.length,
            updated: updated.length,
            skipped: skipped.length,
            created,
            updatedItems: updated,
            skippedDetails: skipped,
        });
    }
    catch (error) {
        console.error('Import next games error:', error);
        return res.status(500).json({ error: 'Failed to import next games' });
    }
});
// Update fussball.de team id (trainers only)
router.put('/:id/fussballde-id', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const { fussballde_id } = req.body;
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can update fussball.de ID' });
        }
        const team = init_1.default.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        const normalizedId = String(fussballde_id || '').trim().toUpperCase();
        if (!normalizedId) {
            return res.status(400).json({ error: 'fussball.de ID ist erforderlich' });
        }
        const isValidFormat = /^[A-Z0-9]{16,40}$/.test(normalizedId);
        if (!isValidFormat) {
            return res.status(400).json({ error: 'Ungültiges fussball.de ID-Format' });
        }
        init_1.default.prepare('UPDATE teams SET fussballde_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(normalizedId, teamId);
        return res.json({ id: teamId, fussballde_id: normalizedId });
    }
    catch (error) {
        console.error('Update fussball.de id error:', error);
        return res.status(500).json({ error: 'Failed to update fussball.de ID' });
    }
});
// Get external team table from api-fussball.de
router.get('/:id/external-table', async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        const team = init_1.default.prepare('SELECT id, name, fussballde_id FROM teams WHERE id = ?').get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        if (!team.fussballde_id) {
            return res.status(400).json({ error: 'Für dieses Team ist keine fussball.de ID hinterlegt' });
        }
        const envToken = HARDCODED_FUSSBALL_API_TOKEN;
        const apiBaseUrl = process.env.FUSSBALL_API_BASE_URL || 'https://api-fussball.de/api';
        if (!envToken) {
            return res.status(500).json({ error: 'FUSSBALL_API_TOKEN ist nicht konfiguriert' });
        }
        const response = await fetch(`${apiBaseUrl}/team/table/${encodeURIComponent(team.fussballde_id)}`, {
            method: 'GET',
            headers: {
                'x-auth-token': envToken,
            },
        });
        if (!response.ok) {
            if (response.status === 401) {
                return res.status(502).json({
                    error: 'api-fussball.de Fehler (401): API-Token ungültig oder abgelaufen.',
                });
            }
            return res.status(502).json({ error: `api-fussball.de Fehler (${response.status})` });
        }
        const payload = await response.json();
        if (!payload?.success || !Array.isArray(payload?.data)) {
            return res.status(502).json({ error: 'Ungültige Antwort von api-fussball.de' });
        }
        const pickFirstString = (...values) => {
            for (const value of values) {
                if (typeof value === 'string' && value.trim()) {
                    return value.trim();
                }
            }
            return null;
        };
        const isFriendlyCompetition = (value) => {
            if (!value) {
                return false;
            }
            return /(freundschaft|friendly|testspiel)/i.test(value);
        };
        let leagueName = pickFirstString(payload?.leagueName, payload?.league_name, payload?.league, payload?.leagueTitle, payload?.league_title, payload?.competition, payload?.competitionName, payload?.competition_name, payload?.division, payload?.group, payload?.staffel, payload?.klasse, payload?.liga, payload?.title, payload?.name, payload?.meta?.leagueName, payload?.meta?.league_name, payload?.meta?.competition, payload?.meta?.competition_name, payload?.meta?.staffel, payload?.meta?.klasse, payload?.meta?.liga, payload?.data?.leagueName, payload?.data?.league_name, payload?.data?.league, payload?.data?.leagueTitle, payload?.data?.league_title, payload?.data?.competition, payload?.data?.competitionName, payload?.data?.competition_name, payload?.data?.division, payload?.data?.group, payload?.data?.staffel, payload?.data?.klasse, payload?.data?.liga, Array.isArray(payload?.data) ? payload.data[0]?.leagueName : null, Array.isArray(payload?.data) ? payload.data[0]?.league_name : null, Array.isArray(payload?.data) ? payload.data[0]?.league : null, Array.isArray(payload?.data) ? payload.data[0]?.leagueTitle : null, Array.isArray(payload?.data) ? payload.data[0]?.league_title : null, Array.isArray(payload?.data) ? payload.data[0]?.competition : null, Array.isArray(payload?.data) ? payload.data[0]?.competitionName : null, Array.isArray(payload?.data) ? payload.data[0]?.competition_name : null, Array.isArray(payload?.data) ? payload.data[0]?.division : null, Array.isArray(payload?.data) ? payload.data[0]?.group : null, Array.isArray(payload?.data) ? payload.data[0]?.staffel : null, Array.isArray(payload?.data) ? payload.data[0]?.klasse : null, Array.isArray(payload?.data) ? payload.data[0]?.liga : null, Array.isArray(payload?.data) ? payload.data[0]?.title : null, Array.isArray(payload?.data) ? payload.data[0]?.name : null);
        try {
            const teamInfoResponse = await fetch(`${apiBaseUrl}/team/${encodeURIComponent(team.fussballde_id)}`, {
                method: 'GET',
                headers: {
                    'x-auth-token': envToken,
                },
            });
            if (teamInfoResponse.ok) {
                const teamInfoPayload = await teamInfoResponse.json();
                const nextGames = Array.isArray(teamInfoPayload?.data?.nextGames) ? teamInfoPayload.data.nextGames : [];
                const prevGames = Array.isArray(teamInfoPayload?.data?.prevGames) ? teamInfoPayload.data.prevGames : [];
                const extractCompetition = (games) => {
                    const game = games.find((entry) => entry && typeof entry === 'object');
                    if (!game) {
                        return null;
                    }
                    return pickFirstString(game.competition_short, game.competitionShort, game.competition_short_name, game.competitionShortName, game.competition_abbreviation, game.competitionAbbreviation, game.league_short, game.leagueShort, game.league_code, game.leagueCode, game.competition, game.league);
                };
                const shortCompetition = extractCompetition(nextGames) || extractCompetition(prevGames) || null;
                if (!leagueName && shortCompetition && !isFriendlyCompetition(shortCompetition)) {
                    leagueName = shortCompetition;
                }
            }
        }
        catch (teamInfoError) {
            console.warn('Get external team league name warning:', teamInfoError);
        }
        return res.json({
            table: payload.data,
            leagueName,
        });
    }
    catch (error) {
        console.error('Get external team table error:', error);
        return res.status(500).json({ error: 'Failed to fetch external team table' });
    }
});
// Create team (admin only)
router.post('/', (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Team name is required' });
        }
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can create teams' });
        }
        const stmt = init_1.default.prepare('INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)');
        const result = stmt.run(name, description, req.user.id);
        // Team is created without members - admin will assign trainers via admin panel
        res.status(201).json({
            id: result.lastInsertRowid,
            name,
            description,
            created_by: req.user.id
        });
    }
    catch (error) {
        console.error('Create team error:', error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});
// Get team members
router.get('/:id/members', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        // Check membership
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        const members = init_1.default.prepare(`
      SELECT u.id, u.name, u.email, u.phone_number, u.birth_date, u.profile_picture, tm.role, tm.jersey_number, tm.position, tm.joined_at
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role, u.name
    `).all(teamId);
        res.json(members);
    }
    catch (error) {
        console.error('Get team members error:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});
// Add team member
router.post('/:id/members', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const { user_id, role = 'player', jersey_number, position } = req.body;
        // Check if user is trainer
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can add members' });
        }
        // Check if user exists
        const userExists = init_1.default.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
        if (!userExists) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Add member
        const stmt = init_1.default.prepare('INSERT INTO team_members (team_id, user_id, role, jersey_number, position) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(teamId, user_id, role, jersey_number, position);
        res.status(201).json({
            id: result.lastInsertRowid,
            team_id: teamId,
            user_id,
            role,
            jersey_number,
            position
        });
    }
    catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'User is already a team member' });
        }
        console.error('Add team member error:', error);
        res.status(500).json({ error: 'Failed to add team member' });
    }
});
// Create new player (trainer only)
router.post('/:id/players', async (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const { name, birth_date, jersey_number } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Player name is required' });
        }
        // Check if user is trainer of this team
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can create players' });
        }
        // Generate unique token
        const crypto = require('crypto');
        const token = crypto.randomBytes(16).toString('hex');
        // Create invite with player info
        const stmt = init_1.default.prepare('INSERT INTO team_invites (team_id, token, role, created_by, player_name, player_birth_date, player_jersey_number, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const result = stmt.run(teamId, token, 'player', req.user.id, name, birth_date || null, jersey_number || null, 1);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
        const inviteUrl = `${frontendUrl}/invite/${token}`;
        res.status(201).json({
            id: result.lastInsertRowid,
            name,
            birth_date,
            jersey_number,
            token,
            invite_url: inviteUrl
        });
    }
    catch (error) {
        console.error('Create player error:', error);
        res.status(500).json({ error: 'Failed to create player' });
    }
});
// Upload team picture (trainers only)
router.post('/:id/picture', upload.single('picture'), (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        // Check if user is trainer of this team
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can upload team pictures' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Delete old picture if exists
        const oldTeam = init_1.default.prepare('SELECT team_picture FROM teams WHERE id = ?').get(teamId);
        if (oldTeam?.team_picture) {
            const oldPath = path_1.default.join(uploadsDir, path_1.default.basename(oldTeam.team_picture));
            if (fs_1.default.existsSync(oldPath)) {
                fs_1.default.unlinkSync(oldPath);
            }
        }
        // Update team with new picture path
        const picturePath = `/uploads/${req.file.filename}`;
        init_1.default.prepare('UPDATE teams SET team_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(picturePath, teamId);
        res.json({ team_picture: picturePath });
    }
    catch (error) {
        console.error('Upload team picture error:', error);
        res.status(500).json({ error: 'Failed to upload team picture' });
    }
});
// Delete team picture (trainers only)
router.delete('/:id/picture', (req, res) => {
    try {
        const teamId = parseInt(req.params.id);
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership || membership.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can delete team pictures' });
        }
        const team = init_1.default.prepare('SELECT team_picture FROM teams WHERE id = ?').get(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        if (team.team_picture) {
            const picturePath = path_1.default.join(uploadsDir, path_1.default.basename(team.team_picture));
            if (fs_1.default.existsSync(picturePath)) {
                fs_1.default.unlinkSync(picturePath);
            }
        }
        init_1.default.prepare('UPDATE teams SET team_picture = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(teamId);
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Delete team picture error:', error);
        return res.status(500).json({ error: 'Failed to delete team picture' });
    }
});
exports.default = router;
//# sourceMappingURL=teams.js.map
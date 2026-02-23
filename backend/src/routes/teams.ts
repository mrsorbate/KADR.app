import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CreateTeamDTO } from '../types';

const router = Router();
const HARDCODED_FUSSBALL_API_TOKEN = 'w1G797J1N7u8a0e1R0C8A1Z2e5TYQm1Sezgk0lBUik';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for team picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'team-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// All routes require authentication
router.use(authenticate);

// Get all teams for current user
router.get('/', (req: AuthRequest, res) => {
  try {
    const teams = db.prepare(`
      SELECT t.*, tm.role as my_role
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
      ORDER BY t.name
    `).all(req.user!.id);

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team details
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    
    // Check if user is member
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Get team settings
router.get('/:id/settings', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const settings = db.prepare(
      `SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`
    ).get(teamId);

    if (!settings) {
      return res.status(404).json({ error: 'Team not found' });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Get team settings error:', error);
    return res.status(500).json({ error: 'Failed to fetch team settings' });
  }
});

// Update team settings (trainers only)
router.put('/:id/settings', (req: AuthRequest, res) => {
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

    const {
      fussballde_id,
      default_response,
      default_rsvp_deadline_hours,
      default_rsvp_deadline_hours_training,
      default_rsvp_deadline_hours_match,
      default_rsvp_deadline_hours_other,
      default_arrival_minutes,
      default_arrival_minutes_training,
      default_arrival_minutes_match,
      default_arrival_minutes_other,
    } = req.body as {
      fussballde_id?: string;
      default_response?: string;
      default_rsvp_deadline_hours?: number | string | null;
      default_rsvp_deadline_hours_training?: number | string | null;
      default_rsvp_deadline_hours_match?: number | string | null;
      default_rsvp_deadline_hours_other?: number | string | null;
      default_arrival_minutes?: number | string | null;
      default_arrival_minutes_training?: number | string | null;
      default_arrival_minutes_match?: number | string | null;
      default_arrival_minutes_other?: number | string | null;
    };

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update team settings' });
    }

    const team = db.prepare(
            `SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`
    ).get(teamId) as any;
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    let nextFussballId = team.fussballde_id as string | null;
    if (hasFussballId) {
      const normalizedFussballId = String(fussballde_id || '').trim().toUpperCase();
      if (normalizedFussballId && !/^[A-Z0-9]{16,40}$/.test(normalizedFussballId)) {
        return res.status(400).json({ error: 'Ungültiges fussball.de ID-Format' });
      }
      nextFussballId = normalizedFussballId || null;
    }

    const allowedDefaultResponses = new Set(['pending', 'accepted', 'tentative', 'declined']);
    let nextDefaultResponse = team.default_response as string | null;
    if (hasDefaultResponse) {
      const normalizedDefaultResponse = String(default_response || '').trim().toLowerCase() || 'pending';
      if (!allowedDefaultResponses.has(normalizedDefaultResponse)) {
        return res.status(400).json({ error: 'Ungültige Standard-Rückmeldung' });
      }
      nextDefaultResponse = normalizedDefaultResponse;
    }

    let nextDefaultRsvpDeadlineHours = team.default_rsvp_deadline_hours as number | null;
    if (hasDefaultRsvpDeadlineHours) {
      let normalizedRsvpDeadlineHours: number | null = null;
      if (default_rsvp_deadline_hours !== null && default_rsvp_deadline_hours !== undefined && String(default_rsvp_deadline_hours).trim() !== '') {
        normalizedRsvpDeadlineHours = parseInt(String(default_rsvp_deadline_hours), 10);
        if (!Number.isFinite(normalizedRsvpDeadlineHours) || normalizedRsvpDeadlineHours < 0 || normalizedRsvpDeadlineHours > 168) {
          return res.status(400).json({ error: 'Standard-Rückmeldefrist muss zwischen 0 und 168 Stunden liegen' });
        }
      }
      nextDefaultRsvpDeadlineHours = normalizedRsvpDeadlineHours;
    }

    const normalizeRsvpHours = (value: number | string | null | undefined): number | null | 'invalid' => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
        return 'invalid';
      }
      return parsed;
    };

    let nextDefaultRsvpDeadlineHoursTraining = team.default_rsvp_deadline_hours_training as number | null;
    if (hasDefaultRsvpDeadlineHoursTraining) {
      const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_training);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Rückmeldefrist Training muss zwischen 0 und 168 Stunden liegen' });
      }
      nextDefaultRsvpDeadlineHoursTraining = normalized;
    }

    let nextDefaultRsvpDeadlineHoursMatch = team.default_rsvp_deadline_hours_match as number | null;
    if (hasDefaultRsvpDeadlineHoursMatch) {
      const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_match);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Rückmeldefrist Spiel muss zwischen 0 und 168 Stunden liegen' });
      }
      nextDefaultRsvpDeadlineHoursMatch = normalized;
    }

    let nextDefaultRsvpDeadlineHoursOther = team.default_rsvp_deadline_hours_other as number | null;
    if (hasDefaultRsvpDeadlineHoursOther) {
      const normalized = normalizeRsvpHours(default_rsvp_deadline_hours_other);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Rückmeldefrist Sonstiges muss zwischen 0 und 168 Stunden liegen' });
      }
      nextDefaultRsvpDeadlineHoursOther = normalized;
    }

    let nextDefaultArrivalMinutes = team.default_arrival_minutes as number | null;
    if (hasDefaultArrivalMinutes) {
      let normalizedArrivalMinutes: number | null = null;
      if (default_arrival_minutes !== null && default_arrival_minutes !== undefined && String(default_arrival_minutes).trim() !== '') {
        normalizedArrivalMinutes = parseInt(String(default_arrival_minutes), 10);
        if (!Number.isFinite(normalizedArrivalMinutes) || normalizedArrivalMinutes < 0 || normalizedArrivalMinutes > 240) {
          return res.status(400).json({ error: 'Standard-Treffpunkt Minuten muss zwischen 0 und 240 liegen' });
        }
      }
      nextDefaultArrivalMinutes = normalizedArrivalMinutes;
    }

    const normalizeArrivalMinutes = (value: number | string | null | undefined): number | null | 'invalid' => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 240) {
        return 'invalid';
      }
      return parsed;
    };

    let nextDefaultArrivalMinutesTraining = team.default_arrival_minutes_training as number | null;
    if (hasDefaultArrivalMinutesTraining) {
      const normalized = normalizeArrivalMinutes(default_arrival_minutes_training);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Training muss zwischen 0 und 240 liegen' });
      }
      nextDefaultArrivalMinutesTraining = normalized;
    }

    let nextDefaultArrivalMinutesMatch = team.default_arrival_minutes_match as number | null;
    if (hasDefaultArrivalMinutesMatch) {
      const normalized = normalizeArrivalMinutes(default_arrival_minutes_match);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Spiel muss zwischen 0 und 240 liegen' });
      }
      nextDefaultArrivalMinutesMatch = normalized;
    }

    let nextDefaultArrivalMinutesOther = team.default_arrival_minutes_other as number | null;
    if (hasDefaultArrivalMinutesOther) {
      const normalized = normalizeArrivalMinutes(default_arrival_minutes_other);
      if (normalized === 'invalid') {
        return res.status(400).json({ error: 'Standard-Treffpunkt Minuten Sonstiges muss zwischen 0 und 240 liegen' });
      }
      nextDefaultArrivalMinutesOther = normalized;
    }

    db.prepare(
      `UPDATE teams
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
       WHERE id = ?`
    ).run(
      nextFussballId,
      nextDefaultResponse || 'pending',
      nextDefaultRsvpDeadlineHours,
      nextDefaultRsvpDeadlineHoursTraining,
      nextDefaultRsvpDeadlineHoursMatch,
      nextDefaultRsvpDeadlineHoursOther,
      nextDefaultArrivalMinutes,
      nextDefaultArrivalMinutesTraining,
      nextDefaultArrivalMinutesMatch,
      nextDefaultArrivalMinutesOther,
      teamId
    );

    const updatedSettings = db.prepare(
      `SELECT id, fussballde_id, default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`
    ).get(teamId);

    return res.json(updatedSettings);
  } catch (error) {
    console.error('Update team settings error:', error);
    return res.status(500).json({ error: 'Failed to update team settings' });
  }
});

// Update fussball.de team id (trainers only)
router.post('/:id/import-next-games', async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can import games' });
    }

    const team = db.prepare(
      `SELECT id, name, fussballde_id, default_response, default_rsvp_deadline_hours, default_rsvp_deadline_hours_match,
              default_arrival_minutes, default_arrival_minutes_match
       FROM teams WHERE id = ?`
    ).get(teamId) as any;

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

    const payload = await response.json() as any;
    const nextGames = Array.isArray(payload?.data?.nextGames) ? payload.data.nextGames : [];

    const pickFirstString = (...values: unknown[]): string => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return '';
    };

    const parseRsvpHours = (value: unknown): number | null => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = parseInt(String(value), 10);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 168) {
        return null;
      }
      return parsed;
    };

    const parseArrivalMinutes = (value: unknown): number | null => {
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

    const parseGameDate = (game: any): Date | null => {
      const parseDateWithOptionalTime = (dateValue: string, timeValue?: string): Date | null => {
        const dateText = String(dateValue || '').trim();
        const timeText = String(timeValue || '').trim();

        const normalizedTime = (() => {
          if (!timeText) return '19:00';
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

      const dateTimeRaw = pickFirstString(
        game?.datetime,
        game?.date_time,
        game?.kickoff_datetime,
        game?.matchDateTime,
        game?.start_time,
        game?.spielbeginn,
      );
      if (dateTimeRaw) {
        const parsed = parseDateWithOptionalTime(dateTimeRaw);
        if (parsed) {
          return parsed;
        }
      }

      const dateRaw = pickFirstString(
        game?.date,
        game?.match_date,
        game?.game_date,
        game?.matchDate,
        game?.datum,
      );
      const timeRaw = pickFirstString(
        game?.time,
        game?.match_time,
        game?.kickoff,
        game?.kickoff_time,
        game?.uhrzeit,
      );

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

    const members = db.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(teamId) as Array<{ user_id: number }>;
    const memberIds = members.map((member) => member.user_id);
    const allowedStatuses = new Set(['pending', 'accepted', 'tentative', 'declined']);
    const defaultResponseStatus = allowedStatuses.has(String(team.default_response || 'pending'))
      ? String(team.default_response || 'pending')
      : 'pending';

    const insertEventStmt = db.prepare(
      `INSERT INTO events (
        team_id, title, type, description, location, location_venue, location_street, location_zip_city,
        pitch_type, meeting_point, arrival_minutes, start_time, end_time, rsvp_deadline, duration_minutes,
        visibility_all, invite_all, created_by, external_game_id, is_home_match
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertResponseStmt = db.prepare('INSERT INTO event_responses (event_id, user_id, status) VALUES (?, ?, ?)');
    const existingEventByExternalIdStmt = db.prepare('SELECT id FROM events WHERE external_game_id = ? LIMIT 1');
    const updateImportedEventStmt = db.prepare(
      `UPDATE events
       SET title = ?,
         description = ?,
         location = ?,
         location_venue = ?,
         location_street = ?,
         location_zip_city = ?,
         arrival_minutes = ?,
         start_time = ?,
         end_time = ?,
         rsvp_deadline = ?,
         duration_minutes = ?,
         is_home_match = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    );

    const created: Array<{ id: number; title: string; start_time: string }> = [];
    const updated: Array<{ id: number; title: string; start_time: string }> = [];
    const skipped: Array<{ reason: string; game: string }> = [];

    const maxImport = Math.min(20, Math.max(1, Number(req.body?.limit) || 8));
    for (const game of nextGames.slice(0, maxImport)) {
      const gameDate = parseGameDate(game);
      if (!gameDate) {
        skipped.push({ reason: 'invalid_date', game: pickFirstString(game?.id, game?.match_id, game?.game_id, game?.title) || 'unknown' });
        continue;
      }

      const homeTeam = pickFirstString(game?.homeTeam, game?.home_team, game?.home, game?.hometeam, game?.heim, game?.team_home);
      const awayTeam = pickFirstString(game?.awayTeam, game?.away_team, game?.away, game?.awayteam, game?.gast, game?.team_away);
      
      // Determine if our team is home or away
      const teamNameTrimmed = (team.name || '').trim().toLowerCase();
      const homeTeamTrimmed = (homeTeam || '').trim().toLowerCase();
      const awayTeamTrimmed = (awayTeam || '').trim().toLowerCase();
      
      // Check if team name matches home team (exact match or contains)
      const isHomeMatch = 
        teamNameTrimmed === homeTeamTrimmed || 
        homeTeamTrimmed.includes(teamNameTrimmed) 
          ? 1 : 0;
      
      // Debug logging
      console.log(`[Game Import] Team: ${team.name}, HomeTeam: ${homeTeam}, AwayTeam: ${awayTeam}, isHome: ${isHomeMatch}`);
      
      const title = pickFirstString(
        game?.title,
        game?.match_title,
        homeTeam && awayTeam ? `${homeTeam} - ${awayTeam}` : '',
        awayTeam ? `Spiel gegen ${awayTeam}` : '',
        homeTeam ? `Spiel: ${homeTeam}` : '',
        'Spiel',
      );

      const gameIdRaw = pickFirstString(
        game?.id,
        game?.match_id,
        game?.game_id,
        game?.fixture_id,
        game?.event_id,
      );

      const syntheticId = `${team.fussballde_id}:${gameDate.toISOString()}:${homeTeam}:${awayTeam}`;
      const externalGameId = gameIdRaw || syntheticId;

      const endDate = new Date(gameDate.getTime() + 120 * 60 * 1000);
      const rsvpDeadline =
        defaultRsvpHours === null
          ? null
          : new Date(gameDate.getTime() - defaultRsvpHours * 60 * 60 * 1000).toISOString();

      const venue = pickFirstString(game?.location, game?.venue, game?.stadium, game?.place, game?.sportfield);
      const street = pickFirstString(game?.street, game?.strasse, game?.address, game?.adresse, game?.location_street);
      const zipCity = pickFirstString(game?.zip_city, game?.ort, game?.city, game?.location_zip_city, game?.postleitzahl_stadt);
      const description = pickFirstString(game?.competition, game?.competition_short, game?.league, game?.staffel) || null;

      const exists = existingEventByExternalIdStmt.get(externalGameId) as { id: number } | undefined;
      if (exists) {
        updateImportedEventStmt.run(
          title,
          description,
          venue || null,
          venue || null,
          street || null,
          zipCity || null,
          defaultArrivalMinutes,
          gameDate.toISOString(),
          endDate.toISOString(),
          rsvpDeadline,
          120,
          isHomeMatch,
          exists.id,
        );

        updated.push({
          id: Number(exists.id),
          title,
          start_time: gameDate.toISOString(),
        });
        continue;
      }

      const result = insertEventStmt.run(
        teamId,
        title,
        'match',
        description,
        venue || null,
        venue || null,
        street || null,
        zipCity || null,
        null,
        null,
        defaultArrivalMinutes,
        gameDate.toISOString(),
        endDate.toISOString(),
        rsvpDeadline,
        120,
        1,
        1,
        req.user!.id,
        externalGameId,
        isHomeMatch,
      );

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
  } catch (error) {
    console.error('Import next games error:', error);
    return res.status(500).json({ error: 'Failed to import next games' });
  }
});

// Update fussball.de team id (trainers only)
router.put('/:id/fussballde-id', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { fussballde_id } = req.body as { fussballde_id?: string };

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update fussball.de ID' });
    }

    const team = db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
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

    db.prepare('UPDATE teams SET fussballde_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(normalizedId, teamId);

    return res.json({ id: teamId, fussballde_id: normalizedId });
  } catch (error) {
    console.error('Update fussball.de id error:', error);
    return res.status(500).json({ error: 'Failed to update fussball.de ID' });
  }
});

// Get external team table from api-fussball.de
router.get('/:id/external-table', async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const team = db.prepare('SELECT id, name, fussballde_id FROM teams WHERE id = ?').get(teamId) as any;

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

    const payload = await response.json() as any;

    if (!payload?.success || !Array.isArray(payload?.data)) {
      return res.status(502).json({ error: 'Ungültige Antwort von api-fussball.de' });
    }

    const pickFirstString = (...values: unknown[]): string | null => {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
      return null;
    };

    const isFriendlyCompetition = (value: string | null): boolean => {
      if (!value) {
        return false;
      }
      return /(freundschaft|friendly|testspiel)/i.test(value);
    };

    let leagueName: string | null = pickFirstString(
      payload?.leagueName,
      payload?.league_name,
      payload?.league,
      payload?.leagueTitle,
      payload?.league_title,
      payload?.competition,
      payload?.competitionName,
      payload?.competition_name,
      payload?.division,
      payload?.group,
      payload?.staffel,
      payload?.klasse,
      payload?.liga,
      payload?.title,
      payload?.name,
      payload?.meta?.leagueName,
      payload?.meta?.league_name,
      payload?.meta?.competition,
      payload?.meta?.competition_name,
      payload?.meta?.staffel,
      payload?.meta?.klasse,
      payload?.meta?.liga,
      payload?.data?.leagueName,
      payload?.data?.league_name,
      payload?.data?.league,
      payload?.data?.leagueTitle,
      payload?.data?.league_title,
      payload?.data?.competition,
      payload?.data?.competitionName,
      payload?.data?.competition_name,
      payload?.data?.division,
      payload?.data?.group,
      payload?.data?.staffel,
      payload?.data?.klasse,
      payload?.data?.liga,
      Array.isArray(payload?.data) ? payload.data[0]?.leagueName : null,
      Array.isArray(payload?.data) ? payload.data[0]?.league_name : null,
      Array.isArray(payload?.data) ? payload.data[0]?.league : null,
      Array.isArray(payload?.data) ? payload.data[0]?.leagueTitle : null,
      Array.isArray(payload?.data) ? payload.data[0]?.league_title : null,
      Array.isArray(payload?.data) ? payload.data[0]?.competition : null,
      Array.isArray(payload?.data) ? payload.data[0]?.competitionName : null,
      Array.isArray(payload?.data) ? payload.data[0]?.competition_name : null,
      Array.isArray(payload?.data) ? payload.data[0]?.division : null,
      Array.isArray(payload?.data) ? payload.data[0]?.group : null,
      Array.isArray(payload?.data) ? payload.data[0]?.staffel : null,
      Array.isArray(payload?.data) ? payload.data[0]?.klasse : null,
      Array.isArray(payload?.data) ? payload.data[0]?.liga : null,
      Array.isArray(payload?.data) ? payload.data[0]?.title : null,
      Array.isArray(payload?.data) ? payload.data[0]?.name : null,
    );

    try {
      const teamInfoResponse = await fetch(`${apiBaseUrl}/team/${encodeURIComponent(team.fussballde_id)}`, {
        method: 'GET',
        headers: {
          'x-auth-token': envToken,
        },
      });

      if (teamInfoResponse.ok) {
        const teamInfoPayload = await teamInfoResponse.json() as any;
        const nextGames = Array.isArray(teamInfoPayload?.data?.nextGames) ? teamInfoPayload.data.nextGames : [];
        const prevGames = Array.isArray(teamInfoPayload?.data?.prevGames) ? teamInfoPayload.data.prevGames : [];
        const extractCompetition = (games: any[]) => {
          const game = games.find((entry) => entry && typeof entry === 'object');
          if (!game) {
            return null;
          }
          return pickFirstString(
            game.competition_short,
            game.competitionShort,
            game.competition_short_name,
            game.competitionShortName,
            game.competition_abbreviation,
            game.competitionAbbreviation,
            game.league_short,
            game.leagueShort,
            game.league_code,
            game.leagueCode,
            game.competition,
            game.league,
          );
        };

        const shortCompetition = extractCompetition(nextGames) || extractCompetition(prevGames) || null;
        if (!leagueName && shortCompetition && !isFriendlyCompetition(shortCompetition)) {
          leagueName = shortCompetition;
        }
      }
    } catch (teamInfoError) {
      console.warn('Get external team league name warning:', teamInfoError);
    }

    return res.json({
      table: payload.data,
      leagueName,
    });
  } catch (error) {
    console.error('Get external team table error:', error);
    return res.status(500).json({ error: 'Failed to fetch external team table' });
  }
});

// Create team (admin only)
router.post('/', (req: AuthRequest, res) => {
  try {
    const { name, description }: CreateTeamDTO = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create teams' });
    }

    const stmt = db.prepare(
      'INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, description, req.user!.id);

    // Team is created without members - admin will assign trainers via admin panel

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      description,
      created_by: req.user!.id
    });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get team members
router.get('/:id/members', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);

    // Check membership
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    const members = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone_number, u.birth_date, u.profile_picture, tm.role, tm.jersey_number, tm.position, tm.joined_at
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role, u.name
    `).all(teamId);

    res.json(members);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add team member
router.post('/:id/members', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { user_id, role = 'player', jersey_number, position } = req.body;

    // Check if user is trainer
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can add members' });
    }

    // Check if user exists
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add member
    const stmt = db.prepare(
      'INSERT INTO team_members (team_id, user_id, role, jersey_number, position) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(teamId, user_id, role, jersey_number, position);

    res.status(201).json({
      id: result.lastInsertRowid,
      team_id: teamId,
      user_id,
      role,
      jersey_number,
      position
    });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'User is already a team member' });
    }
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Create new player (trainer only)
router.post('/:id/players', async (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);
    const { name, birth_date, jersey_number } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    // Check if user is trainer of this team
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create players' });
    }

    // Generate unique token
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');

    // Create invite with player info
    const stmt = db.prepare(
      'INSERT INTO team_invites (team_id, token, role, created_by, player_name, player_birth_date, player_jersey_number, max_uses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(teamId, token, 'player', req.user!.id, name, birth_date || null, jersey_number || null, 1);

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
  } catch (error) {
    console.error('Create player error:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Upload team picture (trainers only)
router.post('/:id/picture', upload.single('picture') as any, (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);

    // Check if user is trainer of this team
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can upload team pictures' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old picture if exists
    const oldTeam = db.prepare('SELECT team_picture FROM teams WHERE id = ?').get(teamId) as any;
    if (oldTeam?.team_picture) {
      const oldPath = path.join(uploadsDir, path.basename(oldTeam.team_picture));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update team with new picture path
    const picturePath = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE teams SET team_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(picturePath, teamId);

    res.json({ team_picture: picturePath });
  } catch (error) {
    console.error('Upload team picture error:', error);
    res.status(500).json({ error: 'Failed to upload team picture' });
  }
});

// Delete team picture (trainers only)
router.delete('/:id/picture', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.id);

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete team pictures' });
    }

    const team = db.prepare('SELECT team_picture FROM teams WHERE id = ?').get(teamId) as any;
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.team_picture) {
      const picturePath = path.join(uploadsDir, path.basename(team.team_picture));
      if (fs.existsSync(picturePath)) {
        fs.unlinkSync(picturePath);
      }
    }

    db.prepare('UPDATE teams SET team_picture = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(teamId);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete team picture error:', error);
    return res.status(500).json({ error: 'Failed to delete team picture' });
  }
});

export default router;


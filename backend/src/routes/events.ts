import { Router } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { CreateEventDTO, UpdateEventResponseDTO } from '../types';
import { randomBytes } from 'crypto';

const router = Router();

router.use(authenticate);

router.use((_req, _res, next) => {
  try {
    db.prepare(`
      UPDATE event_responses
      SET status = 'declined',
          responded_at = CURRENT_TIMESTAMP
      WHERE status = 'tentative'
        AND event_id IN (
          SELECT id
          FROM events
          WHERE rsvp_deadline IS NOT NULL
            AND rsvp_deadline <= ?
        )
    `).run(new Date().toISOString());
  } catch (error) {
    console.error('Auto-convert tentative responses error:', error);
  }

  next();
});

// Helper function to generate recurring event dates
function generateRecurringDates(
  startTime: Date,
  endTime: Date,
  repeatType: string,
  repeatUntil: Date,
  repeatDays?: number[]
): Array<{ start: Date; end: Date }> {
  const dates: Array<{ start: Date; end: Date }> = [];
  const duration = endTime.getTime() - startTime.getTime();
  
  if (repeatType === 'weekly' && repeatDays && repeatDays.length > 0) {
    let currentDate = new Date(startTime);
    
    // Go through each week until repeat_until
    while (currentDate <= repeatUntil) {
      // Check each day of the week
      for (const dayOfWeek of repeatDays) {
        const eventDate = new Date(currentDate);
        const currentDay = eventDate.getDay();
        const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        eventDate.setDate(eventDate.getDate() + daysToAdd);
        
        // Only add if within the date range and not before start
        if (eventDate >= startTime && eventDate <= repeatUntil) {
          const start = new Date(eventDate);
          const end = new Date(start.getTime() + duration);
          dates.push({ start, end });
        }
      }
      
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }
  } else if (repeatType === 'custom' && repeatDays && repeatDays.length > 0) {
    // Custom: specific days, but check all occurrences
    let currentDate = new Date(startTime);
    currentDate.setHours(0, 0, 0, 0); // Start from beginning of day
    
    while (currentDate <= repeatUntil) {
      if (repeatDays.includes(currentDate.getDay())) {
        const start = new Date(currentDate);
        start.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        
        if (start >= startTime && start <= repeatUntil) {
          const end = new Date(start.getTime() + duration);
          dates.push({ start, end });
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  // Sort by date
  dates.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  return dates;
}

// Get upcoming events for user (next 6 events)
router.get('/my-upcoming', (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();

    const events = db.prepare(`
      SELECT e.*, 
             t.name as team_name,
             u.name as created_by_name,
             er.status as my_status,
             er.comment as my_comment,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'accepted') as accepted_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'declined') as declined_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'tentative') as tentative_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'pending') as pending_count
      FROM events e
      INNER JOIN teams t ON e.team_id = t.id
      INNER JOIN users u ON e.created_by = u.id
      INNER JOIN team_members tm ON e.team_id = tm.team_id AND tm.user_id = ?
      LEFT JOIN event_responses er ON er.event_id = e.id AND er.user_id = ?
      WHERE e.start_time >= ?
      ORDER BY e.start_time ASC
      LIMIT 6
    `).all(req.user!.id, req.user!.id, now);

    res.json(events);
  } catch (error) {
    console.error('Get my upcoming events error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

// Get all future events for user across all teams
router.get('/my-all', (req: AuthRequest, res) => {
  try {
    const now = new Date().toISOString();

    const events = db.prepare(`
      SELECT e.*, 
             t.name as team_name,
             u.name as created_by_name,
             er.status as my_status,
             er.comment as my_comment,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'accepted') as accepted_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'declined') as declined_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'tentative') as tentative_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'pending') as pending_count
      FROM events e
      INNER JOIN teams t ON e.team_id = t.id
      INNER JOIN users u ON e.created_by = u.id
      INNER JOIN team_members tm ON e.team_id = tm.team_id AND tm.user_id = ?
      LEFT JOIN event_responses er ON er.event_id = e.id AND er.user_id = ?
      WHERE e.start_time >= ?
      ORDER BY e.start_time ASC
    `).all(req.user!.id, req.user!.id, now);

    res.json(events);
  } catch (error) {
    console.error('Get my all events error:', error);
    res.status(500).json({ error: 'Failed to fetch all events' });
  }
});

// Get events for a team
router.get('/', (req: AuthRequest, res) => {
  try {
    const { team_id, from, to } = req.query;
    const now = new Date().toISOString();

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    // Check membership
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(team_id, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    let query = `
      SELECT e.*, 
             t.name as team_name,
             u.name as created_by_name,
             er.status as my_status,
             er.comment as my_comment,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'accepted') as accepted_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'declined') as declined_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'tentative') as tentative_count,
             (SELECT COUNT(*) FROM event_responses WHERE event_id = e.id AND status = 'pending') as pending_count
      FROM events e
      INNER JOIN teams t ON e.team_id = t.id
      INNER JOIN users u ON e.created_by = u.id
      LEFT JOIN event_responses er ON er.event_id = e.id AND er.user_id = ?
      WHERE e.team_id = ?
    `;

    const params: any[] = [req.user!.id, team_id];

    if (from) {
      query += ' AND e.start_time >= ?';
      params.push(from);
    } else if (!to) {
      query += ' AND e.start_time >= ?';
      params.push(now);
    }

    if (to) {
      query += ' AND e.start_time <= ?';
      params.push(to);
    }

    query += ' ORDER BY e.start_time ASC';

    const events = db.prepare(query).all(...params);

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id);

    const event = db.prepare(`
      SELECT e.*, u.name as created_by_name, t.name as team_name
      FROM events e
      INNER JOIN users u ON e.created_by = u.id
      INNER JOIN teams t ON e.team_id = t.id
      WHERE e.id = ?
    `).get(eventId) as any;

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check membership
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, req.user!.id) as any;

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get responses
    let responses = db.prepare(`
      SELECT er.*, u.name as user_name, u.profile_picture as user_profile_picture
      FROM event_responses er
      INNER JOIN users u ON er.user_id = u.id
      WHERE er.event_id = ?
      ORDER BY er.responded_at DESC
    `).all(eventId);

    const canViewResponses = membership.role === 'trainer' || event.visibility_all === 1 || event.visibility_all === true;
    if (!canViewResponses) {
      responses = responses.filter((response: any) => response.user_id === req.user!.id);
    }

    res.json({ ...event, responses });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event (or series)
router.post('/', (req: AuthRequest, res) => {
  try {
    const { 
      team_id, 
      title, 
      type, 
      description, 
      location,
      location_venue,
      location_street,
      location_zip_city,
      pitch_type,
      meeting_point,
      arrival_minutes,
      start_time, 
      end_time,
      rsvp_deadline,
      duration_minutes,
      visibility_all = true,
      invite_all = true,
      invited_user_ids = [],
      repeat_type,
      repeat_until,
      repeat_days
    }: CreateEventDTO = req.body;

    if (!team_id || !title || !type || !start_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let resolvedEndTime = end_time;
    if (duration_minutes && start_time) {
      const startDate = new Date(start_time);
      const computedEnd = new Date(startDate.getTime() + duration_minutes * 60000);
      resolvedEndTime = computedEnd.toISOString();
    }

    if (!resolvedEndTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const resolvedLocation = location_venue || location || null;

    // Check if user is trainer
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(team_id, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can create events' });
    }

    const teamSettings = db.prepare(
      `SELECT default_response, default_rsvp_deadline_hours,
              default_rsvp_deadline_hours_training, default_rsvp_deadline_hours_match, default_rsvp_deadline_hours_other,
              default_arrival_minutes, default_arrival_minutes_training, default_arrival_minutes_match, default_arrival_minutes_other
       FROM teams WHERE id = ?`
    ).get(team_id) as any;

    const validDefaultStatuses = new Set(['pending', 'accepted', 'tentative', 'declined']);
    const defaultResponseStatus = validDefaultStatuses.has(teamSettings?.default_response)
      ? teamSettings.default_response
      : 'pending';

    const resolvedMeetingPoint = meeting_point || null;

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

    const defaultArrivalMinutesByType: Record<'training' | 'match' | 'other', number | null> = {
      training: parseArrivalMinutes(teamSettings?.default_arrival_minutes_training),
      match: parseArrivalMinutes(teamSettings?.default_arrival_minutes_match),
      other: parseArrivalMinutes(teamSettings?.default_arrival_minutes_other),
    };

    const legacyDefaultArrivalMinutes = parseArrivalMinutes(teamSettings?.default_arrival_minutes);

    const selectedDefaultArrivalMinutes =
      defaultArrivalMinutesByType[(type as 'training' | 'match' | 'other') || 'other'] ?? legacyDefaultArrivalMinutes;

    const resolvedArrivalMinutes = arrival_minutes ?? selectedDefaultArrivalMinutes ?? null;

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

    const defaultRsvpDeadlineHoursByType: Record<'training' | 'match' | 'other', number | null> = {
      training: parseRsvpHours(teamSettings?.default_rsvp_deadline_hours_training),
      match: parseRsvpHours(teamSettings?.default_rsvp_deadline_hours_match),
      other: parseRsvpHours(teamSettings?.default_rsvp_deadline_hours_other),
    };

    const legacyDefaultRsvpDeadlineHours = parseRsvpHours(teamSettings?.default_rsvp_deadline_hours);

    const selectedDefaultRsvpDeadlineHours =
      defaultRsvpDeadlineHoursByType[(type as 'training' | 'match' | 'other') || 'other'] ?? legacyDefaultRsvpDeadlineHours;

    const getDefaultRsvpDeadline = (eventStart: string): string | null => {
      if (rsvp_deadline) {
        return rsvp_deadline;
      }
      if (selectedDefaultRsvpDeadlineHours === null) {
        return null;
      }

      const startDate = new Date(eventStart);
      if (isNaN(startDate.getTime())) {
        return null;
      }

      const deadlineDate = new Date(startDate.getTime() - selectedDefaultRsvpDeadlineHours * 60 * 60 * 1000);
      return deadlineDate.toISOString();
    };

    // Get all team members for responses
    const members = db.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(team_id) as any[];
    const memberIds = members.map((member) => member.user_id);

    let invitedUserIds = invited_user_ids?.length ? invited_user_ids : (invite_all ? memberIds : []);
    invitedUserIds = invitedUserIds.filter((id) => memberIds.includes(id));

    if (invitedUserIds.length === 0) {
      return res.status(400).json({ error: 'At least one invited user is required' });
    }
    
    const normalizedRepeatDays = Array.isArray(repeat_days)
      ? [...new Set(repeat_days.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6))]
      : [];

    const startDateForSeries = new Date(start_time);
    const weeklyFallbackDays = Number.isNaN(startDateForSeries.getTime()) ? [] : [startDateForSeries.getDay()];
    const effectiveRepeatDays =
      repeat_type === 'weekly'
        ? (normalizedRepeatDays.length > 0 ? normalizedRepeatDays : weeklyFallbackDays)
        : normalizedRepeatDays;

    const repeatUntilValue = typeof repeat_until === 'string' ? repeat_until : '';

    // Check if this is a recurring event
    const isRecurring = Boolean(
      repeat_type
      && repeat_type !== 'none'
      && repeatUntilValue
      && effectiveRepeatDays.length > 0
    );
    
    if (isRecurring) {
      // Generate series ID
      const seriesId = randomBytes(16).toString('hex');
      
      // Generate all event dates
      const startDate = new Date(start_time);
      const endDate = new Date(resolvedEndTime);
      const untilDate = new Date(repeatUntilValue);
      
      const eventDates = generateRecurringDates(startDate, endDate, repeat_type!, untilDate, effectiveRepeatDays);
      
      if (eventDates.length === 0) {
        return res.status(400).json({ error: 'No valid dates generated for recurring event' });
      }
      
      // Create all events in the series
      const stmt = db.prepare(
        'INSERT INTO events (team_id, title, type, description, location, location_venue, location_street, location_zip_city, pitch_type, meeting_point, arrival_minutes, start_time, end_time, rsvp_deadline, duration_minutes, visibility_all, invite_all, created_by, series_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      
      const responseStmt = db.prepare(
        'INSERT INTO event_responses (event_id, user_id, status) VALUES (?, ?, ?)'
      );
      
      const createdEvents = [];
      
      for (const { start, end } of eventDates) {
        const result = stmt.run(
          team_id, 
          title, 
          type, 
          description, 
          resolvedLocation,
          location_venue || null,
          location_street || null,
          location_zip_city || null,
          pitch_type || null,
          resolvedMeetingPoint,
          resolvedArrivalMinutes,
          start.toISOString(), 
          end.toISOString(), 
          getDefaultRsvpDeadline(start.toISOString()),
          duration_minutes ?? null,
          visibility_all ? 1 : 0,
          invite_all ? 1 : 0,
          req.user!.id,
          seriesId
        );
        
        // Create pending responses for all team members
        for (const userId of invitedUserIds) {
          responseStmt.run(result.lastInsertRowid, userId, defaultResponseStatus);
        }
        
        createdEvents.push({
          id: result.lastInsertRowid,
          start_time: start.toISOString(),
          end_time: end.toISOString()
        });
      }
      
      return res.status(201).json({
        message: `Created ${createdEvents.length} events in series`,
        series_id: seriesId,
        events: createdEvents
      });
    } else {
      // Create single event
      const stmt = db.prepare(
        'INSERT INTO events (team_id, title, type, description, location, location_venue, location_street, location_zip_city, pitch_type, meeting_point, arrival_minutes, start_time, end_time, rsvp_deadline, duration_minutes, visibility_all, invite_all, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(
        team_id,
        title,
        type,
        description,
        resolvedLocation,
        location_venue || null,
        location_street || null,
        location_zip_city || null,
        pitch_type || null,
        resolvedMeetingPoint,
        resolvedArrivalMinutes,
        start_time,
        resolvedEndTime,
        getDefaultRsvpDeadline(start_time),
        duration_minutes ?? null,
        visibility_all ? 1 : 0,
        invite_all ? 1 : 0,
        req.user!.id
      );

      const resolvedSingleRsvpDeadline = getDefaultRsvpDeadline(start_time);

      // Create pending responses for all team members
      const responseStmt = db.prepare(
        'INSERT INTO event_responses (event_id, user_id, status) VALUES (?, ?, ?)'
      );

      for (const userId of invitedUserIds) {
        responseStmt.run(result.lastInsertRowid, userId, defaultResponseStatus);
      }

      return res.status(201).json({
        id: result.lastInsertRowid,
        team_id,
        title,
        type,
        description,
        location,
        start_time,
        end_time: resolvedEndTime,
        rsvp_deadline: resolvedSingleRsvpDeadline,
        duration_minutes: duration_minutes ?? null,
        visibility_all: visibility_all ? 1 : 0,
        invite_all: invite_all ? 1 : 0,
        created_by: req.user!.id
      });
    }
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event response
router.put('/:id', (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const updateSeries = req.query.update_series === 'true';
    const {
      title,
      type,
      description,
      location,
      location_venue,
      location_street,
      location_zip_city,
      pitch_type,
      meeting_point,
      arrival_minutes,
      start_time,
      end_time,
      rsvp_deadline,
      duration_minutes,
      visibility_all,
      invite_all,
      invited_user_ids,
    } = req.body as {
      title?: string;
      type?: 'training' | 'match' | 'other';
      description?: string;
      location?: string;
      location_venue?: string;
      location_street?: string;
      location_zip_city?: string;
      pitch_type?: string;
      meeting_point?: string;
      arrival_minutes?: number | null;
      start_time?: string;
      end_time?: string;
      rsvp_deadline?: string;
      duration_minutes?: number | null;
      visibility_all?: boolean | number;
      invite_all?: boolean | number;
      invited_user_ids?: number[];
    };

    if (!title || !type || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const event = db.prepare('SELECT id, team_id, series_id, start_time, end_time FROM events WHERE id = ?').get(eventId) as any;
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can edit events' });
    }

    const resolvedLocation = location_venue || location || null;

    const teamMembers = db.prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(event.team_id) as Array<{ user_id: number }>;
    const teamMemberIds = teamMembers.map((member) => Number(member.user_id));
    const normalizedInvitedUserIds = Array.isArray(invited_user_ids)
      ? [...new Set(invited_user_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && teamMemberIds.includes(value)))]
      : [];

    const resolvedInviteAll = !(invite_all === false || invite_all === 0);
    const resolvedInvitedUserIds = resolvedInviteAll ? teamMemberIds : normalizedInvitedUserIds;

    if (!resolvedInviteAll && resolvedInvitedUserIds.length === 0) {
      return res.status(400).json({ error: 'Bitte mindestens einen Teilnehmer einladen' });
    }

    const sourceStartDate = new Date(event.start_time);
    const targetStartDate = new Date(start_time);
    const targetEndDate = new Date(end_time);

    if (Number.isNaN(sourceStartDate.getTime()) || Number.isNaN(targetStartDate.getTime()) || Number.isNaN(targetEndDate.getTime())) {
      return res.status(400).json({ error: 'Ungültige Datumswerte' });
    }

    const startShiftMs = targetStartDate.getTime() - sourceStartDate.getTime();
    const targetDurationMs = targetEndDate.getTime() - targetStartDate.getTime();

    if (!Number.isFinite(targetDurationMs) || targetDurationMs < 0) {
      return res.status(400).json({ error: 'Ungültige Endzeit' });
    }

    const targetRsvpDate = rsvp_deadline ? new Date(rsvp_deadline) : null;
    if (targetRsvpDate && Number.isNaN(targetRsvpDate.getTime())) {
      return res.status(400).json({ error: 'Ungültige Rückmeldefrist' });
    }
    const targetRsvpOffsetMs = targetRsvpDate
      ? targetStartDate.getTime() - targetRsvpDate.getTime()
      : null;

    const eventsToUpdate = updateSeries && event.series_id
      ? db.prepare('SELECT id, start_time FROM events WHERE series_id = ?').all(event.series_id) as Array<{ id: number; start_time: string }>
      : [{ id: eventId, start_time: event.start_time }];

    const updateStmt = db.prepare(
      `UPDATE events
       SET title = ?,
           type = ?,
           description = ?,
           location = ?,
           location_venue = ?,
           location_street = ?,
           location_zip_city = ?,
           pitch_type = ?,
           meeting_point = ?,
           arrival_minutes = ?,
           start_time = ?,
           end_time = ?,
           rsvp_deadline = ?,
           duration_minutes = ?,
           visibility_all = ?,
           invite_all = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    );

    const teamSettings = db.prepare('SELECT default_response FROM teams WHERE id = ?').get(event.team_id) as { default_response?: string } | undefined;
    const validStatuses = new Set(['pending', 'accepted', 'tentative', 'declined']);
    const defaultResponseStatus = validStatuses.has(String(teamSettings?.default_response || 'pending'))
      ? String(teamSettings?.default_response || 'pending')
      : 'pending';

    const syncInvitesForEvent = (targetEventId: number) => {
      const existingResponses = db.prepare('SELECT user_id FROM event_responses WHERE event_id = ?').all(targetEventId) as Array<{ user_id: number }>;
      const existingUserIdSet = new Set(existingResponses.map((row) => Number(row.user_id)));
      const invitedUserIdSet = new Set(resolvedInvitedUserIds);

      const usersToAdd = resolvedInvitedUserIds.filter((userId) => !existingUserIdSet.has(userId));
      const usersToRemove = [...existingUserIdSet].filter((userId) => !invitedUserIdSet.has(userId));

      if (usersToRemove.length > 0) {
        const placeholders = usersToRemove.map(() => '?').join(',');
        db.prepare(`DELETE FROM event_responses WHERE event_id = ? AND user_id IN (${placeholders})`).run(targetEventId, ...usersToRemove);
      }

      if (usersToAdd.length > 0) {
        const insertStmt = db.prepare('INSERT INTO event_responses (event_id, user_id, status) VALUES (?, ?, ?)');
        for (const userId of usersToAdd) {
          insertStmt.run(targetEventId, userId, defaultResponseStatus);
        }
      }
    };

    for (const targetEvent of eventsToUpdate) {
      const currentStart = new Date(targetEvent.start_time);
      const nextStartDate = Number.isNaN(currentStart.getTime())
        ? targetStartDate
        : new Date(currentStart.getTime() + startShiftMs);
      const nextEndDate = new Date(nextStartDate.getTime() + targetDurationMs);
      const nextRsvpDeadline = targetRsvpOffsetMs === null
        ? null
        : new Date(nextStartDate.getTime() - targetRsvpOffsetMs).toISOString();

      updateStmt.run(
        title,
        type,
        description || null,
        resolvedLocation,
        location_venue || null,
        location_street || null,
        location_zip_city || null,
        pitch_type || null,
        meeting_point || null,
        arrival_minutes === null || arrival_minutes === undefined || Number.isNaN(arrival_minutes) ? null : arrival_minutes,
        nextStartDate.toISOString(),
        nextEndDate.toISOString(),
        nextRsvpDeadline,
        duration_minutes === null || duration_minutes === undefined || Number.isNaN(duration_minutes) ? null : duration_minutes,
        visibility_all === false || visibility_all === 0 ? 0 : 1,
        resolvedInviteAll ? 1 : 0,
        targetEvent.id
      );

      syncInvitesForEvent(targetEvent.id);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ error: 'Failed to update event' });
  }
});

// Update event response
router.post('/:id/response', (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { status, comment }: UpdateEventResponseDTO = req.body;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['accepted', 'declined', 'tentative', 'pending']);
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (!normalizedStatus) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (normalizedStatus === 'declined' && !normalizedComment) {
      return res.status(400).json({ error: 'Bitte gib einen Grund für die Absage an' });
    }

    // Check if event exists and user is member
    const event = db.prepare('SELECT team_id, rsvp_deadline FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (normalizedStatus === 'tentative' && event.rsvp_deadline) {
      const deadlineDate = new Date(event.rsvp_deadline);
      if (!Number.isNaN(deadlineDate.getTime())) {
        const tentativeCutoff = new Date(deadlineDate.getTime() - 60 * 60 * 1000);
        if (new Date() >= tentativeCutoff) {
          return res.status(400).json({ error: 'Unsicher ist nur bis 1 Stunde vor Rückmeldefrist möglich' });
        }
      }
    }

    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, req.user!.id);

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Update or create response
    const stmt = db.prepare(`
      INSERT INTO event_responses (event_id, user_id, status, comment)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(event_id, user_id) 
      DO UPDATE SET status = ?, comment = ?, responded_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(
      eventId,
      req.user!.id,
      normalizedStatus,
      normalizedComment || null,
      normalizedStatus,
      normalizedComment || null
    );

    res.json({ success: true, status: normalizedStatus, comment: normalizedComment || null });
  } catch (error) {
    console.error('Update response error:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// Update event response for a specific user (trainer only)
router.post('/:id/response/:userId', (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const { status, comment }: UpdateEventResponseDTO = req.body;
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['accepted', 'declined', 'tentative', 'pending']);
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (!normalizedStatus) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (normalizedStatus === 'declined' && !normalizedComment) {
      return res.status(400).json({ error: 'Bitte gib einen Grund für die Absage an' });
    }

    // Check if event exists
    const event = db.prepare('SELECT team_id, rsvp_deadline FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (normalizedStatus === 'tentative' && event.rsvp_deadline) {
      const deadlineDate = new Date(event.rsvp_deadline);
      if (!Number.isNaN(deadlineDate.getTime())) {
        const tentativeCutoff = new Date(deadlineDate.getTime() - 60 * 60 * 1000);
        if (new Date() >= tentativeCutoff) {
          return res.status(400).json({ error: 'Unsicher ist nur bis 1 Stunde vor Rückmeldefrist möglich' });
        }
      }
    }

    // Check if user is trainer in this team
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can update player responses' });
    }

    // Verify that the target user is also a member
    const targetMembership = db.prepare(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, userId);

    if (!targetMembership) {
      return res.status(404).json({ error: 'User is not a team member' });
    }

    // Update or create response
    const stmt = db.prepare(`
      INSERT INTO event_responses (event_id, user_id, status, comment)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(event_id, user_id) 
      DO UPDATE SET status = ?, comment = ?, responded_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(
      eventId,
      userId,
      normalizedStatus,
      normalizedComment || null,
      normalizedStatus,
      normalizedComment || null
    );

    res.json({ success: true, status: normalizedStatus, comment: normalizedComment || null, user_id: userId });
  } catch (error) {
    console.error('Update response for user error:', error);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// Delete event (or series)
router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const deleteSeries = req.query.delete_series === 'true';

    // Check if event exists
    const event = db.prepare('SELECT team_id, series_id FROM events WHERE id = ?').get(eventId) as any;
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is trainer
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(event.team_id, req.user!.id) as any;

    if (!membership || membership.role !== 'trainer') {
      return res.status(403).json({ error: 'Only trainers can delete events' });
    }

    // Delete event or entire series
    if (deleteSeries && event.series_id) {
      // Delete all events in the series
      const result = db.prepare('DELETE FROM events WHERE series_id = ?').run(event.series_id);
      res.json({ success: true, deleted_count: result.changes });
    } else {
      // Delete single event (cascading deletes will handle event_responses)
      db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
      res.json({ success: true, deleted_count: 1 });
    }
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;

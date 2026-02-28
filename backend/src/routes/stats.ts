import { Router } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Get team statistics
router.get('/team/:teamId', (req: AuthRequest, res) => {
  try {
    const teamId = parseInt(req.params.teamId);

    // Check membership
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user!.id) as { role: 'trainer' | 'player' | 'staff' } | undefined;

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    // Get attendance statistics
    const isPlayer = membership.role === 'player';

    const attendanceStats = isPlayer
      ? db.prepare(`
          SELECT 
            u.id,
            u.name,
            COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN er.status = 'declined' THEN 1 END) as declined,
            COUNT(CASE WHEN er.status = 'tentative' THEN 1 END) as tentative,
            COUNT(CASE WHEN er.status = 'pending' OR er.status IS NULL THEN 1 END) as pending,
            COUNT(e.id) as total_events,
            COALESCE(ROUND(COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) * 100.0 / NULLIF(COUNT(e.id), 0), 2), 0) as attendance_rate
          FROM team_members tm
          INNER JOIN users u ON tm.user_id = u.id
          LEFT JOIN events e ON e.team_id = tm.team_id AND e.start_time < datetime('now')
          LEFT JOIN event_responses er ON er.user_id = u.id AND er.event_id = e.id
          WHERE tm.team_id = ? AND tm.user_id = ?
          GROUP BY u.id, u.name
        `).all(teamId, req.user!.id)
      : db.prepare(`
          SELECT 
            u.id,
            u.name,
            COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN er.status = 'declined' THEN 1 END) as declined,
            COUNT(CASE WHEN er.status = 'tentative' THEN 1 END) as tentative,
            COUNT(CASE WHEN er.status = 'pending' OR er.status IS NULL THEN 1 END) as pending,
            COUNT(e.id) as total_events,
            COALESCE(ROUND(COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) * 100.0 / NULLIF(COUNT(e.id), 0), 2), 0) as attendance_rate
          FROM team_members tm
          INNER JOIN users u ON tm.user_id = u.id
          LEFT JOIN events e ON e.team_id = tm.team_id AND e.start_time < datetime('now')
          LEFT JOIN event_responses er ON er.user_id = u.id AND er.event_id = e.id
          WHERE tm.team_id = ?
          GROUP BY u.id, u.name
          ORDER BY attendance_rate DESC
        `).all(teamId);

    // Get past events count
    const pastEvents = db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE team_id = ? AND start_time < datetime('now')
    `).get(teamId) as any;

    const pastEventsByCategoryRows = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM events
      WHERE team_id = ? AND start_time < datetime('now')
      GROUP BY type
    `).all(teamId) as Array<{ type: string; count: number }>;

    const pastEventsByCategory = {
      training: 0,
      match: 0,
      other: 0,
    };

    for (const row of pastEventsByCategoryRows) {
      if (row.type === 'training' || row.type === 'match' || row.type === 'other') {
        pastEventsByCategory[row.type] = Number(row.count || 0);
      }
    }

    res.json({
      attendance: attendanceStats,
      events: {
        past: pastEvents.count,
        pastByCategory: pastEventsByCategory,
      }
    });
  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get player statistics
router.get('/player/:userId', (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { team_id } = req.query;

    if (!team_id) {
      return res.status(400).json({ error: 'team_id is required' });
    }

    // Check membership
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(team_id, req.user!.id) as { role: 'trainer' | 'player' | 'staff' } | undefined;

    if (!membership) {
      return res.status(403).json({ error: 'Not a team member' });
    }

    if (membership.role === 'player' && userId !== req.user!.id) {
      return res.status(403).json({ error: 'Players can only view their own statistics' });
    }

    // Get attendance
    const attendance = db.prepare(`
      SELECT 
        COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN er.status = 'declined' THEN 1 END) as declined,
        COUNT(CASE WHEN er.status = 'tentative' THEN 1 END) as tentative,
        COUNT(CASE WHEN er.status = 'pending' THEN 1 END) as pending,
        COUNT(*) as total_events,
        ROUND(COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) * 100.0 / COUNT(*), 2) as attendance_rate
      FROM event_responses er
      INNER JOIN events e ON er.event_id = e.id
      WHERE er.user_id = ? AND e.team_id = ?
    `).get(userId, team_id);

    res.json({
      attendance
    });
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({ error: 'Failed to fetch player statistics' });
  }
});

export default router;

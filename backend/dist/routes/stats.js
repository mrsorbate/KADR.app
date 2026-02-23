"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const init_1 = __importDefault(require("../database/init"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get team statistics
router.get('/team/:teamId', (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        // Check membership
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(teamId, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        // Get attendance statistics
        const isPlayer = membership.role === 'player';
        const attendanceStats = isPlayer
            ? init_1.default.prepare(`
          SELECT 
            u.id,
            u.name,
            COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN er.status = 'declined' THEN 1 END) as declined,
            COUNT(CASE WHEN er.status = 'tentative' THEN 1 END) as tentative,
            COUNT(CASE WHEN er.status = 'pending' THEN 1 END) as pending,
            COUNT(*) as total_events,
            ROUND(COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) * 100.0 / COUNT(*), 2) as attendance_rate
          FROM team_members tm
          INNER JOIN users u ON tm.user_id = u.id
          LEFT JOIN event_responses er ON er.user_id = u.id
          LEFT JOIN events e ON er.event_id = e.id AND e.team_id = tm.team_id
          WHERE tm.team_id = ? AND tm.user_id = ?
          GROUP BY u.id, u.name
        `).all(teamId, req.user.id)
            : init_1.default.prepare(`
          SELECT 
            u.id,
            u.name,
            COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) as accepted,
            COUNT(CASE WHEN er.status = 'declined' THEN 1 END) as declined,
            COUNT(CASE WHEN er.status = 'tentative' THEN 1 END) as tentative,
            COUNT(CASE WHEN er.status = 'pending' THEN 1 END) as pending,
            COUNT(*) as total_events,
            ROUND(COUNT(CASE WHEN er.status = 'accepted' THEN 1 END) * 100.0 / COUNT(*), 2) as attendance_rate
          FROM team_members tm
          INNER JOIN users u ON tm.user_id = u.id
          LEFT JOIN event_responses er ON er.user_id = u.id
          LEFT JOIN events e ON er.event_id = e.id AND e.team_id = tm.team_id
          WHERE tm.team_id = ?
          GROUP BY u.id, u.name
          ORDER BY attendance_rate DESC
        `).all(teamId);
        // Get upcoming events count
        const upcomingEvents = init_1.default.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE team_id = ? AND start_time >= datetime('now')
    `).get(teamId);
        // Get past events count
        const pastEvents = init_1.default.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE team_id = ? AND start_time < datetime('now')
    `).get(teamId);
        res.json({
            attendance: attendanceStats,
            events: {
                upcoming: upcomingEvents.count,
                past: pastEvents.count
            }
        });
    }
    catch (error) {
        console.error('Get team stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// Get player statistics
router.get('/player/:userId', (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { team_id } = req.query;
        if (!team_id) {
            return res.status(400).json({ error: 'team_id is required' });
        }
        // Check membership
        const membership = init_1.default.prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?').get(team_id, req.user.id);
        if (!membership) {
            return res.status(403).json({ error: 'Not a team member' });
        }
        if (membership.role === 'player' && userId !== req.user.id) {
            return res.status(403).json({ error: 'Players can only view their own statistics' });
        }
        // Get attendance
        const attendance = init_1.default.prepare(`
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
    }
    catch (error) {
        console.error('Get player stats error:', error);
        res.status(500).json({ error: 'Failed to fetch player statistics' });
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map
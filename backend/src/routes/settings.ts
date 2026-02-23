import { Router } from 'express';
import db from '../database/init';

const router = Router();

// Public endpoint to get organization settings
router.get('/organization', (req, res) => {
  try {
    const org = db.prepare('SELECT * FROM organizations LIMIT 1').get();
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(org);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

export default router;

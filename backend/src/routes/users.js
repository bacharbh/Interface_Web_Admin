import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';

const router = Router();

// Utilisateurs en mémoire partagés avec auth.js
// En production, ce serait une base de données
const USERS = [
  { id: 'admin-001', username: 'admin', email: 'admin@smart-shepherd.local', role: 'admin', isActive: true, createdAt: new Date().toISOString() }
];

router.get('/', authenticate, async (_req, res) => {
  const users = USERS.filter(u => u.isActive).map(({ password: _, ...u }) => u);
  return res.json({ users });
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const user = {
      id: `user-${Date.now()}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      ...req.body,
    };
    USERS.push(user);
    const { password: _, ...safe } = user;
    return res.status(201).json(safe);
  } catch {
    return res.status(500).json({ error: 'Impossible de créer utilisateur' });
  }
});

router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const idx = USERS.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  USERS[idx] = { ...USERS[idx], ...req.body };
  const { password: _, ...safe } = USERS[idx];
  return res.json(safe);
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const idx = USERS.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  USERS[idx].isActive = false;
  return res.json({ success: true });
});

export default router;

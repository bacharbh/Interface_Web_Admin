import { Router } from 'express';
import { getAllRtdbUsers, getRtdbUser, saveRtdbUser } from '../../services/firebaseService.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const users = await getAllRtdbUsers();
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('[Users] fetch error:', err.message);
    return res.status(500).json({ error: 'Impossible de charger les utilisateurs' });
  }
});

router.post('/', async (req, res) => {
  try {
    const id = `user-${Date.now()}`;
    const user = {
      id,
      isActive: true,
      status: 'Actif',
      createdAt: new Date().toISOString(),
      ...req.body,
    };
    const saved = await saveRtdbUser(id, user);
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error('[Users] create error:', err.message);
    return res.status(500).json({ error: 'Impossible de créer utilisateur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getRtdbUser(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    const updated = { ...existing, ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    await saveRtdbUser(req.params.id, updated);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Users] update error:', err.message);
    return res.status(500).json({ error: 'Impossible de mettre à jour utilisateur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getRtdbUser(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    await saveRtdbUser(req.params.id, { ...existing, isActive: false, status: 'Inactif' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Users] delete error:', err.message);
    return res.status(500).json({ error: 'Impossible de supprimer utilisateur' });
  }
});

export default router;

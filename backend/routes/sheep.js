import express from 'express';
import { getAllAnimals, getAnimalByCollarId } from '../services/firebaseService.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// GET /api/sheep — liste tous les animaux depuis Firebase
router.get('/', async (req, res) => {
  try {
    let animals = await getAllAnimals();

    if (req.query.healthStatus) {
      animals = animals.filter(a => a.healthStatus === req.query.healthStatus);
    }
    if (req.query.breed) {
      animals = animals.filter(a => a.breed === req.query.breed);
    }
    if (req.query.gender) {
      animals = animals.filter(a => a.gender === req.query.gender);
    }

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    if (!hasPagination) {
      return res.json(animals);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const total = animals.length;
    const paged = animals.slice((page - 1) * limit, page * limit);

    res.json({
      sheep: paged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching sheep:', error.message);
    res.status(500).json({ error: 'Error fetching sheep data' });
  }
});

// GET /api/sheep/:id — un animal par collar ID
router.get('/:id', async (req, res) => {
  try {
    const animal = await getAnimalByCollarId(req.params.id);
    if (!animal) {
      return res.status(404).json({ error: 'Sheep not found' });
    }
    res.json({ sheep: animal });
  } catch (error) {
    console.error('Error fetching sheep by id:', error.message);
    res.status(500).json({ error: 'Error fetching sheep data' });
  }
});

// Les mutations ne sont pas gérées côté API — modifier directement dans Firebase
router.post('/', authMiddleware, (_req, res) => {
  res.status(501).json({ error: 'Création non supportée — ajoutez directement dans Firebase RTDB' });
});

router.put('/:id', authMiddleware, (_req, res) => {
  res.status(501).json({ error: 'Modification non supportée — modifiez directement dans Firebase RTDB' });
});

router.delete('/:id', authMiddleware, (_req, res) => {
  res.status(501).json({ error: 'Suppression non supportée — supprimez directement dans Firebase RTDB' });
});

export default router;

const express = require('express');
const router = express.Router();
const Vibe = require('../models/vibe');

// Get vibes in an area
router.get('/area', async (req, res) => {
    try {
        const { latitude, longitude, radius = 1000 } = req.query;
        
        const vibes = await Vibe.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(longitude), parseFloat(latitude)]
                    },
                    $maxDistance: parseInt(radius)
                }
            }
        }).populate('createdBy', 'username');
        
        res.json(vibes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new vibe
router.post('/', async (req, res) => {
    try {
        const vibe = new Vibe(req.body);
        await vibe.save();
        res.status(201).json(vibe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update vibe
router.put('/:id', async (req, res) => {
    try {
        const vibe = await Vibe.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
        res.json(vibe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete vibe
router.delete('/:id', async (req, res) => {
    try {
        const vibe = await Vibe.findByIdAndDelete(req.params.id);
        if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
        res.json({ message: 'Vibe deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add comment to vibe
router.post('/:id/comments', async (req, res) => {
    try {
        const vibe = await Vibe.findById(req.params.id);
        if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
        
        vibe.comments.push(req.body);
        await vibe.save();
        res.status(201).json(vibe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Like vibe
router.post('/:id/like', async (req, res) => {
    try {
        const vibe = await Vibe.findById(req.params.id);
        if (!vibe) return res.status(404).json({ error: 'Vibe not found' });
        
        vibe.likes += 1;
        await vibe.save();
        res.json(vibe);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;

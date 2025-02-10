const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware for parsing JSON bodies
app.use(express.json({
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch(e) {
            res.status(400).json({ message: 'Invalid JSON' });
            throw new Error('Invalid JSON');
        }
    }
}));

// CORS middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ message: 'Invalid JSON' });
    }
    next(err);
});

// MongoDB connection with retry logic
const connectWithRetry = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vipemap';
    console.log('Attempting to connect to MongoDB at:', mongoURI);
    
    try {
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB connected successfully');
        
        // Initialize indexes after successful connection
        const User = require('./models/user');
        const Vibe = require('./models/vibe');
        
        try {
            await Promise.all([
                User.init(),
                Vibe.init()
            ]);
            console.log('Indexes created successfully');
        } catch (indexError) {
            console.error('Error creating indexes:', indexError);
        }
        
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Retrying in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

// Enable mongoose debug mode
mongoose.set('debug', (collectionName, method, query, doc) => {
    console.log(`Mongoose: ${collectionName}.${method}`, JSON.stringify(query), doc);
});

// Initial connection attempt
connectWithRetry();

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
    console.error('MongoDB error event:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected, attempting to reconnect...');
    setTimeout(connectWithRetry, 5000);
});

mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
});

// Models
const Vibe = require('./models/vibe');
const User = require('./models/user');

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a specific area (based on coordinates)
    socket.on('joinArea', async (coordinates) => {
        try {
            const areaId = calculateAreaId(coordinates);
            socket.join(areaId);
            
            // Send existing vibes in this area
            const vibes = await Vibe.find({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [coordinates.longitude, coordinates.latitude]
                        },
                        $maxDistance: 1000 // 1km radius
                    }
                }
            }).populate('creator', 'username');
            
            socket.emit('vibes', vibes);
        } catch (error) {
            console.error('Error in joinArea:', error);
            socket.emit('error', { message: 'Error joining area' });
        }
    });

    // Handle new vibe creation
    socket.on('createVibe', async (vibeData) => {
        try {
            const vibe = new Vibe(vibeData);
            await vibe.save();
            
            // Notify users in the same area
            const areaId = calculateAreaId(vibeData.location);
            io.to(areaId).emit('newVibe', vibe);
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    // Handle vibe updates
    socket.on('updateVibe', async (vibeData) => {
        try {
            const updatedVibe = await Vibe.findByIdAndUpdate(
                vibeData._id,
                vibeData,
                { new: true }
            );
            if (updatedVibe) {
                const areaId = calculateAreaId(updatedVibe.location);
                io.to(areaId).emit('vibeUpdated', updatedVibe);
            }
        } catch (error) {
            socket.emit('error', error.message);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Helper function to calculate area ID from coordinates
function calculateAreaId(coordinates) {
    const lat = Math.round(coordinates.latitude * 100) / 100;
    const lng = Math.round(coordinates.longitude * 100) / 100;
    return `${lat},${lng}`;
}

// REST API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vibes', require('./routes/vibes'));
app.use('/api/users', require('./routes/users'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        env: process.env.NODE_ENV
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

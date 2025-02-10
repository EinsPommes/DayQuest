const mongoose = require('mongoose');

const vibeSchema = new mongoose.Schema({
    content: {
        caption: String,
        mediaUrl: String
    },
    type: {
        type: String,
        enum: ['text', 'photo', 'ar'],
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    arData: {
        position: {
            x: Number,
            y: Number,
            z: Number
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    likes: {
        type: Number,
        default: 0
    },
    comments: [{
        text: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
});

// Create a 2dsphere index for location-based queries
vibeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Vibe', vibeSchema);

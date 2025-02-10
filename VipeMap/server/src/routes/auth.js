const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Sign Up
router.post('/signup', async (req, res) => {
    console.log('=== Starting signup process ===');
    console.log('Request body:', {
        username: req.body.username,
        email: req.body.email,
        passwordLength: req.body.password?.length
    });

    try {
        const { username, email, password } = req.body;

        // Basic validation
        if (!username || !email || !password) {
            console.log('Missing required fields');
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if user exists
        console.log('Checking for existing user...');
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username }
            ]
        });

        if (existingUser) {
            console.log('User already exists');
            return res.status(400).json({ 
                message: 'User already exists',
                field: existingUser.email === email.toLowerCase() ? 'email' : 'username'
            });
        }

        // Hash password
        console.log('Hashing password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('Password hashed successfully');

        // Create user instance
        console.log('Creating user instance...');
        const user = new User({
            username,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        // Save user
        console.log('Attempting to save user...');
        try {
            await user.save();
            console.log('User saved successfully');
        } catch (saveError) {
            console.error('Error saving user:', saveError);
            throw saveError;
        }

        // Create token
        console.log('Creating JWT token...');
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Send response
        console.log('Sending success response');
        res.status(201).json({
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                isOnline: user.isOnline || false,
                createdAt: user.createdAt.getTime() / 1000,
                location: user.lastLocation ? {
                    latitude: user.lastLocation.coordinates[1],
                    longitude: user.lastLocation.coordinates[0]
                } : null
            }
        });

        console.log('=== Signup process completed successfully ===');
    } catch (error) {
        console.error('=== Signup process failed ===');
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field} already exists`,
                field
            });
        }

        res.status(500).json({
            message: 'Server error during signup',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Sign In
router.post('/signin', async (req, res) => {
    console.log('=== Starting signin process ===');
    console.log('Request body:', {
        email: req.body.email,
        passwordLength: req.body.password?.length
    });

    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            console.log('Missing required fields');
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Check if user exists
        console.log('Looking for user with email:', email.toLowerCase());
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('User found, comparing passwords...');
        // Check password
        const isMatch = await user.comparePassword(password);
        console.log('Password match result:', isMatch);
        
        if (!isMatch) {
            console.log('Password does not match');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('Password matches, creating token...');
        // Create and return JWT token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('Sending success response');
        res.json({
            token,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                isOnline: user.isOnline || false,
                createdAt: user.createdAt.getTime() / 1000,
                location: user.lastLocation ? {
                    latitude: user.lastLocation.coordinates[1],
                    longitude: user.lastLocation.coordinates[0]
                } : null
            }
        });

        console.log('=== Signin process completed successfully ===');
    } catch (error) {
        console.error('=== Signin process failed ===');
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

        res.status(500).json({
            message: 'Server error during signin',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;

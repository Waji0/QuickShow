import express from 'express';
import cors from 'cors';
// import 'dot/config';
import dotenv from 'dotenv';
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import showRouter from './routes/showRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import userRouter from './routes/userRoutes.js';
import { stripeWebhooks } from './controllers/stripeWebHook.js';


dotenv.config();
// Debug environment variables
// console.log('Environment check:');
// console.log('CLERK_PUBLISHABLE_KEY:', process.env.CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing');
// console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Set' : 'Missing');
// console.log('CLERK_PUBLISHABLE_KEY starts with pk_test_:', process.env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_'));
// console.log('CLERK_SECRET_KEY starts with sk_test_:', process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'));
const app = express();
const port = 3000;

await connectDB();

// Stripe Webhooks Route
app.use('/api/stripe', express.raw({type: 'application/json'}), stripeWebhooks);

// CORS configuration
// app.use(cors({
//     origin: [
//         'http://localhost:5173', // Vite default
//         'http://localhost:3000',
//         'http://localhost:3001',
//     ],
//     credentials: true,
//     allowedHeaders: [
//         'Content-Type',
//         'Authorization',
//         'x-clerk-auth-status',
//         'x-clerk-auth-reason',
//         'x-clerk-auth-message'
//     ]
// }));


// // Middleware
app.use(express.json());
app.use(cors());

// Initialize Clerk middleware with error handling
// try {
//     app.use(clerkMiddleware());
//     console.log('Clerk middleware initialized successfully');
// } catch (error) {
//     console.error('Failed to initialize Clerk middleware:', error);
// }

// app.use(clerkMiddleware());

// Enhanced test route
// app.get('/api/test-auth', (req, res) => {
//     try {
//         console.log('=== AUTH TEST START ===');
//         console.log('Request headers:', {
//             authorization: req.headers.authorization,
//             'user-agent': req.headers['user-agent'],
//             cookie: req.headers.cookie ? 'Present' : 'Missing'
//         });
        
//         const auth = req.auth();
//         console.log('Auth result:', {
//             isAuthenticated: auth.isAuthenticated,
//             userId: auth.userId,
//             sessionId: auth.sessionId,
//             sessionStatus: auth.sessionStatus
//         });
//         console.log('=== AUTH TEST END ===');
        
//         res.json({ 
//             success: true,
//             auth: {
//                 isAuthenticated: auth.isAuthenticated,
//                 userId: auth.userId,
//                 sessionId: auth.sessionId,
//                 sessionStatus: auth.sessionStatus
//             },
//             environment: {
//                 hasPublicKey: !!process.env.CLERK_PUBLISHABLE_KEY,
//                 hasSecretKey: !!process.env.CLERK_SECRET_KEY
//             }
//         });
//     } catch (error) {
//         console.error('Auth test error:', error);
//         res.status(500).json({ 
//             success: false,
//             error: error.message,
//             stack: error.stack
//         });
//     }
// });

app.use(clerkMiddleware());

app.get('/api/debug-inngest', (req, res) => {
    console.log('=== INNGEST CONFIGURATION DEBUG ===');
    console.log('INNGEST_EVENT_KEY exists:', !!process.env.INNGEST_EVENT_KEY);
    console.log('INNGEST_EVENT_KEY length:', process.env.INNGEST_EVENT_KEY?.length || 0);
    console.log('INNGEST_EVENT_KEY starts with:', process.env.INNGEST_EVENT_KEY?.substring(0, 10) + '...');
    
    // Check if it's a signing key instead of event key
    if (process.env.INNGEST_SIGNING_KEY) {
        console.log('INNGEST_SIGNING_KEY found (this is different from EVENT_KEY)');
    }
    
    res.json({
        hasEventKey: !!process.env.INNGEST_EVENT_KEY,
        eventKeyLength: process.env.INNGEST_EVENT_KEY?.length || 0,
        hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
        inngestId: inngest.id
    });
});


// Add to your server.js - Updated test route for User model
app.post('/api/test-inngest', async (req, res) => {
    try {
        const testUserId = "test_user_" + Date.now();
        const testEmail = "test" + Date.now() + "@example.com";
        
        console.log('Sending test Inngest event for user creation...');
        
        await inngest.send({
            name: "clerk/user.created",
            data: {
                id: testUserId,
                first_name: "Test",
                last_name: "User",
                email_addresses: [{ email_address: testEmail }],
                image_url: "https://example.com/test-image.jpg"
            }
        });
        
        console.log('Test event sent, waiting 3 seconds to check database...');
        
        // Wait for the event to be processed, then check if user was created
        setTimeout(async () => {
            try {
                const createdUser = await User.findById(testUserId);
                if (createdUser) {
                    console.log('✅ SUCCESS: Test user found in database:', createdUser);
                } else {
                    console.log('❌ FAILED: Test user not found in database');
                    
                    // Check if any users exist at all
                    const userCount = await User.countDocuments();
                    console.log('Total users in database:', userCount);
                }
            } catch (dbError) {
                console.error('❌ Database check error:', dbError);
            }
        }, 3000);
        
        res.json({ 
            success: true, 
            message: "Test event sent",
            testUserId: testUserId,
            testEmail: testEmail,
            note: "Check console logs in 3 seconds for results"
        });
        
    } catch (error) {
        console.error('Inngest test error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// API Routes
app.get('/', (req, res) => res.send('Server is Live!'));
app.use('/api/inngest', serve({ client: inngest, functions }));
app.use('/api/show', showRouter);
app.use('/api/booking', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);


app.listen(port, () => console.log(`Server is listening at http://localhost:${port}`));


//Claude code <-- Start from here-->

// dotenv.config();

// Debug environment variables
// console.log('Environment check:');
// console.log('CLERK_PUBLISHABLE_KEY:', process.env.CLERK_PUBLISHABLE_KEY ? 'Set' : 'Missing');
// console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Set' : 'Missing');
// console.log('CLERK_PUBLISHABLE_KEY starts with pk_test_:', process.env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_'));
// console.log('CLERK_SECRET_KEY starts with sk_test_:', process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'));

// const app = express();
// const port = 3000;


// await connectDB();

// // Stripe Webhooks Route (must be before express.json())
// app.use('/api/stripe', express.raw({type: 'application/json'}), stripeWebhooks);

// CORS configuration
// app.use(cors({
//     origin: [
//         'http://localhost:5173', // Vite default
//         'http://localhost:3000',
//         'http://localhost:3001',
//     ],
//     credentials: true,
//     allowedHeaders: [
//         'Content-Type',
//         'Authorization',
//         'x-clerk-auth-status',
//         'x-clerk-auth-reason',
//         'x-clerk-auth-message'
//     ]
// }));

// Middleware
// app.use(express.json());


// Initialize Clerk middleware with error handling
// try {
//     app.use(clerkMiddleware());
//     console.log('Clerk middleware initialized successfully');
// } catch (error) {
//     console.error('Failed to initialize Clerk middleware:', error);
// }

// app.use(clerkMiddleware());

// Enhanced test route
// app.get('/api/test-auth', (req, res) => {
//     try {
//         console.log('=== AUTH TEST START ===');
//         console.log('Request headers:', {
//             authorization: req.headers.authorization,
//             'user-agent': req.headers['user-agent'],
//             cookie: req.headers.cookie ? 'Present' : 'Missing'
//         });
        
//         const auth = req.auth();
//         console.log('Auth result:', {
//             isAuthenticated: auth.isAuthenticated,
//             userId: auth.userId,
//             sessionId: auth.sessionId,
//             sessionStatus: auth.sessionStatus
//         });
//         console.log('=== AUTH TEST END ===');
        
//         res.json({ 
//             success: true,
//             auth: {
//                 isAuthenticated: auth.isAuthenticated,
//                 userId: auth.userId,
//                 sessionId: auth.sessionId,
//                 sessionStatus: auth.sessionStatus
//             },
//             environment: {
//                 hasPublicKey: !!process.env.CLERK_PUBLISHABLE_KEY,
//                 hasSecretKey: !!process.env.CLERK_SECRET_KEY
//             }
//         });
//     } catch (error) {
//         console.error('Auth test error:', error);
//         res.status(500).json({ 
//             success: false,
//             error: error.message,
//             stack: error.stack
//         });
//     }
// });


// // API Routes
// app.get('/', (req, res) => res.send('Server is Live!'));
// app.use('/api/inngest', serve({ client: inngest, functions }));
// app.use('/api/show', showRouter);
// app.use('/api/booking', bookingRouter);
// app.use('/api/admin', adminRouter);
// app.use('/api/user', userRouter);

// app.listen(port, () => console.log(`Server is listening at http://localhost:${port}`));



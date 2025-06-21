import express from 'express';
import cors from 'cors';
// import 'dot/config';
import dotenv from 'dotenv';
import connectDB from './configs/db.js';
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";


dotenv.config();
const app = express();
const port = 3000;

await connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());


// API Routes
app.get('/', (req, res) => res.send('Server is Live!'));
app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(port, () => console.log(`Server is listening at http://localhost:${port}`));
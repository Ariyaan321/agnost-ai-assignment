import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { oauth2Client, SCOPES } from './googleConfig';
import { User } from './models/User';
import { google } from 'googleapis';
import { agent } from './calendarAgent'; // Import the LangChain Agent


dotenv.config();
const app = express();

// Allow frontend requests
app.use(cors());
app.use(express.json());

// --- 1. CONNECT TO DATABASE ---
mongoose.connect(process.env.MONGO_URI as string)
    .then(() => console.log('✅ Server connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// --- 2. AGENT ENDPOINT (The New Brain) ---
// server.ts (Inside the /api/chat route)

app.post('/api/chat', async (req, res) => {
    const { message, email, threadId } = req.body;

    if (!message || !email) {
        return res.status(400).json({ error: "Message and Email are required." });
    }

    try {
        // 1. Get Dynamic Time (IST)
        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        console.log(`🤖 Agent received: ======================\n\n "${message}" at ${timeString}`);
        // console.log(`🤖 Agent received:=============================================================\n\n`);

        // 2. Define the Thread Config
        const config = {
            configurable: {
                thread_id: threadId || email // Fallback to email if no threadId (simple persistent chat)
            }
        };

        // 3. Stronger Context Injection
        const inputs = {
            messages: [
                {
                    role: "user",
                    content: `
                        SYSTEM CONTEXT:
                        - Current Date & Time (IST): ${timeString}
                        - Your Timezone: Asia/Kolkata (GMT+5:30)
                        - Manager Email (Me): ${email}
                        
                        USER REQUEST:
                        ${message}
                    `
                }
            ]
        };

        // Invoke LangChain Agent
        const result = await agent.invoke(inputs, config);

        // console.log('result generated: ', result);
        console.log('result generated: ======================================\n\n');
        const lastMessage = result.messages[result.messages.length - 1];
        res.json({ response: lastMessage.content });

    } catch (error: any) {
        console.error("Agent Error:", error);
        res.status(500).json({ error: "Agent failed to process request." });
    }
});

// --- 3. AUTH ROUTES (Keep these exactly the same) ---
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.redirect(url);
});

app.get('/redirect', async (req, res) => {
    const code = req.query.code as string;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        if (!userInfo.data.email) throw new Error("No email found");

        const updateData: any = {
            email: userInfo.data.email,
            name: userInfo.data.name,
            googleId: userInfo.data.id,
            accessToken: tokens.access_token,
        };

        if (tokens.refresh_token) {
            updateData.refreshToken = tokens.refresh_token;
        }

        await User.findOneAndUpdate(
            { email: userInfo.data.email },
            updateData,
            { upsert: true, new: true }
        );

        console.log(`✅ User ${userInfo.data.email} connected!`);
        res.send(`<h1>Login Successful!</h1><p>Agent is connected to ${userInfo.data.email}</p>`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Authentication failed");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
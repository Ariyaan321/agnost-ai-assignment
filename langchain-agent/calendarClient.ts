import 'dotenv/config';
import { User } from './models/User'; // Your existing User model
import { google } from 'googleapis';


export async function getClient(email: string) {
    const user = await User.findOne({ email });
    if (!user || !user.refreshToken) {
        throw new Error(`User ${email} is not connected. Please log in first.`);
    }
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials({ refresh_token: user.refreshToken });
    return google.calendar({ version: 'v3', auth: client });
}

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Scopes = What permissions we are asking for
export const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.profile', // To get name
    'https://www.googleapis.com/auth/userinfo.email',   // To get email
    'https://www.googleapis.com/auth/calendar',          // To Read/Write Calendar
    // 'https://www.googleapis.com/auth/calendar.calendars.readonly',
    // 'https://www.googleapis.com/auth/calendar.events',
    // 'https://www.googleapis.com/auth/calendar.events.freebusy',
    // 'https://www.googleapis.com/auth/calendar.events.readonly',
    // 'https://www.googleapis.com/auth/calendar.freebusy'
];
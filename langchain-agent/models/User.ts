import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    name: { type: String },
    // We store tokens to act as the agent later
    googleId: { type: String },
    accessToken: { type: String }, // Short lived
    refreshToken: { type: String }, // Long lived (The Key to the Kingdom)
});

export const User = mongoose.model('User', UserSchema);
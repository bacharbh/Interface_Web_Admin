import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
    name: string
    email: string
    role: 'admin' | 'vet' | 'farmer'
    phone?: string
    active: boolean
    createdAt: Date
    lastLogin?: Date
}

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    role: { type: String, enum: ['admin', 'vet', 'farmer'], default: 'farmer' },
    phone: { type: String },
    active: { type: Boolean, default: true },
    lastLogin: { type: Date }
}, { timestamps: true })

const User: Model<IUser> = (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>('User', UserSchema)

export default User

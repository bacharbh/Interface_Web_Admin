import mongoose, { Schema, Document, Model } from 'mongoose'

export interface INote extends Document {
    animalId: mongoose.Types.ObjectId
    content: string
    author?: mongoose.Types.ObjectId
    type: 'note' | 'medical' | 'observation'
    createdAt: Date
    updatedAt: Date
}

const NoteSchema = new Schema<INote>({
    animalId: { type: Schema.Types.ObjectId, ref: 'Sheep', required: true },
    content: { type: String, required: true, maxlength: 5000 },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['note', 'medical', 'observation'], default: 'note' }
}, { timestamps: true })

const Note: Model<INote> = (mongoose.models.Note as Model<INote>) || mongoose.model<INote>('Note', NoteSchema)

export default Note

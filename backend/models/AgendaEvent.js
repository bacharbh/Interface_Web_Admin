import mongoose from 'mongoose';

const agendaEventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 160,
    },
    type: {
        type: String,
        required: true,
        enum: ['vaccine', 'checkup', 'treatment', 'other'],
        default: 'other',
    },
    startAt: {
        type: Date,
        required: true,
        index: true,
    },
    endAt: {
        type: Date,
        required: true,
        index: true,
    },
    animalIds: [{
        type: String,
        trim: true,
    }],
    veterinarian: {
        type: String,
        trim: true,
        maxlength: 120,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000,
    },
    recurrence: {
        type: String,
        enum: ['none', 'monthly', 'annual'],
        default: 'none',
    },
    reminderMinutes: {
        type: Number,
        default: 60,
        min: 0,
    },
    status: {
        type: String,
        enum: ['upcoming', 'done', 'cancelled'],
        default: 'upcoming',
    },
    createdBy: {
        type: String,
        default: null,
    },
    updatedBy: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});

agendaEventSchema.index({ startAt: 1, endAt: 1, status: 1 });

agendaEventSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id?.toString?.() || ret.id;
        delete ret._id;
        return ret;
    },
});

export default mongoose.model('AgendaEvent', agendaEventSchema);
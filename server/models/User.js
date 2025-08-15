import mongoose from "mongoose";

// const userSchema = new mongoose.Schema({
//     _id: {type: String, required: true},
//     name: {type: String, required: true},
//     email: {type: String, required: true},
//     image: {type: String, required: true},
// });

const userSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String, required: false, default: '' }, // Made optional with default
}, {
    timestamps: true // Add timestamps for created/updated tracking
});

const User = mongoose.model('User', userSchema);

export default User;
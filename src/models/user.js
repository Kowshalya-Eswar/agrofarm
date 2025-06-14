const { Timestamp } = require("bson");
const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String
    },
    userName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    phone: {
        type: String
    },
    age:{
        type: Number,
        min: 18,
    }, 
    gender: {
        type: String,
        validate(value) {
            if (!["male","female","others"].includes(value.toLocaleLowerCase())) {
                throw new Error("Gender data is not valid");
            }
        }
    },
    role: {
        type: [String],
        default: 'user'
    }

},{timestamps:true});

const User = mongoose.model("User",userSchema);

module.exports = User;
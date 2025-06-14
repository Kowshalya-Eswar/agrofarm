const validator = require("validator");
const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        minimumLength: 4,
        maximumLength: 100
    },
    lastName: {
        type: String,
        minimumLength: 4,
        maximumLength: 100
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
//match: [/.+@.+\..+/, 'Please fill a valid email address']
       validate(value) {
         if(!validator.isEmail(value)) {
            throw new Error("invalid email id");
         }
       }
    },
    password: {
        type: String,
        trim: true,
        required:true, 
        validate(value) {
            if(!validator.isStrongPassword(value)) {
                throw new Error("your password is not strong: "+value);
            }
        }
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
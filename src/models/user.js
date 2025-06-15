require("dotenv").config();
const validator = require("validator");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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

userSchema.methods.verifyPassword = async function(userPassword) {
   const isPasswordValid = await bcrypt.compare(userPassword, this.password);
   return isPasswordValid;
}

userSchema.methods.getJWT = async function() {
    const token = await jwt.sign({_id:this._id},process.env.TOKEN_KEY, {expiresIn: "1d"});
    return token;
}

const User = mongoose.model("User",userSchema);

module.exports = User;
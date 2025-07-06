
const validator = require("validator");
const mongoose  = require("mongoose");
const bcrypt    = require("bcrypt");
const {v4:uuidv4} = require("uuid"); 
const jwt       = require("jsonwebtoken");

// Define the Mongoose schema for the User model.
// This schema outlines the structure, data types, validation rules, and custom methods
// for user documents stored in your MongoDB database.
const userSchema = mongoose.Schema({
    _id: {
        type: String,
        required: true,
        immutable:true,
        default:uuidv4
    },
    // firstName field: Stores the user's first name.
    firstName: {
        type: String,        
        minimumLength: 4,    
        maximumLength: 100   
    },
    // lastName field: Stores the user's last name.
    lastName: {
        type: String,        // Specifies that lastName must be a string.
        minimumLength: 4,    // Custom validation: enforces a minimum length of 4 characters.
        maximumLength: 100   // Custom validation: enforces a maximum length of 100 characters.
    },
    // userName field: Stores a unique username for the user.
    userName: {
        type: String,        // Specifies that userName must be a string.
        required: true,      // Marks this field as mandatory; a user cannot be saved without a username.
        unique: true,        // Ensures that each userName in the database is unique.
        trim: true,          // Removes whitespace from both ends of the string before saving.
    },
    // email field: Stores the user's email address.
    email: {
        type: String,        // Specifies that email must be a string.
        required: true,      // Marks this field as mandatory.
        unique: true,        // Ensures that each email in the database is unique.
        trim: true,          // Removes whitespace from both ends of the string.
        lowercase: true,     // Converts the email to lowercase before saving for consistency.
        // match: [/.+@.+\..+/, 'Please fill a valid email address'] // An alternative regex-based email validation
        // Custom validation function using the 'validator' library to check the email format.
        validate(value) {
            if(!validator.isEmail(value)) { // Uses validator.isEmail() to check if the value is a syntactically valid email address.
                throw new Error("invalid email id"); // Throws an error if the email is not valid.
            }
        }
    },
    // password field: Stores the user's hashed password.
    password: {
        type: String,        // Specifies that password must be a string.
        trim: true,          // Removes whitespace from both ends of the string.
        required:true,       // Marks this field as mandatory.
        // Custom validation function using the 'validator' library to check for password strength.
        validate(value) {
            if(!validator.isStrongPassword(value)) { // Uses validator.isStrongPassword() for strength criteria (e.g., min length, required chars).
                throw new Error("your password is not strong: "+value); // Throws an error if the password does not meet strength requirements.
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
        // Custom validation to ensure the gender value is one of the predefined options.
        validate(value) {
            // Converts the value to lowercase and checks if it's included in the array of valid genders.
            if (!["male","female","others"].includes(value.toLocaleLowerCase())) {
                throw new Error("Gender data is not valid"); // Throws an error if the provided gender is not 'male', 'female', or 'others'.
            }
        } 
    },
    resetPasswordToken: { 
     type: String 
    },
    resetTokenExpiry: { 
        type: Date 
    },
    role: {
        type: [String],     
        default: 'user'      // Sets 'user' as the default role if no role is explicitly provided.
    }

}, {
    timestamps: true
});


userSchema.methods.verifyPassword = async function(userPassword) {
    const isPasswordValid = await bcrypt.compare(userPassword, this.password);
    return isPasswordValid; 
}

userSchema.methods.isResetTokenValid = function(token) {
    const now = new Date();

    // Check if token matches and not expired
    const isTokenMatch = this.resetPasswordToken === token;
    const isNotExpired = this.resetTokenExpiry && now < this.resetTokenExpiry;

    return isTokenMatch && isNotExpired;
};


// for the user, used for authentication.
userSchema.methods.getJWT = async function() {
    const token = await jwt.sign({_id:this._id},process.env.TOKEN_KEY, {expiresIn: "1d"});
    return token; // Returns the generated JWT string.
}

//for generating password reset token
userSchema.methods.getJWT_PasswordReset = async function() {
    const token = await jwt.sign({_id:this._id},process.env.TOKEN_KEY, {expiresIn: "15m"});
    return token; // Returns the generated JWT string.
}

// Define a pre-save hook for the userSchema.
// This middleware function executes automatically before a user document is saved to the database.
// It's primarily used here for password hashing.
userSchema.pre('save', async function (next) {
    try {
        if(this.isNew) {
            this.userId = uuidv4();
        }
        if(this.isModified('password')) {
            this.password = await bcrypt.hash(this.password,10);
        }
        next();
    } catch(err) {
        throw new Error(err.message)
    }
});

// Create th Mongoose model named "User" using the defined `userSchema`
const User = mongoose.model("User",userSchema);

module.exports = User;
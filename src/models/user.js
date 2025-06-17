
require("dotenv").config();
const validator = require("validator");
const mongoose  = require("mongoose");
const bcrypt    = require("bcrypt");
const {v4:uuidv4} = require("uuid"); 
const jwt       = require("jsonwebtoken");

// Define the Mongoose schema for the User model.
// This schema outlines the structure, data types, validation rules, and custom methods
// for user documents stored in your MongoDB database.
const userSchema = mongoose.Schema({
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
    // phone field: Stores the user's phone number.
    phone: {
        type: String         // Specifies that phone must be a string.
    },
    // age field: Stores the user's age.
    age:{
        type: Number,        // Specifies that age must be a number.
        min: 18,             // Custom validation: enforces a minimum age of 18.
    },
    // uuid field: stores unique identifier for the user
    uuid: {
        type: String,
        unique: true
    },
    // gender field: Stores the user's gender.
    gender: {
        type: String,        // Specifies that gender must be a string.
        // Custom validation to ensure the gender value is one of the predefined options.
        validate(value) {
            // Converts the value to lowercase and checks if it's included in the array of valid genders.
            if (!["male","female","others"].includes(value.toLocaleLowerCase())) {
                throw new Error("Gender data is not valid"); // Throws an error if the provided gender is not 'male', 'female', or 'others'.
            }
        } 
    },
    // role field: Stores the user's role(s) as an array of strings.
    role: {
        type: [String],      // Specifies that role must be an array of strings (e.g., ['user'], ['admin', 'user']).
        default: 'user'      // Sets 'user' as the default role if no role is explicitly provided.
    }

}, {
    // Schema Options:
    // timestamps: true automatically adds `createdAt` and `updatedAt` fields to your schema.
    // `createdAt` stores the date when the document was first created.
    // `updatedAt` stores the date when the document was last updated.
    timestamps: true
});

// Define a custom instance method on the userSchema to verify a provided plaintext password
// against the hashed password stored in the database.
userSchema.methods.verifyPassword = async function(userPassword) {
    // Uses bcrypt.compare() to asynchronously compare the plaintext 'userPassword'
    // with the hashed password stored in the current user document ('this.password').
    const isPasswordValid = await bcrypt.compare(userPassword, this.password);
    return isPasswordValid; // Returns a boolean: true if passwords match, false otherwise.
}

// Define a custom instance method on the userSchema to generate a JSON Web Token (JWT)
// for the user, used for authentication.
userSchema.methods.getJWT = async function() {
    // Generates a new JWT.
    // The payload includes the user's MongoDB `_id`.
    // It's signed using `process.env.TOKEN_KEY` (a secret key from environment variables)
    // and set to expire in '1d' (1 day).
    const token = await jwt.sign({_id:this._id},process.env.TOKEN_KEY, {expiresIn: "1d"});
    return token; // Returns the generated JWT string.
}

// Define a pre-save hook for the userSchema.
// This middleware function executes automatically before a user document is saved to the database.
// It's primarily used here for password hashing.
userSchema.pre('save', async function (next) {
    try {
        if(this.isNew) {
            this.uuid = uuidv4();
        }
        // Checks if the 'password' field has been modified or is new.
        // This prevents re-hashing an already hashed password on subsequent saves if it hasn't changed.
        if(this.isModified('password')) {
            // Asynchronously hashes the plaintext password using bcrypt with a salt round of 10.
            // The hashed password then replaces the plaintext one in the document before saving.
            this.password = await bcrypt.hash(this.password,10);
        }
        // Calls next() to pass control to the next pre-save middleware or the actual save operation.
        next();
    } catch(err) {
        // If an error occurs during password hashing, it propagates the error
        // to the calling function, preventing the save operation.
        throw new Error(err.message)
    }
});

// Create the Mongoose model named "User" using the defined `userSchema`.
// Mongoose will automatically create a MongoDB collection named 'users' (lowercase, plural)
// to store documents conforming to this schema.
const User = mongoose.model("User",userSchema);

// Export the User model so it can be imported and used in other parts of your application,
// such as Express route handlers, to perform CRUD operations on user data.
module.exports = User;

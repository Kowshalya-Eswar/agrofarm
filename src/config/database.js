const { connect } = require('http2');
const mongoose = require('mongoose');
const connectDB = async()=>{
   // await mongoose.connect('mongodb+srv://kowsiganeshan:<db_password>@cluster0.wsbnn.mongodb.net/');
     await mongoose.connect("mongodb+srv://kowsiganeshan:test123@cluster0.wsbnn.mongodb.net/agrifarm");
}

module.exports = connectDB;




const { SESClient } = require("@aws-sdk/client-ses");
const REGION = "ap-south-1";

//create SES service object
const sesClient = new SESClient({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
})
module.exports = { sesClient }
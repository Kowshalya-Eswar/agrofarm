
const {sesClient} = require('./sesClient');
const { SendEmailCommand } = require('@aws-sdk/client-ses');

const createSendEmailCommand = (toAddress, subject, body) => {
  return new SendEmailCommand({
    Destination: {
      ToAddresses: [
        toAddress
      ],
    },
    Message: {
      /* required */
      Body: {
        /* required */
        Html: {
          Charset: "UTF-8",
          Data: body,
        },
        /*Text: {
          Charset: "UTF-8",
          Data: body,
        },*/
      },
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
    },
    Source: process.env.ADMIN_EMAIL,
  });
};

const run = async (subject, body, toAddress) => {
  const sendEmailCommand = createSendEmailCommand(
     toAddress,
    subject,
    body
  );

  try {
    return await sesClient.send(sendEmailCommand);
  } catch (caught) {
    if (caught instanceof Error && caught.name === "MessageRejected") {
      /** @type { import('@aws-sdk/client-ses').MessageRejected} */
      const messageRejectedError = caught;
      return messageRejectedError;
    }
    throw caught;
  }
};

module.exports = { run }

const {sesClient} = require('./sesClient');
const { SendEmailCommand } = require('@aws-sdk/client-ses');

const createSendEmailCommand = (toAddress, fromAddress, subject, body) => {
  return new SendEmailCommand({
    Destination: {
       CcAddresses: [
        process.env.ADMIN_EMAIL
      ],
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
    Source: fromAddress,
  });
};

const run = async (subject, body) => {
  const sendEmailCommand = createSendEmailCommand(
    "kowsi.ganeshan@gmail.com",
    "support@cocofields.in",
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
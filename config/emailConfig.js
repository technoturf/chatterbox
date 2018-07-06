var smtpConfig = {
    "Mandrill" : {
        host: "smtp.mandrillapp.com",
        port: 587, // port for secure SMTP
        auth: {
            user: "User",
            pass: "pass"
        },
        senderEmail : "sender@sender.com"
    }
};
module.exports = {
    smtpConfig: smtpConfig
};

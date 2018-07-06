"use strict"

const _ = require('underscore');
const emailConfig = require('./emailConfig');
const nodeMailerModule = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const transporter = nodeMailerModule.createTransport(smtpTransport(emailConfig.smtpConfig.Mandrill));
const emailTemplates = require('./emailTemplates');
const https = require('https');
const Handlebars = require('handlebars');


exports.sendEmailToUser = function* (emailType, emailVariables, emailId, emailFrom, emailSubject, name_mail) {
    console.log("ADSdsadsasdas",emailType, emailVariables, emailId, emailFrom, emailSubject)
    var mailOptions = {
        from: emailFrom,
        to: emailId,
        subject: null,
        html: null
    };

    switch (emailType) {
        case 'FORGOT_PASSWORD':
            mailOptions.subject = emailSubject;
            mailOptions.html = renderMessageFromTemplateAndVariables(emailTemplates.forgotPassword, emailVariables);
            sendMailViaTransporter(mailOptions);
            break;
        case 'REGISTRATION_ACKNOWLEDGE':
            mailOptions.subject = emailSubject;
            mailOptions.html = renderMessageFromTemplateAndVariables(emailTemplates.newRegisterationAcknowledge, emailVariables);
            sendMailViaTransporter(mailOptions);
            break;
        case 'REGISTRATION_WELCOME':
            mailOptions.subject = emailSubject;
            mailOptions.html = renderMessageFromTemplateAndVariables(emailTemplates.newRegisterationAcknowledge, emailVariables);
            sendMailViaTransporter(mailOptions);
            break;
    }
};


function renderMessageFromTemplateAndVariables(templateData, variablesData) {
    return Handlebars.compile(templateData)(variablesData);
}

function sendMailViaTransporter(mailOptions) {
    transporter.sendMail(mailOptions, function (error, info) {
        console.log('Mail Sent Callback Error:', error);
        console.log('Mail Sent Callback Info:', info);
    });
    return true;
}

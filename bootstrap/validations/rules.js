"use strict";
var v = require('validator');

module.exports = function(Rules){
    Rules.prototype.array = function *(field, value, message){
        if(typeof value === 'object' && Array.isArray(value)){
            return true;
        }else{
            this.validator.addError(field, 'rule', 'array', message || 'The value of the field needs to be an array');
            return false;
        }
    };

    Rules.prototype.nonEmptyArray = function *(field, value, message){
        if(typeof value === 'object' && Array.isArray(value) && value.length){
            return true;
        }else{
            this.validator.addError(field, 'nonEmptyArray', 'array', message || 'The value of the field needs to be a non empty array');
            return false;
        }
    };

    Rules.prototype.float = function *(field, value, message){
        if(v.isFloat(value)){
            return true;
        }else{
            this.validator.addError(field, 'float', 'array', message || 'The value of the field needs to be a floating number');
            return false;
        }
    };

    Rules.prototype.commaSeparatedEmails = function *(field, value, message){
        const emails = value.split(',');
        let areEmails = true;

        for(let email of emails){
            if(!v.isEmail(email.trim())){
                areEmails = false;
                break;
            }
        }

        if(areEmails){
            return true;
        }else {
            this.validator.addError(field, 'commaSeparatedEmails', 'field', message || 'The value needs to be proper comma separated emails');
            return false;
        }
    };
};
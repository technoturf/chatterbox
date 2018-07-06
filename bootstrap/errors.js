"use strict";

global.GenericError = function (message) {
    this.name = 'GenericError';
    this.message = message || 'There was some`` kinda GenericError';
    this.code = 500;
};

GenericError.prototype = Object.create(Error.prototype);
GenericError.prototype.constructor = GenericError;

global.UploadLimitExceeded = function (message) {
    this.name = 'UploadLimitExceeded';
    this.message = "You can only upload at max 5 files. To add one more file delete any one file from the previous list of files.";
    this.code = 500;
};

UploadLimitExceeded.prototype = Object.create(Error.prototype);
UploadLimitExceeded.prototype.constructor = UploadLimitExceeded;

global.NotFoundError = function (message) {
    this.name = 'NotFoundError';
    this.message = message || 'The url you are looking for was not found!!';
    this.code = 404;
};

NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

global.InvalidPassword = function (message) {
    this.name = 'InvalidPassword';
    this.message = message || 'You have entered a worng password!!';
    this.code = 490;
};

InvalidPassword.prototype = Object.create(Error.prototype);
InvalidPassword.prototype.constructor = InvalidPassword;

global.AlreadyMarkedRead = function (message) {
    this.name = 'AlreadyMarkedRead';
    this.message = message || 'This notification is already marked read.';
    this.code = 420;
};

AlreadyMarkedRead.prototype = Object.create(Error.prototype);
AlreadyMarkedRead.prototype.constructor = AlreadyMarkedRead;

global.InvalidCurrentPassword = function (message) {
    this.name = 'InvalidCurrentPassword';
    this.message = message || 'You have entered a wrong current password!!';
    this.code = 490;
};

InvalidCurrentPassword.prototype = Object.create(Error.prototype);
InvalidCurrentPassword.prototype.constructor = InvalidCurrentPassword;


global.WrongPassword = function (message) {
    this.name = 'WrongPassword';
    this.message = message || 'You have entered a worng password!!';
    this.code = 420;
};

WrongPassword.prototype = Object.create(Error.prototype);
WrongPassword.prototype.constructor = WrongPassword;

global.AccountNotFound = function (message) {
    this.name = 'AccountNotFound';
    this.message = message || 'This account does not exists in our database';
    this.code = 404;
};

AccountNotFound.prototype = Object.create(Error.prototype);
AccountNotFound.prototype.constructor = AccountNotFound;

global.FileNotFoundError = function (message) {
    this.name = 'FileNotFoundError';
    this.message = message || 'The file you are looking for was not found';
    this.code = 404;
};

FileNotFoundError.prototype = Object.create(Error.prototype);
FileNotFoundError.prototype.constructor = FileNotFoundError;

global.UserNotActiveError = function (message) {
    this.name = 'UserNotActiveError';
    this.message = message || 'The user state is not active. Cannot use account until state is active';
    this.code = 499;
};

UserNotActiveError.prototype = Object.create(Error.prototype);
UserNotActiveError.prototype.constructor = UserNotActiveError;


global.ValidationError = function (message) {
    this.name = 'ValidationError';
    this.message = message || 'There were errors in validation';
    this.code = 420;
};

ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;


global.FileError = function (message) {
    this.name = 'FileError';
    this.message = message || 'There were errors in File Format. Please make sure that it contains fields like first_name, phone_number_one, country_code_one, customer_address, latitude and longitude';
    this.code = 420;
};

FileError.prototype = Object.create(Error.prototype);
FileError.prototype.constructor = FileError;

global.AccessTokenError = function (message) {
    this.name = 'AccessTokenError';
    this.message = message || 'Your session has expired. Your account seems to be active on another device. Kindly login again.';
    this.code = 490;
};

AccessTokenError.prototype = Object.create(Error.prototype);
AccessTokenError.prototype.constructor = AccessTokenError;

global.BlockedError = function (message) {
    this.name = 'BlockedError';
    this.message = message || 'You have been blocked by your Manager. Kindly contact to your reporting Manager';
    this.code = 490;
};

BlockedError.prototype = Object.create(Error.prototype);
BlockedError.prototype.constructor = BlockedError;

global.InvalidLoginError = function (message) {
    this.name = 'InvalidLoginError';
    this.message = message || 'Your Email ID or Password was Incorrect';
    this.code = 490;
};

InvalidLoginError.prototype = Object.create(Error.prototype);
InvalidLoginError.prototype.constructor = InvalidLoginError;

global.NotYourDeviceError = function (message) {
    this.name = 'NotYourDeviceError';
    this.message = message || `The device ain't yours bruh!! Be cool!!`;
    this.code = 492;
};

NotYourDeviceError.prototype = Object.create(Error.prototype);
NotYourDeviceError.prototype.constructor = NotYourDeviceError;

global.NoPhoneNumberError = function (message) {
    this.name = 'NoPhoneNumberError';
    this.message = message || 'No Phone numbers in your account... Say What!!';
    this.code = 490;
};

NoPhoneNumberError.prototype = Object.create(Error.prototype);
NoPhoneNumberError.prototype.constructor = NoPhoneNumberError;

global.InvalidContentTypeError = function (message) {
    this.name = 'InvalidContentTypeError';
    this.message = message || 'The content type set was invalid';
    this.code = 406;
};

InvalidContentTypeError.prototype = Object.create(Error.prototype);
InvalidContentTypeError.prototype.constructor = InvalidContentTypeError;

global.PhoneNumbersCountFullError = function (message) {
    this.name = 'PhoneNumbersCountFullError';
    this.message = message || 'You have added the maximum number of phone numbers possible';
    this.code = 457;
};

PhoneNumbersCountFullError.prototype = Object.create(Error.prototype);
PhoneNumbersCountFullError.prototype.constructor = PhoneNumbersCountFullError;

global.InvalidVerificationPinError = function (message) {
    this.name = 'InvalidVerificationPinError';
    this.message = message || 'The pin you have entered is invalid';
    this.code = 422;
};

InvalidVerificationPinError.prototype = Object.create(Error.prototype);
InvalidVerificationPinError.prototype.constructor = InvalidVerificationPinError;

global.ExpiredVerificationPinError = function (message) {
    this.name = 'ExpiredVerificationPinError';
    this.message = message || 'The pin you have entered has probably expired';
    this.code = 423;
};

ExpiredVerificationPinError.prototype = Object.create(Error.prototype);
ExpiredVerificationPinError.prototype.constructor = ExpiredVerificationPinError;

global.InvalidPhoneNumberError = function (message) {
    this.name = 'InvalidPhoneNumberError';
    this.message = message || 'The phone number entered is Invalid';
    this.code = 451;
};

InvalidPhoneNumberError.prototype = Object.create(Error.prototype);
InvalidPhoneNumberError.prototype.constructor = InvalidPhoneNumberError;

global.PhoneNumberNotLinkedToUserError = function (message) {
    this.name = 'PhoneNumberNotLinkedToUserError';
    this.message = message || 'The phone number you are trying to access does not belong to you';
    this.code = 468;
};
PhoneNumberNotLinkedToUserError.prototype = Object.create(Error.prototype);
PhoneNumberNotLinkedToUserError.prototype.constructor = PhoneNumberNotLinkedToUserError;

global.PhoneNumberNotGreaterThanOneError = function (message) {
    this.name = 'PhoneNumberNotGreaterThanOneError';
    this.message = message || 'You do not have more than one phone number';
    this.code = 469;
};

PhoneNumberNotGreaterThanOneError.prototype = Object.create(Error.prototype);
PhoneNumberNotGreaterThanOneError.prototype.constructor = PhoneNumberNotGreaterThanOneError;


global.SyncTimestampError = function (message) {
    this.name = 'SyncTimestampError';
    this.message = message || 'The timestamps do not match. Start over with store and sync';
    this.code = 445;
};

SyncTimestampError.prototype = Object.create(Error.prototype);
SyncTimestampError.prototype.constructor = SyncTimestampError;

global.DeviceNotActivatedError = function (message) {
    this.name = 'DeviceNotActivatedError';
    this.message = message || 'The device has not been activated through email yet!!';
    this.code = 495;
};

DeviceNotActivatedError.prototype = Object.create(Error.prototype);
DeviceNotActivatedError.prototype.constructor = DeviceNotActivatedError;

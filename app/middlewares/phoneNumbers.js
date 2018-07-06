'use strict';

module.exports = function *(next){
    if(this.user.phone_numbers
        && typeof this.user.phone_numbers === 'object'
        && Object.keys(this.user.phone_numbers).length){

        this.user.has_verified_phone_number = true;
        yield next;
    }else{
        error('NoPhoneNumberError');
    }
}

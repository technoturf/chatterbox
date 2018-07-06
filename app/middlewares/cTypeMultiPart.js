'use strict';

module.exports = function *(next){
    if(['GET', 'HEAD'].indexOf(this.method.toUpperCase()) === -1){
        if(typeof this.get('Content-Type') === 'undefined' || this.get('Content-Type').indexOf('multipart') === -1){
            error('InvalidContentTypeError', 'The content type sent is invalid. Please change it to multipart/form-data');
        }
    }

    yield next;
};

'use strict';

module.exports = function *(next){
    yield this.validateBody({
        'access_token': 'required'
    });

    if(!this.validationErrors){
      if((yield db.queryAsync(`SELECT access_token FROM login_device_details WHERE access_token = ? `,[this.request.body.fields.access_token])).length > 0){
        yield next;
      }else{
        error('AccessTokenError')
      }
    }else{
        error('ValidationError');
    }
};

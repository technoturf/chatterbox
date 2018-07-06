'use strict';

module.exports = function *(next){
    yield this.validateBody({
        'access_token': 'required',
        'business_id': 'required'
    });

    if(!this.validationErrors){
      if((yield db.queryAsync(`SELECT access_token FROM login_device_details WHERE access_token = ? AND business_id = ?`,[this.request.body.fields.access_token, this.request.body.fields.business_id])).length > 0){

        var status = yield db.queryAsync(`
          SELECT m.status
          FROM login_device_details ldd
          LEFT JOIN managers m ON m.manager_id = ldd.user_id
          WHERE ldd.access_token = ?
          AND ldd.business_id = ?`,[this.request.body.fields.access_token, this.request.body.fields.business_id]);

          if(status[0].status === 0){
            error('BlockedError');
          }else{
            yield next;
          }
      }else{
        error('AccessTokenError');
      }
    }else{
        error('ValidationError');
    }
};

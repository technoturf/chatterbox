'use strict';

module.exports = function *(next){
    yield this.validateHeaders({
        'x-unique-id': 'required',
        'x-device-id': 'required'
    });

    if(!this.validationErrors){
        this.user = yield spikedb.selectSync(
            aerospike.key('users', this.get('x-unique-id')),
            [
                'name',
                'email',
                'pp_hash',
                'pp_timestamp',
                'slt',
                'slt_timestamp',
                'som',
                'som_timestamp',
                'tz',
                'tz_timestamp',
                'timestamp',
                'phone_numbers',
                'default_cid',
                'deleted',
                'currency',
                'status'
            ]
        );

        if(Object.keys(this.user).length && !this.user.deleted){
            this.user.unique_id = this.get('x-unique-id');
            this.user.auto = (this.get('x-auto'))? true:false;

            if(this.user.status !== 'Active'){
                error('UserNotActiveError');
            }

            yield next;
        }else{
            error('UserNotFoundError');
        }
    }else{
        error('ValidationError');
    }
};

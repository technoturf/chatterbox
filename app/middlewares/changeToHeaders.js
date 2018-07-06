"use strict";

module.exports = function *(next){

    this.headers['x-unique-id'] = (this.query && this.query.unique_id)? this.query.unique_id: null;
    this.headers['x-access-token'] = (this.query && this.query.access_token)? this.query.access_token: null;
    this.headers['x-device-id'] = (this.query && this.query.device_id)? this.query.device_id: null;

    yield next;
};
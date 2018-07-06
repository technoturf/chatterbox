'use strict';

const Agent = require('../models/Agent');

exports.login_agent = function *(){
    yield this.validateBody({
        agent_email: 'required',
        password: 'required',
        device_type: 'required|numeric',
        device_details: 'required',
        app_type: 'required|numeric',
        app_version: `required|numeric`,
        device_id: 'required'
    });

    if(!this.validationErrors){
      const agent = {
        agent_email: this.request.body.fields.agent_email,
        password: this.request.body.fields.password,
        device_type: this.request.body.fields.device_type,
        device_details: this.request.body.fields.device_details,
        app_type: this.request.body.fields.app_type,
        app_version: this.request.body.fields.app_version,
        device_id: this.request.body.fields.device_id
      }
        this.result = yield Agent.getInstance().login_agent(agent);
    }else{
        error('ValidationError');
    }
};

exports.login_agent_access_token = function *(){
    yield this.validateBody({
        access_token: 'required',
        device_type: 'required|numeric',
        app_type: 'required|numeric',
        app_version: `required|numeric`,
        device_id: 'required'
    });

    if(!this.validationErrors){
      const agent = {
        access_token: this.request.body.fields.access_token,
        device_type: this.request.body.fields.device_type,
        app_type: this.request.body.fields.app_type,
        app_version: this.request.body.fields.app_version,
        device_id: this.request.body.fields.device_id
      }
        this.result = yield Agent.getInstance().login_agent_access_token(agent);
    }else{
        error('ValidationError');
    }
};

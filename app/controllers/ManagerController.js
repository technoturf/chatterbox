"use strict";

const Manager = require('../models/Manager');
const request = require('co-request');

exports.manager_signin = function *(){  // Manager Login

    yield this.validateBody({
        email: 'required|email',
        password: 'required'
    });

    if(!this.validationErrors){
        var manager = {
            email: this.request.body.fields.email.toLowerCase(),
            password: this.request.body.fields.password,
            device_type: this.request.body.fields.device_type,
            device_details: this.request.body.fields.device_details,
            app_type: this.request.body.fields.app_type,
            app_version: this.request.body.fields.app_version,
            device_id: this.request.body.fields.device_id
        };

        this.result = yield Manager.getInstance().manager_signin(manager);

    }else{
        error('ValidationError');
    }
};

exports.manager_logout = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id
    }
      this.result = yield Manager.getInstance().manager_logout(manager);
  }else{
      error('ValidationError');
  }
}

exports.manager_mobile_signin = function *(){  // Manager Login

    yield this.validateBody({
        email: 'required|email',
        password: 'required'
    });

    if(!this.validationErrors){
        var manager = {
            email: this.request.body.fields.email.toLowerCase(),
            password: this.request.body.fields.password,
            device_type: this.request.body.fields.device_type,
            device_details: this.request.body.fields.device_details,
            app_type: this.request.body.fields.app_type,
            app_version: this.request.body.fields.app_version,
            device_id: this.request.body.fields.device_id
        };

        this.result = yield Manager.getInstance().manager_mobile_signin(manager);

    }else{
        error('ValidationError');
    }
};

exports.manager_access_token_login = function *(){  // Manager Login

    yield this.validateBody({
        access_token: 'required'
    });

    if(!this.validationErrors){
        var manager = {
            access_token: this.request.body.fields.access_token,
            password: this.request.body.fields.password,
            device_type: this.request.body.fields.device_type,
            device_details: this.request.body.fields.device_details,
            app_type: this.request.body.fields.app_type,
            app_version: this.request.body.fields.app_version,
            device_id: this.request.body.fields.device_id
        };

        this.result = yield Manager.getInstance().manager_access_token_login(manager);

    }else{
        error('ValidationError');
    }
};

exports.manager_signup = function *(){  // New Onboarding

    yield this.validateBody({
        manager_full_name: 'required',
        // manager_last_name: 'required', //Removed because of design changes done on 12th august 2017
        // manager_username: 'required', //Removed because of design changes done on 12th august 2017
        // city: 'required', //Will be fetched from Address according to the design changes done on 12th August 2017
        // manager_task_type: 'numeric', //not needed
        // manager_profile_picture: 'required', //Removed because of design changes done on 12th august 2017
        // state: 'required', //Will be fetched from Address according to the design changes done on 12th August 2017
        // country: 'required', //Will be fetched from Address according to the design changes done on 12th August 2017
        manager_email: 'required|email',
        manager_phone_number: 'required',
        country_code: 'required',// introduced in the the design changes done on 12th August 2017
        password: 'required',
        business_type: 'numeric',
        industry_type: 'numeric',
        business_name: 'requiredWith:business_address',
        business_address: 'requiredWith:business_name',
        business_region: 'required'
        // close_status:'numeric',
        // setup_type: 'numeric'
    });

    if(!this.validationErrors){
        var manager = {
          manager_full_name: this.request.body.fields.manager_full_name,
          // manager_last_name: this.request.body.fields.manager_last_name,//Removed because of design changes done on 12th august 2017
          // manager_user_name: this.request.body.fields.manager_user_name, //Removed because of design changes done on 12th august 2017
          // city: this.request.body.fields.manager_city, //Will be fetched from Address according to the design changes done on 12th August 2017
          // manager_task_type: this.request.body.fields.manager_task_type,
          // manager_profile_picture: this.request.body.fields.manager_profile_picture, //Removed because of design changes done on 12th august 2017
          // state: this.request.body.fields.manager_state,//Will be fetched from Address according to the design changes done on 12th August 2017
          // country: this.request.body.fields.manager_country,//Will be fetched from Address according to the design changes done on 12th August 2017
          manager_email: this.request.body.fields.manager_email,
          manager_phone_number: this.request.body.fields.manager_phone_number,
          country_code: this.request.body.fields.country_code,
          password: this.request.body.fields.password,
          business_type: this.request.body.fields.business_type,
          industry_type: this.request.body.fields.industry_type,
          business_name: this.request.body.fields.business_name,
          business_address: this.request.body.fields.business_address,
          // close_status: this.request.body.fields.close_status,
          // setup_type: this.request.body.fields.setup_type,
          business_region: this.request.body.fields.business_region
        };

        this.result = yield Manager.getInstance().manager_signup(manager);

    }else{
        error('ValidationError');
    }
};

exports.manager_permissons = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required',
        manager_type: 'required|numeric'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_type: this.request.body.fields.manager_type
        };

        this.result = yield Manager.getInstance().manager_permissons(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_business_managers = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_business_managers(manager);
    }else{
        error('ValidationError');
    }
};

exports.manager_access_layer = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id
        };

        this.result = yield Manager.getInstance().manager_access_layer(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_managers_via_manager_type = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required',
        manager_type: 'required'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_type: this.request.body.fields.manager_type,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_managers_via_manager_type(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_managers_to_team = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required',
        team_id: 'required|numeric',
        limit: 'required|numeric',
        offset: 'required|numeric'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          team_id: this.request.body.fields.team_id,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_managers_to_team(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_managers_to_teams = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required',
        team_id: 'required|array',
        limit: 'required|numeric',
        offset: 'required|numeric'
    });
    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          team_id: this.request.body.fields.team_id,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_managers_to_teams(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_notifications_to_manager = function *(){  // Get List Of Managers
    yield this.validateBody({
        access_token: 'required',
        business_id: 'required',
        limit: 'required|numeric',
        offset: 'required|numeric'
    });

    if(!this.validationErrors){
        const manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_notifications_to_manager(manager);
    }else{
        error('ValidationError');
    }
};

exports.add_manager = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_full_name: 'required',
      manager_username: 'required',
      manager_task_type: 'required|array',
      manager_email: 'required|email',
      manager_phone_number: 'required',
      country_code: 'required',
      password: 'required',
      manager_reporting_to: 'required|numeric',
      manager_type: 'required|numeric',
      manager_permissons: 'required|array',
      employee_code: 'required',
      team_id: 'required|array'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_full_name: this.request.body.fields.manager_full_name,
          manager_username: this.request.body.fields.manager_username,
          manager_task_type: this.request.body.fields.manager_task_type,
          manager_email: this.request.body.fields.manager_email,
          manager_phone_number: this.request.body.fields.manager_phone_number,
          country_code: this.request.body.fields.country_code,
          password: this.request.body.fields.password,
          manager_reporting_to: this.request.body.fields.manager_reporting_to,
          manager_type: this.request.body.fields.manager_type,
          manager_permissons: this.request.body.fields.manager_permissons,
          employee_code: this.request.body.fields.employee_code,
          team_id: this.request.body.fields.team_id,
          manager_profile_picture: this.request.body.fields.manager_profile_picture
        };

        this.result = yield Manager.getInstance().add_manager(manager);
    }else{
        error('ValidationError');
    }
};

exports.edit_manager = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_id: 'required|numeric',
      manager_full_name: 'required',
      manager_username: 'required',
      manager_task_type: 'required|array',
      manager_email: 'required|email',
      manager_phone_number: 'required',
      country_code: 'required',
      manager_reporting_to: 'required|numeric',
      manager_type: 'required|numeric',
      manager_permissons: 'required|array',
      employee_code: 'required',
      team_id: 'required|array'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_id: this.request.body.fields.manager_id,
          manager_full_name: this.request.body.fields.manager_full_name,
          manager_username: this.request.body.fields.manager_username,
          manager_task_type: this.request.body.fields.manager_task_type,
          manager_email: this.request.body.fields.manager_email,
          manager_phone_number: this.request.body.fields.manager_phone_number,
          country_code: this.request.body.fields.country_code,
          manager_reporting_to: this.request.body.fields.manager_reporting_to,
          manager_type: this.request.body.fields.manager_type,
          manager_permissons: this.request.body.fields.manager_permissons,
          employee_code: this.request.body.fields.employee_code,
          team_id: this.request.body.fields.team_id,
          manager_profile_picture: this.request.body.fields.manager_profile_picture
        };

        this.result = yield Manager.getInstance().edit_manager(manager);
    }else{
        error('ValidationError');
    }
};

exports.edit_manager_status = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_id: 'required|numeric',
      status: 'required|numeric'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_id: this.request.body.fields.manager_id,
          status: this.request.body.fields.status
        };

        this.result = yield Manager.getInstance().edit_manager_status(manager);
    }else{
        error('ValidationError');
    }
};

exports.manager_forgot_password = function *(){  // Add Managers
    yield this.validateBody({
      email: 'required|email'
    });

    if(!this.validationErrors) {
        var manager = {
          email: this.request.body.fields.email
        };

        this.result = yield Manager.getInstance().manager_forgot_password(manager);
    }else{
        error('ValidationError');
    }
};

exports.manager_reset_password = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      new_password: 'required'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          old_password: this.request.body.fields.old_password,
          new_password: this.request.body.fields.new_password
        };

        this.result = yield Manager.getInstance().manager_reset_password(manager);
    }else{
        error('ValidationError');
    }
};

exports.manager_reset_password_in = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      old_password: 'required',
      new_password: 'required'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          old_password: this.request.body.fields.old_password,
          new_password: this.request.body.fields.new_password
        };

        this.result = yield Manager.getInstance().manager_reset_password_in(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_manager_via_id = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_id: 'required|numeric'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_id: this.request.body.fields.manager_id
        };

        this.result = yield Manager.getInstance().get_manager_via_id(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_manager_profile = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required'
    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id
        };

        this.result = yield Manager.getInstance().get_manager_profile(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_bulk_managers_drop_down = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      type: 'required|numeric'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          type: this.request.body.fields.type,
        };

        this.result = yield Manager.getInstance().get_bulk_managers_drop_down(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_bulk_managers_result = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      type: 'required|numeric',
      item_id: 'required|array',
      limit: 'required|numeric',
      offset: 'required|numeric'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          type: this.request.body.fields.type,
          item_id: this.request.body.fields.item_id,
          limit: this.request.body.fields.limit,
          offset: this.request.body.fields.offset
        };

        this.result = yield Manager.getInstance().get_bulk_managers_result(manager);
    }else{
        error('ValidationError');
    }
};

exports.edit_manager_profile = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      manager_full_name: 'required',
      manager_email: 'required',
      manager_phone_number: 'required',
      manager_address: 'required'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id,
          manager_full_name: this.request.body.fields.manager_full_name,
          manager_email: this.request.body.fields.manager_email,
          manager_phone_number: this.request.body.fields.manager_phone_number,
          manager_address: this.request.body.fields.manager_address
        };

        this.result = yield Manager.getInstance().edit_manager_profile(manager);
    }else{
        error('ValidationError');
    }
};

exports.get_agent_app_config = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          business_id: this.request.body.fields.business_id
        };

        this.result = yield Manager.getInstance().get_agent_app_config(manager);
    }else{
        error('ValidationError');
    }
};

exports.upload_task_file = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric'
  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      file: this.request.body.files.file
    }
      console.log("This is the file", manager.file);
      this.result = yield Manager.getInstance().upload_task_file(manager);
  }else{
      error('ValidationError');
  }
}

exports.mark_read_notification = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      notification_id: 'required'

  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      notification_id: this.request.body.fields.notification_id
    }
      console.log("This is the file", manager.file);
      this.result = yield Manager.getInstance().mark_read_notification(manager);
  }else{
      error('ValidationError');
  }
}

exports.mark_read_alert = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      alert_id: 'required'

  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      alert_id: this.request.body.fields.alert_id
    }
      console.log("This is the file", manager.file);
      this.result = yield Manager.getInstance().mark_read_notification(manager);
  }else{
      error('ValidationError');
  }
}

exports.send_dummy_mail = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      mailType: 'required',
      emailVariables: 'required',
      emailId: 'required',
      emailFrom: 'required',
      emailSubject: 'required',
      name_mail: 'required'

  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      mailType: this.request.body.fields.mailType,
      emailVariables: this.request.body.fields.emailVariables,
      emailId: this.request.body.fields.emailId,
      emailFrom: this.request.body.fields.emailFrom,
      emailSubject: this.request.body.fields.emailSubject,
      name_mail: this.request.body.fields.name_mail,
    }
      console.log("This is the file", manager.file);
      this.result = yield Manager.getInstance().send_dummy_mail(manager);
  }else{
      error('ValidationError');
  }
}

exports.home_screen = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      from_date: 'required',
      to_date: 'required'
  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      from_date: this.request.body.fields.from_date,
      to_date: this.request.body.fields.to_date
    }
      this.result = yield Manager.getInstance().home_screen(manager);
  }else{
      error('ValidationError');
  }
}

exports.get_notes_of_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric'
  });

  if(!this.validationErrors){
    const note = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id
    }
      this.result = yield Manager.getInstance().get_notes_of_task(note);
  }else{
      error('ValidationError');
  }
}

exports.search_managers = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      input: 'required'
  });

  if(!this.validationErrors){
    const note = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      input: this.request.body.fields.input
    }
      this.result = yield Manager.getInstance().search_managers(note);
  }else{
      error('ValidationError');
  }
}

exports.upload_manager_profile_pic = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      manager_id: 'required'
  });
  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      manager_id: this.request.body.fields.manager_id,
      file: this.request.body.files.file
    }
      this.result = yield Manager.getInstance().upload_manager_profile_pic(manager);
  }else{
      error('ValidationError');
  }
}

exports.upload_signature_manager_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      file: this.request.body.files.file,
      task_id: this.request.body.fields.task_id
    }
      this.result = yield Manager.getInstance().upload_signature_manager_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.upload_document_manager_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      task_id: 'required',
      doc_number: 'required'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      file: this.request.body.files.file,
      task_id: this.request.body.fields.task_id,
      doc_number: this.request.body.fields.doc_number
    }
      this.result = yield Manager.getInstance().upload_document_manager_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.create_note_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric',
      note_name: 'required',
      content: 'required'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id,
      note_name: this.request.body.fields.note_name,
      content: this.request.body.fields.content
    }
      this.result = yield Manager.getInstance().create_note_to_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.create_notes_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric',
      notes: 'required|array'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id,
      notes: this.request.body.fields.notes
    }
      this.result = yield Manager.getInstance().create_notes_to_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.edit_note_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric',
      note_name: 'required',
      content: 'required',
      note_id: 'required|numeric'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id,
      note_name: this.request.body.fields.note_name,
      content: this.request.body.fields.content,
      note_id: this.request.body.fields.note_id
    }
      this.result = yield Manager.getInstance().edit_note_to_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.edit_notes_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      notes_data: 'required|array'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      notes_data: this.request.body.fields.notes_data
    }
      this.result = yield Manager.getInstance().edit_notes_to_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.delete_note_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric',
      note_id: 'required|numeric',
      status: 'required|numeric'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id,
      note_id: this.request.body.fields.note_id,
      status: this.request.body.fields.status
    }
      this.result = yield Manager.getInstance().delete_note_of_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.edit_template_to_task = function *(){
  yield this.validateBody({
      access_token: 'required',
      business_id: 'required|numeric',
      task_id: 'required|numeric',
      value: 'required',
      template_id: 'required|numeric'
  });

  if(!this.validationErrors){
    const manager = {
      access_token: this.request.body.fields.access_token,
      business_id: this.request.body.fields.business_id,
      task_id: this.request.body.fields.task_id,
      value: this.request.body.fields.value,
      template_id: this.request.body.fields.template_id
    }
      this.result = yield Manager.getInstance().edit_template_to_task(manager);
  }else{
      error('ValidationError');
  }
}

exports.manager_email = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_email: 'required'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          manager_email: this.request.body.fields.manager_email
        };

        this.result = yield Manager.getInstance().manager_email(manager);
    }else{

        error('ValidationError');
    }
};

exports.manager_username = function *(){  // Add Managers
    yield this.validateBody({
      access_token: 'required',
      business_id: 'required',
      manager_username: 'required'

    });

    if(!this.validationErrors) {
        var manager = {
          access_token: this.request.body.fields.access_token,
          manager_username: this.request.body.fields.manager_username
        };

        this.result = yield Manager.getInstance().manager_username(manager);
    }else{

        error('ValidationError');
    }
};


exports.manager_task_types = function *(){
  this.result = yield Manager.getInstance().manager_task_types();
}

'use strict';
const request = require('co-request');
var bcrypt = require('bcryptjs');
const CommonFunction = require('./CommonFunction');
const saltRounds = 10;
const sendEmailToUser = require('../../config/email').sendEmailToUser;


class Manager {
    constructor() {
        this.multi = [];
    }

    * manager_signin(manager) {
        let remainTask = 0;
        var hash = bcrypt.hashSync(manager.password, 10);
        const password = yield db.queryAsync(`
        SELECT *
        FROM managers
        WHERE status NOT IN(2)
        AND (manager_email = ? OR manager_username = ?)`, [manager.email, manager.email]);

        if (password.length <= 0) {
            console.log("There was some problem")
            return error('InvalidLoginError')
        }else if (password[0].status === 0) {
            console.log("There was some problem")
            return error('BlockedError')
        }

        else if ((bcrypt.compareSync(manager.password, password[0].password)) === true) {

            var main_permissions = yield db.queryAsync(
              `SELECT *
               FROM permission_categories
              `,[]
            );

            var permissions = yield db.queryAsync(
                `SELECT ctm.category_id,
                  pc.category_name,
                  ctm.status
           FROM category_to_manager ctm
           LEFT JOIN permission_categories pc ON pc.category_id = ctm.category_id
           WHERE ctm.manager_id = ?
          `, [password[0].manager_id]
            )

            var actual_permission = []

          for(var i = 0; i < main_permissions.length; i++ ){
            actual_permission.push({category_id: main_permissions[i].category_id, category_name:  main_permissions[i].category_name, status: 0})
            for(var j = 0; j < permissions.length; j++){
              if(main_permissions[i].category_id === permissions[j].category_id){
                actual_permission[i] = {category_id: permissions[j].category_id, category_name:  permissions[j].category_name, status: permissions[j].status}
              }
            }
          }

            var device_details = yield db.queryAsync(`
          SELECT
              id,
              user_id,
              user_type,
              business_id,
              app_type,
              device_type
          FROM login_device_details
          WHERE user_id = ?
          AND app_type = ?
          AND device_type = ?
          AND user_type = ?
          AND business_id = ?
           `, [password[0].manager_id, 1, 3, 1, password[0].business_id])

            if (device_details.length > 0) {
                var update_access_token = yield db.queryAsync(`
            UPDATE login_device_details
              SET access_token = ?,
                  device_details = ?,
                  signin_count = signin_count + 1,
                  device_id = ?
              WHERE id = ?
            `, [hash, "web", "web", device_details[0].id])
            } else {
                const device_details = yield db.queryAsync(
                    `INSERT INTO login_device_details(
              access_token,
              business_id,
              device_type,
              app_type,
              user_id,
              device_details,
              signin_count,
              user_type)
             VALUES(?, ?, ?, ?, ?, ?, signin_count + 1, ?)
            `, [hash, password[0].business_id, 3, 1, password[0].manager_id, "web", 1]);
            }

            const token = yield db.queryAsync(
                `UPDATE managers
            SET access_token = ?
            WHERE manager_email = ?
            OR manager_username = ?
          `, [hash, manager.email, manager.email]);

            const business_details = yield db.queryAsync(
                `SELECT *
           FROM business_details
           WHERE business_id = ?
          `, [password[0].business_id]);

            const totalTasks = yield db.queryAsync(
                'SELECT count(task_id) as tasks FROM tasks where business_id = ?', [password[0].business_id]
            )
            //console.log("________b______", totalTasks, business_details[0].max_no_of_task)
            if (totalTasks[0].tasks < business_details[0].max_no_of_task) {
                remainTask = parseInt(business_details[0].max_no_of_task) - parseInt(totalTasks[0].tasks)
            }
            var retVal = {
                access_token: hash,
                manager_details: password,
                business_details: business_details,
                permissions: actual_permission,
                remain_task: remainTask
            };

            return retVal;
        }
        else {
            error('InvalidLoginError')
        }
    }

    * manager_logout(manager) {

      var manager_details = yield db.queryAsync(
        `SELECT *
         FROM login_device_details
         WHERE access_token = ?`,[manager.access_token]
      );

      var logout_manager = yield db.queryAsync(`
        UPDATE login_device_details ldd
        SET ldd.access_token = ?,
            ldd.device_id = ?
        WHERE access_token = ?
        AND business_id = ?
        `,["Logged out", "Logged out", manager.access_token, manager.business_id])

      var last_active_time = yield db.queryAsync(
        `UPDATE managers
         SET last_active = NOW()
         WHERE manager_id = ?
        `,[manager_details[0].user_id]
      )

      var retVal = {
          status_code: 200,
          message: "Manager logged out successfully",
          data: {}
      }
      return retVal
    }

    * manager_mobile_signin(manager) {
        let remainTask = 0;
        var hash = bcrypt.hashSync(manager.password, 10);

        var app_version_details = yield db.queryAsync(`
        SELECT * FROM app_version
        WHERE device_type = ?
        AND app_type = ?`, [manager.device_type, manager.app_type]);

        const password = yield db.queryAsync(`
        SELECT m.*,
               GROUP_CONCAT(t.team_name) AS teams
        FROM managers m
        LEFT JOIN team_to_manager ttm ON ttm.manager_id = m.manager_id
        LEFT JOIN teams t ON t.team_id = ttm.team_id
        WHERE m.status NOT IN(0,2)
        AND (m.manager_email = ? OR m.manager_username = ?)
        GROUP BY m.manager_id`, [manager.email, manager.email]);

        if (password.length <= 0) {
            console.log("There was some problem")
            return error('InvalidLoginError')
        }else if (password[0].status === 0) {
            console.log("There was some problem")
            return error('BlockedError')
        }
        else if ((bcrypt.compareSync(manager.password, password[0].password)) === true) {

            var device_details = yield db.queryAsync(`
          SELECT
              id,
              user_id,
              user_type,
              business_id,
              app_type,
              device_type
          FROM login_device_details
          WHERE user_id = ?
          AND app_type = ?
          AND device_type = ?
          AND user_type = ?
          AND business_id = ?
           `, [password[0].manager_id, manager.app_type, manager.device_type, 1, password[0].business_id]);

            if (device_details.length > 0) {
                var update_access_token = yield db.queryAsync(`
            UPDATE login_device_details
              SET access_token = ?,
                  device_details = ?,
                  signin_count = signin_count + 1,
                  device_id = ?
              WHERE id = ?
            `, [hash, manager.device_details, manager.device_id, device_details[0].id])
            } else {
                const device_details = yield db.queryAsync(
                    `INSERT INTO login_device_details(
              access_token,
              business_id,
              device_type,
              app_type,
              user_id,
              device_details,
              signin_count,
              user_type)
             VALUES(?, ?, ?, ?, ?, ?, signin_count + 1, ?)
            `, [hash, password[0].business_id, manager.device_type, manager.app_type, password[0].manager_id, manager.device_details, 1]);
            }

            const business_details = yield db.queryAsync(
                `SELECT *
           FROM business_details
           WHERE business_id = ?
          `, [password[0].business_id]);

            if (app_version_details[0].version > manager.app_version) {
                var critical = app_version_details[0].critical;
                var message = 'Update the app with new version.';
                if (app_version_details[0].last_critical > manager.app_version) {
                    critical = 1;
                }
                var app_version = {
                    version_upgrade: 1,
                    critical: critical,
                    message: message
                }
            }
            else {
                var app_version = {
                    version_upgrade: 0,
                    critical: 0,
                    message: ''
                }
            }

            const notification_count_unread = yield db.queryAsync(
                `SELECT COUNT(notification_id) AS notification_count
              FROM  notifications
              WHERE business_id = ?
              AND user_id = ?
              AND user_type = ?
              AND read_status = ?`, [password[0].business_id, password[0].manager_id, 1, 0]
            )

            const alert_count_unread = yield db.queryAsync(
                `SELECT COUNT(alert_id) AS alert_count
              FROM  alerts
              WHERE business_id = ?
              AND user_id = ?
              AND user_type = ?
              AND read_status = ?`, [password[0].business_id, password[0].manager_id, 1, 0]
            )

            var totalTasks = yield db.queryAsync('select count(task_id) as total_tasks from tasks where `business_id` = ?',[password[0].business_id]);
            console.log("________b______", totalTasks, business_details[0].max_no_of_task)
            if (totalTasks[0].total_tasks < business_details[0].max_no_of_task) {
                remainTask = parseInt(business_details[0].max_no_of_task) - parseInt(totalTasks[0].total_tasks)
            }
            var retVal = {
                status_code: 200,
                message: "Logged in successfully",
                data: {
                    manager_details: {
                        business_id: password[0].business_id,
                        manager_id: password[0].manager_id,
                        manager_full_name: password[0].manager_full_name,
                        manager_username: password[0].manager_username,
                        manager_email: password[0].manager_email,
                        manager_phone_number: password[0].manager_phone_number,
                        manager_profile_picture: password[0].manager_profile_picture,
                        rating: 5,
                        default_channel: business_details[0].default_channel,
                        business_phone: business_details[0].business_phone,
                        business_email: business_details[0].business_email,
                        reporting_manager: password[0].manager_full_name,
                        unread_notification_count: notification_count_unread[0].notification_count,
                        unread_alert_count: alert_count_unread[0].alert_count,
                        total_unread_count:  alert_count_unread[0].alert_count+notification_count_unread[0].notification_count,
                        last_active: password[0].last_active,
                        teams: password[0].teams.split(",")
                    },
                    access_token: hash,
                    app_version: app_version,
                    remain_task: remainTask
                }
            }
            return retVal;
        }
        else {
            error('InvalidLoginError')
        }
    }

    * manager_access_token_login(manager) {
        var hash = manager.access_token;

        var app_version_details = yield db.queryAsync(`
        SELECT * FROM app_version
        WHERE device_type = ?
        AND app_type = ?`, [manager.device_type, manager.app_type]);

        const access_token_check = yield db.queryAsync(`
        SELECT *
        FROM login_device_details
        WHERE access_token = ?
        AND device_type = ?`, [manager.access_token, manager.device_type]);
        console.log("jdhscishkhcsd", access_token_check);

        if (access_token_check <= 0) {
            console.log("There was some problem")
            return error('InvalidLoginError')
        }
        else {
            const password = yield db.queryAsync(`
          SELECT *
          FROM managers
          WHERE manager_id = ?
          AND status NOT IN(0,2)`, [access_token_check[0].user_id]);

            var device_details = yield db.queryAsync(`
          SELECT
              id,
              user_id,
              user_type,
              business_id,
              app_type,
              device_type
          FROM login_device_details
          WHERE user_id = ?
          AND app_type = ?
          AND device_type = ?
          AND user_type = ?
          AND business_id = ?
           `, [password[0].manager_id, manager.app_type, manager.device_type, 1, password[0].business_id])

            if (device_details.length > 0) {
                var update_access_token = yield db.queryAsync(`
            UPDATE login_device_details
              SET access_token = ?,
                  device_details = ?,
                  signin_count = signin_count + 1,
                  device_id = ?
              WHERE id = ?
            `, [hash, manager.device_details, manager.device_id, device_details[0].id])
            } else {
                const device_details = yield db.queryAsync(
                    `INSERT INTO login_device_details(
              access_token,
              business_id,
              device_type,
              app_type,
              user_id,
              device_details,
              signin_count,
              user_type)
             VALUES(?, ?, ?, ?, ?, ?, signin_count + 1, ?)
            `, [hash, password[0].business_id, manager.device_type, manager.app_type, password[0].manager_id, manager.device_details, 1]);
            }

            const business_details = yield db.queryAsync(
                `SELECT *
         FROM business_details
         WHERE business_id = ?
        `, [password[0].business_id]);

            if (app_version_details[0].version > manager.app_version) {
                var critical = app_version_details[0].critical;
                var message = 'Update the app with new version.';
                if (app_version_details[0].last_critical > manager.app_version) {
                    critical = 1;
                }
                var app_version = {
                    version_upgrade: 1,
                    critical: critical,
                    message: message
                }
            }
            else {
                var app_version = {
                    version_upgrade: 0,
                    critical: 0,
                    message: ''
                }
            }
            const notification_count_unread = yield db.queryAsync(
                `SELECT COUNT(notification_id) AS notification_count
              FROM  notifications
              WHERE business_id = ?
              AND user_id = ?
              AND user_type = ?
              AND read_status = ?`, [password[0].business_id, password[0].manager_id, 1, 0]
            )

            const alert_count_unread = yield db.queryAsync(
                `SELECT COUNT(alert_id) AS alert_count
              FROM  alerts
              WHERE business_id = ?
              AND user_id = ?
              AND user_type = ?
              AND read_status = ?`, [password[0].business_id, password[0].manager_id, 1, 0]
            )

            if (manager.device_type === 1 || manager.device_type === 2) {
                var retVal = {
                    status_code: 200,
                    message: "Logged in successfully",
                    data: {
                        manager_details: {
                            business_id: password[0].business_id,
                            manager_id: password[0].manager_id,
                            manager_full_name: password[0].manager_full_name,
                            manager_username: password[0].manager_username,
                            manager_email: password[0].manager_email,
                            manager_phone_number: password[0].manager_phone_number,
                            manager_profile_picture: password[0].manager_profile_picture,
                            rating: 5,
                            default_channel: business_details[0].default_channel,
                            business_phone: business_details[0].business_phone,
                            business_email: business_details[0].business_email,
                            reporting_manager: password[0].manager_full_name,
                            unread_notification_count: notification_count_unread[0].notification_count,
                            unread_alert_count: alert_count_unread[0].alert_count,
                            total_unread_count:  alert_count_unread[0].alert_count+notification_count_unread[0].notification_count
                        },
                        access_token: hash,
                        app_version: app_version
                    }
                }
            } else {
                var retVal = {
                    access_token: hash,
                    manager_details: password,
                    business_details: business_details,
                    app_version: app_version
                };
            }
            return retVal;
        }
    }

    * manager_signup(manager) {
        var hash = bcrypt.hashSync(manager.password, 10);

        if ((yield db.queryAsync(`SELECT m.manager_email FROM managers m WHERE m.manager_email = ?`, [manager.manager_email])).length > 0) {
            console.log("___inside__")
            error('UserExistsErrorEmail');
        }
        else if ((yield db.queryAsync(`SELECT m.manager_username FROM managers m WHERE m.manager_username = ?`, [manager.manager_username])).length > 0) {
            error('UserExistsErrorUsername');
        }
        else {
            const managers = yield db.queryAsync(
                `INSERT INTO
              managers(
                manager_full_name,
                manager_email,
                manager_username,
                manager_phone_number,
                country_code,
                password,
                manager_address,
                manager_reporting_to,
                status,
                manager_type,
                access_token)
                VALUES(?,?,?,?,?,?,?,?,?,?,?)
            `,
                [manager.manager_full_name, manager.manager_email, manager.manager_email,manager.manager_phone_number, manager.country_code, bcrypt.hashSync(manager.password, saltRounds), manager.business_address, 0, 1, 1, hash]
            );

            var values1 = []

            for (var i = 1; i < 20; i++) {
                values1.push([managers.insertId, i, managers.insertId, managers.insertId])
            }

            const manager_permissions_default = yield db.queryAsync(
                `INSERT INTO
              category_to_manager(
                manager_id,
                category_id,
                created_by,
                updated_by)
                VALUES ?`, [values1]
            )

            var permissions = yield db.queryAsync(
                `SELECT ctm.category_id,
                    pc.category_name,
                    ctm.status
             FROM category_to_manager ctm
             LEFT JOIN permission_categories pc ON pc.category_id = ctm.category_id
             WHERE ctm.manager_id = ?
            `, [managers.insertId]
            )

            const business = yield db.queryAsync(
                `INSERT INTO
              business_details(
                manager_id,
                business_email,
                business_name,
                business_address,
                business_phone,
                country_code,
                business_type,
                industry_type,
                status,
                business_region,
                created_by,
                updated_by,
                georestriction_status
              )
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [managers.insertId, manager.manager_email, manager.business_name, manager.business_address,
                    manager.manager_phone_number,manager.country_code, manager.business_type, manager.industry_type, 1, manager.business_region, managers.insertId, managers.insertId, 0]
            );

            var notif_config = [];

            for (var i = 1; i < 9; i++) {
              if(i != 7){
                notif_config.push([i, 0, 0, 1, business.insertId]);
              }
            }

            var default_notification_config = yield db.queryAsync(
                `INSERT INTO notification_configurations(
              trigger_id,
              webhook,
              sms,
              email,
              business_id
            )
            VALUES ?
            `, [notif_config]
            )

            // var batches = [(manager.business_id, "Custom Batch", 1, 1, 40000, 10000, 100000, 10000, 10000, 10, 2, managers.insertId, managers.insertId, 1, 1),(manager.business_id, "One By One", 2, 1, 40000, 10000, 100000, 10000, 10000, 1, 1000000, managers.insertId, managers.insertId, 1, 1),(manager.business_id, "Send To All", 3, 1, 40000, 10000, 100000, 10000, 10000, 1000000, 1, managers.insertId, managers.insertId, 1, 1)];

            const default_batch_custom = yield db.queryAsync(
                `INSERT INTO batch(
              business_id,
              batch_name,
              batch_type,
              status,
              start_radius,
              radius_increment,
              maximum_radius,
              batch_processing_time,
              request_time,
              maximum_batch_size,
              maximum_batch_limit,
              created_by,
              updated_by,
              updated_by_user_type,
              created_by_user_type)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [business.insertId, "Custom Batch", 1, 1, 40000, 10000, 100000, 10000, 60000, 10, 2, managers.insertId, managers.insertId, 1, 1])

            const default_batch_onebyone = yield db.queryAsync(
                `INSERT INTO batch(
              business_id,
              batch_name,
              batch_type,
              status,
              start_radius,
              radius_increment,
              maximum_radius,
              batch_processing_time,
              request_time,
              maximum_batch_size,
              maximum_batch_limit,
              created_by,
              updated_by,
              updated_by_user_type,
              created_by_user_type)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [business.insertId, "One By One", 2, 1, 40000, 10000, 100000, 10000, 10000, 1, 1000000, managers.insertId, managers.insertId, 1, 1])

            const default_batch_sendtoall = yield db.queryAsync(
                `INSERT INTO batch(
              business_id,
              batch_name,
              batch_type,
              status,
              start_radius,
              radius_increment,
              maximum_radius,
              batch_processing_time,
              request_time,
              maximum_batch_size,
              maximum_batch_limit,
              created_by,
              updated_by,
              updated_by_user_type,
              created_by_user_type)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [business.insertId, "Send To All", 3, 1, 40000, 10000, 100000, 10000, 10000, 1000000, 1, managers.insertId, managers.insertId, 1, 1])

            const default_team = yield db.queryAsync(
                `INSERT INTO teams(
                business_id,
                team_name,
                team_initials,
                status,
                created_by,
                updated_by)
              VALUES(?,?,?,?,?,?)
            `, [business.insertId, "Team A", "Team A", 1, managers.insertId, managers.insertId]
            )

            const default_service_region = yield db.queryAsync(
                `INSERT INTO service_region (
                business_id,
                source_location,
                city,
                state,
                country,
                service_region_name,
                polygon,
                created_by,
                updated_by,
                status)
             VALUES(?, ?, ?, ?, ?, ?, X'00000000010300000001000000070000006286D791ADC1544000000000002666C0112DBD376D5255C000000000004565C0BF8CEF0853EB54C00000000000802640455FA4F536C64F4000000000001865C07F598C2B79CC544000000000006464C0C08CEF0853EB54400000000000E030406286D791ADC1544000000000002666C0', ?, ?, ?)`, [business.insertId, "World", "World", "World", "World", "World", managers.insertId, managers.insertId, 1]
            )

            const default_team_service_regions = yield db.queryAsync(
                `INSERT INTO team_to_service_region(
               business_id,
               team_id,
               service_region_id,
               status,
               created_by,
               updated_by)
               VALUES (?,?,?,?,?,?)
             `, [business.insertId, default_team.insertId, default_service_region.insertId, 1, managers.insertId, managers.insertId]
            )

            var agent_name = manager.manager_full_name.split(" ");
            var agent_first_name = agent_name[0];
            var agent_last_name = (agent_name[1] === undefined) ? def_val : agent_name[1];
            console.log("The ganet names******", agent_first_name, agent_last_name);

            const default_agent = yield db.queryAsync(
                `INSERT INTO agents(
               business_id,
               agent_first_name,
               agent_last_name,
               agent_username,
               country_code,
               agent_email,
               agent_address,
               agent_phone_number,
               password,
               status,
               created_by,
               updated_by,
               work_status
             )
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
             `, [business.insertId, agent_first_name, agent_last_name, manager.manager_email,manager.country_code, manager.manager_email, manager.business_address, manager.manager_phone_number, hash, 1, managers.insertId, managers.insertId, 4])

            const default_task_type = yield db.queryAsync(
                `INSERT INTO task_types_to_business(
                   business_id,
                   task_type_name,
                   task_type_duration,
                   status,
                   created_by,
                   updated_by)
                 VALUES(?,?,?,?,?,?)
               `, [business.insertId, "Task Type A", 30, 1, managers.insertId, managers.insertId]
            )

            const default_task_type_to_manager = yield db.queryAsync(
                `INSERT INTO task_type_to_manager(
                   business_id,
                   manager_id,
                   task_type_id,
                   status,
                   created_by,
                   updated_by)
                 VALUES(?,?,?,?,?,?)
               `, [business.insertId, managers.insertId, default_task_type.insertId, 1, managers.insertId, managers.insertId]
            )

            const default_task_type_to_agent = yield db.queryAsync(
                `INSERT INTO task_type_to_agent(
                   business_id,
                   agent_id,
                   task_type_id,
                   status,
                   created_by,
                   updated_by)
                 VALUES(?,?,?,?,?,?)
               `, [business.insertId, default_agent.insertId, default_task_type.insertId, 1, managers.insertId, managers.insertId]
            )

            const team_managers = yield db.queryAsync(
                `INSERT INTO team_to_manager(
                 business_id,
                 team_id,
                 manager_id,
                 status,
                 created_by,
                 updated_by)
                 VALUES(?,?,?,?,?,?)
               `, [business.insertId, default_team.insertId, managers.insertId, 1, managers.insertId, managers.insertId]
            )
            const team_agents = yield db.queryAsync(
                `INSERT INTO agent_to_manager_and_team(
                 business_id,
                 team_id,
                 agent_id,
                 status,
                 manager_id,
                 created_by,
                 updated_by)
                 VALUES (?,?,?,?,?,?,?)
               `, [business.insertId, default_team.insertId, default_agent.insertId, 1, managers.insertId, managers.insertId, managers.insertId]
            )

            const device_details = yield db.queryAsync(
                `INSERT INTO login_device_details(
              access_token,
              business_id,
              device_type,
              app_type,
              user_id,
              device_details,
              signin_count,
              user_type)
             VALUES(?, ?, ?, ?, ?, ?, 1, ?)
            `, [hash, business.insertId, 3, 1, managers.insertId, "web", 1]);


            var ssid = business.insertId + "_" + Math.floor((Math.random() * 10000) + 1);
            var default_channel = "DC_" + business.insertId + "_" + Math.floor((Math.random() * 10000) + 1);
            var business_key = bcrypt.hashSync("DC_" + business.insertId + "_");

            const update_business = yield db.queryAsync(
                `UPDATE business_details
              SET ssid = ?,
                  default_channel = ?,
                  default_batch_id = ?,
                  business_key=?
              WHERE business_id = ?
            `, [ssid, default_channel, default_batch_custom.insertId,business_key, business.insertId]
            );

            const update_managers = yield db.queryAsync(
                `UPDATE managers m
              SET m.business_id = ?,
                  m.created_by = ?,
                  m.updated_by = ?,
                  m.manager_reporting_to = ?
              WHERE m.manager_id = ?
            `, [business.insertId, managers.insertId, managers.insertId, managers.insertId, managers.insertId]
            );

            var values1 = [];

            for (var i = 1; i <= 8; i++) {
                if(i === 4 || i === 5 || i === 6 ){
                  values1.push([business.insertId, i, 1, 0, managers.insertId, managers.insertId])
                }
                else{
                  values1.push([business.insertId, i, 1, 1, managers.insertId, managers.insertId])
                }
            }

            const default_agent_app_config = yield db.queryAsync(
                `INSERT INTO agent_app_configuration (
              business_id,
              field_id,
              accept_decline,
              mandatory,
              created_by,
              updated_by)
             VALUES ?`, [values1]
            )

            const accept_reject = yield db.queryAsync(
              `UPDATE agent_app_configuration
               SET config_status = 2,
                   read_and_write = 0
               WHERE field_id = 8
               AND business_id = ?
              `,[business.insertId] //Thek nahi hua
            )

            let NotiContent = yield db.queryAsync(
                'INSERT INTO notification_content (trigger_id, trigger_type, business_id, content,email_subject)' +
                'SELECT trigger_id, trigger_type, ?, content,email_subject FROM emailTemplate', [business.insertId]
            );

            if ((managers.insertId > 0) && (business.insertId > 0) && (update_managers.affectedRows > 0)) {
                var retVal = {
                    manager_id: managers.insertId,
                    business_id: business.insertId,
                    google_status: 1,
                    here_status: 0,
                    access_token: hash,
                    permissions: permissions,
                    remain_task: 300,
                    default_channel: default_channel

                }
                yield sendEmailToUser("REGISTRATION_ACKNOWLEDGE", {manager_name:manager.manager_full_name, manager_email: manager.manager_email, password: manager.password }, manager.manager_email, "support@azuratech.in", "Welcome to Q-Engine!", "Registeration Mail");

                var content1 =  'Dear '+manager.manager_full_name+', \n' +
                '\n' +
                'Thanks for registering to Q-Engine platform. We are glad to on board you to our platform to help you optimise your day-to-day business operations. Here’s a link to a video to give you a walkthrough of the entire platform: XXXXXXXX\n' +
                '\n' +
                'To login to your Manager application, Kindly click on this link: XXXXXXX\n' +
                '\n' +
                'Here are the credentials below:' +
                '\n' +
                'Manager Login ID: '+manager.manager_email+
                '\n' +
                'Manager Password: '+manager.password +
                '\n' +
                'Regards\n' +
                'Salman Buheji\n' +
                'CEO Q-Engine';

                var content2 = 'Dear '+manager.manager_full_name+', \n' +
                '\n' +
                'To login to your Agent application, Kindly click on this link: XXXXXXX\n' +
                'Here are the credentials below:' +
                '\n' +
                'Agent Login ID: '+manager.manager_email+
                '\n' +
                'Agent Password: '+manager.password+
                '\n' +
                'Further, we have a business consultant who can help you with the initial Onboarding and understanding of the system.\n' +
                ' To setup a meeting, Kindly select a meeting slot from the following link: XXXXXXX\n' +
                '\n' +
                'Have a great day!\n' +
                '\n' +
                '—\n' +
                'Regards\n' +
                'Salman Buheji\n' +
                'CEO Q-Engine';

                yield CommonFunction.send_sms_plivo(manager.country_code+manager.manager_phone_number, content1);
                yield CommonFunction.send_sms_plivo(manager.country_code+manager.manager_phone_number, content2);
                return retVal
            } else {
                error('GenericError')
            }
        }
    }

    * manager_access_layer(manager) {
        var manager_details = yield db.queryAsync(
            `SELECT manager_type
         FROM managers
         WHERE access_token = ?
         AND business_id = ?
        `, [manager.access_token, manager.business_id]
        )

        if (manager_details[0].manager_type === 1) {
            var retVal = {
                allowed_permisssions: [{manager_type: 1, manager_type_name: "Super Admin"}, {
                    manager_type: 2,
                    manager_type_name: "Country Manager"
                }, {manager_type: 3, manager_type_name: "Region Manager"}, {
                    manager_type: 4,
                    manager_type_name: "Store Manager"
                }, {manager_type: 5, manager_type_name: "Dispatcher"},]
            }
        }
        if (manager_details[0].manager_type === 2) {
            var retVal = {
                allowed_permisssions: [{manager_type: 2, manager_type_name: "Country Manager"}, {
                    manager_type: 3,
                    manager_type_name: "Region Manager"
                }, {manager_type: 4, manager_type_name: "Store Manager"}, {
                    manager_type: 5,
                    manager_type_name: "Dispatcher"
                },]
            }
        }
        if (manager_details[0].manager_type === 3) {
            var retVal = {
                allowed_permisssions: [{manager_type: 3, manager_type_name: "Region Manager"}, {
                    manager_type: 4,
                    manager_type_name: "Store Manager"
                }, {manager_type: 5, manager_type_name: "Dispatcher"},]
            }
        }
        if (manager_details[0].manager_type === 4) {
            var retVal = {
                allowed_permisssions: [{manager_type: 4, manager_type_name: "Store Manager"}, {
                    manager_type: 5,
                    manager_type_name: "Dispatcher"
                },]
            }
        }
        if (manager_details[0].manager_type === 5) {
            var retVal = {
                allowed_permisssions: [{manager_type: 5, manager_type_name: "Dispatcher"},]
            }
        }

        return retVal;
    }

    * manager_permissons(manager) {

        var manager_details = yield db.queryAsync(
            `SELECT manager_type
         FROM managers
         WHERE access_token = ?
         AND business_id = ?
        `, [manager.access_token, manager.business_id]
        )

        console.log("dldjlfd", manager_details, manager.manager_type);

        if (manager_details[0].manager_type <= manager.manager_type) {
            if (manager.manager_type === 1) {
                var get_manager_permissions = yield db.queryAsync(
                    `SELECT category_id,
                            category_name,
                            super_admin as reporter
                    FROM permission_categories
                    WHERE category_id NOT IN (1,4)`, []
                )}

            if (manager.manager_type === 2) {
                var get_manager_permissions = yield db.queryAsync(
                    `SELECT category_id,
                            category_name,
                            country_manager as reporter
                     FROM permission_categories
                     WHERE category_id NOT IN (1,4)
            `, []
                )
            }

            if (manager.manager_type === 3) {
                var get_manager_permissions = yield db.queryAsync(
                    `SELECT category_id,
                            category_name,
                            region_manager as reporter
                     FROM permission_categories
                     WHERE category_id NOT IN (1,4)
            `, []
                )
            }

            if (manager.manager_type === 4) {
                var get_manager_permissions = yield db.queryAsync(
                    `SELECT category_id,
                            category_name,
                            store_manager as reporter
                     FROM permission_categories
                     WHERE category_id NOT IN (1,4)
            `, []
                )
            }

            if (manager.manager_type === 5) {
                var get_manager_permissions = yield db.queryAsync(
                    `SELECT category_id,
                            category_name,
                            dispatcher as reporter
                     FROM permission_categories
                     WHERE category_id NOT IN (1,4)
            `, []
                )
            }

            var retVal = {
                permissions: get_manager_permissions
            }

            return retVal;

        } else {
            console.log("You dont have enough rights to make such user");
            error('NotAuthorised');
        }

    }

    * add_manager(manager) {
        if ((yield db.queryAsync(`SELECT m.manager_email FROM managers m WHERE m.manager_email = ?`, [manager.manager_email])).length > 0) {
            error('UserExistsErrorEmail');
        }
        else if ((yield db.queryAsync(`SELECT m.manager_username FROM managers m WHERE m.manager_username = ?`, [manager.manager_username])).length > 0) {
            error('UserExistsErrorUsername');
        }
        else if ((yield db.queryAsync(`SELECT m.employee_code FROM managers m WHERE m.employee_code = ? AND m.business_id = ?`, [manager.employee_code, manager.business_id])).length > 0) {
            error('UserExistsErrorEmployeeCode');
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM agents WHERE employee_code = ? AND business_id = ?`, [manager.employee_code, manager.business_id])).length > 0) {
            error('UserExistsErrorEmployeeCode');
        }
        else {

            const manager_detail = yield db.queryAsync(`
          SELECT ldd.user_id,
                 m.manager_full_name,
                 bd.business_name
          FROM login_device_details ldd
          LEFT JOIN managers m ON m.manager_id = ldd.user_id
          LEFT JOIN business_details bd ON bd.business_id = ldd.business_id
          WHERE ldd.access_token = ?
          `, [manager.access_token]);

            const managers = yield db.queryAsync(
                `INSERT INTO
              managers(
                business_id,
                manager_full_name,
                manager_username,
                manager_email,
                manager_phone_number,
                country_code,
                password,
                manager_reporting_to,
                manager_profile_picture,
                status,
                manager_type,
                employee_code)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            `,
                [manager.business_id, manager.manager_full_name, manager.manager_username, manager.manager_email, manager.manager_phone_number, manager.country_code, bcrypt.hashSync(manager.password, saltRounds), manager.manager_reporting_to, manager.manager_profile_picture, 1, manager.manager_type, manager.employee_code]
            );
            var values1 = []
            var values2 = []
            var values3 = []

            values3.push([managers.insertId, 1, 1, manager_detail[0].user_id, manager_detail[0].user_id])
            values3.push([managers.insertId, 4, 1, manager_detail[0].user_id, manager_detail[0].user_id]) // These are defaut permissions

            for (var i = 0; i < manager.team_id.length; i++) {
                values1.push([manager.business_id, manager.team_id[i], managers.insertId, 1, 1, 1])//Dummy Manager ID Inserted
            }
            for (var i = 0; i < manager.manager_task_type.length; i++) {
                values2.push([manager.business_id, manager.manager_task_type[i], managers.insertId, 1, 1, 1])//Dummy Manager ID Inserted
            }
            for (var i = 0; i < manager.manager_permissons.length; i++) {
                values3.push([managers.insertId, manager.manager_permissons[i], 1, manager_detail[0].user_id, manager_detail[0].user_id])//Dummy Manager ID Inserted
            }

            if (values1.length === manager.team_id.length && values2.length === manager.manager_task_type.length && values3.length > manager.manager_permissons.length) {
                const teams_to_manager = yield db.queryAsync(
                    `INSERT INTO
                team_to_manager(
                  business_id,
                  team_id,
                  manager_id,
                  created_by,
                  updated_by,
                  status
                )
                VALUES ?
              `, [values1]
                )

                const manager_task_types = yield db.queryAsync(
                    `INSERT INTO task_type_to_manager(
                business_id,
                task_type_id,
                manager_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values2]
                )

                const permissions_to_manager = yield db.queryAsync(
                    `INSERT INTO category_to_manager(
                manager_id,
                category_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values3]
                )

                console.log("Permissions to manager", permissions_to_manager, values3);

                var retVal = {
                    manager_id: managers.insertId,
                    business_id: manager.business_id,
                    manager_full_name: manager.manager_full_name
                }
            }

            let content1 =" Dear "+manager.manager_full_name+"," +
                "\n\n" +
                "Welcome to Q-Engine.You have been added as a manager by "+manager_detail[0].business_name +
                "\n\n" +
                "To get started, please use the following link below to download the App:" +
                "\n\n" +
                "AppLink:" +
                "Use the credentials below to login: " +
                "\n Username: "+manager.manager_email+"\n" +
                "Password: "+manager.password+"\n\n" +
                "Regards\nQ-Engine Team";

            let content2 =" Dear "+manager.manager_full_name+",<br><br>" +
                 +
                "Welcome to Q-Engine.You have been added as a manager by "+manager_detail[0].business_name +
                "<br><br>" +
                "To get started, please use the following link below to download the App:" +
                "<br><br>" +
                "AppLink:" +
                "Use the credentials below to login: " +
                "\n Username: "+manager.manager_email+"<br>" +
                "Password: "+manager.password+"<br><br>" +
                "Regards\nQ-Engine Team";
            yield sendEmailToUser("CONFIGURABLE_MAIL", {content:content2}, manager.manager_email, "support@azuratech.in", "Create Manager", "Password Reset Mail");
            yield CommonFunction.send_sms_plivo(manager.country_code+manager.manager_phone_number,content1);

            return retVal;
        }
    }

    * edit_manager(manager) {

      var manager_details = yield db.queryAsync(
        `SELECT ldd.*,
                m.*
         FROM login_device_details ldd
         LEFT JOIN managers m ON m.manager_id = ldd.user_id
         WHERE ldd.access_token = ?
        `,[manager.access_token]
      );
        if((manager_details[0].manager_id === manager.manager_id) || (manager_details[0].manager_type > 1)){
          error('CannotEditYourSelf');
        }
        if(manager_details[0].manager_type > manager.manager_type){
          error('LowRankedManagersCannotEdit');
        }
        if ((yield db.queryAsync(`SELECT m.manager_email FROM managers m WHERE m.manager_email = ? AND m.business_id = ? AND m.status != ? AND m.manager_id != ?`, [manager.manager_email, manager.business_id, 2, manager.manager_id])).length > 0) {
            error('UserExistsErrorEmail');
        }
        else if ((yield db.queryAsync(`SELECT m.manager_username FROM managers m WHERE m.manager_username = ? AND m.business_id = ? AND m.status != ? AND m.manager_id != ?`, [manager.manager_username, manager.business_id, 2, manager.manager_id])).length > 0) {
            error('UserExistsErrorUsername');
        }
        else if ((yield db.queryAsync(`SELECT m.employee_code FROM managers m WHERE m.employee_code = ? AND m.business_id = ? AND m.status != ? AND m.manager_id != ?`, [manager.employee_code, manager.business_id, 2, manager.manager_id])).length > 0) {
            error('UserExistsErrorEmployeeCode');
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM agents WHERE employee_code = ? AND business_id = ? AND status != ?`, [manager.employee_code, manager.business_id, 2])).length > 0) {
            error('UserExistsErrorEmployeeCode');
        }
        else {
            const managers = yield db.queryAsync(
                `UPDATE
              managers
              SET
                manager_full_name = ?,
                manager_username = ?,
                manager_email = ?,
                manager_phone_number = ?,
                country_code = ?,
                manager_reporting_to = ?,
                manager_type = ?,
                manager_profile_picture = ?,
                employee_code = ?
              WHERE
              manager_id = ?
              AND business_id = ?
            `,
                [manager.manager_full_name, manager.manager_username, manager.manager_email, manager.manager_phone_number, manager.country_code, manager.manager_reporting_to, manager.manager_type, manager.manager_profile_picture, manager.employee_code, manager.manager_id, manager.business_id]
            );
            var values1 = []
            var values2 = []
            var values3 = []
            for (var i = 0; i < manager.team_id.length; i++) {
                values1.push([manager.business_id, manager.team_id[i], manager.manager_id, manager_details[0].manager_id, manager_details[0].manager_id, 1])
            }
            for (var i = 0; i < manager.manager_task_type.length; i++) {
                values2.push([manager.business_id, manager.manager_task_type[i], manager.manager_id, 1, manager_details[0].manager_id, manager_details[0].manager_id])
            }
            for (var i = 0; i < manager.manager_permissons.length; i++) {
                values3.push([manager.business_id, manager.manager_permissons[i], manager.manager_id, 1, manager_details[0].manager_id, manager_details[0].manager_id])
            }
            if (values1.length === manager.team_id.length && values2.length === manager.manager_task_type.length && values3.length === manager.manager_permissons.length) {

                const delete_teams_to_manager = yield db.queryAsync(
                    `DELETE FROM
                team_to_manager
                WHERE manager_id = ?
                AND business_id = ?
              `, [manager.manager_id, manager.business_id]
                )

                const teams_to_manager = yield db.queryAsync(
                    `INSERT INTO
                team_to_manager(
                  business_id,
                  team_id,
                  manager_id,
                  created_by,
                  updated_by,
                  status
                )
                VALUES ?
              `, [values1]
                )

                const delete_manager_task_types = yield db.queryAsync(
                    `DELETE FROM task_type_to_manager
              WHERE manager_id = ?
              AND business_id = ?
              `, [manager.manager_id, manager.business_id]
                )

                const manager_task_types = yield db.queryAsync(
                    `INSERT INTO task_type_to_manager(
                business_id,
                task_type_id,
                manager_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values2]
                )

                const delete_permissions_to_manager = yield db.queryAsync(
                    ` DELETE FROM permissions_to_manager
                WHERE manager_id = ?
                AND business_id = ?
              `, [manager.manager_id, manager.business_id]
                )

                const permissions_to_manager = yield db.queryAsync(
                    `INSERT INTO permissions_to_manager(
                business_id,
                permission_id,
                manager_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values3]
                )

                var retVal = {
                    manager_id: manager.manager_id,
                    business_id: manager.business_id,
                    manager_full_name: manager.manager_full_name
                }

                return retVal;
            }
            else {
                var retVal = {
                    manager_id: manager.manager_id,
                    business_id: manager.business_id,
                    manager_full_name: manager.manager_full_name
                }

                return retVal;
            }
        }
    }

    * edit_manager_status(manager) {
      var manager_details = yield db.queryAsync(
        `SELECT ldd.*,
                m.manager_type
         FROM login_device_details ldd
         LEFT JOIN managers m ON m.manager_id = ldd.user_id
         WHERE ldd.access_token = ?
        `,[manager.access_token]
      );
      var edited_manager_details = yield db.queryAsync(
        `SELECT manager_type
         FROM managers
         WHERE manager_id = ?
        `,[manager.manager_id]
      )
      if(manager_details[0].manager_type > edited_manager_details[0].manager_type){
        error('LowRankedManagersCannotEdit');
      }
        const managers = yield db.queryAsync(
            `UPDATE managers
         SET status = ?
         WHERE business_id = ?
         AND manager_id = ?
         AND status != ?
        `, [manager.status, manager.business_id, manager.manager_id, 2]
        )
        if(manager.status === 0){
          `UPDATE login_device_details
           SET access_token = ?,
           WHERE user_id = ?
           AND user_type = 1`,["Logged Out", manager.manager_id]
        }
        if (managers.affectedRows > 0) {
            var retVal = {
                message: "Manager status updated succesfully",
                manager_id: manager.manager_id,
                status: manager.status
            }
            return retVal
        }
        else if (manager.affectedRows === 0 && (manager.status === 2 || manager.status === 1 || manager.status === 0)) {
            return error('AlreadyDeletedError')
        }
        else {
            return error('GenericError')
        }

    }

    * get_business_managers(manager) {
        if (manager.limit === 0 && manager.offset === 0) {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types,
                  COUNT(DISTINCT(ctm.id)) -2 AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN category_to_manager ctm ON m.manager_id = ctm.manager_id
            LEFT JOIN teams t ON t.team_id = ttm.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = tttm.task_type_id
            WHERE m.business_id = ?
            AND tttb.status NOT IN (0,2)
            AND m.status != ?
            GROUP BY m.manager_id`, [manager.business_id, 2]
            )
        } else {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types,
                  COUNT(DISTINCT(ctm.id)) -2 AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN category_to_manager ctm ON m.manager_id = ctm.manager_id
            LEFT JOIN teams t ON t.team_id = ttm.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = tttm.task_type_id
            WHERE m.business_id = ?
            AND m.status != ?
            AND tttb.status NOT IN (0,2)
            GROUP BY m.manager_id
            LIMIT ?
            OFFSET ?`, [manager.business_id, 2, manager.limit, manager.offset]
            )
        }

        const managers_count = yield db.queryAsync(
            `SELECT COUNT(manager_id) AS count
          FROM  managers
          WHERE business_id = ? AND status != ? `, [manager.business_id, 2]
        )

        var retVal = {
            managers: managers,
            count: managers_count[0].count
        }
        return retVal
    }

    * get_managers_via_manager_type(manager) {
        if (manager.limit === 0 && manager.offset === 0) {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types,
                  COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            LEFT JOIN teams t ON t.team_id = ttm.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = tttm.task_type_id
            WHERE m.business_id = ?
            AND m.status != ?
            AND m.manager_type <= ?
            GROUP BY m.manager_id`, [manager.business_id, 2, manager.manager_type]
            )
        } else {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(t.team_name) AS teams,
                  GROUP_CONCAT(tttb.task_type_name) AS task_types,
                  COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            LEFT JOIN teams t ON t.team_id = ttm.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = tttm.task_type_id
            WHERE m.business_id = ?
            AND m.status != ?
            AND m.manager_type <= ?
            GROUP BY m.manager_id
            LIMIT ?
            OFFSET ?`, [manager.business_id, 2, manager.manager_type, manager.limit, manager.offset]
            )
        }

        const managers_count = yield db.queryAsync(
            `SELECT COUNT(manager_id) AS count
          FROM  managers
          WHERE business_id = ?
          AND status != ?
          AND manager_type <= ?`, [manager.business_id, 2, manager.manager_type]
        )

        var retVal = {
            managers: managers,
            count: managers_count[0].count
        }
        return retVal
    }

    * get_managers_to_team(manager) {
        if (manager.limit === 0 && manager.offset === 0) {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type
            FROM  team_to_manager ttm
            LEFT JOIN managers m ON m.manager_id = ttm.manager_id
            WHERE ttm.business_id = ?
            AND ttm.status != ?
            AND ttm.team_id = ?`, [manager.business_id, 2, manager.team_id]
            )
        } else {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_email,
                  m.manager_phone_number,
                  m.status,
                  m.manager_type
            FROM  team_to_manager ttm
            LEFT JOIN managers m ON m.manager_id = ttm.manager_id
            WHERE ttm.business_id = ?
            AND ttm.status != ?
            AND ttm.team_id = ?
            LIMIT ?
            OFFSET ?`, [manager.business_id, 2, manager.team_id, manager.limit, manager.offset]
            )
        }

        const managers_count = yield db.queryAsync(
            `SELECT COUNT(m.manager_id) AS manager_count
          FROM  team_to_manager ttm
          LEFT JOIN managers m ON m.manager_id = ttm.manager_id
          WHERE ttm.business_id = ?
          AND ttm.status != ?
          AND ttm.team_id = ? `, [manager.business_id, 2, manager.team_id]
        )

        var retVal = {
            managers: managers,
            count: managers_count[0].manager_count
        }
        return retVal
    }

    * get_notifications_to_manager(manager) {

        var device_type = yield db.queryAsync(`
        SELECT *
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id]);

        var manager_data = yield db.queryAsync(
            `SELECT manager_id
         FROM managers
         WHERE manager_id = ?
         AND business_id = ?
        `, [device_type[0].user_id, manager.business_id])

        if (manager.limit === 0 && manager.offset === 0) {
            var notifications = yield db.queryAsync(
                `SELECT notification_id,
                  notification_type,
                  notification_content,
                  sent_at,
                  order_id,
                  read_status,
                  run_id,
                  task_id,
                  team_id,
                  unique_id
            FROM  notifications
            WHERE business_id = ?
            AND user_id = ?
            AND user_type = ?
            ORDER BY sent_at DESC`, [manager.business_id, manager_data[0].manager_id, 1]
            )
            var alerts = yield db.queryAsync(
                `SELECT alert_id,
                  alert_type,
                  alert_content,
                  sent_at,
                  order_id,
                  read_status,
                  run_id,
                  task_id,
                  team_id,
                  unique_id
            FROM  alerts
            WHERE business_id = ?
            AND user_id = ?
            AND user_type = ?
            ORDER BY sent_at DESC`, [manager.business_id, manager_data[0].manager_id, 1]
            )
        } else {
            var notifications = yield db.queryAsync(
                `SELECT notification_id,
                  notification_type,
                  notification_content,
                  sent_at,
                  order_id,
                  read_status,
                  run_id,
                  task_id,
                  team_id
            FROM  notifications
            WHERE business_id = ?
            AND user_id = ?
            AND user_type = ?
            ORDER BY sent_at DESC
            LIMIT ?
            OFFSET ?`, [manager.business_id, manager_data[0].manager_id, 1, manager.limit, manager.offset]
            )

            var alerts = yield db.queryAsync(
                `SELECT alert_id,
                  alert_type,
                  alert_content,
                  sent_at,
                  order_id,
                  read_status,
                  run_id,
                  task_id,
                  team_id
            FROM  alerts
            WHERE business_id = ?
            AND user_id = ?
            AND user_type = ?
            ORDER BY sent_at DESC
            LIMIT ?
            OFFSET ?`, [manager.business_id, manager_data[0].manager_id, 1, manager.limit, manager.offset]
            )
        }

        const notification_count = yield db.queryAsync(
            `SELECT COUNT(notification_id) AS notification_count
          FROM  notifications
          WHERE business_id = ?
          AND user_id = ?
          AND user_type = ?`, [manager.business_id, manager_data[0].manager_id, 1]
        )

        const alert_count = yield db.queryAsync(
            `SELECT COUNT(alert_id) AS alert_count
          FROM  alerts
          WHERE business_id = ?
          AND user_id = ?
          AND user_type = ?`, [manager.business_id, manager_data[0].manager_id, 1]
        )

        const notification_count_unread = yield db.queryAsync(
            `SELECT COUNT(notification_id) AS notification_count
          FROM  notifications
          WHERE business_id = ?
          AND user_id = ?
          AND user_type = ?
          AND read_status = ?`, [manager.business_id, manager_data[0].manager_id, 1, 0]
        )

        const alert_count_unread = yield db.queryAsync(
            `SELECT COUNT(alert_id) AS alert_count
          FROM  alerts
          WHERE business_id = ?
          AND user_id = ?
          AND user_type = ?
          AND read_status = ?`, [manager.business_id, manager_data[0].manager_id, 1, 0]
        )

        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "Fetched all Notifications and Alerts",
                data: {
                    notifications: notifications,
                    alerts: alerts,
                    notification_count: notification_count[0].notification_count,
                    alert_count: alert_count[0].alert_count,
                    unread_count_notification: notification_count_unread[0].notification_count,
                    unread_count_alert: alert_count_unread[0].alert_count
                }
            }
        }
        else {
            var retVal = {
                notifications: notifications,
                alerts: alerts,
                notification_count: notification_count[0].notification_count,
                alert_count: alert_count[0].alert_count,
                unread_count_notification: notification_count_unread[0].notification_count,
                unread_count_alert: alert_count_unread[0].alert_count
            }
        }

        return retVal
    }

    * get_managers_to_teams(manager) {
        if (manager.limit === 0 && manager.offset === 0) {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                CONCAT(m.manager_full_name,"(",t.team_name,")") as manager_full_name,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  ttm.team_id,
                  CONCAT(m.manager_id,ttm.team_id) AS joint_id,
                  t.team_name
            FROM  team_to_manager ttm
            JOIN managers m ON m.manager_id = ttm.manager_id
            JOIN teams t ON t.team_id = ttm.team_id
            WHERE ttm.business_id = ?
            AND ttm.status != ?
            AND ttm.team_id IN(?)`, [manager.business_id, 2, manager.team_id]
            )
        } else {
            var managers = yield db.queryAsync(
                `SELECT m.manager_id,
                 CONCAT(m.manager_full_name,"(",t.team_name,")") as manager_full_name,
                  m.manager_email,
                  m.manager_phone_number,
                  m.status,
                  m.manager_type,
                  ttm.team_id,
                  CONCAT(m.manager_id,ttm.team_id) AS joint_id,
                  t.team_name
            FROM  team_to_manager ttm
            JOIN managers m ON m.manager_id = ttm.manager_id
            JOIN teams t ON t.team_id = ttm.team_id
            WHERE ttm.business_id = ?
            AND ttm.status != ?
            AND ttm.team_id IN(?)
            LIMIT ?
            OFFSET ?`, [manager.business_id, 2, manager.team_id, manager.limit, manager.offset]
            )
        }

        const managers_count = yield db.queryAsync(
            `SELECT COUNT(ttm.manager_id) as manager_count
          FROM  team_to_manager ttm
          WHERE ttm.business_id = ?
          AND ttm.status != ?
          AND ttm.team_id IN(?)`, [manager.business_id, 2, manager.team_id]
        )

        var retVal = {
            managers: managers,
            count: managers_count[0].manager_count
        }
        return retVal
    }

    * manager_forgot_password(manager) {
        let managerData = yield db.queryAsync(`SELECT * FROM managers WHERE manager_email = ? AND status NOT IN(?,?)`, [manager.email, 2, 0]);
        if (managerData.length > 0) {
            var hash = bcrypt.hashSync(manager.email, 10);

            const token = yield db.queryAsync(
                `UPDATE managers
            SET access_token = ?,
            password_reset = 1
            WHERE manager_email = ?
          `, [hash, manager.email]);
            yield sendEmailToUser("FORGOT_PASSWORD", {manager_name:managerData[0].manager_full_name,link:"http://18.221.158.62/qengine_company_panel/#/page/Reset_Password?token="+hash}, manager.email, "support@azuratech.in", "Password Reset Link", "Password Reset Mail");

            var manager_details = yield db.queryAsync(
                `SELECT manager_email
                  manager_phone_number
           FROM managers
           WHERE manager_email = ?
           AND status NOT IN(?,?)`, [manager.email, 2, 0]
            )
           // console.log("______",managerData[0]);
            yield CommonFunction.send_sms_plivo(managerData[0].country_code+managerData[0].manager_phone_number,
                "Hi "+managerData[0].manager_full_name+",\n" +
                "We get it "+managerData[0].manager_full_name+", you forgot your password. It happens to the best of us. We feel your pain.\n" +
                "Click here to make up a new password and get back to managing: http://18.221.158.62/qengine_company_panel/#/page/Reset_Password?token="+hash+"\n" +
                "Have a great \n" +
                "Regards,\n" +
                "Q-Engine Team");

            var retVal = {
                status_code: 200,
                message: "A reset link has been sent on your email id",
                token: hash,
                data: {}
            }
            return retVal
        }
        else {
            return error('UserDoesNotExistsErrorEmail')
        }
    }

    * manager_reset_password(manager) {
        var hash = bcrypt.hashSync(manager.new_password, 10);

        var manager_id = yield db.queryAsync(
            `SELECT *
         FROM managers
         WHERE access_token = ?
         `, [manager.access_token]
        )

        if((yield db.queryAsync(`SELECT access_token FROM managers WHERE access_token = ? AND password_reset = 1`,[manager.access_token])).length > 0){
          var manager_password = yield db.queryAsync(`
          SELECT *
          FROM managers
          WHERE manager_id = ?
          `, [manager_id[0].manager_id])

          if ((manager_password[0].password != undefined)) {

              const logout_agent = yield db.queryAsync(`
            UPDATE managers
            SET password = ?
            WHERE access_token = ?
            `, [hash, manager.access_token]);
              let content ="Dear "+manager_password[0].manager_full_name+"," +
                  "<br><br>" +
                  "This is to notify you that the password for Manager App and Manager Panel , has been successfully changed to" +manager.new_password+
                  "<br><br>" +
                  "Regards<br>Q-Engine Team" +
                  "<br><br>Note: If you did not request a password reset, or are having any trouble logging in, please let us know at support@qengine.com";

              yield sendEmailToUser("CONFIGURABLE_MAIL", {content: content}, manager_password[0].manager_email, "support@azuratech.in", "Password Reset Mail", "Password Reset Mail");

              let content1='Dear '+manager_password[0].manager_full_name+',\n\nThis is to notify you that the password for Manager App AND Manager Panel, has been successfully changed to '+manager.new_password+'\n\nNote: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com';

              yield CommonFunction.send_sms_plivo(manager_password[0].country_code+manager_password[0].manager_phone_number, content1);

            //  yield CommonFunction.send_sms_plivo(manager_password[0].manager_phone_number, "Your password has been successfully changed");

              if (manager_id[0].device_type === 2) {
                  var retVal = {
                      status_code: 200,
                      message: "Manager password has been changed",
                      data: {}
                  }
              } else {
                  var retVal = {
                      message: "Manager password has been changed"
                  }
              }
              return retVal
          } else {
              error('WrongPassword')
          }
        }else{
          error('AccessTokenError')
        }

    }

    * manager_reset_password_in(manager) {
            var hash = bcrypt.hashSync(manager.new_password, 10);

            var manager_id = yield db.queryAsync(
                `SELECT *
             FROM login_device_details
             WHERE access_token = ?
             AND business_id = ?`, [manager.access_token, manager.business_id]
            )

            var manager_password = yield db.queryAsync(`
            SELECT *
            FROM managers
            WHERE manager_id = ?
            AND business_id = ?
            `, [manager_id[0].user_id, manager.business_id])

            if ((manager_password[0].password != undefined) && (bcrypt.compareSync(manager.old_password, manager_password[0].password)) === true) {

              let content ="Dear "+manager_password[0].manager_full_name+"," +
                  "<br><br>" +
                  "This is to notify you that the password for Manager App and Manager Panel , has been successfully changed to" +manager.new_password+
                  "<br><br>" +
                  "Regards<br>Q-Engine Team" +
                  "<br><br>Note: If you did not request a password reset, or are having any trouble logging in, please let us know at support@qengine.com";

              yield sendEmailToUser("CONFIGURABLE_MAIL", {content: content}, manager_password[0].manager_email, "support@azuratech.in", "Password Reset Mail", "Password Reset Mail");

              let content1='Dear '+manager_password[0].manager_full_name+',\n\nThis is to notify you that the password for Manager App AND Manager Panel, has been successfully changed to '+manager.new_password+'\n\nNote: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com';

              yield CommonFunction.send_sms_plivo(manager_password[0].country_code+manager_password[0].manager_phone_number, content1);

                if (manager_id[0].device_type === 2) {
                    var retVal = {
                        status_code: 200,
                        message: "Manager password has been changed",
                        data: {}
                    }
                } else {
                    var retVal = {
                        message: "Manager password has been changed"
                    }
                }
                return retVal
            } else {
                error('WrongPassword')
            }
        }

    * get_manager_via_id(manager) {
        var managers = yield db.queryAsync(
            `SELECT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  m.manager_profile_picture,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND m.status != ?
            AND m.manager_id = ?`, [manager.business_id, 2, manager.manager_id]
        )

        var permissions = yield db.queryAsync(
            `SELECT ctm.category_id,
                    pc.category_name,
                    ctm.status
             FROM category_to_manager ctm
             LEFT JOIN permission_categories pc ON pc.category_id = ctm.category_id
             WHERE ctm.manager_id = ?
            `, [manager.manager_id]
        )

        const teams_to_manager = yield db.queryAsync(
            `SELECT
                  t.team_id,
                  t.team_name,
                  t.team_initials
                FROM team_to_manager ttm
                LEFT JOIN teams t ON t.team_id = ttm.team_id
                WHERE ttm.manager_id = ?
                AND ttm.business_id = ?
              `, [manager.manager_id, manager.business_id]
        )

        const manager_task_types = yield db.queryAsync(
            `SELECT
                tttb.task_type_id,
                tttb.task_type_name
               FROM task_type_to_manager tttm
               LEFT JOIN task_types_to_business tttb on tttb.task_type_id = tttm.task_type_id
               WHERE tttm.manager_id = ?
               AND tttm.business_id = ?
              `, [manager.manager_id, manager.business_id]
        )

        var retVal = {
            manager: managers,
            teams: teams_to_manager,
            task_types: manager_task_types,
            permissions: permissions
        }
        return retVal
    }

    * get_manager_profile(manager) {
        var device_type = yield db.queryAsync(`
        SELECT *
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id]);

        var managers = yield db.queryAsync(
            `SELECT m.manager_id,
                m.manager_full_name,
                m.manager_email,
                m.manager_phone_number,
                m.manager_username,
                m.manager_profile_picture,
                m.manager_address,
                bd.business_type,
                bd.industry_type,
                mm.manager_reporting_to,
                mm.manager_full_name AS reporting_manager,
                m.updated_at AS last_active,
                5 AS manager_rating
          FROM  managers m
          LEFT JOIN business_details bd ON m.business_id = bd.business_id
          LEFT JOIN login_device_details ldd ON m.manager_id = ldd.user_id
          LEFT JOIN managers mm ON m.manager_id = mm.manager_reporting_to
          WHERE m.business_id = ?
          AND m.status != ?
          AND ldd.access_token = ?`, [manager.business_id, 2, manager.access_token]
        )
        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "Manager profile details.",
                data: {manager: managers[0]}
            }
        }
        else {
            var retVal = {
                manager: managers[0]
            }
        }
        return retVal
    }

    * get_bulk_managers_drop_down(manager) {
        if (manager.type === 1) {
            var types = yield db.queryAsync(`
          SELECT manager_type_id AS item_id,
                 manager_type_name AS item_name
          FROM manager_type
          `)
        }
        if (manager.type === 2) {
            var types = yield db.queryAsync(`
          SELECT manager_id AS item_id,
                 manager_full_name AS item_name
          FROM managers
          WHERE business_id = ?
          `, [manager.business_id])
        }
        if (manager.type === 3) {
            var types = yield db.queryAsync(`
          SELECT team_id AS item_id,
                 team_name AS item_name
          FROM teams
          WHERE business_id = ?
          `, [manager.business_id])

        }
        if (manager.type === 4) {
            var types = yield db.queryAsync(`
          SELECT task_type_id AS item_id,
                 task_type_name AS item_name
          FROM task_types_to_business
          WHERE business_id = ?
          `, [manager.business_id])
        }
        if (manager.type === 0) {
            var type1 = yield db.queryAsync(`
          SELECT manager_type_id AS item_id,
                 manager_type_name AS item_name
          FROM manager_type
          `)

            var type2 = yield db.queryAsync(`
          SELECT manager_id AS item_id,
                 manager_full_name AS item_name
          FROM managers
          WHERE business_id = ?
          `, [manager.business_id])

            var type3 = yield db.queryAsync(`
          SELECT team_id AS item_id,
                 team_name AS item_name
          FROM teams
          WHERE business_id = ?
          `, [manager.business_id])

            var type4 = yield db.queryAsync(`
          SELECT task_type_id AS item_id,
                 task_type_name AS item_name
          FROM task_types_to_business
          WHERE business_id = ?
          `, [manager.business_id])

            var types = [
                {type1: type1},
                {type2: type2},
                {type3: type3},
                {type4: type4}
            ]
        }

        var retVal = {
            data_dropdown: types
        }
        return retVal
    }

    * get_bulk_managers_result(manager) {
        if (manager.offset === 0 && manager.limit === 0) {
            if (manager.type === 1) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                    m.manager_full_name,
                    m.manager_username,
                    m.manager_email,
                    m.manager_phone_number,
                    m.manager_reporting_to,
                    m.status,
                    m.manager_type,
                    m.employee_code,
                    COUNT(DISTINCT(ttm.team_id)) AS team_count,
                    COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                    COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
              FROM  managers m
              LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
              LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
              LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
              WHERE m.business_id = ?
              AND m.manager_type IN(?)
              AND m.status != ?
              GROUP BY m.manager_id
            `, [manager.business_id, manager.item_id, 2])
            }
            if (manager.type === 2) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                    m.manager_full_name,
                    m.manager_username,
                    m.manager_email,
                    m.manager_phone_number,
                    m.manager_reporting_to,
                    m.status,
                    m.manager_type,
                    m.employee_code,
                    COUNT(DISTINCT(ttm.team_id)) AS team_count,
                    COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                    COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
              FROM  managers m
              LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
              LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
              LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
              WHERE m.business_id = ?
              AND m.manager_reporting_to IN(?)
              AND m.status != ?
              GROUP BY m.manager_id
            `, [manager.business_id, manager.item_id, 2])
            }
            if (manager.type === 3) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                    m.manager_full_name,
                    m.manager_username,
                    m.manager_email,
                    m.manager_phone_number,
                    m.manager_reporting_to,
                    m.status,
                    m.manager_type,
                    m.employee_code,
                    COUNT(DISTINCT(ttm.team_id)) AS team_count,
                    COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                    COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
              FROM  managers m
              LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
              LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
              LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
              WHERE m.business_id = ?
              AND ttm.team_id IN(?)
              AND m.status != ?
              GROUP BY m.manager_id
            `, [manager.business_id, manager.item_id, 2])

            }
            if (manager.type === 4) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                    m.manager_full_name,
                    m.manager_username,
                    m.manager_email,
                    m.manager_phone_number,
                    m.manager_reporting_to,
                    m.status,
                    m.manager_type,
                    m.employee_code,
                    COUNT(DISTINCT(ttm.team_id)) AS team_count,
                    COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                    COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
              FROM  managers m
              LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
              LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
              LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
              WHERE m.business_id = ?
              AND tttm.manager_id IN(?)
              AND m.status != ?
              GROUP BY m.manager_id
            `, [manager.business_id, manager.item_id, 2])
            }
            if (manager.type === 0) {
                  var type1 = yield db.queryAsync(`
                      SELECT m.manager_id,
                        m.manager_full_name,
                        m.manager_username,
                        m.manager_email,
                        m.manager_phone_number,
                        m.manager_reporting_to,
                        m.status,
                        m.manager_type,
                        m.employee_code,
                        COUNT(DISTINCT(ttm.team_id)) AS team_count,
                        COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                        COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                  FROM  managers m
                  LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                  LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                  LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                  WHERE m.business_id = ?
                  AND m.manager_type IN(?)
                  AND m.status != ?
                  GROUP BY m.manager_id
                `, [manager.business_id, manager.item_id[0].item_id_1, 2])

                  var type2 = yield db.queryAsync(`
                    SELECT m.manager_id,
                      m.manager_full_name,
                      m.manager_username,
                      m.manager_email,
                      m.manager_phone_number,
                      m.manager_reporting_to,
                      m.status,
                      m.manager_type,
                      m.employee_code,
                      COUNT(DISTINCT(ttm.team_id)) AS team_count,
                      COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                      COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                    FROM  managers m
                    LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                    LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                    LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                    WHERE m.business_id = ?
                    AND m.manager_reporting_to IN(?)
                    AND m.status != ?
                    GROUP BY m.manager_id
              `, [manager.business_id, manager.item_id[1].item_id_2, 2])

                  var type3 = yield db.queryAsync(`
                    SELECT m.manager_id,
                            m.manager_full_name,
                            m.manager_username,
                            m.manager_email,
                            m.manager_phone_number,
                            m.manager_reporting_to,
                            m.status,
                            m.manager_type,
                            m.employee_code,
                            COUNT(DISTINCT(ttm.team_id)) AS team_count,
                            COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                            COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                      FROM  managers m
                      LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                      LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                      LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                      WHERE m.business_id = ?
                      AND ttm.team_id IN(?)
                      AND m.status != ?
                      GROUP BY m.manager_id
              `, [manager.business_id, manager.item_id[2].item_id_3, 2])

                  var type4 = yield db.queryAsync(`
                      SELECT m.manager_id,
                              m.manager_full_name,
                              m.manager_username,
                              m.manager_email,
                              m.manager_phone_number,
                              m.manager_reporting_to,
                              m.status,
                              m.manager_type,
                              m.employee_code,
                              COUNT(DISTINCT(ttm.team_id)) AS team_count,
                              COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                              COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                        FROM  managers m
                        LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                        LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                        LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                        WHERE m.business_id = ?
                        AND tttm.manager_id IN(?)
                        AND m.status != ?
                        GROUP BY m.manager_id
              `, [manager.business_id, manager.item_id[3].item_id_4, 2])

                var types = type1.concat(type2, type3, type4);

            }
        } else {
            if (manager.type === 1) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                          m.manager_full_name,
                          m.manager_username,
                          m.manager_email,
                          m.manager_phone_number,
                          m.manager_reporting_to,
                          m.status,
                          m.manager_type,
                          m.employee_code,
                          COUNT(DISTINCT(ttm.team_id)) AS team_count,
                          COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                          COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                    FROM  managers m
                    LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                    LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                    LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                    WHERE m.business_id = ?
                    AND m.manager_type IN(?)
                    AND m.status != ?
                    GROUP BY m.manager_id
                    LIMIT ?
                    OFFSET ?
                  `, [manager.business_id, manager.item_id, 2, manager.limit, manager.offset])
            }
            if (manager.type === 2) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                          m.manager_full_name,
                          m.manager_username,
                          m.manager_email,
                          m.manager_phone_number,
                          m.manager_reporting_to,
                          m.status,
                          m.manager_type,
                          m.employee_code,
                          COUNT(DISTINCT(ttm.team_id)) AS team_count,
                          COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                          COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                    FROM  managers m
                    LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                    LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                    LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                    WHERE m.business_id = ?
                    AND m.manager_reporting_to IN(?)
                    AND m.status != ?
                    GROUP BY m.manager_id
                    LIMIT ?
                    OFFSET ?
                  `, [manager.business_id, manager.item_id, 2, manager.limit, manager.offset])
                  }
            if (manager.type === 3) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                          m.manager_full_name,
                          m.manager_username,
                          m.manager_email,
                          m.manager_phone_number,
                          m.manager_reporting_to,
                          m.status,
                          m.manager_type,
                          m.employee_code,
                          COUNT(DISTINCT(ttm.team_id)) AS team_count,
                          COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                          COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                    FROM  managers m
                    LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                    LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                    LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                    WHERE m.business_id = ?
                    AND ttm.team_id IN(?)
                    AND m.status != ?
                    GROUP BY m.manager_id
                    LIMIT ?
                    OFFSET ?
                  `, [manager.business_id, manager.item_id, 2, manager.limit, manager.offset])

            }
            if (manager.type === 4) {
                var types = yield db.queryAsync(`
                  SELECT m.manager_id,
                          m.manager_full_name,
                          m.manager_username,
                          m.manager_email,
                          m.manager_phone_number,
                          m.manager_reporting_to,
                          m.status,
                          m.manager_type,
                          m.employee_code,
                          COUNT(DISTINCT(ttm.team_id)) AS team_count,
                          COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                          COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
                    FROM  managers m
                    LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
                    LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
                    LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
                    WHERE m.business_id = ?
                    AND tttm.manager_id IN(?)
                    AND m.status != ?
                    GROUP BY m.manager_id
                    LIMIT ?
                    OFFSET ?
                  `, [manager.business_id, manager.item_id, 2, manager.limit, manager.offset])
            }
        }

        if (manager.type === 1) {
            var count = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND m.manager_type IN(?)
            AND m.status != ?
          `, [manager.business_id, manager.item_id, 2])
        }
        if (manager.type === 2) {
            var count = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND m.manager_reporting_to IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id, 2])
        }
        if (manager.type === 3) {
            var count = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND ttm.team_id IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id, 2])

        }
        if (manager.type === 4) {
            var count = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND tttm.manager_id IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id, 2])
        }
        if (manager.type === 0) {
            var count1 = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND m.manager_type IN(?)
            AND m.status != ?
          `, [manager.business_id, manager.item_id[0].item_id_1, 2])
            var count2 = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND m.manager_reporting_to IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id[1].item_id_2, 2])
            var count3 = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND ttm.team_id IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id[2].item_id_3, 2])
            var count4 = yield db.queryAsync(`
          SELECT m.manager_id AS item_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            WHERE m.business_id = ?
            AND tttm.manager_id IN(?)
            AND m.status != ?
            GROUP BY m.manager_id
          `, [manager.business_id, manager.item_id[3].item_id_4, 2])

            var item_count = 0; //count1[0].item_count+count2[0].item_count+count3[0].item_count+count4[0].item_count;

            var count = [{item_count}]
        }


        var retVal = {
            managers: types,
            count: count[0].item_count
        }
        return retVal
    }

    * edit_manager_profile(manager) {
        var managers = yield db.queryAsync(
            `UPDATE managers
          SET   manager_full_name = ?,
                manager_email = ?,
                manager_phone_number = ?,
                manager_address = ?
          WHERE business_id = ?
          AND status != ?
          AND access_token = ?`, [manager.manager_full_name, manager.manager_email, manager.manager_phone_number, manager.manager_address, manager.business_id, 2, manager.access_token]
        )
        var retVal = {
            message: "Manager has been updated successfully"
        }
        return retVal
    }

    * upload_manager_profile_pic(manager) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = manager.file.path.split('/');

        manager.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);

        var image_update = yield db.queryAsync(`
        UPDATE managers
          SET manager_profile_picture = ?
          WHERE business_id = ?
          AND manager_id = ?
        `, [return_path + manager.file.name, manager.business_id, manager.agent_id]);
        var retVal = {
            status_code: 200,
            message: "Image uploaded successfully",
            data: {
                path: return_path + manager.file.name
            }
        }
        return retVal
    }

    * get_agent_app_config(manager) {
        var app_config_details = yield db.queryAsync(`
        SELECT aac.field_id,
               aafn.field_name,
               aac.read_and_write,
               aac.mandatory,
               aac.config_status
        FROM agent_app_configuration aac
        LEFT JOIN agent_app_field_names aafn ON aac.field_id = aafn.field_id
        WHERE aac.business_id = ?
        `, [manager.business_id])

        var retVal = {
            app_config_details: app_config_details
        }

        return retVal;
    }

    * upload_task_file(manager) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = manager.file.path.split('/');

        manager.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);

        var retVal = {
            status_code: 200,
            message: "File uploaded successfully",
            data: {
                path: return_path + manager.file.name
            }
        }
        return retVal
    }

    * mark_read_notification(manager) {
        var marked_read = yield db.queryAsync(
            `UPDATE notifications
        SET read_status = ?
        WHERE unique_id = ?
        AND business_id = ?
        AND read_status = 0
        `, [1, manager.notification_id, manager.business_id]
        );
        console.log("notif++++++++++", marked_read);
         if(marked_read.affectedRows === 0){
           var retVal = {
               status_code: 420,
               message: "Already Marked Read",
               data: {}
           }
           error('AlreadyMarkedRead');
         }else{
           var retVal = {
               status_code: 200,
               message: "Marked Read",
               data: {}
           }
         }


        return retVal
    }

    * mark_read_alert(manager) {
        var marked_read = yield db.queryAsync(
            `UPDATE alerts
        SET read_status = ?
        WHERE unique_id = ?
        AND business_id = ?
        AND read_status = 0
        `, [1, manager.alert_id, manager.business_id]
        );

        if(marked_read.affectedRows === 0){
          var retVal = {
              status_code: 420,
              message: "Already Marked Read",
              data: {}
          }
          error('AlreadyMarkedRead');
        }else{
          var retVal = {
              status_code: 200,
              message: "Marked Read",
              data: {}
          }
        }


       return retVal
    }

    * send_dummy_mail(manager) {
        yield sendEmailToUser(manager.mailType, manager.emailVariables, manager.emailId, manager.emailFrom, manager.emailSubject, manager.name_mail)

        var retVal = {
            message: "Dummy mail was sent"
        }

        return retVal
    }

    * home_screen(manager) {

      var manager_details = yield db.queryAsync(
          `SELECT *
       FROM login_device_details
       WHERE access_token = ?
      `, [manager.access_token, manager.business_id]
      )

      var update_last_status = yield db.queryAsync(
        `UPDATE managers
         SET last_active = NOW()
         WHERE manager_id = ?
        `,[manager_details[0].user_id]
      );
        var task_details = yield db.queryAsync(`
          SELECT COUNT(DISTINCT t.task_id) AS total_task_count,
                  DATE(date_time) AS date,
                  SUM(DISTINCT (IF(t.task_status IN(8,10), 1, 0))) AS completed_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(1,2,12), 1, 0))) AS unassigned_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(11), 1, 0))) AS cancelled_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(11), 1, 0))) AS delayed_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(5,6,7), 1, 0))) AS in_progress_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(9), 1, 0))) AS failed_task_count,
                  SUM(DISTINCT (IF(t.task_status IN(3,4), 1, 0))) AS active_tasks,
                  SUM(DISTINCT (IF(t.task_status IN(5,6,7), 1, 0))) AS busy_tasks
          FROM tasks t
          LEFT JOIN runs r ON r.run_id = t.run_id
          LEFT JOIN agent_to_manager_and_team atmat ON atmat.team_id = r.team_id
          WHERE t.date_time BETWEEN ? AND ?
          AND atmat.manager_id = ?
          AND t.business_id = ?
          GROUP BY date
        `, [manager.from_date, manager.to_date, manager_details[0].user_id, manager.business_id])


        var retVal = {
            status_code: 200,
            message: "Fteched data for home_screen",
            data: {
                task_details: task_details
            }
        }

        return retVal
    }

    * get_notes_of_task(note) {

        const notes = yield db.queryAsync(`
        SELECT ntt.note_id,
               ntt.note_name,
               ntt.content,
               IF(ntt.updated_by = 1,  m.manager_full_name, CONCAT(a.agent_first_name, " ", a.agent_last_name)) AS updated_by,
               ntt.updated_at
        FROM notes_to_tasks ntt
        LEFT JOIN managers m ON m.manager_id = ntt.updated_by
        LEFT JOIN agents a ON a.agent_id = ntt.updated_by
        WHERE task_id = ?
        AND ntt.business_id = ?
        AND ntt.status = ?
        `, [note.task_id, note.business_id, 1])

        var retVal = {
            status_code: 200,
            message: "Feteched System notes",
            data: {
                notes: notes
            }
        }
        return retVal
    }

    * search_managers(manager) {
        var managers = yield db.queryAsync(
            `SELECT DISTINCT m.manager_id,
                  m.manager_full_name,
                  m.manager_username,
                  m.manager_email,
                  m.manager_phone_number,
                  m.manager_reporting_to,
                  m.manager_profile_picture,
                  m.status,
                  m.manager_type,
                  m.employee_code,
                  COUNT(DISTINCT(ttm.team_id)) AS team_count,
                  COUNT(DISTINCT(tttm.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types,
                  COUNT(DISTINCT(ptm.permission_id)) AS persmissions_count
            FROM  managers m
            LEFT JOIN team_to_manager ttm ON m.manager_id = ttm.manager_id
            LEFT JOIN task_type_to_manager tttm ON m.manager_id = tttm.manager_id
            LEFT JOIN permissions_to_manager ptm ON m.manager_id = ptm.manager_id
            LEFT JOIN teams t ON t.team_id = ttm.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = tttm.task_type_id
            WHERE m.business_id = ?
            AND m.status != ?
            AND (m.manager_full_name LIKE ? OR m.manager_email LIKE ? OR m.manager_phone_number LIKE ?)
            GROUP BY m.manager_id`, [manager.business_id, 2, manager.input + "%", manager.input + "%", manager.input + "%"]
        )

        console.log("The inputs", manager);
        var retVal = {
            managers: managers
        }
        return retVal
    }

    * upload_signature_manager_task(manager) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = manager.file.path.split('/');

        manager.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);

        var image_update = yield db.queryAsync(`
        UPDATE tasks
          SET task_signature = ?
          WHERE business_id = ?
          AND task_id = ?
        `, [return_path + manager.file.name, manager.business_id, manager.task_id]);

        var retVal = {
            status_code: 200,
            message: "File uploaded successfully",
            data: {
                path: return_path + manager.file.name
            }
        }
        return retVal
    }

    * upload_document_manager_task(manager) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/"

        var file_name_array = manager.file.path.split('/');

        manager.file.name = file_name_array[file_name_array.length - 1];

        if (manager.doc_number > 0) {
            if (manager.doc_number === '1') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document1 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + manager.file.name, manager.business_id, manager.task_id]);
            }
            if (manager.doc_number === '2') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document2 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + manager.file.name, manager.business_id, manager.task_id]);
            }
            if (manager.doc_number === '3') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document3 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + manager.file.name, manager.business_id, manager.task_id]);
            }
            if (manager.doc_number === '4') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document4 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + manager.file.name, manager.business_id, manager.task_id]);
            }
            if (manager.doc_number === '5') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(manager.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document5 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + manager.file.name, manager.business_id, manager.task_id]);
            }


            var retVal = {
                status_code: 200,
                message: "File uploaded successfully",
                data: {
                    path: return_path + manager.file.name,
                    doc_number: manager.doc_number
                }
            }
            return retVal
        }
        else {
            return error('GenericError')
        }
    }

    * create_note_to_task(manager) {

        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id])

        const notes = yield db.queryAsync(`
        INSERT INTO notes_to_tasks(
          business_id,
          task_id,
          note_name,
          content,
          created_by,
          updated_by,
          created_by_user_type,
          updated_by_user_type,
          status)
          VALUES (?,?,?,?,?,?,?,?,?)
        `, [manager.business_id, manager.task_id, manager.note_name, manager.content, manager_id[0].user_id, manager_id[0].user_id, 1, 1, 1])

        var retVal = {
            status_code: 200,
            message: "Note created",
            data: {
                note_id: notes.insertId,
                note_name: manager.note_name,
                task_id: manager.task_id,
                content: manager.content
            }
        }
        return retVal
    }

    * create_notes_to_task(manager) {

        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id])

        var values1 = [];

        for(var i = 0; i < manager.notes.length; i++){
          values1.push([manager.business_id, manager.task_id, manager.notes[i].note_name, manager.notes[i].content, manager_id[0].user_id, manager_id[0].user_id, 1, 1, 1])
        }

        const notes = yield db.queryAsync(`
        INSERT INTO notes_to_tasks(
          business_id,
          task_id,
          note_name,
          content,
          created_by,
          updated_by,
          created_by_user_type,
          updated_by_user_type,
          status)
          VALUES ?
        `, [values1])

        var retVal = {
            status_code: 200,
            message: "Note created",
            data: {
                note_id: notes.insertId,
                note_name: manager.note_name,
                task_id: manager.task_id,
                content: manager.content
            }
        }
        return retVal
    }

    * edit_note_to_task(manager) {
        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id])

        const notes = yield db.queryAsync(`
        UPDATE notes_to_tasks
        SET note_name = ?,
            content = ?,
            updated_by = ?,
            updated_by_user_type = ?
        WHERE note_id = ?
        AND task_id = ?
        `, [manager.note_name, manager.content, manager_id[0].user_id, 1, manager.note_id, manager.task_id,])

        var retVal = {
            status_code: 200,
            message: "Note edited successfully",
            data: {
                note_id: manager.note_id,
                note_name: manager.note_name,
                task_id: manager.task_id,
                content: manager.content
            }
        }
        return retVal
    }

    * edit_notes_to_task(manager) {
        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id]);

        var values1 = [];
        var values2 = [];

        for(var i = 0; i < manager.notes_data.length; i++){
          if(manager.notes_data[i].note_id === 0){
            values1.push([manager.business_id, manager.notes_data[i].task_id, manager.notes_data[i].note_name, manager.notes_data[i].content, manager_id[0].user_id, manager_id[0].user_id, 1, 1, 1]);
          }else{
            values2.push([manager.notes_data[i].note_id, manager.notes_data[i].note_name, manager.notes_data[i].content, manager_id[0].user_id, 1]);
          }
        }

        if(values1.length > 0){
          const notes = yield db.queryAsync(`
          INSERT INTO notes_to_tasks(
            business_id,
            task_id,
            note_name,
            content,
            created_by,
            updated_by,
            created_by_user_type,
            updated_by_user_type,
            status)
            VALUES ?
          `, [values1]);

          console.log("There is some problem wiht the edit query++++++++",notes.sql);
        }

        if(values2.length > 0){
          const update_notes = yield db.queryAsync(
            `INSERT INTO notes_to_tasks (note_id, note_name, content, updated_by, updated_by_user_type)
             VALUES ?
             ON DUPLICATE KEY UPDATE note_name = VALUES (note_name),
                                     content = VALUES (content),
                                     updated_by = VALUES (updated_by),
                                     updated_by_user_type = VALUES (updated_by_user_type)`,[values2]
          )
          console.log("There is some problem wiht the edit query_____________",update_notes.sql);
        }

        var retVal = {
            status_code: 200,
            message: "Notes added/edited successfully",
            data: {
            }
        }
        return retVal
    }

    * delete_note_of_task(manager) {
        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id])

        const notes = yield db.queryAsync(`
        UPDATE notes_to_tasks
        SET status = ?
        WHERE note_id = ?
        AND task_id = ?
        `, [manager.status, manager.note_id, manager.task_id])

        var retVal = {
            status_code: 200,
            message: "Deleted successfully",
            data: {
                note_id: manager.note_id,
                task_id: manager.task_id
            }
        }
        return retVal
    }

    * edit_template_to_task(manager) {
        const manager_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [manager.access_token, manager.business_id])

        const template_fields = yield db.queryAsync(`
        UPDATE templates_to_tasks
        SET value = ?
        WHERE template_id = ?
        AND task_id = ?
        AND business_id = ?
        `, [manager.value, manager.template_id, manager.task_id, manager.business_id])

        var retVal = {
            status_code: 200,
            message: "Template edited successfully",
            data: {}
        }
        return retVal
    }

    * manager_email(manager){
      var manager_email = yield db.queryAsync(`
        SELECT manager_email
        FROM managers
        WHERE manager_email = ?
      `,[manager.manager_email]);
      console.log("dhdiuhuhd", manager_email, manager_email.length);

      if(manager_email.length > 0){
        error('UserExistsErrorEmail')
      }else{
        var retVal = {
          message: "No such email found",
          status_code: 200
        }
        return retVal
      }
    }

    * manager_username(manager){
      var manager_username = yield db.queryAsync(`
        SELECT manager_username
        FROM managers
        WHERE manager_username = ?
      `,[manager.manager_username]);

      if(manager_username.length > 0){
        error('UserExistsErrorUsername')
      }else{
        var retVal = {
          message: "No such username found",
          status_code: 200
        }
        return retVal
      }
    }

    * manager_task_types(){
      var task_types = yield db.queryAsync(`
        SELECT id,
               task_status_name
        FROM task_statuses
        WHERE id IN (2,3,5,6,8,9,11)
        `)

        var retVal = {
          status_code: 200,
          message: "Fetched Task statuses",
          data: {
            task_types: task_types
          }
        }

        return retVal;
    }
}

module.exports = Manager;
module.exports.getInstance = () => new Manager();

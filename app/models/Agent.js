'use strict';
const request = require('co-request');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const fsExtra = require('fs-extra');
const fs= require('fs');
const AWS = require('aws-sdk');
const CommonFunction = require('./CommonFunction');
const gcm = require('node-gcm');
const server_key = require('../../config/notification').android.android_agent_FCM;
const bayeux = require('../../bayeux');
const sender = new gcm.Sender(server_key);
const _ = require('underscore');
const sendEmailToUser = require('../../config/email').sendEmailToUser;
const moment = require('moment');
const lodash = require('lodash');
const tinyurl = require('tinyurl');


class Agent {
    constructor(){
        this.multi = [];
    }

    * login_agent(agent) {
        var hash = bcrypt.hashSync(agent.password, 10);

        var agents_details = yield db.queryAsync(`
          SELECT
            a.business_id,
            a.agent_id,
            a.agent_first_name,
            a.agent_last_name,
            a.agent_username,
            a.agent_email,
            a.agent_address,
            a.agent_phone_number,
            a.rating,
            a.work_status,
            a.password,
            a.vehicle_type,
            a.agent_profile_picture,
            a.vehicle_model,
            GROUP_CONCAT(atmat.manager_id) AS reporting_managers,
            GROUP_CONCAT(atmat.team_id) AS reporting_team_ids,
            GROUP_CONCAT(t.team_name) AS reporting_team_names,
            bd.ssid,
            bd.default_channel,
            bd.business_phone,
            bd.business_email,
            ast.status_name
           FROM agents a
          LEFT JOIN business_details bd ON bd.business_id = a.business_id
          LEFT JOIN agent_status ast ON a.work_status = ast.status_id
          LEFT JOIN agent_to_manager_and_team atmat ON atmat.agent_id = a.agent_id
          LEFT JOIN teams t ON t.team_id = atmat.team_id
          WHERE a.status NOT IN(0,2)
          AND(a.agent_email = ?
          OR a.agent_username = ?)
          GROUP BY agent_id`, [agent.agent_email, agent.agent_email]);

      if (agents_details.length > 0) {

        var manager_id_split = agents_details[0].reporting_managers.split(',');
        for(var i = 0; i < manager_id_split.length; i++){
          manager_id_split[i] = parseInt(manager_id_split[i]);
        }

        var manager_team_id_split = agents_details[0].reporting_team_ids.split(',');
        for(var i = 0; i < manager_id_split.length; i++){
          manager_team_id_split[i] = parseInt(manager_team_id_split[i]);
        }
        var manager_team_name_split = agents_details[0].reporting_team_names.split(',');

        var reporting_manager_details = yield db.queryAsync(`
          SELECT DISTINCT m.manager_full_name,
          		   m.manager_id,
                 CONCAT(m.country_code,m.manager_phone_number)AS manager_phone_number,
                 atmat.team_id,
                 t.team_name
          FROM managers m
          LEFT JOIN agent_to_manager_and_team atmat ON atmat.manager_id = m.manager_id
          LEFT JOIN teams t ON t.team_id = atmat.team_id
          WHERE m.manager_id IN (?)
          AND atmat.team_id IN (?);
        `,[manager_id_split, manager_team_id_split]);

            var app_config_details_fields = yield db.queryAsync(`
              SELECT aac.field_id,
                     aafn.field_name,
                     IF(aac.read_and_write = 1, 2, 1) AS read_and_write,
                     aac.config_status AS status,
                     aac.mandatory
              FROM agent_app_configuration aac
              LEFT JOIN agent_app_field_names aafn ON aac.field_id = aafn.field_id
              WHERE aac.business_id = ?
              AND aac.field_id IN(4,5,6)
              `, [agents_details[0].business_id])

            var app_config_details_buttons = yield db.queryAsync(`
              SELECT aac.field_id AS button_id,
                     aafn.field_name AS button_name,
                     aac.config_status AS status
              FROM agent_app_configuration aac
              LEFT JOIN agent_app_field_names aafn ON aac.field_id = aafn.field_id
              WHERE aac.business_id = ?
              AND aac.field_id IN(1,2,3)
              `, [agents_details[0].business_id])

            var notification_count = yield db.queryAsync(
                `SELECT COUNT(n.notification_id) AS notification_count
                  FROM  notifications n
                  WHERE n.user_id = ?
                  AND read_status = 0
                  AND n.business_id = ?
                  AND n.user_type = ?
                  AND n.status NOT IN(?,?,?)`, [agents_details[0].agent_id, agents_details[0].business_id, 2, 1, 2, 3]
                  )

            var app_version_details = yield db.queryAsync(`
                SELECT * FROM app_version
                WHERE device_type = ?
                AND app_type = ?`, [agent.device_type, agent.app_type]);

        var update_agent_status = yield db.queryAsync(`
          UPDATE agents
            SET work_status = ?
            WHERE agent_id = ?
          `,[1, agents_details[0].agent_id])

        if((agents_details.length > 0) && (bcrypt.compareSync(agent.password, agents_details[0].password)) === true){
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
             `, [agents_details[0].agent_id, agent.app_type, agent.device_type, 2, agents_details[0].business_id])
                if (device_details.length > 0) {
                    var update_access_token = yield db.queryAsync(`
              UPDATE login_device_details
                SET access_token = ?,
                    device_details = ?,
                    signin_count = signin_count + 1,
                    device_id = ?
                WHERE id = ?
              `, [hash, agent.device_details, agent.device_id, device_details[0].id])
                } else {
                    var device_details = yield db.queryAsync(`
              INSERT INTO login_device_details(
                  business_id,
                  device_type,
                  app_type,
                  user_id,
                  user_type,
                  device_details,
                  access_token,
                  signin_count,
                  device_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, signin_count + 1, ?)
               `,[agents_details[0].business_id, agent.device_type, agent.app_type, agents_details[0].agent_id, 2, agent.device_details, hash, agent.device_id])
          }
          var identification_key = 4;
          var text = "Agent "+agents_details[0].agent_first_name+" "+agents_details[0].agent_last_name+"("+ agents_details[0].agent_id + ") status to Online.";
          var data = {
              agent_id: agents_details[0].agent_id,
              agent_status: 1,
              text: text
          }
          yield bayeux.faye_push(agents_details[0].business_id, identification_key, data);

                if (app_version_details[0].version > agent.app_version) {
                    var critical = app_version_details[0].critical;
                    var message = 'Update the app with new version.';
                    if (app_version_details[0].last_critical > agent.app_version) {
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
                var retVal = {
                    status_code: 200,
                    message: "Logged in successfully",
                    data: {
                        agent_details: {
                            business_id: agents_details[0].business_id,
                            agent_id: agents_details[0].agent_id,
                            agent_first_name: agents_details[0].agent_first_name,
                            agent_last_name: agents_details[0].agent_last_name,
                            agent_username: agents_details[0].agent_username,
                            agent_email: agents_details[0].agent_email,
                            agent_address: agents_details[0].agent_address,
                            agent_status: 1,
                            agent_phone_number: agents_details[0].agent_phone_number,
                            agent_profile_picture: agents_details[0].agent_profile_picture,
                            vehicle_model: agents_details[0].vehicle_model,
                            vehicle_type: agents_details[0].vehicle_type,
                            rating: agents_details[0].rating,
                            ssid: agents_details[0].ssid,
                            reporting_manager_details: reporting_manager_details,
                            default_channel: agents_details[0].default_channel,
                            business_phone: agents_details[0].business_phone,
                            business_email: agents_details[0].business_email
                          },
            access_token: hash,
            app_version: app_version,
            app_config_details: {
              fields: app_config_details_fields,
              buttons: app_config_details_buttons
              },
            notification_count: notification_count[0].notification_count
            }
          }
          return retVal
        }else{
          error('InvalidLoginError')
        }
      }
      else{
        error('InvalidLoginError')
      }

    }

    * login_agent_access_token(agent) {
        var agent_id = yield db.queryAsync(`
        SELECT user_id FROM login_device_details WHERE access_token = ?
        `, [agent.access_token])

        var agents_details = yield db.queryAsync(`
          SELECT
            a.business_id,
            a.agent_id,
            a.agent_first_name,
            a.agent_last_name,
            a.agent_username,
            a.agent_email,
            a.agent_address,
            a.agent_phone_number,
            a.rating,
            a.work_status,
            a.password,
            a.vehicle_type,
            a.agent_profile_picture,
            a.vehicle_model,
            GROUP_CONCAT(atmat.manager_id) AS reporting_managers,
            GROUP_CONCAT(atmat.team_id) AS reporting_team_ids,
            GROUP_CONCAT(t.team_name) AS reporting_team_names,
            bd.ssid,
            bd.default_channel,
            bd.business_phone,
            bd.business_email,
            ast.status_name
           FROM agents a
          LEFT JOIN business_details bd ON bd.business_id = a.business_id
          LEFT JOIN agent_status ast ON a.work_status = ast.status_id
          LEFT JOIN agent_to_manager_and_team atmat ON atmat.agent_id = a.agent_id
          LEFT JOIN teams t ON t.team_id = atmat.team_id
        WHERE a.agent_id = ?
        AND a.status NOT IN(0,2)`, [agent_id[0].user_id]);

        var app_config_details_fields = yield db.queryAsync(`
        SELECT aac.field_id,
               aafn.field_name,
               IF(aac.read_and_write = 1, 2, 1) AS read_and_write,
               aac.config_status AS status,
               aac.mandatory
        FROM agent_app_configuration aac
        LEFT JOIN agent_app_field_names aafn ON aac.field_id = aafn.field_id
        WHERE aac.business_id = ?
        AND aac.field_id IN(4,5,6)
        `, [agents_details[0].business_id]);

        var manager_id_split = agents_details[0].reporting_managers.split(',');
        for(var i = 0; i < manager_id_split.length; i++){
          manager_id_split[i] = parseInt(manager_id_split[i]);
        }

        var manager_team_id_split = agents_details[0].reporting_team_ids.split(',');
        for(var i = 0; i < manager_id_split.length; i++){
          manager_team_id_split[i] = parseInt(manager_team_id_split[i]);
        }
        var manager_team_name_split = agents_details[0].reporting_team_names.split(',');

        var reporting_manager_details = yield db.queryAsync(`
          SELECT DISTINCT m.manager_full_name,
                 m.manager_id,
                 CONCAT(m.country_code,m.manager_phone_number)AS manager_phone_number,
                 atmat.team_id,
                 t.team_name
          FROM managers m
          LEFT JOIN agent_to_manager_and_team atmat ON atmat.manager_id = m.manager_id
          LEFT JOIN teams t ON t.team_id = atmat.team_id
          WHERE m.manager_id IN (?)
          AND atmat.team_id IN (?);
        `,[manager_id_split, manager_team_id_split]);

        var app_config_details_buttons = yield db.queryAsync(`
        SELECT aac.field_id AS button_id,
               aafn.field_name AS button_name,
               aac.config_status AS status
        FROM agent_app_configuration aac
        LEFT JOIN agent_app_field_names aafn ON aac.field_id = aafn.field_id
        WHERE aac.business_id = ?
        AND aac.field_id IN(1,2,3)
        `, [agents_details[0].business_id])

        var notification_count = yield db.queryAsync(
            `SELECT COUNT(n.notification_id) AS notification_count
          FROM  notifications n
          WHERE n.user_id = ?
          AND read_status = 0
          AND n.business_id = ?
          AND n.user_type = ?
          AND n.status NOT IN(?,?,?)`, [agent_id[0].user_id, agents_details[0].business_id, 2, 1, 2, 3]
        )

        var app_version_details = yield db.queryAsync(`
        SELECT * FROM app_version
        WHERE device_type = ?
        AND app_type = ?`, [agent.device_type, agent.app_type]);

        var device_details = yield db.queryAsync(`
          SELECT
              id,
              user_id,
              user_type,
              business_id,
              app_type,
              device_type
          FROM login_device_details
          WHERE access_token = ?
           `, [agent.access_token])

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
           `, [agents_details[0].agent_id, agent.app_type, agent.device_type, 2, agents_details[0].business_id])

        if (app_version_details[0].version > agent.app_version) {
            var critical = app_version_details[0].critical;
            var message = 'Update the app with new version.';
            if (app_version_details[0].last_critical > agent.app_version) {
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
        var retVal = {
          status_code: 200,
          message: "Logged in successfully",
          data: {
            agent_details: {business_id: agents_details[0].business_id,
                            agent_id: agents_details[0].agent_id,
                            agent_first_name: agents_details[0].agent_first_name,
                            agent_last_name: agents_details[0].agent_last_name,
                            agent_username: agents_details[0].agent_username,
                            agent_email: agents_details[0].agent_email,
                            agent_address: agents_details[0].agent_address,
                            agent_status: agents_details[0].work_status,
                            agent_phone_number: agents_details[0].agent_phone_number,
                            agent_profile_picture: agents_details[0].agent_profile_picture,
                            vehicle_model: agents_details[0].vehicle_model,
                            vehicle_type: agents_details[0].vehicle_type,
                            rating: agents_details[0].rating,
                            ssid: agents_details[0].ssid,
                            reporting_manager_details: reporting_manager_details,
                            default_channel: agents_details[0].default_channel,
                            business_phone: agents_details[0].business_phone,
                            business_email: agents_details[0].business_email
                          },
            access_token: agent.access_token,
            app_version: app_version,
            app_config_details: {
              fields: app_config_details_fields,
              buttons: app_config_details_buttons
            },
            notification_count: notification_count[0].notification_count
          }
        }
        return retVal
    }

    * get_agent(agent) {
        if (agent.limit === 0 && agent.offset === 0) {
            var agents = yield db.queryAsync(
                `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_username,
                  a.agent_email,
                  a.agent_address,
                  a.agent_phone_number,
                  a.status,
                  a.city,
                  a.state,
                  a.agent_profile_picture,
                  a.country,
                  a.rating,
                  a.tags_to_agent,
                  a.online_status,
                  a.work_status,
                  a.employee_code,
                  COUNT(DISTINCT(tta.team_id)) AS teams_count,
                  COUNT(DISTINCT(ttta.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types
            FROM agents a
            LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
            LEFT JOIN teams t ON t.team_id = tta.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = ttta.task_type_id
            WHERE a.business_id = ?
            AND a.status != ?
            AND ttta.status NOT IN (0,2)
            GROUP BY a.agent_id`, [agent.business_id, 2]
            )
        } else {
            var agents = yield db.queryAsync(
                `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_username,
                  a.agent_email,
                  a.agent_address,
                  a.agent_phone_number,
                  a.status,
                  a.city,
                  a.state,
                  a.agent_profile_picture,
                  a.country,
                  a.rating,
                  a.tags_to_agent,
                  a.online_status,
                  a.work_status,
                  a.employee_code,
                  COUNT(DISTINCT(tta.team_id)) AS teams_count,
                  COUNT(DISTINCT(ttta.task_type_id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types
            FROM agents a
            LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
            LEFT JOIN teams t ON t.team_id = tta.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = ttta.task_type_id
            WHERE a.business_id = ?
            AND a.status != ?
            AND ttta.status NOT IN (0,2)
            GROUP BY a.agent_id
            LIMIT ?
            OFFSET ?`, [agent.business_id, 2, agent.limit, agent.offset]
            )
        }

        const agents_count = yield db.queryAsync(
            `SELECT COUNT(agent_id) AS agent_count
          FROM  agents
          WHERE business_id = ? AND status != ?`, [agent.business_id, 2]
        )

        var retVal = {
            agents: agents,
            count: agents_count[0].agent_count
        }
        return retVal
    }

    * get_agents_to_team(agent) {

        var device_type = yield db.queryAsync(`
        SELECT *
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id]);

        if (agent.limit === 0 && agent.offset === 0) {
            var agents = yield db.queryAsync(
                `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_email,
                  a.agent_phone_number,
                  a.status,
                  a.online_status,
                  a.work_status,
                  GROUP_CONCAT(tttb.task_type_name) AS agent_task_types
            FROM agent_to_manager_and_team tta
            LEFT JOIN agents a ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = tta.agent_id
            LEFT JOIN task_types_to_business tttb ON ttta.task_type_id = tttb.task_type_id
            WHERE tta.business_id = ?
            AND tta.team_id = ?
            AND tta.status != ?
            AND a.status != 0
            GROUP BY tta.agent_id`, [agent.business_id, agent.team_id, 0]
            )
        } else {
            var agents = yield db.queryAsync(
                `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_email,
                  a.agent_phone_number,
                  a.status,
                  a.online_status,
                  a.work_status,
                  GROUP_CONCAT(tttb.task_type_name) AS agent_task_types
            FROM agent_to_manager_and_team tta
            LEFT JOIN agents a ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = tta.agent_id
            LEFT JOIN task_types_to_business tttb ON ttta.task_type_id = tttb.task_type_id
            WHERE tta.business_id = ?
            AND tta.team_id = ?
            AND tta.status != ?
            AND a.status != 0
            GROUP BY tta.agent_id
            LIMIT ?
            OFFSET ?`, [agent.business_id, agent.team_id, 2, agent.limit, agent.offset]
            )
        }

        const agents_count = yield db.queryAsync(
            `SELECT COUNT(a.agent_id) AS agent_count
          FROM agent_to_manager_and_team tta
          LEFT JOIN agents a ON tta.agent_id = a.agent_id
          WHERE tta.business_id = ?
          AND tta.status != ?
          AND tta.team_id = ?
          GROUP BY tta.agent_id`, [agent.business_id, 2, agent.team_id]
        )
        if(agents_count.length > 0){
          var count_agent = agents_count[0].agent_count
        }else{
          var count_agent = 0
        }
        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "List of Agents.",
                data: {
                    agents: agents,
                    count: count_agent
                }
            }
        }
        else {
            var retVal = {
                agents: agents,
                count: count_agent
            }
        }
        return retVal
    }

    * get_agents_by_team_ids(agent) {

      var device_type = yield db.queryAsync(`
      SELECT *
      FROM login_device_details
      WHERE access_token = ?
      AND business_id = ?
      `, [agent.access_token, agent.business_id]);

        var task_types = _.uniq(agent.task_types)
        var agents = yield db.queryAsync(
            `SELECT tta.agent_id,
                a.agent_first_name,
                a.agent_last_name,
                a.agent_phone_number,
                GROUP_CONCAT(tta.team_id) AS team_id,
                COUNT(tta.team_id) AS team_count
          FROM agent_to_manager_and_team tta
          LEFT JOIN agents a ON tta.agent_id = a.agent_id
          LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = tta.agent_id
          LEFT JOIN task_types_to_business tttb ON ttta.task_type_id = tttb.task_type_id
          WHERE tta.business_id = ?
          AND tta.team_id IN(?)
          AND ttta.task_type_id IN(?)
          AND tta.status NOT IN(?,?)
          AND a.work_status NOT IN (0,3,4)
          GROUP BY tta.agent_id
          HAVING COUNT(DISTINCT ttta.task_type_id) = ?`, [agent.business_id, agent.team_ids, task_types, 2, 0, task_types.length]
        )
        //console.log("teh data", agents);

        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "List of Agents.",
                data: {
                    agents: agents
                }
            }
        }
        else {
            var retVal = {
                agents: agents
            }
        }
        return retVal
    }

    * get_agents_by_team_ids_new(agent) {

      var device_type = yield db.queryAsync(`
      SELECT *
      FROM login_device_details
      WHERE access_token = ?
      AND business_id = ?
      `, [agent.access_token, agent.business_id]);

        var task_types = _.uniq(agent.task_types)
        var task_time_query = "";
        for(var i = 0; i < agent.tasks.length; i++){
          task_time_query = task_time_query.concat(" AND t.date_time = '"+agent.tasks[i].date_time+"' AND duration = "+agent.tasks[i].duration+" ");
        }

        var final_conflict_query =  yield db.queryAsync("SELECT DISTINCT t.agent_id, COUNT(t.task_id) AS conflict_task_count, GROUP_CONCAT( DISTINCT t.task_id) AS conflict_tasks, GROUP_CONCAT( DISTINCT t.date_time) AS conflict_times FROM tasks t WHERE t.business_id = "+agent.business_id+" "+task_time_query+" GROUP BY t.agent_id",[]);

        console.log("Final Query++++++++++", final_conflict_query);

        var agents = yield db.queryAsync(
            `SELECT tta.agent_id,
                a.agent_first_name,
                a.agent_last_name,
                a.agent_phone_number,
                a.agent_profile_picture,
                a.work_status AS current_status,
                0 AS future_status,
                GROUP_CONCAT(DISTINCT tta.team_id) AS team_id,
                COUNT( DISTINCT tta.team_id) AS team_count,
                0 AS conflict_task_count,
                0 AS conflict_tasks,
                0 AS conflict_times,
                111.111
                * DEGREES(ACOS(COS(RADIANS(a.last_updated_lat))
                * COS(RADIANS(?))
                * COS(RADIANS(a.last_updated_long - ?))
                + SIN(RADIANS(a.last_updated_lat))
                * SIN(RADIANS(?)))) AS distance_in_km
          FROM agent_to_manager_and_team tta
          LEFT JOIN agents a ON tta.agent_id = a.agent_id
          LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = tta.agent_id
          LEFT JOIN task_type_to_agent ttta1 ON ttta1.agent_id = tta.agent_id
          LEFT JOIN task_types_to_business tttb ON ttta.task_type_id = tttb.task_type_id
          LEFT JOIN task_types_to_business tttb1 ON ttta1.task_type_id = tttb1.task_type_id
          WHERE tta.business_id = ?
          AND tta.team_id IN(?)
          AND ttta.task_type_id IN(?)
          AND tta.status NOT IN(?,?)
          AND a.work_status NOT IN (0,3,4)
          AND a.status NOT IN (0,2)
          GROUP BY tta.agent_id
          HAVING COUNT(DISTINCT ttta.task_type_id) = ?`, [agent.tasks[0].task_lat, agent.tasks[0].task_long, agent.tasks[0].task_lat, agent.business_id, agent.team_ids, task_types, 2, 0, task_types.length]
        )

        for(var i = 0; i < agents.length; i++){
          console.log("Some lp1 ++++++",agents.length);
          for(var j = 0; j < final_conflict_query.length; j++){
            console.log("Some lp2 ++++++",final_conflict_query.length);
            if(agents[i].agent_id === final_conflict_query[j].agent_id){
              console.log("Some problem here may be ++++++", agents[i].agent_id,  final_conflict_query[j].agent_id);
              agents[i].future_status = 1
              agents[i].conflict_task_count = final_conflict_query[j].conflict_task_count
              agents[i].conflict_tasks = final_conflict_query[j].conflict_task_count
              agents[i].conflict_times = final_conflict_query[j].conflict_times
            }
          }
        }
        //console.log("teh data", agents);

        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "List of Agents.",
                data: {
                    agents: agents
                }
            }
        }
        else {
            var retVal = {
                agents: agents
            }
        }
        return retVal
    }

    * add_agent(agent) {
        var hash = bcrypt.hashSync(agent.password, 10);
        const manager_details = yield db.queryAsync(`
          SELECT ldd.user_id,
                 m.*
          FROM login_device_details ldd
          LEFT JOIN managers m ON m.manager_id = ldd.user_id
          WHERE ldd.access_token = ?
          `, [agent.access_token]);

        let flag = false;
        if ((yield db.queryAsync(`SELECT agent_email FROM agents WHERE business_id = ?  AND agent_email = ? AND status != ?`, [agent.business_id, agent.agent_email, 2])).length > 0) {
            error('UserExistsErrorEmail')
        }
        else if ((yield db.queryAsync(`SELECT agent_username FROM agents WHERE business_id = ?  AND agent_username = ? AND status != ?`, [agent.business_id, agent.agent_username, 2])).length > 0) {

            error('UserExistsErrorUsername')
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM agents WHERE business_id = ?  AND employee_code = ? AND status != ?`, [agent.business_id, agent.employee_code, 2])).length > 0) {
            error('UserExistsErrorEmployeeCode')
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM managers WHERE business_id = ?  AND employee_code = ? AND status != ?`, [agent.business_id, agent.employee_code, 2])).length > 0) {
            error('UserExistsErrorEmployeeCode')
        }
        else {
            let count = lodash.countBy(agent.team_reporting_manager_id, function(t){
                return t.team_id;
            });
            //console.log("_____",count);
            let data = Object.keys(count).map(x => ({team_id: x, count: count[x]}));
            //console.log("*****",data);
            for(let i=0;i<data.length;i++){
                if(data[i].count>1){
                    flag=true;
                    i=data.length
                }
            }
            //console.log("*******",flag)
            if(flag){
                error('MultipleManager')
            }
            else {
                const agents = yield db.queryAsync(
                    `INSERT INTO agents(
            business_id,
            agent_first_name,
            agent_last_name,
            agent_username,
            agent_email,
            agent_address,
            agent_phone_number,
            password,
            country_code,
            agent_permissions,
            status,
            agent_profile_picture,
            tags_to_agent,
            document1,
            document2,
            document3,
            document4,
            document5,
            created_by,
            updated_by,
            employee_code,
            work_status)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `, [agent.business_id, agent.agent_first_name, agent.agent_last_name, agent.agent_username, agent.agent_email, agent.agent_address, agent.agent_phone_number, hash,agent.country_code, agent.agent_permissions, 1, agent.agent_profile_picture, agent.tag_id, agent.document1, agent.document2, agent.document3, agent.document4, agent.document5, manager_details[0].user_id, manager_details[0].user_id, agent.employee_code, 4])

                var values1 = [];
                var values2 = [];
                var values3 = [];

                for (var i = 0; i < agent.task_type_id.length; i++) {
                    values1.push([agent.business_id, agents.insertId, agent.task_type_id[i], 1, manager_details[0].user_id, manager_details[0].user_id])
                }
                for (var i = 0; i < agent.team_id.length; i++) {
                    values2.push([agent.business_id, agents.insertId, agent.team_id[i], 1, manager_details[0].user_id, manager_details[0].user_id])
                }
                for (var i = 0; i < agent.team_reporting_manager_id.length; i++) {
                    values3.push([agent.business_id, agents.insertId, agent.team_reporting_manager_id[i].team_id, agent.team_reporting_manager_id[i].manager_id, 1, manager_details[0].user_id, manager_details[0].user_id])
                }
                if (values1.length === agent.task_type_id.length && values2.length === agent.team_id.length && values3.length === agent.team_reporting_manager_id.length) {

                    const agent_task_types = yield db.queryAsync(
                        `INSERT INTO task_type_to_agent(
                business_id,
                agent_id,
                task_type_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values1]
                    )

                    const team_agent_managers = yield db.queryAsync(
                        `INSERT INTO agent_to_manager_and_team(
                business_id,
                agent_id,
                team_id,
                manager_id,
                status,
                created_by,
                updated_by)
                VALUES ?
              `, [values3]
                    );
                    // let managerDetails = yield  db.queryAsync(
                    //     'select * from managers where access_token ='+[agent.business_id]
                    // );
                    // //console.log("________",managerDetails)
                    //  let content =" Dear "+agent.agent_first_name+" "+agent.agent_last_name+"," +
                    //      "<br><br>" +
                    //      "Welcome to Q-Engine.You have been added as an agent ." +
                    //      "<br><br>" +
                    //      "To get started, please use the following link below to download the App:" +
                    //      "<br><br>" +
                    //      "AppLink:" +
                    //      "Use the credentials below to login: " +
                    //      "<br>Username: "+agent.agent_email+"" +
                    //      "<br>Password: "+agent.password+"" +
                    //      "<br><br>" +
                    //      "Regards<br>Q-Engine Team";
                    let content1 =" Dear "+agent.agent_first_name+" "+agent.agent_last_name+"," +
                        "\n\n" +
                        "Welcome to Q-Engine.You have been added as an agent by "+manager_details[0].manager_full_name+"." +
                        "\n\n" +
                        "To get started, please use the following link below to download the App:" +
                        "\n\n" +
                        "AppLink:" +
                        "Use the credentials below to login: " +
                        "\n Username: "+agent.agent_email+"\n" +
                        "Password: "+agent.password+"\n\n" +
                        "Regards\nQ-Engine Team";

                        let content2 =" Dear "+agent.agent_first_name+" "+agent.agent_last_name+",<br><br>" +
                            "" +
                            "Welcome to Q-Engine.You have been added as an agent by "+manager_details[0].manager_full_name+"." +
                            "<br><br>" +
                            "To get started, please use the following link below to download the App:" +
                            "<br><br>" +
                            "AppLink:" +
                            "Use the credentials below to login: " +
                            "\n Username: "+agent.agent_email+"\n" +
                            "Password: "+agent.password+"<br><br>" +
                            "Regards<br><br>Q-Engine Team";
                    yield sendEmailToUser("CONFIGURABLE_MAIL", {content: content2}, agent.agent_email, "support@azuratech.in", "Create Agent", "Password Reset Mail");
                    yield CommonFunction.send_sms_plivo(agent.country_code+agent.agent_phone_number,content1);
                    var retVal = {
                        agent_id: agents.insertId,
                        agent_first_name: agent.agent_first_name,
                        agent_last_name: agent.agent_last_name
                    };
                    return retVal
                }
                else {
                    error('GenericError')
                }
            }



        }
    }

    * edit_agent(agent) {
      let flag = false;
        if ((yield db.queryAsync(`SELECT agent_email FROM agents WHERE business_id = ?  AND agent_email = ? AND status != ? AND agent_id != ?`, [agent.business_id, agent.agent_email, 2, agent.agent_id])).length > 0) {
            error('UserExistsErrorEmail')
        }
        else if ((yield db.queryAsync(`SELECT agent_username FROM agents WHERE business_id = ?  AND agent_username = ? AND status != ? AND agent_id != ?`, [agent.business_id, agent.agent_username, 2, agent.agent_id])).length > 0) {
            error('UserExistsErrorUsername')
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM agents WHERE business_id = ?  AND employee_code = ? AND status != ? AND agent_id != ?`, [agent.business_id, agent.employee_code, 2, agent.agent_id])).length > 0) {
            error('UserExistsErrorEmployeeCode')
        }
        else if ((yield db.queryAsync(`SELECT employee_code FROM managers WHERE business_id = ?  AND employee_code = ? AND status != ?`, [agent.business_id, agent.employee_code, 2])).length > 0) {
            error('UserExistsErrorEmployeeCode')
        }
        else {
          let count = lodash.countBy(agent.team_reporting_manager_id, function(t){
              return t.team_id;
          });
          //console.log("_____",count);
          let data = Object.keys(count).map(x => ({team_id: x, count: count[x]}));
          //console.log("*****",data);
          for(let i=0;i<data.length;i++){
              if(data[i].count>1){
                  flag=true;
                  i=data.length
              }
          }
          //console.log("*******",flag)
          if(flag){
              error('MultipleManager')
          }
          else{
            const agents = yield db.queryAsync(
                `UPDATE agents
           SET
            agent_first_name = ?,
            agent_last_name = ?,
            agent_username = ?,
            agent_email = ?,
            agent_address = ?,
            agent_phone_number = ?,
            agent_permissions = ?,
            agent_profile_picture = ?,
            tags_to_agent = ?,
            document1 = ?,
            document2 = ?,
            document3 = ?,
            document4 = ?,
            document5 = ?,
            updated_by = ?,
            employee_code = ?
            WHERE agent_id = ?
            AND business_id = ?
          `, [agent.agent_first_name, agent.agent_last_name, agent.agent_username, agent.agent_email, agent.agent_address, agent.agent_phone_number, agent.agent_permissions, agent.agent_profile_picture, agent.tags_to_agent, agent.document1, agent.document2, agent.document3, agent.document4, agent.document5, 1, agent.employee_code, agent.agent_id, agent.business_id]) //Dummy Manager ID Inserted

            var values1 = [];
            var values2 = [];
            var values3 = [];

            for (var i = 0; i < agent.task_type_id.length; i++) {
                values1.push([agent.business_id, agent.agent_id, agent.task_type_id[i], 1, 1, 1])//Dummy Manager ID Inserted
            }
            for (var i = 0; i < agent.team_id.length; i++) {
                values2.push([agent.business_id, agent.agent_id, agent.team_id[i], 1, 1, 1])//Dummy Manager ID Inserted
            }
            for (var i = 0; i < agent.team_reporting_manager_id.length; i++) {
                values3.push([agent.business_id, agent.agent_id, agent.team_reporting_manager_id[i].team_id, agent.team_reporting_manager_id[i].manager_id, 1, 1, 1])//Dummy Manager ID Inserted
            }
            if (values1.length === agent.task_type_id.length && values2.length === agent.team_id.length && values3.length === agent.team_reporting_manager_id.length) {

                const delete_agent_task_types = yield db.queryAsync(
                    `DELETE FROM task_type_to_agent
              WHERE agent_id = ?
              AND business_id = ?
              `, [agent.agent_id, agent.business_id]
                )

                const agent_task_types = yield db.queryAsync(
                    `INSERT INTO task_type_to_agent(
                business_id,
                agent_id,
                task_type_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values1]
                )

                const delete_team_agent_managers = yield db.queryAsync(
                    `DELETE FROM agent_to_manager_and_team
               WHERE agent_id = ?
               AND business_id = ?
              `, [agent.agent_id, agent.business_id]
                )

                const team_agent_managers = yield db.queryAsync(
                    `INSERT INTO agent_to_manager_and_team(
                business_id,
                agent_id,
                team_id,
                manager_id,
                status,
                created_by,
                updated_by)
                VALUES ?
              `, [values3]
                )

                var retVal = {
                    agent_id: agent.agent_id,
                    agent_first_name: agent.agent_first_name,
                    agent_last_name: agent.agent_last_name
                }
                return retVal
            } else {
                error('GenericError')
            }
        }
      }
    }

    * edit_agent_by_agent(agent) {
        if ((yield db.queryAsync(`SELECT agent_email FROM agents WHERE business_id = ?  AND agent_email = ? AND status != ? AND agent_id != ?`, [agent.business_id, agent.agent_email, 2, agent.agent_id])).length > 0) {
            error('UserExistsErrorEmail')
        }
        else if ((yield db.queryAsync(`SELECT agent_username FROM agents WHERE business_id = ?  AND agent_username = ? AND status != ? AND agent_id != ?`, [agent.business_id, agent.agent_username, 2, agent.agent_id])).length > 0) {
            error('UserExistsErrorUsername')
        }
        else {
            const agents = yield db.queryAsync(
                `UPDATE agents
           SET
            agent_first_name = ?,
            agent_last_name = ?,
            agent_username = ?,
            agent_email = ?,
            agent_address = ?,
            agent_phone_number = ?,
            agent_profile_picture = ?,
            document1 = ?,
            document2 = ?,
            document3 = ?,
            document4 = ?,
            document5 = ?,
            updated_by = ?
            WHERE agent_id = ?
            AND business_id = ?
          `, [agent.agent_first_name, agent.agent_last_name, agent.agent_username, agent.agent_email, agent.agent_address, agent.agent_phone_number, agent.agent_profile_picture, agent.document1, agent.document2, agent.document3, agent.document4, agent.document5, 1, agent.agent_id, agent.business_id]) //Dummy Manager ID Inserted

            var values1 = [];

            for (var i = 0; i < agent.task_type_id.length; i++) {
                values1.push([agent.business_id, agent.agent_id, agent.task_type_id[i], 1, 1, 1])//Dummy Manager ID Inserted
            }
            if (values1.length === agent.task_type_id.length) {

                const delete_agent_task_types = yield db.queryAsync(
                    `DELETE FROM task_type_to_agent
              WHERE agent_id = ?
              AND business_id = ?
              `, [agent.agent_id, agent.business_id]
                )

                const agent_task_types = yield db.queryAsync(
                    `INSERT INTO task_type_to_agent(
                business_id,
                agent_id,
                task_type_id,
                status,
                created_by,
                updated_by)
               VALUES ?
              `, [values1]
                )

                var retVal = {
                    status_code: 200,
                    message: "Agent profile edited successfully",
                    data: {
                        agent_id: agent.agent_id,
                        agent_first_name: agent.agent_first_name,
                        agent_last_name: agent.agent_last_name
                    }
                }

                return retVal
            } else {
                error('GenericError')
            }
        }
    }

    * edit_agent_status(agent) {
        //Need to implement a logic for giving a warning about assigned tasks to the agent
        const agent_details = yield db.queryAsync(
          `SELECT CONCAT(a.agent_first_name," ",a.agent_last_name) AS agent_name,
                  a.work_status,
                  ast.status_name
           FROM agents a
           LEFT JOIN agent_status ast ON ast.status_id = a.work_status
           WHERE a.agent_id = ?
          `,[agent.agent_id]
        )

        const agents = yield db.queryAsync(
            `UPDATE agents
         SET status = ?
         WHERE business_id = ?
         AND agent_id = ?
         AND status != ?
        `, [agent.status, agent.business_id, agent.agent_id, 2]
        )

        if(agent.status === 0){
          const update_access_token = yield db.queryAsync(
            `UPDATE login_device_details
             SET access_token = ?
             WHERE user_id = ?
             AND user_type = ?
             AND business_id = ?
            `,["Logged Out", agent.agent_id, 2, agent.business_id]);

          const update_work_status = yield db.queryAsync(
            `UPDATE agents
             SET work_status = ?
             WHERE agent_id = ?
             AND business_id = ?
            `,[3, agent.agent_id, agent.business_id]);

        }

        if (agents.affectedRows > 0) {

            var identification_key = 4;
            if(agent.status === 0){
              var text = "Agent "+agent_details[0].agent_name+"(" + agent.agent_id + ") status set to Blocked .";
            }
            else{
              var text = "Agent "+agent_details[0].agent_name+"(" + agent.agent_id + ") status set to Active .";
            }
            var data = {
                agent_id: agent.agent_id,
                agent_status: agent.status,
                text: text
            }
            yield bayeux.faye_push(agent.business_id, identification_key, data);

            var retVal = {
                message: "Agent status updated succesfully",
                agent_id: agent.agent_id,
                status: agent.status
            }
            return retVal
        }
        else if (agent.affectedRows === 0 && (agent.status === 2 || agent.status === 1 || agent.status === 0)) {
            return error('AlreadyDeletedError')
        }
        else {
            return error('GenericError')
        }

    }

    * edit_agent_status_by_agent(agent) {

      const agent_details = yield db.queryAsync(
        `SELECT CONCAT(a.agent_first_name," ",a.agent_last_name) AS agent_name,
                a.work_status,
                ast.status_name
         FROM agents a
         LEFT JOIN agent_status ast ON ast.status_id = a.work_status
         WHERE a.agent_id = ?
        `,[agent.agent_id]
      )

        const agents = yield db.queryAsync(
            `UPDATE agents
         SET work_status = ?
         WHERE business_id = ?
         AND agent_id = ?
         AND status != ?
        `, [agent.status, agent.business_id, agent.agent_id, 2]
        )
        if(agent.status === 0){
          var as = "Offline"
        }
        if(agent.status === 1){
          var as = "Online"
        }
        if (agents.affectedRows > 0) {

            var identification_key = 4;
            var text = "Agent "+agent_details[0].agent_name+"(" + agent.agent_id + ") to " +as+".";
            var data = {
                agent_id: agent.agent_id,
                agent_status: agent.status,
                text: text
            }
            yield bayeux.faye_push(agent.business_id, identification_key, data);


            var retVal = {
                message: "Agent status updated succesfully",
                agent_id: agent.agent_id,
                status: agent.status
            }
            return retVal
        }
        else if (agent.affectedRows === 0 && (agent.status === 2 || agent.status === 1 || agent.status === 0)) {
            return error('AlreadyDeletedError')
        }
        else {
            return error('GenericError')
        }

    }

    * get_agent_via_id(agent) {

      var device_type = yield db.queryAsync(`
      SELECT *
      FROM login_device_details
      WHERE access_token = ?
      AND business_id = ?
      `, [agent.access_token, agent.business_id]);

        var agents = yield db.queryAsync(
            `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_username,
                  a.agent_email,
                  a.agent_address,
                  a.agent_phone_number,
                  a.status,
                  a.country_code,
                  a.city,
                  a.state,
                  a.agent_profile_picture,
                  a.country,
                  a.rating,
                  a.tags_to_agent,
                  a.online_status,
                  a.work_status,
                  a.employee_code,
                  a.document1,
                  a.document2,
                  a.document3,
                  a.document4,
                  a.document5,
                  COUNT(DISTINCT(tta.id)) AS teams_count,
                  COUNT(DISTINCT(ttta.id)) AS task_type_count
            FROM agents a
            LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
            WHERE a.business_id = ? AND a.status != ?
            AND a.agent_id = ?`, [agent.business_id, 2, agent.agent_id]
        )

        const agent_task_types = yield db.queryAsync(
            `SELECT
            tttb.task_type_id,
            tttb.task_type_name
          FROM task_type_to_agent ttta
          LEFT JOIN task_types_to_business tttb ON ttta.task_type_id = tttb.task_type_id
          WHERE ttta.agent_id = ?
          AND ttta.business_id = ?
          `, [agent.agent_id, agent.business_id]
        )

        const team_agent_managers = yield db.queryAsync(
            `SELECT
            t.team_id,
            t.team_name,
            m.manager_id,
            m.manager_full_name
          FROM agent_to_manager_and_team atmat
          LEFT JOIN managers m ON m.manager_id = atmat.manager_id
          LEFT JOIN teams t ON t.team_id = atmat.team_id
          WHERE atmat.agent_id = ?
          AND atmat.business_id = ?
          `, [agent.agent_id, agent.business_id]
        )

        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "Fetched Agent Details",
                data: {agent: agents[0],
                task_types: agent_task_types,
                managers: team_agent_managers}
            }
        }
        else {
          var retVal = {
              agent: agents[0],
              task_types: agent_task_types,
              managers: team_agent_managers
          }
        }
        return retVal
    }

    * get_agent_lat_long_via_id(agent) {
        var agents = yield db.queryAsync(
            `SELECT a.last_updated_lat,
                  a.last_updated_long
            FROM agents a
            WHERE a.business_id = ? AND a.status != ?
            AND a.agent_id = ?`, [agent.business_id, 2, agent.agent_id]
        )
        var retVal = {
            agent: agents[0]
        }
        return retVal
    }

    * change_task_work_status_agent(order) {

        let triggerStatus = 0;
        if (order.task_status === 3) {
            var task_status = 3;

            const order_details = yield db.queryAsync(
                `SELECT order_id,
                  run_id,
                  agent_id
            FROM tasks
            WHERE task_id = ?
          `, [order.task_id]);

            const check_if_accepted = yield db.queryAsync(`
          SELECT run_status,
                 order_type
            FROM runs
            WHERE run_id = ?
          `, [order_details[0].run_id]);

            const agent_id = yield db.queryAsync(`
          SELECT ldd.user_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.work_status
          FROM login_device_details ldd
          LEFT JOIN agents a ON a.agent_id = ldd.user_id
          WHERE ldd.access_token = ?
          AND ldd.business_id = ?
          `, [order.access_token, order.business_id]);

          if(agent_id[0].user_id != order_details[0].agent_id){
            error('NoMoreAssigned');
          }

            if (check_if_accepted[0].run_status > 2) {
                var notifications = yield db.queryAsync(
                    `UPDATE notifications n
              SET n.status = ?
              WHERE n.user_id = ?
              AND n.business_id = ?
              AND n.user_type = ?
              AND n.order_id = ?
              AND n.status NOT IN(?,?)`, [1, agent_id[0].user_id, agent.business_id, 2, order_details[0].order_id, 1, 2]
                )
                error('OrderAlreadyAccepted')
            } else {
                var notifications_check = yield db.queryAsync(
                    `SELECT n.status
              FROM notifications n
              WHERE n.business_id = ?
              AND n.user_type = ?
              AND n.order_id = ?
              AND n.status IN(?,?)`, [order.business_id, 2, order_details[0].order_id, 1, 2]
                )

                var tasks = yield db.queryAsync(
                    `UPDATE tasks
                  SET agent_id = ?,
                      task_status = ?,
                      status_updated_by = ?,
                      status_updated_by_type = 2
                WHERE run_id = ?
                AND order_id = ?
                AND business_id = ?`, [agent_id[0].user_id, task_status,agent_id[0].user_id, order_details[0].run_id, order_details[0].order_id, order.business_id]
                );

                var notifications = yield db.queryAsync(
                    `UPDATE notifications n
                SET n.status = ?
                WHERE n.user_id = ?
                AND n.business_id = ?
                AND n.user_type = ?
                AND n.order_id = ?
                AND n.status NOT IN(?,?)`, [1, agent_id[0].user_id, order.business_id, 2, order_details[0].order_id, 1, 2]
                )

                var notifications_update_other_agents = yield db.queryAsync(
                    `UPDATE notifications n
                SET n.status = ?
                WHERE n.user_id != ?
                AND n.business_id = ?
                AND n.user_type = ?
                AND n.order_id = ?
                AND n.status NOT IN(?,?)`, [3, agent_id[0].user_id, order.business_id, 2, order_details[0].order_id, 1, 2]
                )

                var team_id_info = yield db.queryAsync(
                    `SELECT n.team_id
               FROM notifications n
               WHERE n.user_id = ?
               AND n.business_id = ?
               AND n.user_type = ?
               AND n.order_id = ?
               AND n.notification_type = ?`, [agent_id[0].user_id, order.business_id, 2, order_details[0].order_id, 2]
                )

                //console.log("team_id_info", team_id_info, agent_id[0].user_id, order.business_id, order_details[0].order_id);
                var runs = yield db.queryAsync(
                    `UPDATE runs
                  SET agent_id = ?,
                      team_id = ?,
                      run_status = 2
                WHERE run_id = ?
                AND order_id = ?
                AND business_id = ?`, [agent_id[0].user_id, team_id_info[0].team_id, order_details[0].run_id, order_details[0].order_id, order.business_id]
                )

                var manager_ids = yield db.queryAsync(
                    `SELECT ttm.manager_id
               FROM team_to_manager ttm
               WHERE ttm.team_id = ?
               AND ttm.business_id = ?`, [team_id_info[0].team_id, order.business_id])

                var super_manager_ids = yield db.queryAsync(
                    `SELECT manager_id
              FROM managers
              WHERE manager_type = ?
              AND business_id = ?`, [1, order.business_id])

                manager_ids = manager_ids.concat(super_manager_ids);
                var managers = []
                for (var i = 0; i < manager_ids.length; i++) {
                    managers.push(manager_ids[i].manager_id);
                }
                manager_ids = _.uniq(managers)
                //console.log("returning manager ids", manager_ids);

                var notification_text = "Agent " + agent_id[0].agent_first_name + "(" + agent_id[0].user_id + ") has acknowledged Order ID:" + order_details[0].order_id + ".";

                var values1 = [];

                var manager_id_with_unique_id = [];

                for (var i = 0; i < manager_ids.length; i++) {
                    var hash = bcrypt.hashSync("hash", 3);
                    values1.push([order.business_id, 3, 3, 1, notification_text, 1, order_details[0].order_id, order_details[0].run_id, order.task_id, manager_ids[i], 1, team_id_info[0].team_id, hash])
                    manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
                }

                var manager_notifications = yield db.queryAsync(
                    `INSERT INTO notifications(
                  business_id,
                  notification_type,
                  device_type,
                  app_type,
                  notification_content,
                  status,
                  order_id,
                  run_id,
                  task_id,
                  user_id,
                  user_type,
                  team_id,
                  unique_id
                )
                VALUES ?
              `, [values1]
                )
                var identification_key = 3
                var data = {
                    manager_id: manager_id_with_unique_id,
                    text: notification_text,
                    order_id: order_details[0].order_id,
                    task_status: task_status,
                    task_id: order.task_id,
                    run_id: order_details[0].run_id,
                    agent_id: agent_id[0].user_id,
                    agent_name: agent_id[0].agent_first_name+" "+agent_id[0].agent_last_name,
                    agent_status: agent_id[0].work_status
                }

                yield bayeux.faye_push(order.business_id, identification_key, data);

                var android_manager_device_tokens = yield db.queryAsync(
                  `SELECT device_id
                    FROM login_device_details
                    WHERE user_id IN(?)
                    AND user_type = 1
                    AND device_type = 1
                    AND app_type = 1
                  `,[manager_ids]
                )

                var device_token = [];//device_tokens
                for(var i = 0; i < android_manager_device_tokens.length; i++){
                  device_token.push(android_manager_device_tokens[i].device_id)
                }
                //console.log("device pushes", device_token);
                var text = notification_text;
                var pushFlag = 2;
                var order_id = agent.order_id;
                var run_id = agent.run_id;
                var task_id = 0;
                var notification_id = manager_id_with_unique_id;

                yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

                var runs = yield db.queryAsync(
                    `UPDATE runs
                 SET  agent_id = ?,
                      run_status = ?,
                      team_id = ?
                WHERE run_id = ?
                AND order_id = ?
                AND business_id = ?`, [agent_id[0].user_id, 3, order_details[0].run_id, team_id_info[0].team_id, order_details[0].order_id, order.business_id]
                )

                //console.log("Checking data", tasks);

                var retVal = {
                    status_code: 200,
                    message: "Task status updated succesfully",
                    task_id: order.task_id,
                    task_status: order.task_status
                }
                return retVal

            }
        }
        else {
          console.log("###########1");
          var agent_current_location = yield db.queryAsync(
              `SELECT a.last_updated_lat,
                a.last_updated_long,
                a.agent_id
               FROM agents a
               LEFT JOIN login_device_details ldd ON ldd.user_id = a.agent_id
               WHERE ldd.access_token = ?`, [order.access_token]);
           const order_details = yield db.queryAsync(
               `SELECT order_id,
                 run_id,
                 agent_id
           FROM tasks
           WHERE task_id = ?
         `, [order.task_id]);

               if(order_details[0].agent_id != agent_current_location[0].agent_id){
                 error('NoMoreAssigned');
               }

            if (order.task_status === 5) {
                triggerStatus = 3;
                var update_point_of_task = yield db.queryAsync(
                    `UPDATE tasks
            SET agent_started_point = GeomFromText(?),
                agent_started_time = NOW()
            WHERE task_id = ?`, ["POINT(" + agent_current_location[0].last_updated_lat + " " + agent_current_location[0].last_updated_long + ")", order.task_id]
                )
                console.log("###########2");
            }

            else if (order.task_status === 6) {
                triggerStatus = 4;
                var update_point_of_task = yield db.queryAsync(
                    `UPDATE tasks
            SET agent_arrived_point = GeomFromText(?),
                agent_arrived_time = NOW()
            WHERE task_id = ?`, ["POINT(" + agent_current_location[0].last_updated_lat + " " + agent_current_location[0].last_updated_long + ")", order.task_id]
                )
                console.log("###########3");
            }

            else if (order.task_status === 7) {
                var update_point_of_task = yield db.queryAsync(
                    `UPDATE tasks
            SET begin_task_point = GeomFromText(?),
                begin_task_time = NOW()
            WHERE task_id = ?`, ["POINT(" + agent_current_location[0].last_updated_lat + " " + agent_current_location[0].last_updated_long + ")", order.task_id]
                )
                console.log("###########4");
            }

            else if (order.task_status === 8) {
                triggerStatus = 5;
                var update_point_of_task = yield db.queryAsync(
                    `UPDATE tasks
            SET ended_point = GeomFromText(?),
                ended_time = NOW()
            WHERE task_id = ?`, ["POINT(" + agent_current_location[0].last_updated_lat + " " + agent_current_location[0].last_updated_long + ")", order.task_id]
                )
                console.log("###########5");
            }
            else if (order.task_status === 9) {
                triggerStatus = 6;
            }
            else if (order.task_status === 11) {
                triggerStatus = 8;
            }
            console.log("###########6");
            var tasks = yield db.queryAsync(
                `UPDATE tasks
           SET task_status = ?,
           status_updated_by = ?,
           status_updated_by_type = 2
           WHERE business_id = ?
           AND task_id = ?
          `, [order.task_status, agent_current_location[0].agent_id, order.business_id, order.task_id]);
            console.log("###########7");

            var task_status = yield db.queryAsync(
              `SELECT task_status_name
               FROM task_statuses
               WHERE id = ?
              `,[order.task_status]
            )
            console.log("###########8");
            var agent_status_val = yield db.queryAsync(
              `SELECT agent_id
               FROM tasks
               WHERE task_status IN (5,6,7)
               AND agent_id = ?`,[agent_current_location[0].agent_id]
            )
            console.log("###########9");
            console.log("SOme problem here+++++++++",agent_status_val, agent_current_location[0].agent_id);

            if(agent_status_val.length > 0){
              var agent_status_res = 2
            }else{
              var agent_status_res = 1
            }

            if (tasks.affectedRows > 0) {
                var values1 = [];
                var identification_key = 5;
                var notification_text = "Task status for task id:" + order.task_id + " changed to " + task_status[0].task_status_name+".";
                var manager_ids = yield db.queryAsync(
                    `SELECT DISTINCT n.user_id as manager_id
             FROM runs r
             LEFT JOIN tasks t ON t.run_id = r.run_id
             LEFT JOIN notifications n ON r.run_id = n.run_id
             WHERE t.task_id = ?
             AND user_type = ?
             AND r.business_id = ?`, [order.task_id, 1, order.business_id])

                var team_id = yield db.queryAsync(
                    `SELECT r.team_id,
                    r.run_id,
                    r.order_id
             FROM runs r
             LEFT JOIN tasks t ON t.run_id = r.run_id
             WHERE t.task_id = ?
             AND r.business_id = ?`, [order.task_id, order.business_id])

                var manager_details = yield db.queryAsync(
                    `SELECT  atmat.manager_id,
                  m.manager_full_name,
                  m.manager_email,
                  m.manager_phone_number
          FROM agent_to_manager_and_team atmat
          LEFT JOIN managers m ON m.manager_id = atmat.manager_id
          WHERE atmat.team_id = ?
          AND atmat.business_id = ? GROUP BY atmat.manager_id`, [team_id[0].team_id, order.business_id])

                var customer_details = yield db.queryAsync(
                    `SELECT  t.customer_name,
                   t.customer_email,
                   t.customer_phone_number,
                   t.customer_country_code,
                   t.address,
                   t.duration,
                   t.local_date_time,
                   tt.task_type_name,
                   t.customer_link,
                   CONCAT(a.agent_first_name,' ',a.agent_last_name) as agent_name,
                   a.agent_phone_number,
                   bd.business_phone,
                   bd.business_name
                   FROM tasks t LEFT JOIN business_details bd ON t.business_id = bd.business_id
                   LEFT JOIN agents a on a.agent_id = t.agent_id
                   LEFT JOIN task_types_to_business tt on tt.task_type_id = t.task_type_id
           WHERE t.task_id = ?
           AND t.business_id = ?`, [order.task_id, order.business_id]);

                var super_manager_ids = yield db.queryAsync(
                    `SELECT manager_id
            FROM managers
            WHERE manager_type = ?
            AND business_id = ?`, [1, order.business_id])

                if (manager_ids[0].manager_id == null) {
                    manager_ids = super_manager_ids
                } else {
                    manager_ids = super_manager_ids.concat(manager_ids);
                }
                var managers = []
                for (var i = 0; i < manager_ids.length; i++) {
                    managers.push(manager_ids[i].manager_id);
                }
                manager_ids = _.uniq(managers)

                var manager_id_with_unique_id = [];

                for (var i = 0; i < manager_ids.length; i++) {
                    var hash = bcrypt.hashSync("hash", 3);
                    values1.push([order.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, order.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
                    manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
                }

                var data = {
                    manager_id: manager_id_with_unique_id,
                    task_id: order.task_id,
                    task_status: order.task_status,
                    text: notification_text,
                    agent_status: agent_status_res,
                    agent_id: agent_current_location[0].agent_id

                }
                yield bayeux.faye_push(order.business_id, identification_key, data);

                var android_manager_device_tokens = yield db.queryAsync(
                  `SELECT device_id
                    FROM login_device_details
                    WHERE user_id IN(?)
                    AND user_type = 1
                    AND device_type = 1
                    AND app_type = 1
                  `,[manager_ids]
                )

                var device_token = [];//device_tokens
                for(var i = 0; i < android_manager_device_tokens.length; i++){
                  device_token.push(android_manager_device_tokens[i].device_id)
                }
                //console.log("device pushes", device_token);
                var text = notification_text;
                var pushFlag = 2;
                var order_id = team_id[0].order_id;
                var run_id = team_id[0].run_id;
                var task_id = order.task_id;
                var notification_id = manager_id_with_unique_id;

                yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

                var manager_notifications = yield db.queryAsync(
                    `INSERT INTO notifications(
              business_id,
              notification_type,
              device_type,
              app_type,
              notification_content,
              status,
              order_id,
              run_id,
              task_id,
              user_id,
              user_type,
              team_id,
              unique_id
            )
            VALUES ?
          `, [values1]
                )

                let notData = yield db.queryAsync('SELECT nc.content,nc.email_subject,noc.email,noc.sms,nc.trigger_type from notification_content nc ' +
                    'JOIN notification_configurations noc On nc.business_id = noc.business_id and nc.trigger_id= noc.trigger_id ' +
                    'where nc.business_id = ? and nc.trigger_id=? ' +
                    'order by nc.trigger_type DESC', [order.business_id, triggerStatus]);

                if (notData.length) {
                    let start_date_task = moment(customer_details[0].local_date_time).format('DD MMMM YYYY');
                    let start_time_task = moment(customer_details[0].local_date_time).format('hh:mm a');
                    let end_time_task = moment(customer_details[0].local_date_time).add(customer_details[0].duration, 'm').format('hh:mm a');
                    let end_date_task = moment(customer_details[0].local_date_time).add(customer_details[0].duration, 'm').format('DD MMMM YYYY');
                    if (notData[0].email === 1) {
                        yield sendEmailToUser(
                            "ORDER",
                            {
                                customer_name: customer_details[0].customer_name,
                                customer_number: customer_details[0].customer_phone_number,
                                customer_email: customer_details[0].customer_email,
                                task_type: customer_details[0].task_type_name,
                                task_id: order.task_id,
                                link: customer_details[0].customer_link,
                                start_date_task: start_date_task,
                                start_time_task: start_time_task,
                                end_time_task: end_time_task,
                                agent_name: customer_details[0].agent_name,
                                link:  "http://18.221.158.62/qengine_customer_panel/#/page/login?task_id="+customer_details[0].customer_link,
                                business_name: customer_details[0].business_name,
                                customer_address: customer_details[0].address,
                                business_number: customer_details[0].business_phone,
                                agent_number: customer_details[0].agent_phone_number,
                                end_date_task: end_date_task
                            },
                            customer_details[0].customer_email,
                            "support@azuratech.in",
                            notData[0],
                            "Order received");
                    }
                    //console.log("dsdsdsa", notData[1])
                    if (notData[1] && notData[0].sms === 1) {
                        yield CommonFunction.send_order_sms(
                            customer_details[0].customer_country_code + customer_details[0].customer_phone_number,
                            notData[1],
                            {
                                customer_name: customer_details[0].customer_name,
                                customer_number: customer_details[0].customer_phone_number,
                                customer_email: customer_details[0].customer_email,
                                task_type: customer_details[0].task_type_name,
                                task_id: order.task_id,
                                start_date_task: start_date_task,
                                start_time_task: start_time_task,
                                end_time_task: end_time_task,
                                agent_name: customer_details[0].agent_name,
                                link:  "http://18.221.158.62/qengine_customer_panel/#/page/login?task_id="+customer_details[0].customer_link,
                                business_name: customer_details[0].business_name,
                                customer_address: customer_details[0].address,
                                business_number: customer_details[0].business_phone,
                                agent_number: customer_details[0].agent_phone_number,
                                end_date_task: end_date_task
                            });
                    }

                }

                var retVal = {
                    message: "Task status updated succesfully",
                    task_id: order.task_id,
                    task_status: order.task_status
                }
                return retVal
            }
            else {
                return error('GenericError')
            }
        }
    }

    * get_map_agents(agent) {

        var device_type = yield db.queryAsync(`
        SELECT *
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id]);

        var agents = yield db.queryAsync(
            `SELECT a.agent_id,
                IF((SELECT SUM(DISTINCT(task_id)) FROM tasks WHERE agent_id = a.agent_id AND task_status IN (5,6,7)) > 1, 2, a.work_status) AS work_status,
                CONCAT(a.agent_first_name,' ', a.agent_last_name) AS agent_name,
                a.agent_phone_number,
                a.agent_email,
                a.last_updated_location_time,
                (SELECT COUNT(DISTINCT(task_id)) FROM tasks WHERE agent_id = a.agent_id AND DATE(date_time) = ?) AS task_count ,
                a.last_updated_lat,
                a.last_updated_long
          FROM agents a
          WHERE a.business_id = ?
          AND a.status != ?
          GROUP BY a.agent_id
          ORDER BY a.agent_first_name`, [agent.date, agent.business_id, 2]
        )
        if (device_type[0].device_type != 3) {
            var retVal = {
                status_code: 200,
                message: "All agents for the selected date",
                data: {agent: agents}
            }
        }
        else {
            var retVal = {
                agent: agents
            }
        }
        return retVal
    }

    * get_agent_orders(order) {
        if (order.limit === 0 && order.offset === 0) {
            var orders = yield db.queryAsync(
                `SELECT o.order_id,
                  o.order_status,
                  o.order_start_time,
                  o.local_date_time AS local_order_start_time,
                  m.manager_full_name,
                  m.manager_phone_number,
                  COUNT(DISTINCT(r.run_id)) AS runs_count,
                  COUNT(DISTINCT(t.task_id)) AS task_count,
                  (SELECT COUNT(task_status) FROM tasks WHERE order_id = o.order_id AND task_status = 8) AS completed_task_count,
                  r.multiple_tasks
            FROM orders o
            JOIN runs r ON r.order_id = o.order_id
            LEFT JOIN tasks t ON t.order_id = o.order_id
            LEFT JOIN managers m ON m.manager_id = o.created_by
            WHERE o.business_id = ?
            AND r.business_id = ?
            AND r.agent_id = ?
            AND o.status != ?
            AND ((r.order_type IN (2,3) AND t.task_status NOT IN (1)) OR (r.order_type IN (1,2,3) AND t.task_status > 2))
            GROUP BY o.order_id
            ORDER BY o.order_start_time
          `, [order.business_id, order.business_id, order.agent_id, 2]
            )
        } else {
            var orders = yield db.queryAsync(
                `SELECT o.order_id,
                  o.order_status,
                  o.order_start_time,
                  o.local_date_time AS local_order_start_time,
                  m.manager_full_name,
                  m.manager_phone_number,
                  COUNT(DISTINCT(r.run_id)) AS runs_count,
                  COUNT(DISTINCT(t.task_id)) AS task_count,
                  (SELECT COUNT(task_status) FROM tasks WHERE order_id = o.order_id AND task_status = 8) AS completed_task_count
            FROM orders o
            JOIN runs r ON r.order_id = o.order_id
            LEFT JOIN tasks t ON t.order_id = o.order_id
            LEFT JOIN managers m ON m.manager_id = o.created_by
            WHERE o.business_id = ?
            AND r.business_id = ?
            AND r.agent_id = ?
            AND o.status != ?
            GROUP BY o.order_id
            ORDER BY o.order_start_time
            LIMIT ?
            OFFSET ?
          `, [order.business_id, order.business_id, order.agent_id, 2, order.limit, order.offset]
            )
        }
        const orders_count = yield db.queryAsync(
            `SELECT COUNT(o.order_id) AS order_count
          FROM orders o
          JOIN runs r ON r.order_id = o.order_id
          WHERE o.business_id = ?
          AND r.agent_id = ?
          AND o.status != ?
        `, [order.business_id, order.agent_id, 2]
        )
        var retVal = {
            status_code: 200,
            message: "Fteched agent order",
            data: {
                orders: orders,
                count: orders_count[0].order_count
            }
        }
        return retVal
    }

    * get_agent_order_tasks(order) {
        var orders = yield db.queryAsync(
            `SELECT t.task_id,
                  t.run_id,
                  t.order_id,
                  t.date_time AS start_time,
                  t.date_time + INTERVAL t.duration MINUTE AS end_time,
                  t.task_type_id,
                  tttb.task_type_name,
                  t.task_status,
                  t.agent_id,
                  t.customer_id,
                  t.customer_name,
                  t.customer_phone_number,
                  t.dependant_on_tasks,
                  t.address,
                  t.task_lat,
                  t.task_long,
                  t.task_description,
                  t.document1,
                  t.document2,
                  t.document3,
                  t.document4,
                  t.document5,
                  t.task_signature,
                  t.template_group_id,
                  atmat.manager_id,
                  m.manager_full_name,
                  m.manager_phone_number,
                  t.local_date_time AS local_start_time,
                  t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
                  t.timezone,
                  t.dst_factor,
                  t.minutes_offset,
                  t.duration,
                  t.address_type,
                  t.date_time,
                  r.multiple_tasks
            FROM tasks t
            JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
            JOIN runs r ON r.run_id = t.run_id
            JOIN agent_to_manager_and_team atmat ON atmat.team_id = r.team_id
            JOIN managers m ON m.manager_id = atmat.manager_id
            WHERE t.business_id = ?
            AND t.order_id = ?
            AND t.status != ?
            AND atmat.agent_id = t.agent_id
            ORDER BY t.date_time
          `, [order.business_id, order.order_id, 2]
        )

        if (orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var dependants = orders[i].dependant_on_tasks.split(",")
                if ((dependants[0] == "0") || (dependants[0] === "")) {
                    orders[i].dependant_on_tasks = [];
                }
                else {
                    orders[i].dependant_on_tasks = dependants;
                }
            }
        }

        var retVal = {
            status_code: 200,
            message: "Feteched agent order tasks",
            data: {
                tasks: orders
            }
        }
        return retVal
    }

    * get_agent_order_details_via_order_id(order) {
        var orders = yield db.queryAsync(
            `SELECT t.order_id,
                t.created_at,
                t.run_id,
                t.task_id,
                tttb.task_type_name,
                t.task_type_id,
                t.date_time,
                t.duration,
                t.customer_id,
                t.customer_name,
                t.customer_phone_number,
                t.customer_email,
                t.address,
                t.address_type,
                t.task_description,
                t.task_sequence,
                t.dependant_on_tasks,
                t.task_status,
                t.customer_country_code,
                t.document1,
                t.document2,
                t.document3,
                t.document4,
                t.document5,
                t.task_lat,
                t.task_long,
                t.agent_id,
                t.task_signature,
                CONCAT(a.agent_first_name, ' ', a.agent_last_name) AS agent_name,
                a.agent_email,
                a.agent_phone_number,
                a.employee_code,
                t.template_group_id,
                tg.template_group_name,
                t.local_date_time AS local_order_start_time,
                t.timezone,
                t.dst_factor,
                t.minutes_offset,
                t.duration,
                t.address_type,
                t.date_time,
                r.multiple_tasks
          FROM tasks t
          LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
          LEFT JOIN runs r ON r.run_id = t.run_id
          LEFT JOIN agents a ON a.agent_id = t.agent_id
          LEFT JOIN template_group tg ON tg.template_group_id = t.template_group_id
          WHERE t.business_id = ?
          AND t.order_id = ?
          AND t.status != ?
          ORDER BY t.date_time;
        `, [order.business_id, order.order_id, 2]
        )

        if (orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var dependants = orders[i].dependant_on_tasks.split(",")
                if ((dependants[0] == "0") || (dependants[0] === "")) {
                    orders[i].dependant_on_tasks = [];
                }
                else {
                    orders[i].dependant_on_tasks = dependants;
                }
            }
        }

        var retVal = {
            status_code: 200,
            message: "Fteched order details",
            data: {
                orders: orders
            }
        }
        return retVal
    }

    * get_datewise_tasks(order){
      if(order.sort_type === 1){
        var orders = yield db.queryAsync(
          `SELECT DISTINCT t.task_id,
                  t.run_id,
                  t.order_id,
                  t.date_time AS start_time,
                  t.date_time + INTERVAL t.duration MINUTE AS end_time,
                  t.task_type_id,
                  tttb.task_type_name,
                  t.task_status,
                  t.agent_id,
                  CONCAT(a.agent_first_name, ' ', a.agent_last_name) AS agent_name,
                  a.work_status,
                  t.customer_id,
                  t.customer_name,
                  t.customer_phone_number,
                  t.dependant_on_tasks,
                  t.address,
                  t.task_lat,
                  t.task_long,
                  t.task_description,
                  t.document1,
                  t.document2,
                  t.document3,
                  t.document4,
                  t.document5,
                  t.task_signature,
                  t.template_group_id,
                  atmat.manager_id,
                  m.manager_full_name,
                  m.manager_phone_number,
                  t.local_date_time AS local_start_time,
                  t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
                  t.timezone,
                  t.dst_factor,
                  t.minutes_offset,
                  t.duration,
                  t.address_type,
                  t.date_time,
                  r.multiple_tasks,
                  111.111
                  * DEGREES(ACOS(COS(RADIANS(a.last_updated_lat))
                  * COS(RADIANS(t.task_lat))
                  * COS(RADIANS(a.last_updated_long - t.task_long))
                  + SIN(RADIANS(a.last_updated_lat))
                  * SIN(RADIANS(t.task_lat)))) AS distance_in_km
            FROM tasks t
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
            LEFT JOIN agents a ON a.agent_id = t.agent_id
            LEFT JOIN runs r ON r.run_id = t.run_id
            LEFT JOIN agent_to_manager_and_team atmat ON atmat.agent_id = r.team_id
            LEFT JOIN managers m ON m.manager_id = atmat.manager_id
            WHERE t.business_id = ?
            AND t.agent_id = ?
            AND ((r.order_type IN (2,3) AND t.task_status NOT IN (1)) OR (r.order_type IN (1,2,3) AND t.task_status > 2))
            AND t.date_time BETWEEN ? - INTERVAL ? MINUTE AND ? - INTERVAL ? MINUTE
            AND t.status != ?
            ORDER BY distance_in_km
          `,[order.business_id,order.agent_id, order.from_date, order.timezone_minutes, order.to_date, order.timezone_minutes, 2]
        )
      }else if(order.sort_type === 2){
        var orders = yield db.queryAsync(
          `SELECT DISTINCT t.task_id,
                  t.run_id,
                  t.order_id,
                  t.date_time AS start_time,
                  t.date_time + INTERVAL t.duration MINUTE AS end_time,
                  t.task_type_id,
                  tttb.task_type_name,
                  t.task_status,
                  t.agent_id,
                  CONCAT(a.agent_first_name, ' ', a.agent_last_name) AS agent_name,
                  a.work_status,
                  t.customer_id,
                  t.customer_name,
                  t.customer_phone_number,
                  t.dependant_on_tasks,
                  t.address,
                  t.task_lat,
                  t.task_long,
                  t.task_description,
                  t.document1,
                  t.document2,
                  t.document3,
                  t.document4,
                  t.document5,
                  t.task_signature,
                  t.template_group_id,
                  atmat.manager_id,
                  m.manager_full_name,
                  m.manager_phone_number,
                  t.local_date_time AS local_start_time,
                  t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
                  t.timezone,
                  t.dst_factor,
                  t.minutes_offset,
                  t.duration,
                  t.address_type,
                  t.date_time,
                  r.multiple_tasks,
                  111.111
                  * DEGREES(ACOS(COS(RADIANS(a.last_updated_lat))
                  * COS(RADIANS(t.task_lat))
                  * COS(RADIANS(a.last_updated_long - t.task_long))
                  + SIN(RADIANS(a.last_updated_lat))
                  * SIN(RADIANS(t.task_lat)))) AS distance_in_km
            FROM tasks t
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
            LEFT JOIN agents a ON a.agent_id = t.agent_id
            LEFT JOIN runs r ON r.run_id = t.run_id
            LEFT JOIN agent_to_manager_and_team atmat ON atmat.agent_id = r.team_id
            LEFT JOIN managers m ON m.manager_id = atmat.manager_id
            WHERE t.business_id = ?
            AND t.agent_id = ?
            AND ((r.order_type IN (2,3) AND t.task_status NOT IN (1)) OR (r.order_type IN (1,2,3) AND t.task_status > 2))
            AND t.date_time BETWEEN ? - INTERVAL ? MINUTE AND ? - INTERVAL ? MINUTE
            AND t.status != ?
            ORDER BY t.date_time
          `,[order.business_id,order.agent_id, order.from_date, order.timezone_minutes, order.to_date, order.timezone_minutes, 2]
        )
      }else{
        var orders = yield db.queryAsync(
          `SELECT DISTINCT t.task_id,
                  t.run_id,
                  t.order_id,
                  t.date_time AS start_time,
                  t.date_time + INTERVAL t.duration MINUTE AS end_time,
                  t.task_type_id,
                  tttb.task_type_name,
                  t.task_status,
                  t.agent_id,
                  CONCAT(a.agent_first_name, ' ', a.agent_last_name) AS agent_name,
                  a.work_status,
                  t.customer_id,
                  t.customer_name,
                  t.customer_phone_number,
                  t.dependant_on_tasks,
                  t.address,
                  t.task_lat,
                  t.task_long,
                  t.task_description,
                  t.document1,
                  t.document2,
                  t.document3,
                  t.document4,
                  t.document5,
                  t.task_signature,
                  t.template_group_id,
                  t.created_at,
                  atmat.manager_id,
                  m.manager_full_name,
                  m.manager_phone_number,
                  t.local_date_time AS local_start_time,
                  t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
                  t.timezone,
                  t.dst_factor,
                  t.minutes_offset,
                  t.duration,
                  t.address_type,
                  t.date_time,
                  r.multiple_tasks,
                  111.111
                  * DEGREES(ACOS(COS(RADIANS(a.last_updated_lat))
                  * COS(RADIANS(t.task_lat))
                  * COS(RADIANS(a.last_updated_long - t.task_long))
                  + SIN(RADIANS(a.last_updated_lat))
                  * SIN(RADIANS(t.task_lat)))) AS distance_in_km
            FROM tasks t
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
            LEFT JOIN agents a ON a.agent_id = t.agent_id
            LEFT JOIN runs r ON r.run_id = t.run_id
            LEFT JOIN agent_to_manager_and_team atmat ON atmat.agent_id = r.team_id
            LEFT JOIN managers m ON m.manager_id = atmat.manager_id
            WHERE t.business_id = ?
            AND t.agent_id = ?
            AND ((r.order_type IN (2,3) AND t.task_status NOT IN (1)) OR (r.order_type IN (1,2,3) AND t.task_status > 2))
            AND t.date_time BETWEEN ? - INTERVAL ? MINUTE AND ? - INTERVAL ? MINUTE
            AND t.status != ?
            ORDER BY t.created_at
          `,[order.business_id,order.agent_id, order.from_date, order.timezone_minutes, order.to_date, order.timezone_minutes, 2]
        )
      }

        if (orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var dependants = orders[i].dependant_on_tasks.split(",")
                if ((dependants[0] == "0") || (dependants[0] === "")) {
                    orders[i].dependant_on_tasks = [];
                }
                else {
                    orders[i].dependant_on_tasks = dependants;
                }
            }
        }

        var retVal = {
            status_code: 200,
            message: "Fteched datewise tasks",
            data: {
                orders: orders
            }
        }
        return retVal
    }

    * get_monthly_tasks(order){
      var orders = yield db.queryAsync(
        `SELECT COUNT(DISTINCT t.task_id) AS task_count,
                DATE(t.date_time) AS date,
                SUM(IF(t.task_status IN(8,9,10,11), 1, 0)) AS completed_task_count
        FROM tasks t
        LEFT JOIN runs r ON r.run_id = t.run_id
        WHERE date_time BETWEEN ? - INTERVAL ? MINUTE AND ? - INTERVAL ? MINUTE
        AND ((r.order_type IN (2,3) AND t.task_status NOT IN (1)) OR (r.order_type IN (1,2,3) AND t.task_status > 2))
        AND t.agent_id = ?
        AND t.business_id = ?
        GROUP BY date
        `, [order.from_date, order.timezone_minutes, order.to_date, order.timezone_minutes, order.agent_id, order.business_id]
        )

        var retVal = {
            status_code: 200,
            message: "Fteched Monthly tasks",
            data: {
                task_dates: orders
            }
        }
        return retVal
    }

    * get_completed_task_count(order) {
        var orders = yield db.queryAsync(
            `SELECT COUNT(task_status) AS completed_task_count,
                DATE(date_time) AS date
        FROM tasks
        WHERE date_time BETWEEN ? - INTERVAL ? MINUTE AND ? - INTERVAL ? MINUTE
        AND agent_id = ?
        AND task_status IN(8,9,10,11)
        AND business_id = ?
        GROUP BY date
        `, [order.from_date, order.timezone_minutes, order.to_date, order.timezone_minutes, order.agent_id, order.business_id]
        )

        var retVal = {
            status_code: 200,
            message: "Fteched completed task count",
            data: {
                completed_tasks: orders
            }
        }
        return retVal
    }

    * create_note_to_task(note) {

        const agent_id = yield db.queryAsync(`
        SELECT ldd.user_id,
                a.agent_first_name
        FROM login_device_details ldd
        LEFT JOIN agents a ON a.agent_id = ldd.user_id
        WHERE ldd.access_token = ?
        AND ldd.business_id = ?
        `, [note.access_token, note.business_id])

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
        `, [note.business_id, note.task_id, note.note_name, note.content, agent_id[0].user_id, agent_id[0].user_id, 2, 2, 1]);

        var manager_ids = yield db.queryAsync(
            `SELECT DISTINCT n.user_id as manager_id
         FROM runs r
         LEFT JOIN tasks t ON t.run_id = r.run_id
         LEFT JOIN notifications n ON r.run_id = n.run_id
         WHERE t.task_id = ?
         AND user_type = ?
         AND r.business_id = ?`, [note.task_id, 1, note.business_id])

        var team_id = yield db.queryAsync(
            `SELECT r.team_id,
               r.run_id,
               r.order_id
        FROM runs r
        LEFT JOIN tasks t ON t.run_id = r.run_id
        WHERE t.task_id = ?
        AND r.business_id = ?`, [note.task_id, note.business_id])

        var super_manager_ids = yield db.queryAsync(
            `SELECT manager_id
        FROM managers
        WHERE manager_type = ?
        AND business_id = ?`, [1, note.business_id])
        if (manager_ids[0].manager_id == null) {
            manager_ids = super_manager_ids
        } else {
            manager_ids = super_manager_ids.concat(manager_ids);
        }
        var managers = []
        for (var i = 0; i < manager_ids.length; i++) {
            managers.push(manager_ids[i].manager_id);
        }
        manager_ids = _.uniq(managers)
        //console.log("returning manager ids", manager_ids);

        var values1 = [];

        var identification_key = 9

        var notification_text = "Note for task id:" + note.task_id + " has been added by "+agent_id[0].agent_first_name+".";

        var manager_id_with_unique_id = [];

        for (var i = 0; i < manager_ids.length; i++) {
            var hash = bcrypt.hashSync("hash", 3);
            values1.push([note.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, note.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
            manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
        }

        var data = {
            manager_id: manager_id_with_unique_id,
            text: notification_text,
            task_id: note.task_id
        }

        var manager_notifications = yield db.queryAsync(
            `INSERT INTO notifications(
            business_id,
            notification_type,
            device_type,
            app_type,
            notification_content,
            status,
            order_id,
            run_id,
            task_id,
            user_id,
            user_type,
            team_id,
            unique_id
          )
          VALUES ?
        `, [values1]
        )

        yield bayeux.faye_push(note.business_id, identification_key, data);

        var android_manager_device_tokens = yield db.queryAsync(
          `SELECT device_id
            FROM login_device_details
            WHERE user_id IN(?)
            AND user_type = 1
            AND device_type = 1
            AND app_type = 1
          `,[manager_ids]
        )

        var device_token = [];//device_tokens
        for(var i = 0; i < android_manager_device_tokens.length; i++){
          device_token.push(android_manager_device_tokens[i].device_id)
        }
        //console.log("device pushes", device_token);
        var text = notification_text;
        var pushFlag = 2;
        var order_id = team_id[0].order_id;
        var run_id = team_id[0].run_id;
        var task_id = note.task_id;
        var notification_id = manager_id_with_unique_id;

        yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

        var retVal = {
            status_code: 200,
            message: "Note created",
            data: {
                note_id: notes.insertId,
                note_name: note.note_name,
                task_id: note.task_id,
                content: note.content
            }
        }
        return retVal
    }

    * edit_note_to_task(note) {
        const agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [note.access_token, note.business_id])

        const notes = yield db.queryAsync(`
        UPDATE notes_to_tasks
        SET note_name = ?,
            content = ?,
            updated_by = ?,
            updated_by_user_type = ?
        WHERE note_id = ?
        AND task_id = ?
        `, [note.note_name, note.content, agent_id[0].user_id, 2, note.note_id, note.task_id,])

        var retVal = {
            status_code: 200,
            message: "Note edited successfully",
            data: {
                note_id: note.note_id,
                note_name: note.note_name,
                task_id: note.task_id,
                content: note.content
            }
        }
        return retVal
    }

    * edit_template_to_task(agent) {
        const agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id])

        const template_fields = yield db.queryAsync(`
        UPDATE templates_to_tasks
        SET value = ?
        WHERE template_id = ?
        AND task_id = ?
        AND business_id = ?
        `, [agent.value, agent.template_id, agent.task_id, agent.business_id])

        var retVal = {
            status_code: 200,
            message: "Template edited successfully",
            data: {}
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

    * delete_note_of_task(note) {
        const agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [note.access_token, note.business_id])

        const notes = yield db.queryAsync(`
        UPDATE notes_to_tasks
        SET status = ?
        WHERE note_id = ?
        AND task_id = ?
        `, [note.status, note.note_id, note.task_id])

        var retVal = {
            status_code: 200,
            message: "Deleted successfully",
            data: {
                note_id: note.note_id,
                task_id: note.task_id
            }
        }
        return retVal
    }

    * logout_agent(agent) {

      var agent_details = yield db.queryAsync(`
        SELECT a.*
        FROM agents a
        LEFT JOIN login_device_details ldd ON a.agent_id = ldd.user_id
        WHERE ldd.access_token = ?
        AND a.business_id = ?
        `, [agent.access_token, agent.business_id])


      var logout_agent_android = yield db.queryAsync(`
        UPDATE login_device_details
        SET access_token = ?,
            device_id = ?
        WHERE access_token = ?
        AND business_id = ?
        `,["Logged out", "Logged out", agent.access_token, agent.business_id])

      var logout_agent_status = yield db.queryAsync(`
        UPDATE agents
        SET work_status = ?
        WHERE agent_id = ?
        AND business_id = ?
        `,[ 3, agent_details[0].agent_id, agent.business_id])

        //console.log("All queries executed", agent_details, logout_agent_android, logout_agent_status);

        var identification_key = 4;
        var text = "Agent "+agent_details[0].agent_first_name+" "+agent_details[0].agent_last_name+"(" + agent_details[0].agent_id + ") changed status to Logout.";
        var data = {
            agent_id: agent_details[0].agent_id,
            agent_status: 3,
            text: text
        }
        yield bayeux.faye_push(agent.business_id, identification_key, data);

        var retVal = {
            status_code: 200,
            message: "Agent logged out successfully",
            data: {}
        }
        return retVal
    }

    * change_password_agent(agent) {
        var hash = bcrypt.hashSync(agent.new_password, 10);

        var agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id])

        var agent_password = yield db.queryAsync(`
        SELECT *
        FROM agents
        WHERE agent_id = ?
        AND business_id = ?
        `, [agent_id[0].user_id, agent.business_id])

        if ((agent_password[0].password != undefined) && (bcrypt.compareSync(agent.old_password, agent_password[0].password)) === true) {

            const logout_agent = yield db.queryAsync(`
          UPDATE agents
          SET password = ?
          WHERE agent_id = ?
          AND business_id = ?
          `, [hash, agent_id[0].user_id, agent.business_id])

           yield sendEmailToUser("CONFIGURABLE_MAIL", {content: 'Dear '+agent_password[0].agent_first_name+' <br><br>,\n\nThis is to notify you that the password for Agent App, has been successfully changed to '+agent.new_password+'\n\n <br><br> Note: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com'}, agent_password[0].agent_email, "support@azuratech.in", "Password Reset Mail", "Password Reset Mail");

            let content='Dear '+agent_password[0].agent_first_name+',\n\nThis is to notify you that the password for Agent App, has been successfully changed to '+agent.new_password+'\n\nNote: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com';
            yield CommonFunction.send_sms_plivo(agent_password[0].country_code+agent_password[0].agent_phone_number, content);

            var retVal = {
                status_code: 200,
                message: "Agent password has been changed",
                data: {}
            }
            return retVal
        } else {
            error('InvalidCurrentPassword')
        }
    }

    * change_password_agent_by_manager(agent) {
        var hash = bcrypt.hashSync(agent.new_password, 10);

        var agent_password = yield db.queryAsync(`
        SELECT *
        FROM agents
        WHERE agent_id = ?
        AND business_id = ?
        `, [agent.agent_id, agent.business_id])

        const logout_agent = yield db.queryAsync(`
          UPDATE agents
          SET password = ?
          WHERE agent_id = ?
          AND business_id = ?
          `, [hash, agent.agent_id, agent.business_id]);

        yield sendEmailToUser("CONFIGURABLE_MAIL", {content: 'Dear '+agent_password[0].agent_first_name+',\n\nThis is to notify you that the password for Agent App, has been successfully changed to '+agent.new_password+'\n\nNote: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com'}, agent_password[0].agent_email, "support@azuratech.in", "Password Reset Mail", "Password Reset Mail");

        let content='Dear '+agent_password[0].agent_first_name+',\n\nThis is to notify you that the password for Agent App, has been successfully changed to '+agent.new_password+'\n\nNote: If you did not request a password reset, or are having any trouble logging in, please let contact us  at support@qengine.com';
        yield CommonFunction.send_sms_plivo(agent_password[0].country_code+agent_password[0].agent_phone_number, content);

        var retVal = {
            status_code: 200,
            message: "Agent password has been changed",
            data: {}
        }
        return retVal
    }

    * forgot_password_agent(agent) {
        var hash = bcrypt.hashSync(agent.email, 10);

        var agent_id = yield db.queryAsync(`
        SELECT *
        FROM agents
        WHERE agent_email = ?
        `, [agent.email])

        if (agent_id.length > 0) {
          tinyurl.shorten('http://18.221.158.62/qengine_company_panel/#/page/Reset_Password?token='+hash, function(res) {
            console.log(res); //Returns a shorter version of http://google.com - http://tinyurl.com/2tx
             sendEmailToUser(
                "FORGOT_PASSWORD", {manager_name:agent_id[0].agent_first_name,link:res}, agent_id[0].email, "support@azuratech.in", "Password Reset Link", "Password Reset Mail");
             CommonFunction.send_sms_plivo(agent_id[0].country_code+agent_id[0].agent_phone_number,
                "Hi "+agent_id[0].agent_first_name+",\n" +
                "We get it, you forgot your password. It happens to the best of us. We feel your pain.\n" +
                "Click here to make up a new password and get back to managing:"+res+"\n" +
                "Have a great \n" +
                "Regards,\n" +
                "Q-Engine Team");
            var retVal = {
                message: "An email has been sent to the provided email id with the reset link"
            }
            return retVal
          });


        } else {
            error('AccountNotFound')
        }
    }

    * upload_agent_profile_pic(agent) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = agent.file.path.split('/');

        agent.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);

        var image_update = yield db.queryAsync(`
        UPDATE agents
          SET agent_profile_picture = ?
          WHERE business_id = ?
          AND agent_id = ?
        `, [return_path + agent.file.name, agent.business_id, agent.agent_id]);
        var retVal = {
            status_code: 200,
            message: "Image uploaded successfully",
            data: {
                path: return_path + agent.file.name
            }
        }
        return retVal
    }

    * upload_task_file(agent) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = agent.file.path.split('/');

        agent.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);

        var retVal = {
            status_code: 200,
            message: "File uploaded successfully",
            data: {
                path: return_path + agent.file.name
            }
        }
        return retVal
    }

    * upload_signature_agent_task(agent) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/";

        var file_name_array = agent.file.path.split('/');

        agent.file.name = file_name_array[file_name_array.length - 1];

        var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);

        var image_update = yield db.queryAsync(`
        UPDATE tasks
          SET task_signature = ?
          WHERE business_id = ?
          AND task_id = ?
        `, [return_path + agent.file.name, agent.business_id, agent.task_id]);

        var manager_ids = yield db.queryAsync(
            `SELECT DISTINCT n.user_id as manager_id
         FROM runs r
         LEFT JOIN tasks t ON t.run_id = r.run_id
         LEFT JOIN notifications n ON r.run_id = n.run_id
         WHERE t.task_id = ?
         AND user_type = ?
         AND r.business_id = ?`, [agent.task_id, 1, agent.business_id])

        var team_id = yield db.queryAsync(
            `SELECT r.team_id,
               r.run_id,
               r.order_id
        FROM runs r
        LEFT JOIN tasks t ON t.run_id = r.run_id
        WHERE t.task_id = ?
        AND r.business_id = ?`, [agent.task_id, agent.business_id])

        var super_manager_ids = yield db.queryAsync(
            `SELECT manager_id
        FROM managers
        WHERE manager_type = ?
        AND business_id = ?`, [1, agent.business_id])
        if (manager_ids[0].manager_id == null) {
            manager_ids = super_manager_ids
        } else {
            manager_ids = super_manager_ids.concat(manager_ids);
        }
        var managers = []
        for (var i = 0; i < manager_ids.length; i++) {
            managers.push(manager_ids[i].manager_id);
        }
        manager_ids = _.uniq(managers)
        //console.log("returning manager ids", manager_ids);

        var values1 = [];

        var identification_key = 9

        var notification_text = "Signature of task id:" + agent.task_id + " has been uploaded.";

        var manager_id_with_unique_id = [];

        for (var i = 0; i < manager_ids.length; i++) {
            var hash = bcrypt.hashSync("hash", 3);
            values1.push([agent.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, agent.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
            manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
        }

        var data = {
            manager_id: manager_id_with_unique_id,
            text: notification_text,
            task_id: agent.task_id
        }

        var manager_notifications = yield db.queryAsync(
            `INSERT INTO notifications(
            business_id,
            notification_type,
            device_type,
            app_type,
            notification_content,
            status,
            order_id,
            run_id,
            task_id,
            user_id,
            user_type,
            team_id,
            unique_id
          )
          VALUES ?
        `, [values1]
        )

        yield bayeux.faye_push(agent.business_id, identification_key, data);

        var android_manager_device_tokens = yield db.queryAsync(
          `SELECT device_id
            FROM login_device_details
            WHERE user_id IN(?)
            AND user_type = 1
            AND device_type = 1
            AND app_type = 1
          `,[manager_ids]
        )

        var device_token = [];//device_tokens
        for(var i = 0; i < android_manager_device_tokens.length; i++){
          device_token.push(android_manager_device_tokens[i].device_id)
        }
        //console.log("device pushes", device_token);
        var text = notification_text;
        var pushFlag = 2;
        var order_id = team_id[0].order_id;
        var run_id = team_id[0].run_id;
        var task_id = agent.task_id;
        var notification_id = manager_id_with_unique_id;

        yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

        var retVal = {
            status_code: 200,
            message: "File uploaded successfully",
            data: {
                path: return_path + agent.file.name
            }
        }
        return retVal
    }

    * delete_signature_agent_task(agent) {

        var image_update = yield db.queryAsync(`
        UPDATE tasks
          SET task_signature = ?
          WHERE business_id = ?
          AND task_id = ?
        `, ['NULL', agent.business_id, agent.task_id]);

        var manager_ids = yield db.queryAsync(
            `SELECT DISTINCT n.user_id as manager_id
         FROM runs r
         LEFT JOIN tasks t ON t.run_id = r.run_id
         LEFT JOIN notifications n ON r.run_id = n.run_id
         WHERE t.task_id = ?
         AND user_type = ?
         AND r.business_id = ?`, [agent.task_id, 1, agent.business_id])

        var team_id = yield db.queryAsync(
            `SELECT r.team_id,
                r.run_id,
                r.order_id
         FROM runs r
         LEFT JOIN tasks t ON t.run_id = r.run_id
         WHERE t.task_id = ?
         AND r.business_id = ?`, [agent.task_id, agent.business_id])

        var super_manager_ids = yield db.queryAsync(
            `SELECT manager_id
        FROM managers
        WHERE manager_type = ?
        AND business_id = ?`, [1, agent.business_id])

        if (manager_ids[0].manager_id == null) {
            manager_ids = super_manager_ids
        } else {
            manager_ids = super_manager_ids.concat(manager_ids);
        }
        var managers = []
        for (var i = 0; i < manager_ids.length; i++) {
            managers.push(manager_ids[i].manager_id);
        }
        manager_ids = _.uniq(managers)
        //console.log("returning manager ids", manager_ids);

        var identification_key = 8

        var notification_text = "Signature of task id:" + agent.task_id + " has been deleted.";

        var values1 = [];

        var manager_id_with_unique_id = [];

        for (var i = 0; i < manager_ids.length; i++) {
            var hash = bcrypt.hashSync("hash", 3);
            values1.push([agent.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, agent.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
            manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
        }

        var data = {
            manager_id: manager_id_with_unique_id,
            text: notification_text,
            task_id: agent.task_id
        }


        var manager_notifications = yield db.queryAsync(
            `INSERT INTO notifications(
            business_id,
            notification_type,
            device_type,
            app_type,
            notification_content,
            status,
            order_id,
            run_id,
            task_id,
            user_id,
            user_type,
            team_id,
            unique_id
          )
          VALUES ?
        `, [values1]
        )

        yield bayeux.faye_push(agent.business_id, identification_key, data);

        var android_manager_device_tokens = yield db.queryAsync(
          `SELECT device_id
            FROM login_device_details
            WHERE user_id IN(?)
            AND user_type = 1
            AND device_type = 1
            AND app_type = 1
          `,[manager_ids]
        )

        var device_token = [];//device_tokens
        for(var i = 0; i < android_manager_device_tokens.length; i++){
          device_token.push(android_manager_device_tokens[i].device_id)
        }
        //console.log("device pushes", device_token);
        var text = notification_text;
        var pushFlag = 2;
        var order_id = team_id[0].order_id;
        var run_id = team_id[0].run_id;
        var task_id = agent.task_id;
        var notification_id = manager_id_with_unique_id;

        yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

        var retVal = {
            status_code: 200,
            message: "File deleted successfully",
            data: {}
        }
        return retVal
    }

    * upload_document_agent_task(agent) {
        var return_path = "https://s3.us-east-2.amazonaws.com/aztech-qengine/Qengine/"

        var file_name_array = agent.file.path.split('/');

        agent.file.name = file_name_array[file_name_array.length - 1];

        var upload_limit_check = yield db.queryAsync(
          `SELECT task_id
            FROM tasks
            WHERE task_id = ?
            AND document1 IS NOT NULL
            AND document2 IS NOT NULL
            AND document3 IS NOT NULL
            AND document4 IS NOT NULL
            AND document5 IS NOT NULL;
          `,[agent.task_id]
        );

        if(upload_limit_check.length > 0){
          console.log("The check for upload limit for documents", upload_limit_check);
          return error('UploadLimitExceeded');
        }

        if (agent.doc_number > 0) {
            if (agent.doc_number === '1') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document1 = ?,
                  doc_one_user_id = agent_id,
                  doc_one_user_type = 2,
                  doc_one_time = NOW()
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + agent.file.name, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === '2') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document2 = ?,
                  doc_two_user_id = agent_id,
                  doc_two_user_type = 2,
                  doc_two_time = NOW()
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + agent.file.name, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === '3') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document3 = ?,
                  doc_three_user_id = agent_id,
                  doc_three_user_type = 2,
                  doc_three_time = NOW()
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + agent.file.name, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === '4') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document4 = ?,
                  doc_four_user_id = agent_id,
                  doc_four_user_type = 2,
                  doc_four_time = NOW()
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + agent.file.name, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === '5') {
                var rtrns = yield CommonFunction.uploadImageToS3Bucket(agent.file);
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document5 = ?,
                  doc_five_user_id = agent_id,
                  doc_five_user_type = 2,
                  doc_five_time = NOW()
              WHERE business_id = ?
              AND task_id = ?
            `, [return_path + agent.file.name, agent.business_id, agent.task_id]);
            }

            var manager_ids = yield db.queryAsync(
                `SELECT DISTINCT n.user_id as manager_id
           FROM runs r
           LEFT JOIN tasks t ON t.run_id = r.run_id
           LEFT JOIN notifications n ON r.run_id = n.run_id
           WHERE t.task_id = ?
           AND user_type = ?
           AND r.business_id = ?`, [agent.task_id, 1, agent.business_id])

            var team_id = yield db.queryAsync(
                `SELECT r.team_id,
                 r.run_id,
                 r.order_id
          FROM runs r
          LEFT JOIN tasks t ON t.run_id = r.run_id
          WHERE t.task_id = ?
          AND r.business_id = ?`, [agent.task_id, agent.business_id])

            var super_manager_ids = yield db.queryAsync(
                `SELECT manager_id
          FROM managers
          WHERE manager_type = ?
          AND business_id = ?`, [1, agent.business_id])

            if (manager_ids.lenght > 0) {
                manager_ids = super_manager_ids
            } else {
                manager_ids = super_manager_ids.concat(manager_ids);
            }
            var managers = []
            for (var i = 0; i < manager_ids.length; i++) {
                managers.push(manager_ids[i].manager_id);
            }
            manager_ids = _.uniq(managers)

            var identification_key = 7

            var notification_text = "Document:" + agent.doc_number + "of task id:" + agent.task_id + " has been uploaded.";

            var values1 = [];

            var manager_id_with_unique_id = [];

            for (var i = 0; i < manager_ids.length; i++) {
                var hash = bcrypt.hashSync("hash", 3);
                values1.push([agent.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, agent.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
                manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
            }

            var data = {
                manager_id: manager_id_with_unique_id,
                text: notification_text,
                task_id: agent.task_id,
                document_number: agent.doc_number
            }

            var manager_notifications = yield db.queryAsync(
                `INSERT INTO notifications(
              business_id,
              notification_type,
              device_type,
              app_type,
              notification_content,
              status,
              order_id,
              run_id,
              task_id,
              user_id,
              user_type,
              team_id,
              unique_id
            )
            VALUES ?
          `, [values1]
            )

            yield bayeux.faye_push(agent.business_id, identification_key, data);

            var android_manager_device_tokens = yield db.queryAsync(
              `SELECT device_id
                FROM login_device_details
                WHERE user_id IN(?)
                AND user_type = 1
                AND device_type = 1
                AND app_type = 1
              `,[manager_ids]
            )

            var device_token = [];//device_tokens
            for(var i = 0; i < android_manager_device_tokens.length; i++){
              device_token.push(android_manager_device_tokens[i].device_id)
            }
            //console.log("device pushes", device_token);
            var text = notification_text;
            var pushFlag = 2;
            var order_id = team_id[0].order_id;
            var run_id = team_id[0].run_id;
            var task_id = agent.task_id;
            var notification_id = manager_id_with_unique_id;

            yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

            var retVal = {
                status_code: 200,
                message: "File uploaded successfully",
                data: {
                    path: return_path + agent.file.name,
                    doc_number: agent.doc_number
                }
            }
            return retVal
        }
        else {
            return error('GenericError')
        }
    }

    * delete_document_agent_task(agent) {

        if (agent.doc_number > 0) {
            if (agent.doc_number === 1) {
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document1 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [null, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === 2) {
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document2 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [null, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === 3) {
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document3 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [null, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === 4) {
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document4 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [null, agent.business_id, agent.task_id]);
            }
            if (agent.doc_number === 5) {
                var image_update = yield db.queryAsync(`
            UPDATE tasks
              SET document5 = ?
              WHERE business_id = ?
              AND task_id = ?
            `, [null, agent.business_id, agent.task_id]);
            }

            var manager_ids = yield db.queryAsync(
                `SELECT DISTINCT n.user_id as manager_id
           FROM runs r
           LEFT JOIN tasks t ON t.run_id = r.run_id
           LEFT JOIN notifications n ON r.run_id = n.run_id
           WHERE t.task_id = ?
           AND user_type = ?
           AND r.business_id = ?`, [agent.task_id, 1, agent.business_id])

            var team_id = yield db.queryAsync(
                `SELECT r.team_id,
                 r.run_id,
                 r.order_id
          FROM runs r
          LEFT JOIN tasks t ON t.run_id = r.run_id
          WHERE t.task_id = ?
          AND r.business_id = ?`, [agent.task_id, agent.business_id])

            var super_manager_ids = yield db.queryAsync(
                `SELECT manager_id
          FROM managers
          WHERE manager_type = ?
          AND business_id = ?`, [1, agent.business_id])

            if (manager_ids[0].manager_id == null) {
                manager_ids = super_manager_ids
            } else {
                manager_ids = super_manager_ids.concat(manager_ids);
            }
            var managers = []
            for (var i = 0; i < manager_ids.length; i++) {
                managers.push(manager_ids[i].manager_id);
            }
            manager_ids = _.uniq(managers)
            //console.log("returning manager ids", manager_ids);

            var identification_key = 6

            var notification_text = "Document:" + agent.doc_number + "of task id:" + agent.task_id + " has been deleted.";

            var values1 = [];

            var manager_id_with_unique_id = [];

            for (var i = 0; i < manager_ids.length; i++) {
                var hash = bcrypt.hashSync("hash", 3);
                values1.push([agent.business_id, 4, 3, 1, notification_text, 1, team_id[0].order_id, team_id[0].run_id, agent.task_id, manager_ids[i], 1, team_id[0].team_id, hash])
                manager_id_with_unique_id.push({manager_id: manager_ids[i], unique_id: hash});
            }

            var data = {
                manager_id: manager_id_with_unique_id,
                text: notification_text,
                task_id: agent.task_id,
                document_number: agent.doc_number
            }

            var manager_notifications = yield db.queryAsync(
                `INSERT INTO notifications(
              business_id,
              notification_type,
              device_type,
              app_type,
              notification_content,
              status,
              order_id,
              run_id,
              task_id,
              user_id,
              user_type,
              team_id,
              unique_id
            )
            VALUES ?
          `, [values1]
            )

            yield bayeux.faye_push(agent.business_id, identification_key, data);

            var android_manager_device_tokens = yield db.queryAsync(
              `SELECT device_id
                FROM login_device_details
                WHERE user_id IN(?)
                AND user_type = 1
                AND device_type = 1
                AND app_type = 1
              `,[manager_ids]
            )

            var device_token = [];//device_tokens
            for(var i = 0; i < android_manager_device_tokens.length; i++){
              device_token.push(android_manager_device_tokens[i].device_id)
            }
            //console.log("device pushes", device_token);
            var text = notification_text;
            var pushFlag = 2;
            var order_id = team_id[0].order_id;
            var run_id = team_id[0].run_id;
            var task_id = agent.task_id;
            var notification_id = manager_id_with_unique_id;

            yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

            var retVal = {
                status_code: 200,
                message: "File deleted successfully",
                data: {}
            }
            return retVal
        }
        else {
            return error('GenericError')
        }
    }

    * get_agent_task_details_via_task_id(agent) {

      var task_assigned_unassigned_check = yield db.queryAsync(
        `SELECT r.team_id
         FROM tasks t
         LEFT JOIN runs r ON r.run_id = t.run_id
         WHERE t.business_id = ?
         AND t.task_id = ?
        `,[agent.business_id, agent.task_id]);

      if(task_assigned_unassigned_check[0].team_id === 0){
        var tasks = yield db.queryAsync(
            `SELECT t.task_id,
              t.run_id,
              t.order_id,
              t.date_time AS start_time,
              t.date_time + INTERVAL t.duration MINUTE AS end_time,
              t.task_type_id,
              tttb.task_type_name,
              t.task_status,
              t.agent_id,
              t.customer_id,
              t.customer_name,
              t.customer_phone_number,
              t.dependant_on_tasks,
              t.address,
              t.task_lat,
              t.task_long,
              t.task_description,
              t.document1,
              t.document2,
              t.document3,
              t.document4,
              t.document5,
              t.task_signature,
              t.template_group_id,
              t.created_by,
              m.manager_full_name,
              t.local_date_time AS local_start_time,
              t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
              t.timezone,
              t.dst_factor,
              t.minutes_offset,
              t.duration,
              t.address_type,
              t.date_time,
              m.manager_phone_number
        FROM tasks t
        LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
        LEFT JOIN runs r ON r.run_id = t.run_id
        LEFT JOIN teams_qualified_for_run tqfr ON tqfr.run_id = r.run_id
        LEFT JOIN team_to_manager ttm ON ttm.team_id = tqfr.team_id
        LEFT JOIN managers m ON m.manager_id = t.created_by
        WHERE t.business_id = ?
        AND t.task_id IN(?)
        AND t.status != ?
        ORDER BY t.date_time
      `, [agent.business_id, agent.task_id, 2])

      }else{
        var tasks = yield db.queryAsync(
            `SELECT DISTINCT t.task_id,
              t.run_id,
              t.order_id,
              t.date_time AS start_time,
              t.date_time + INTERVAL t.duration MINUTE AS end_time,
              t.task_type_id,
              tttb.task_type_name,
              t.task_status,
              t.agent_id,
              t.customer_id,
              t.customer_name,
              t.customer_phone_number,
              t.dependant_on_tasks,
              t.address,
              t.task_lat,
              t.task_long,
              t.task_description,
              t.document1,
              t.document2,
              t.document3,
              t.document4,
              t.document5,
              t.task_signature,
              t.template_group_id,
              atmat.manager_id,
              m.manager_full_name,
              t.local_date_time AS local_start_time,
              t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
              t.timezone,
              t.dst_factor,
              t.minutes_offset,
              t.duration,
              t.address_type,
              t.date_time,
              m.manager_phone_number
        FROM tasks t
        JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
        JOIN runs r ON r.run_id = t.run_id
        JOIN agent_to_manager_and_team atmat ON atmat.agent_id = r.agent_id
        JOIN managers m ON m.manager_id = atmat.manager_id
        WHERE t.business_id = ?
        AND t.task_id IN(?)
        AND t.status != ?
        AND r.team_id = ?
        ORDER BY t.date_time
      `, [agent.business_id, agent.task_id, 2, task_assigned_unassigned_check[0].team_id])
      }

        if (tasks.length > 0) {
            for (var i = 0; i < tasks.length; i++) {
                tasks[i].dependant_on_tasks = tasks[i].dependant_on_tasks.split(",")
            }
        }

        var retVal = {
            status_code: 200,
            message: "Feteched agent tasks",
            data: {
                tasks: tasks
            }
        }
        return retVal
    }

    * get_template_info_via_task_id_agent(template) {
        var templates = yield db.queryAsync(
            `SELECT ttt.template_id,
                  ttt.field_name,
                  ttt.data_type,
                  ttt.template_group_id,
                  ttt.mobile_app_permission,
                  ttt.mandatory_status,
                  ttt.value
            FROM  templates_to_tasks ttt
            WHERE ttt.business_id = ?
            AND ttt.task_id = ?
            AND ttt.template_group_id = ?`, [template.business_id, template.task_id, template.template_group_id]
        )

        var retVal = {
            status_code: 200,
            message: "Feteched agent tasks",
            data: {
                template_details: templates
            }
        }
        return retVal
    }

    * accept_order(agent) {

      const agent_details = yield db.queryAsync(
        `SELECT user_id
         FROM login_device_details
         WHERE access_token = ?`,[agent.access_token]
      )

      const check_if_accepted = yield db.queryAsync(`
        SELECT run_status,
               order_type
          FROM runs
          WHERE run_id = ?
        `,[agent.run_id]);

     const agent_to_task = yield db.queryAsync(
       `SELECT *
        FROM tasks
        WHERE run_id = ?
        AND business_id = ?`, agent.run_id, agent.business_id);

      var task_ids =  yield db.queryAsync(
        `SELECT task_id
         FROM tasks
         WHERE run_id = ?`,[agent.run_id]
      );

      console.log("Check if accepted data ++_++_+_+_+_+_+_", check_if_accepted, check_if_accepted[0].run_status);
      if(agent_details[0].user_id === agent_to_task[0].agent_id ){
        if(check_if_accepted[0].order_type === 2){
          var task_status = 3;
        }else{
          var task_status = 4;
        }
        const agent_id = yield db.queryAsync(`
          SELECT ldd.user_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.work_status
          FROM login_device_details ldd
          LEFT JOIN agents a ON a.agent_id = ldd.user_id
          WHERE ldd.access_token = ?
          AND ldd.business_id = ?
          `, [agent.access_token, agent.business_id]);

        if(check_if_accepted[0].run_status > 1 && check_if_accepted[0].order_type != 2){
          var notifications = yield db.queryAsync(
            `UPDATE notifications n
              SET n.status = ?
              WHERE n.user_id = ?
              AND n.business_id = ?
              AND n.user_type = ?
              AND n.order_id = ?
              AND n.status NOT IN(?,?)`,[1, agent_id[0].user_id, agent.business_id, 2, agent.order_id, 1, 2]
            )
            console.log("This order was already accepted*****************", check_if_accepted[0].run_status, check_if_accepted);
          error('OrderAlreadyAccepted')
        }
        else{
            var notifications_check = yield db.queryAsync(
          `SELECT n.status
            FROM notifications n
            WHERE n.business_id = ?
            AND n.user_type = ?
            AND n.order_id = ?
            AND n.status IN(?,?)`,[agent.business_id, 2, agent.order_id, 1, 2]
          )


          var tasks = yield db.queryAsync(
            `UPDATE tasks
                SET agent_id = ?,
                    task_status = ?
              WHERE run_id = ?
              AND order_id = ?
              AND business_id = ?`,[agent_id[0].user_id, task_status, agent.run_id, agent.order_id, agent.business_id]
            );

          var notifications = yield db.queryAsync(
            `UPDATE notifications n
              SET n.status = ?
              WHERE n.user_id = ?
              AND n.business_id = ?
              AND n.user_type = ?
              AND n.order_id = ?
              AND n.status NOT IN(?,?)`,[1, agent_id[0].user_id, agent.business_id, 2, agent.order_id, 1, 2]
            )

          var notifications_update_other_agents = yield db.queryAsync(
            `UPDATE notifications n
              SET n.status = ?
              WHERE n.user_id != ?
              AND n.business_id = ?
              AND n.user_type = ?
              AND n.order_id = ?
              AND n.status NOT IN(?,?)`,[3, agent_id[0].user_id, agent.business_id, 2, agent.order_id, 1, 2]
            )

          var team_id_info = yield db.queryAsync(
            `SELECT n.team_id
             FROM notifications n
             WHERE n.user_id = ?
             AND n.business_id = ?
             AND n.user_type = ?
             AND n.order_id = ?
             AND n.notification_type = ?`,[agent_id[0].user_id, agent.business_id, 2, agent.order_id, 2]
          )

          var runs = yield db.queryAsync(
            `UPDATE runs
                SET agent_id = ?,
                    team_id = ?,
                      run_status = 2
              WHERE run_id = ?
              AND order_id = ?
              AND business_id = ?`,[agent_id[0].user_id, team_id_info[0].team_id, agent.run_id, agent.order_id, agent.business_id]
            )

          var teams_qualified_for_run = yield db.queryAsync(
            `UPDATE teams_qualified_for_run
              SET status = 1
              WHERE run_id = ?
              AND business_id = ?
            `,[agent.run_id, agent.business_id]
          )

          var manager_ids = yield db.queryAsync(
            `SELECT ttm.manager_id
             FROM team_to_manager ttm
             WHERE ttm.team_id = ?
             AND ttm.business_id = ?`,[team_id_info[0].team_id, agent.business_id])

          var super_manager_ids = yield db.queryAsync(
           `SELECT manager_id
            FROM managers
            WHERE manager_type = ?
            AND business_id = ?`,[1, agent.business_id])

          manager_ids = manager_ids.concat(super_manager_ids);
          var managers = []
          for(var i = 0; i < manager_ids.length; i++){
            managers.push(manager_ids[i].manager_id);
          }
          manager_ids = _.uniq(managers)
          //console.log("returning manager ids", manager_ids);

          var notification_text = "Agent "+agent_id[0].agent_first_name+"("+agent_id[0].user_id+") has accept Order ID:"+agent.order_id+".";

          var values1 = [];

          var manager_id_with_unique_id = [];

          for(var i = 0; i < manager_ids.length; i++){
            var hash = bcrypt.hashSync("hash", 3);
            values1.push([agent.business_id, 3, 3, 1, notification_text, 1, agent.order_id, agent.run_id, 0, manager_ids[i], 1, team_id_info[0].team_id, hash])
            manager_id_with_unique_id.push({manager_id:manager_ids[i], unique_id: hash});
          }

          var manager_notifications = yield db.queryAsync(
            `INSERT INTO notifications(
                business_id,
                notification_type,
                device_type,
                app_type,
                notification_content,
                status,
                order_id,
                run_id,
                task_id,
                user_id,
                user_type,
                team_id,
                unique_id
              )
              VALUES ?
            `,[values1]
          )
          var identification_key = 3
          var data = {
            manager_id: manager_id_with_unique_id,
            text: notification_text,
            order_id: agent.order_id,
            task_status: task_status,
            task_id : task_ids,
            run_id: agent.run_id,
            agent_id: agent_id[0].user_id,
            agent_name: agent_id[0].agent_first_name+" "+agent_id[0].agent_last_name,
            agent_status: agent_id[0].work_status
          }

          console.log("Checking for data of identification 3 faye push", data);

          yield bayeux.faye_push(agent.business_id, identification_key, data);

          var android_manager_device_tokens = yield db.queryAsync(
            `SELECT device_id
              FROM login_device_details
              WHERE user_id IN(?)
              AND user_type = 1
              AND device_type = 1
              AND app_type = 1
            `,[manager_ids]
          )

          var device_token = [];//device_tokens
          for(var i = 0; i < android_manager_device_tokens.length; i++){
            device_token.push(android_manager_device_tokens[i].device_id)
          }
          //console.log("device pushes", device_token);
          var text = notification_text;
          var pushFlag = 2;
          var order_id = agent.order_id;
          var run_id = agent.run_id;
          var task_id = 0;
          var notification_id = manager_id_with_unique_id;

          yield CommonFunction.sendAndroidPushNotificationManager(device_token, text, pushFlag, order_id, run_id, task_id, notification_id);

              var runs = yield db.queryAsync(
                  `UPDATE runs
               SET  agent_id = ?,
                    run_status = ?,
                    team_id = ?
              WHERE run_id = ?
              AND order_id = ?
              AND business_id = ?`, [agent_id[0].user_id, 2, agent.run_id, team_id_info[0].team_id, agent.order_id, agent.business_id]
              );

              let emailData = yield  db.queryAsync(
                  "select CONCAT( a.agent_first_name,' ',a.agent_last_name) as agent_name," +
                  "tt.task_type_name," +
                  "t.task_type_id," +
                  "t.agent_id,t.customer_name,t.address,t.customer_phone_number,t.customer_country_code," +
                  "t.customer_email,t.business_id," +
                  "bd.business_name," +
                  "t.task_id," +
                  "t.duration," +
                  "t.local_date_time " +
                  "from tasks t left join business_details bd on bd.business_id=t.business_id " +
                  "left join agents a on a.agent_id = t.agent_id " +
                  "left join task_types_to_business tt on tt.task_type_id = t.task_type_id " +
                  "where run_id = ?", [agent.run_id]
              );
              let notData= yield db.queryAsync('SELECT nc.content,nc.email_subject,noc.email,noc.sms,nc.trigger_type from notification_content nc '+
                  'JOIN notification_configurations noc On nc.business_id = noc.business_id and nc.trigger_id= noc.trigger_id ' +
                  'where nc.business_id = ? and nc.trigger_id=? ' +
                  'order by nc.trigger_type DESC',[agent.business_id,2]);

              if (emailData.length && notData.length) {
                  for (let i = 0; i < emailData.length; i++) {
                      console.log("dsdsds", emailData[i]);
                      let start_date_task = moment(emailData[i].local_date_time).format('DD MMMM YYYY');
                      let start_time_task = moment(emailData[i].local_date_time).format('hh:mm a');
                      let end_time_task = moment(emailData[i].local_date_time).add(emailData[i].duration, 'm').format('hh:mm a');
                      let end_date_task = moment(emailData[i].local_date_time).add(emailData[i].duration, 'm').format('DD MMMM YYYY');
                      console.log("Issue with the time may be ))))))))", start_date_task, start_time_task, end_time_task);
                      if ((emailData[i].customer_email) && (notData[0].email === 1)) {
                          yield sendEmailToUser("ORDER", {
                                  customer_name: emailData[i].customer_name,
                                  customer_number: emailData[i].customer_phone_number,
                                  customer_email: emailData[i].customer_email,
                                  customer_address: emailData[i].customer_address,
                                  task_type: emailData[i].task_type_name,
                                  task_id: emailData[i].task_id,
                                  start_date_task: start_date_task,
                                  start_time_task: start_time_task,
                                  end_time_task: end_time_task,
                                  end_date_task: end_date_task,
                                  agent_name: emailData[i].agent_name,
                                  business_name: emailData[i].business_name
                              },
                              emailData[i].customer_email,
                              "support@azuratech.in",
                              notData[0],
                              "Order Accepted");
                          // yield CommonFunction.send_sms_plivo(emailData[i].customer_country_code+emailData[i].customer_phone_number,
                          //     "Hi "+emailData[i].customer_name+", your "+emailData[i].task_type_name+" task with ID "+emailData[i].task_id+", scheduled for "+start_date_task+", between "+start_time_task+" and "+end_time_task+" has been accepted by our agent "+emailData[i].agent_name+". ");
                      }
                      if(notData[1] && notData[0].sms === 1){
                          yield CommonFunction.send_order_sms(
                              emailData[i].customer_country_code+emailData[i].customer_phone_number,
                              notData[1],
                              {
                                  customer_name: emailData[i].customer_name,
                                  customer_number: emailData[i].customer_phone_number,
                                  customer_email: emailData[i].customer_email,
                                  customer_address: emailData[i].customer_address,
                                  task_type: emailData[i].task_type_name,
                                  task_id: emailData[i].task_id,
                                  start_date_task: start_date_task,
                                  start_time_task: start_time_task,
                                  end_time_task: end_time_task,
                                  end_date_task: end_date_task,
                                  agent_name: emailData[i].agent_name,
                                  business_name: emailData[i].business_name
                              });
                      }
                  }
              }
              var retVal = {
                  status_code: 200,
                  message: "Accepted Order Successfully",
                  data: {}
              };
              return retVal
          }

        }
      else{
        console.log("hgvujhvbk++++++");
          error('NoMoreAssigned');
        }

      }

    * reject_order(agent) {
        const agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id]);



        var notifications = yield db.queryAsync(
            `UPDATE notifications n
            SET n.status = ?,
                n.reason = ?
            WHERE n.user_id = ?
            AND n.business_id = ?
            AND n.user_type = ?
            AND n.order_id = ?
            AND n.status NOT IN(?,?)`, [2, agent_id[0].reason, agent_id[0].user_id, agent.business_id, 2, agent.order_id, 1, 2]
        )

       var tasks = yield db.queryAsync(
         `UPDATE tasks
             SET agent_id = ?,
                 task_status = ?
           WHERE run_id = ?
           AND order_id = ?
           AND business_id = ?`,[0, 1, agent.run_id, agent.order_id, agent.business_id]
         )

       var runs = yield db.queryAsync(
         `UPDATE runs
            SET  agent_id = ?,
                 run_status = ?
           WHERE run_id = ?
           AND order_id = ?
           AND business_id = ?`,[0, 1, agent.run_id, agent.order_id, agent.business_id]
         );

        const agent_id1 = yield db.queryAsync(`
        SELECT ldd.user_id,
                a.agent_first_name
        FROM login_device_details ldd
        LEFT JOIN agents a ON a.agent_id = ldd.user_id
        WHERE ldd.access_token = ?
        AND ldd.business_id = ?`, [agent.access_token, agent.business_id]);

        var team_id_info = yield db.queryAsync(
            `SELECT n.team_id
           FROM notifications n
           WHERE n.user_id = ?
           AND n.business_id = ?
           AND n.user_type = ?
           AND n.order_id = ?
           AND n.notification_type = ?`,[agent_id[0].user_id, agent.business_id, 2, agent.order_id, 2]
        )

        var manager_ids = yield db.queryAsync(
            `SELECT ttm.manager_id
           FROM team_to_manager ttm
           WHERE ttm.team_id = ?
           AND ttm.business_id = ?`,[team_id_info[0].team_id, agent.business_id])

        var super_manager_ids = yield db.queryAsync(
            `SELECT manager_id
          FROM managers
          WHERE manager_type = ?
          AND business_id = ?`,[1, agent.business_id])

        manager_ids = manager_ids.concat(super_manager_ids);
        var managers = []
        for(var i = 0; i < manager_ids.length; i++){
            managers.push(manager_ids[i].manager_id);
        }
        manager_ids = _.uniq(managers);

        var manager_id_with_unique_id = [];

        var values1 = [];

        var notification_text = "Agent "+agent_id1[0].agent_first_name+"("+agent_id1[0].user_id+") has reject the  Order ID:"+agent.order_id+".";

        for(var i = 0; i < manager_ids.length; i++){
            var hash = bcrypt.hashSync("hash", 3);
            values1.push([agent.business_id, 5, 3, 1, notification_text, 2, agent.order_id, agent.run_id, 0, manager_ids[i], 1, team_id_info[0].team_id, hash, agent_id[0].user_id])
            manager_id_with_unique_id.push({manager_id:manager_ids[i], unique_id: hash});
        }
        var manager_notifications = yield db.queryAsync(
            `INSERT INTO notifications(
              business_id,
              notification_type,
              device_type,
              app_type,
              notification_content,
              status,
              order_id,
              run_id,
              task_id,
              user_id,
              user_type,
              team_id,
              unique_id,
              agent_id
            )
            VALUES ?
          `,[values1]
        )


        var identification_key = 23
        var data = {
            manager_id: manager_id_with_unique_id,
            text: notification_text,
            order_id: agent.order_id,
            run_id: agent.run_id,
            agent_id:agent_id1[0].user_id
        }

        yield bayeux.faye_push(agent.business_id, identification_key, data);

        var retVal = {
            status_code: 200,
            message: "Rejected Order Successfully",
            data: {}
        }
        return retVal
    }

    * acknowledge_order(agent) {
        const agent_id = yield db.queryAsync(`
        SELECT user_id
        FROM login_device_details
        WHERE access_token = ?
        AND business_id = ?
        `, [agent.access_token, agent.business_id])

        var tasks = yield db.queryAsync(
            `UPDATE tasks
            SET agent_id = ?,
                task_status = ?
          WHERE run_id = ?
          AND order_id = ?
          AND business_id = ?`, [agent_id[0].user_id, agent.status, agent.run_id, agent.order_id, agent.business_id]
        )

        var runs = yield db.queryAsync(
            `UPDATE runs
           SET  agent_id = ?,
                run_status = ?
          WHERE run_id = ?
          AND order_id = ?
          AND business_id = ?`, [agent_id[0].user_id, agent.status, agent.run_id, agent.order_id, agent.business_id]
        )

        var retVal = {
            status_code: 200,
            message: "Acknowledged Order Successfully",
            data: {}
        }
        return retVal
    }

    * get_order_notifications(agent) {

        var agent_id = yield db.queryAsync(`
        SELECT user_id FROM login_device_details WHERE access_token = ?
        `,[agent.access_token]);
      if(agent.limit === 0 && agent.offset === 0){
            var notifications = yield db.queryAsync(`
              SELECT n.notification_content,
                      n.notification_type,
                      n.notification_id,
                      n.status,
                      n.sent_at,
                      n.order_id,
                      n.order_type,n.run_id,
                      n.read_status
                FROM  notifications n
                WHERE n.user_id = ?
                AND n.business_id = ?
                AND n.user_type = ?
                AND n.status NOT IN(?,?,?)
                ORDER BY n.order_id DESC`,[agent_id[0].user_id, agent.business_id, 2, 1, 2, 3]
              )}else{
              var notifications = yield db.queryAsync(
                `SELECT n.notification_content,
                        n.notification_type,
                        n.notification_id,
                        n.status,
                        n.sent_at,
                        n.order_id,
                        n.order_type,
                        n.run_id,
                        n.read_status
                  FROM  notifications n
                  WHERE n.user_id = ?
                  AND n.business_id = ?
                  AND n.user_type = ?
                  AND n.status NOT IN(?,?,?)
                  ORDER BY n.order_id DESC
                  LIMIT ?
                  OFFSET ?`,[agent_id[0].user_id, agent.business_id, 2, 1, 2, 3, agent.limit, agent.offset]
                )
            }

              var orders = yield db.queryAsync(
                  `SELECT GROUP_CONCAT(DISTINCT(n.order_id)) AS orders
                  FROM  notifications n
                  WHERE n.user_id = ?
                  AND n.business_id = ?
                  AND n.user_type = ?
                  ORDER BY n.order_id DESC`, [agent_id[0].user_id, agent.business_id, 2]
              )
              console.log("some problem here**************",orders);
              if(orders[0].orders != null){
                  var ord_arr = orders[0].orders.split(",");
                  var tasks = yield db.queryAsync(
                      `SELECT t.task_id,
                          t.order_id,
                          tttb.task_type_name,
                          t.task_type_id,
                          t.date_time AS start_time,
                          t.date_time + INTERVAL t.duration MINUTE AS end_time,
                          t.duration,
                          t.customer_id,
                          t.customer_name,
                          t.customer_phone_number,
                          t.customer_email,
                          t.address,
                          t.address_type,
                          t.task_description,
                          t.task_sequence,
                          t.dependant_on_tasks,
                          t.task_status,
                          t.customer_country_code,
                          t.document1,
                          t.document2,
                          t.document3,
                          t.document4,
                          t.document5,
                          t.task_lat,
                          t.task_long,
                          t.template_group_id,
                          tg.template_group_name,
                          t.local_date_time AS local_start_time,
                          t.local_date_time + INTERVAL t.duration MINUTE AS local_end_time,
                          t.timezone,
                          t.dst_factor,
                          t.minutes_offset,
                          t.duration,
                          t.address_type
                      FROM tasks t
                      LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = t.task_type_id
                      LEFT JOIN template_group tg ON tg.template_group_id = t.template_group_id
                      WHERE t.business_id = ?
                      AND t.order_id IN(?)
                      AND t.status != ?
                      ORDER BY t.order_id DESC`, [agent.business_id, ord_arr, 2]
                  )

                const notification_count_unread = yield db.queryAsync(
                  `SELECT COUNT(notification_id) AS notification_count
                    FROM  notifications
                    WHERE business_id = ?
                    AND user_id = ?
                    AND user_type = ?
                    AND read_status = ?`,[agent.business_id, agent_id[0].user_id, 2, 0]
                )
                  for(var i = 0; i < notifications.length; i++){
                  var task_ids = []
                  for(var j = 0; j < tasks.length; j++){
                    if(tasks[j].order_id === notifications[i].order_id){
                      task_ids.push(tasks[j])
                      notifications[i].task_ids = task_ids;
                    }
                  }
                }
                var retVal = {
                  status_code: 200,
                  message: "Notifications loaded Successfully",
                  data: {
                    notifications: notifications,
                    count: notifications.length,
                  unread_count_notification: notification_count_unread[0].notification_count,}
                }
              }else{
                var retVal = {
                  status_code: 200,
                  message: "Notifications loaded Successfully",
                  data: {
                    notifications: [],
                    count: 0,
                  unread_count_notification: 0}
                }
              }
              return retVal
    }

    * mark_read_notification(agent){
      var marked_read = db.queryAsync(
        `UPDATE notifications
        SET read_status = ?
        WHERE notification_id = ?
        AND business_id = ?
        `,[1, agent.notification_id, agent.business_id]
      );

      var retVal = {
        status_code: 200,
        message: "Marked Read",
        data: {
        }
      }
      return retVal
    }

    * get_bulk_agents_drop_down(agent) {
        if (agent.type === 1) {
            var types = yield db.queryAsync(`
          SELECT status_id AS item_id,
                 status_name AS item_name
          FROM agent_status
          `)
        }
        if (agent.type === 2) {
            var types = yield db.queryAsync(`
          SELECT team_id AS item_id,
                 team_name AS item_name
          FROM teams
          WHERE business_id = ?
          `, [agent.business_id])
        }
        if (agent.type === 3) {
            var types = yield db.queryAsync(`
          SELECT manager_id AS item_id,
                 manager_full_name AS item_name
          FROM managers
          WHERE business_id = ?
          `, [agent.business_id])

        }
        if (agent.type === 4) {
            var types = yield db.queryAsync(`
          SELECT task_type_id AS item_id,
                 task_type_name AS item_name
          FROM task_types_to_business
          WHERE business_id = ?
          `, [agent.business_id])
        }
        if (agent.type === 0) {
            var type1 = yield db.queryAsync(`
          SELECT status_id AS item_id,
                 status_name AS item_name
          FROM agent_status
          `)

            var type2 = yield db.queryAsync(`
          SELECT team_id AS item_id,
                 team_name AS item_name
          FROM teams
          WHERE business_id = ?
          `, [agent.business_id])

            var type3 = yield db.queryAsync(`
          SELECT manager_id AS item_id,
                 manager_full_name AS item_name
          FROM managers
          WHERE business_id = ?
          `, [agent.business_id])

            var type4 = yield db.queryAsync(`
          SELECT task_type_id AS item_id,
                 task_type_name AS item_name
          FROM task_types_to_business
          WHERE business_id = ?
          `, [agent.business_id])

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

    * get_bulk_agents_result(agent) {
        if (agent.limit === 0 && agent.offset === 0) {
          if(agent.type === 0){

            var type1 = yield db.queryAsync(
              `SELECT a.agent_id,
                    a.agent_first_name,
                    a.agent_last_name,
                    a.agent_username,
                    a.agent_email,
                    a.agent_address,
                    a.agent_phone_number,
                    a.status,
                    a.city,
                    a.state,
                    a.agent_profile_picture,
                    a.country,
                    a.rating,
                    a.tags_to_agent,
                    a.online_status,
                    a.work_status,
                    a.employee_code,
                    COUNT(DISTINCT(tta.id)) AS teams_count,
                    COUNT(DISTINCT(ttta.id)) AS task_type_count
                FROM agents a
                LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
                LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
                WHERE a.business_id = ?
                AND a.status != ?
                AND a.work_status IN(?)
                GROUP BY a.agent_id`,[agent.business_id, 2, agent.item_id[0].item_id_1]
            );

            var type2 = yield db.queryAsync(
              `SELECT a.agent_id,
                    a.agent_first_name,
                    a.agent_last_name,
                    a.agent_username,
                    a.agent_email,
                    a.agent_address,
                    a.agent_phone_number,
                    a.status,
                    a.city,
                    a.state,
                    a.agent_profile_picture,
                    a.country,
                    a.rating,
                    a.tags_to_agent,
                    a.online_status,
                    a.work_status,
                    a.employee_code,
                    COUNT(DISTINCT(tta.id)) AS teams_count,
                    COUNT(DISTINCT(ttta.id)) AS task_type_count
                FROM agents a
                LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
                LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
                WHERE a.business_id = ?
                AND a.status != ?
                AND tta.team_id IN(?)
                GROUP BY a.agent_id`,[agent.business_id, 2, agent.item_id[0].item_id_2]
            )

            var type3 = yield db.queryAsync(
              `SELECT a.agent_id,
                    a.agent_first_name,
                    a.agent_last_name,
                    a.agent_username,
                    a.agent_email,
                    a.agent_address,
                    a.agent_phone_number,
                    a.status,
                    a.city,
                    a.state,
                    a.agent_profile_picture,
                    a.country,
                    a.rating,
                    a.tags_to_agent,
                    a.online_status,
                    a.work_status,
                    a.employee_code,
                    COUNT(DISTINCT(tta.id)) AS teams_count,
                    COUNT(DISTINCT(ttta.id)) AS task_type_count
                FROM agents a
                LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
                LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
                WHERE a.business_id = ?
                AND a.status != ?
                AND tta.manager_id IN(?)
                GROUP BY a.agent_id`,[agent.business_id, 2, agent.item_id[0].item_id_3]
            );

            var type4 = yield db.queryAsync(
              `SELECT a.agent_id,
                    a.agent_first_name,
                    a.agent_last_name,
                    a.agent_username,
                    a.agent_email,
                    a.agent_address,
                    a.agent_phone_number,
                    a.status,
                    a.city,
                    a.state,
                    a.agent_profile_picture,
                    a.country,
                    a.rating,
                    a.tags_to_agent,
                    a.online_status,
                    a.work_status,
                    a.employee_code,
                    COUNT(DISTINCT(tta.id)) AS teams_count,
                    COUNT(DISTINCT(ttta.id)) AS task_type_count
                FROM agents a
                LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
                LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
                WHERE a.business_id = ?
                AND a.status != ?
                AND a.rating IN(?)
                GROUP BY a.agent_id`,[agent.business_id, 2, agent.item_id[0].item_id_4]
            )

            var type5 = yield db.queryAsync(
              `SELECT a.agent_id,
                    a.agent_first_name,
                    a.agent_last_name,
                    a.agent_username,
                    a.agent_email,
                    a.agent_address,
                    a.agent_phone_number,
                    a.status,
                    a.city,
                    a.state,
                    a.agent_profile_picture,
                    a.country,
                    a.rating,
                    a.tags_to_agent,
                    a.online_status,
                    a.work_status,
                    a.employee_code,
                    COUNT(DISTINCT(tta.id)) AS teams_count,
                    COUNT(DISTINCT(ttta.id)) AS task_type_count
                FROM agents a
                LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
                LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
                WHERE a.business_id = ?
                AND a.status != ?
                AND ttta.task_type_id IN(?)
                GROUP BY a.agent_id`,[agent.business_id, 2, agent.item_id[0].item_id_5]
            )
            var types = type1.concat(type2, type3, type4, type5);
          }
        } else {
            var agents = yield db.queryAsync(
                `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_username,
                  a.agent_email,
                  a.agent_address,
                  a.agent_phone_number,
                  a.status,
                  a.city,
                  a.state,
                  a.agent_profile_picture,
                  a.country,
                  a.rating,
                  a.tags_to_agent,
                  a.online_status,
                  a.work_status,
                  a.employee_code,
                  COUNT(tta.id) AS teams_count,
                  COUNT(ttta.id) AS tasks_count
            FROM  agents a
            LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
            WHERE a.business_id = ? AND a.status != ?
            GROUP BY a.agent_id
            LIMIT ?
            OFFSET ?`, [agent.business_id, 2, agent.limit, agent.offset]
            )
        }

        const agents_count = yield db.queryAsync(
            `SELECT COUNT(agent_id) AS agent_count
          FROM  agents
          WHERE business_id = ? AND status != ?`, [agent.business_id, 2]
        )

        var retVal = {
            agents: types,
            count: types.length
        }
        return retVal
    }

    * send_push_check(agent) {
        //console.log("device tokesn", agent.device_token);
        var device_token = agent.device_token;
        var text = "You have recieved a new push";
        var pushFlag = 1;
        var order_id = 56;
        var run_id = 56;
        var task_id = 74;
        var retVal = {response: "Notification Sent"};
        //console.log("CHeching sent device tokens", device_token);
        yield CommonFunction.sendAndroidPushNotification(device_token, text, pushFlag, order_id, run_id, task_id);
        return retVal;
    }

    * search_agent(agent) {
        var agents = yield db.queryAsync(
            `SELECT a.agent_id,
                  a.agent_first_name,
                  a.agent_last_name,
                  a.agent_username,
                  a.agent_email,
                  a.agent_address,
                  a.agent_phone_number,
                  a.status,
                  a.city,
                  a.state,
                  a.agent_profile_picture,
                  a.country,
                  a.rating,
                  a.tags_to_agent,
                  a.online_status,
                  a.work_status,
                  a.employee_code,
                  COUNT(DISTINCT(tta.id)) AS teams_count,
                  COUNT(DISTINCT(ttta.id)) AS task_type_count,
                  GROUP_CONCAT(DISTINCT t.team_name) AS teams,
                  GROUP_CONCAT(DISTINCT tttb.task_type_name) AS task_types
            FROM agents a
            LEFT JOIN agent_to_manager_and_team tta ON tta.agent_id = a.agent_id
            LEFT JOIN task_type_to_agent ttta ON ttta.agent_id = a.agent_id
            LEFT JOIN teams t ON t.team_id = tta.team_id
            LEFT JOIN task_types_to_business tttb ON tttb.task_type_id = ttta.task_type_id
            WHERE a.business_id = ? AND a.status != ?
            AND (a.agent_first_name LIKE ?
                OR a.agent_last_name LIKE ?
                OR a.agent_email LIKE ?
                OR a.agent_phone_number LIKE ?
                OR CONCAT(a.agent_first_name, " ", a.agent_last_name) LIKE ?)
            GROUP BY a.agent_id`, [agent.business_id, 2, "%" + agent.input + "%", "%" + agent.input + "%", "%" + agent.input + "%", "%" + agent.input + "%", "%" + agent.input + "%"]
        )

        var retVal = {
            agents: agents
        }
        return retVal
    }

    * agent_email(agent){
      var agent_email = yield db.queryAsync(`
        SELECT agent_email
        FROM agents
        WHERE agent_email = ?
        AND agent_id != ?
      `,[agent.agent_email, agent.agent_id]);

      if(agent_email.length > 0){
        error('UserExistsErrorEmail')
      }else{
        var retVal = {
          message: "No such email found",
          status_code: 200
        }
        return retVal
      }
    }

    * agent_username(agent){
      var agent_username = yield db.queryAsync(`
        SELECT agent_username
        FROM agents
        WHERE agent_username = ?
        AND agent_id != ?
      `,[agent.agent_username, agent.agent_id]);

      if(agent_username.length > 0){
        error('UserExistsErrorUsername')
      }else{
        var retVal = {
          message: "No such username found",
          status_code: 200
        }
        return retVal
      }
    }

    * faye_try(agent){
      yield bayeux.faye_push(agent.business_id, agent.identification_key, agent.data);

      return agent;
    }

    * confirm_task_address(agent){

      if(agent.status === 1){
        const confirm_address = yield db.queryAsync(
          `UPDATE tasks
           SET address_varified_by_agent = ?
           WHERE task_id = ?`,[agent.status, agent.task_id]
        )
      }
      else{
          const confirm_address = yield db.queryAsync(
            `UPDATE tasks
             SET address_varified_by_agent = ?
                 address = ?,
                 address_type = ?,
                 task_lat = ?,
                 task_long = ?,
                 address_id = ?
             WHERE task_id = ?`,[agent.status, agent.address, agent.address_type, agent.task_lat, customer.task_long, agent.address_id, agent.task_id]);

          if(confirm_address.rows_affected >= 1){
            var edit_customer_address = yield db.queryAsync(
              `UPDATE customer_addresses
               SET address_type = ?,
                   customer_address = ?,
                   block_number = ?,
                   area = ?,
                   road = ?,
                   building_number = ?,
                   flat_number = ?,
                   level = ?,
                   landmark = ?,
                   compound_garden = ?,
                   country_id = ?,
                   latitude = ?,
                   longitude = ?,
                   city = ?,
                   road_number = ?,
                   building_name = ?,
                   municipality = ?
               WHERE address_id = ?`, [agent.address_type, agent.address, agent.block_number, agent.block_number, agent.area, agent.road, agent.building_number, agent.flat_number, agent.level, customer.landmark, agent.compound_garden, agent.country_id, agent.latitude, agent.city, agent.road_number, agent.building_name, agent.municipality, agent,address_id]);

        }
        console.log("The address was right");
      }

      var retVal = {
        message: "Your feedback was recorded succesfully",
        status_code: 200
      }
      return retVal
  }
}

module.exports.getInstance = () => new Agent();

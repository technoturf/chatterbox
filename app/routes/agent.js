'use strict';

const AgentController = require('../controllers/AgentController')
	, cTypeJSON = require('../middlewares/cTypeJSON')
	, cTypeMultiPart = require('../middlewares/cTypeMultiPart')
	, accessToken = require('../middlewares/managerAccessToken')
	, agentAccessToken = require('../middlewares/agentAccessToken')

module.exports = function(app, Router){

	const router = new Router({ prefix: '/agent' });

	router.post('/login_agent', cTypeJSON, AgentController.login_agent);
	router.post('/login_agent_access_token', agentAccessToken, cTypeJSON, AgentController.login_agent_access_token);
	app.use(router.routes()).use(router.allowedMethods());
};

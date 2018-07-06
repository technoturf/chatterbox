'use strict';

const ManagerController = require('../controllers/ManagerController')
    , cTypeJSON = require('../middlewares/cTypeJSON')
    , accessToken = require('../middlewares/managerAccessToken')
    , cTypeMultiPart = require('../middlewares/cTypeMultiPart');

module.exports = function(app, Router){

	const router = new Router({ prefix: '/manager' });

    router.post('/manager_signin', cTypeJSON, ManagerController.manager_signin);
    router.post('/manager_logout', cTypeJSON, accessToken, ManagerController.manager_logout);
    router.post('/manager_mobile_signin', cTypeJSON, ManagerController.manager_mobile_signin);
    router.post('/manager_access_token_login', cTypeJSON, ManagerController.manager_access_token_login);
    router.post('/manager_signup', cTypeJSON, ManagerController.manager_signup);

	app.use(router.routes()).use(router.allowedMethods());
};

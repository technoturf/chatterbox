'use strict';

const Router = require('koa-router');

module.exports = function(app){
    require('./routes/manager')(app, Router);
    require('./routes/agent')(app, Router);
};

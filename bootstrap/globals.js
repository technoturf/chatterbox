'use strict';

//********* Environment Global Function ************//
global.env = function(name, defaultVal){
    if(typeof process.env[name] !== 'undefined'){
        return process.env[name];
    }else{
        if(typeof defaultVal !== 'undefined'){
            return defaultVal;
        }else{
            return null;
        }
    }
};

//********* Config Global Function ************//
var fs = require('fs')
    , path = require('path');

global.config = (function(){
    const files = fs.readdirSync(__dirname + '/../config');

    if(files.length){
        let configFiles = files.map(function(file){
            if(path.extname(file) === '.js'){
                return path.basename(file, '.js');
            }
        });

        if(configFiles.length){
            var config = {};

            configFiles.forEach(function(file){
                if(file)
                    config[file] = require(__dirname + '/../config/'+file);
            });
            return config;
        }else{
            throw new Error('No Config Files Found');
        }
    }else{
        throw new Error('No Config Files Found')
    }
})();

//********* Global Redis Client ************//
// global.redis = new (require('ioredis'))(
//     config.db.redis.port,
//     config.db.redis.host
// );

//********* Global Database Client ************//
global.db = require('./lib/mysql');

// //********* Global Logging function ************//
// global.log = require('./lib/log');

// //********* Global MongoDB Client ************//
// global.MongoClient = require('mongodb').MongoClient;
// global.Binary = require('mongodb').Binary;
// global.ObjectID = require('mongodb').ObjectID;

//********* Global Error Handler ************//
global.error = function(type, message, code, fields){
    var err;

    err = (typeof global[type] !== 'undefined')? new global[type] : new GenericError;

    if(message) err.message = message;
    if(code && typeof code === 'number') err.code = code;

    if(fields && typeof fields === 'object'){
        for (var key in fields){
            if (fields.hasOwnProperty(key)) {
                err[key] = fields[key];
            }
        }
    }

    throw err;
};

// require('./lib/aerospike');
// require('./lib/crypt');

//********* Global Time Object ************//
// const time = require('time');
// time.tzset('UTC');
//
// global.time = time;

//********* Global Chance Object ************//
global.chance = (new require('chance'))();

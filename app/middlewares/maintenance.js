'use strict';

module.exports = function *(next){
    const maintenance = (yield spikedb.selectSync(
        aerospike.key('settings', 'maintenance'),
        ['value']
    )).value;

    if(maintenance){
        error('MaintenanceModeError');
    }

    yield next;
};

var http = require('http'),
    faye = require('faye');

var server = http.createServer(),
    bayeux = new faye.NodeAdapter({mount: '/faye'});

bayeux.attach(server);
server.listen(8000);

bayeux.on('publish', function(clientId, channel, data) {
  // console.log("some event fired on publish 2",clientId, channel, data);
});

bayeux.on('unsubscribe', function(clientId, channel) {
  //console.log("some event fired on unsubscribe",clientId, channel);
});
bayeux.on('disconnect', function(clientId) {
  //console.log("some event fired on disconnect",clientId);
});
bayeux.getClient().publish('/DC_1_1232233', {
  text:       'Checking Faye. Working successfully',
  inboxSize:  34
});

exports.faye_push = function *(business_id, identification_key, data){
  bayeux.getClient().publish('/'+business_details[0].default_channel, {
    data: data,
    identification_key: identification_key
  });
}

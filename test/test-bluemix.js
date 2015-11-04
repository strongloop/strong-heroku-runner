var EventEmitter = require('events').EventEmitter;
var test = require('tap').test;
var util = require('util');
var runner = require('../bin/sl-run').main;

function MockWebsocketChannel(_, registrationUrl) {
  EventEmitter.call(this);
  var self = this;

  this.registrationUrl = registrationUrl;
  this.msgs = [];

  setImmediate(function() {
    self.emit('connect');
  });
}
util.inherits(MockWebsocketChannel, EventEmitter);

MockWebsocketChannel.prototype.request = function(msg, cb) {
  this.msgs.push(msg);
  if (msg.cmd === 'register-container') {
    cb({
      controlUri: '',
    });
  }
};

MockWebsocketChannel.prototype.close = function() {
};

var MockWebsocketChannelModule = {
  connect: function connect(_, registrationUrl) {
    if (!MockWebsocketChannelModule.ch) {
      MockWebsocketChannelModule.ch =
        new MockWebsocketChannel(_, registrationUrl);
    }
    return MockWebsocketChannelModule.ch;
  },
};

test('Test bluemix integration', function(t) {
  process.env.VCAP_SERVICES = JSON.stringify({
    Strongloop: [
      {
        name: 'strongloop-aa',
        label: 'Strongloop',
        plan: 'beta',
        credentials: {
          STRONGLOOP_LICENSE: 'xyz',
          STRONGLOOP_ADDON_INFO:
            'eyJyZWdpc3RyYXRpb25VcmwiOiJodHRwczovL2JsdWVtaXguZG8uc3Ryb25nbG9' +
            'vcC5jb20vZXhlY3V0b3ItY29udHJvbCIsImJtU2VydmljZUluc3RhbmNlSWQiOi' +
            'JkNTVmNzQ0ZC02NDgxLTRiMmItODhiZi03NDk4MmIwZjVmZWYifQ==',
        },
      },
    ],
  });

  t.test('Wrapper parses addon-info', function(t) {
    runner(MockWebsocketChannelModule, function() {
      t.equal(
        MockWebsocketChannelModule.ch.registrationUrl,
        'https://bluemix.do.strongloop.com/executor-control'
      );
      t.equal(
        MockWebsocketChannelModule.ch.msgs[0].cmd,
        'register-container'
      );
      t.end();
    });
  });

  t.end();
});

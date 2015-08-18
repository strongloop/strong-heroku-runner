#!/usr/bin/env node

var WebsocketChannel = require('strong-control-channel/ws-channel');
var debug = require('debug')('strong-heroku-runner');
var os = require('os');
var agentVersion =
  require('strong-supervisor/node_modules/strong-agent/package.json').version;
var supervisorVersion = require('strong-supervisor/package.json').version;
var version = require('../package.json').version;

if (process.env.STRONGLOOP_ADDON_INFO) {
  var addonInfo = JSON.parse(
    new Buffer(process.env.STRONGLOOP_ADDON_INFO, 'base64').toString('utf8')
  );
  debug('addonInfo: ', addonInfo);

  var channel = WebsocketChannel.connect(
    function() {},
    addonInfo.registrationUrl
  );

  channel.on('connect', function() {
    debug('start: connected');
    channel.request({
      cmd: 'register-dyno',
      herokuResourceId: addonInfo.herokuResourceId,
      os: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release()
      },
      node: process.version,
      container: {
        name: process.env.DYNO,
        size: process.env.WEB_MEMORY,
        supervisorVersion: supervisorVersion,
        version: version,
      },
      cpus: os.cpus().length,
      agentVersion: agentVersion,
    }, function(rsp) {
      debug('register-dyno: %j', rsp);
      channel.close();
      process.env.STRONGLOOP_CONTROL = rsp.controlUri;
      process.env.STRONGLOOP_ADDON_INFO = '';
      runSupervisor();
    });
  });

  channel.on('error', function(err) {
    debug('error: %s', err.message);
  });
  return;
}
runSupervisor();

function runSupervisor() {
  require('strong-supervisor/bin/sl-run');
}

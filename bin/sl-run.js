#!/usr/bin/env node

var WebsocketChannel = require('strong-control-channel/ws-channel');
var debug = require('debug')('strong-heroku-runner');
var os = require('os');
var agentVersion =
  require('strong-supervisor/node_modules/strong-agent/package.json').version;
var supervisorVersion = require('strong-supervisor/package.json').version;
var version = require('../package.json').version;

function registerContainer(WebsocketChannel, addonInfo, callback) {
  // This setup only needs to happen the first time that the command is run.
  // After registering with central, it should not be run anymore. Since
  // supervisor will run through this code for every worker, we can
  // distinguish the 2 run modes using the presence of the STRONGLOOP_CONTROL
  // env. If it is present then registration is no longer necessary.
  if (addonInfo && !process.env.STRONGLOOP_CONTROL) {
    addonInfo = JSON.parse(
      new Buffer(addonInfo, 'base64').toString('utf8')
    );
    debug('addonInfo: ', addonInfo);

    var channel = WebsocketChannel.connect(
      function() {},
      addonInfo.registrationUrl
    );

    channel.on('connect', function() {
      debug('start: connected');
      channel.request({
        cmd: 'register-container',
        bindingId: addonInfo.bindingId,
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
        callback();
      });
    });

    channel.on('error', function(err) {
      debug('error: %s', err.message);
    });
    return;
  }
  callback();
}

function getVCapCredentials() {
  if (!process.env.VCAP_SERVICES) return null;
  var vcap_services = JSON.parse(process.env.VCAP_SERVICES);
  if (!vcap_services.Strongloop || !vcap_services.Strongloop[0]) return null;
  var slConfig = vcap_services.Strongloop[0];
  return slConfig.credentials;
}

// Variable overrides are for testing purposes
function main(WebsocketChannel, runSupervisor) {
  // Heroku sets environment directly
  var addonInfo = process.env.STRONGLOOP_ADDON_INFO;

  // Cloud Foundry and Bluemix set VCAP_SERVICES
  var vCapCreds = getVCapCredentials();
  if (vCapCreds && vCapCreds.STRONGLOOP_ADDON_INFO) {
    addonInfo = vCapCreds.STRONGLOOP_ADDON_INFO;
    process.env.STRONGLOOP_LICENSE = vCapCreds.STRONGLOOP_LICENSE;
  }

  registerContainer(WebsocketChannel, addonInfo, runSupervisor);
}
exports.main = main;

function runSupervisor() {
  require('strong-supervisor/bin/sl-run');
}

// This is dont for testing purposes. The main function is only called here if
// this file is run on command line and not if loaded as a module.
if (require.main === module) {
  main(WebsocketChannel, runSupervisor);
}

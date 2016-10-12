'use strict';
/**
 * Module dependencies.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('lodash');
var chalk = require('chalk');
var config = require('../../config/config');




/**
 * Running test Schema
 */
var RunningTestSchema = new mongoose.Schema({
  'testRunId': String,
  'start': {
    type: Date,
    default: Date.now
  },
  'end': {
    type: Date
  },
  'keepAliveTimestamp': {
    type: Date,
    default: Date.now
  },
  'completed': {
    type: Boolean,
    default: false
  },
  'productName': String,
  'productRelease': {
    type: String,
    uppercase: true
  },
  'dashboardName': {
    type: String,
    uppercase: true
  },
  'buildResultsUrl': String,
  'humanReadableDuration': String,
  'rampUpPeriod': Number

},
    {
      read: 'primary'
    });

RunningTestSchema.index({
  testRunId: 1,
  productName: 1,
  dashboardName: 1

}, { unique: true });


mongoose.model('RunningTest', RunningTestSchema);

var testRunTargetSchema = new Schema({
  'meetsRequirement': Boolean,
  'benchmarkResultFixedOK': Boolean,
  'benchmarkResultPreviousOK': Boolean,
  'target': String,
  'value': Number,
  'benchmarkPreviousValue': Number,
  'benchmarkFixedValue': Number
},
    {
      read: 'primary'
    });
mongoose.model('TestrunTarget', testRunTargetSchema);
var testRunMetricSchema = new Schema({
  'alias': String,
  'type': String,
  'tags': [{ text: String }],
  'requirementOperator': String,
  'requirementValue': String,
  'benchmarkOperator': String,
  'benchmarkValue': String,
  'meetsRequirement': {
    type: Boolean,
    default: null
  },
  'benchmarkResultFixedOK': {
    type: Boolean,
    default: null
  },
  'benchmarkResultPreviousOK': {
    type: Boolean,
    default: null
  },
  'annotation': String,
  'targets': [testRunTargetSchema]
},
    {
      read: 'primary'
    });
mongoose.model('TestrunMetric', testRunMetricSchema);
/**
 * Testrun Schema
 */
var TestrunSchema = new Schema({
  'productName': {
    type: String,
    uppercase: true
  },
  'productRelease': {
    type: String,
    uppercase: true
  },
  'dashboardName': {
    type: String,
    uppercase: true
  },
  'testRunId': {
    type: String,
    uppercase: true
  },
  'start': {
    type: Date,
    expires: config.graphiteRetentionPeriod
  },
  'end': Date,
  'baseline' : {
    type: String,
    default: null
  },
  'previousBuild': {
    type: String,
    default: null
  },
  'completed': {
    type: Boolean,
    default: true
  },
  'humanReadableDuration': String,
  'meetsRequirement': Boolean,
  'benchmarkResultFixedOK': Boolean,
  'benchmarkResultPreviousOK': Boolean,
  'buildResultsUrl': String,
  'annotations': String,
  'rampUpPeriod': {
    type: Number
  },
  'metrics': [testRunMetricSchema]
},
    {
      toObject: { getters: true },
      read: 'primary'
    } );
TestrunSchema.virtual('startEpoch').get(function () {
  return this.start.getTime();
});
TestrunSchema.virtual('endEpoch').get(function () {
  return this.end.getTime();
});
TestrunSchema.index({
  testRunId: 1,
  dashboardId: 1
}, { unique: true });
mongoose.model('Testrun', TestrunSchema);


//console.log('isDemo: ' + process.env.isDemo);
//console.log('mongoUrl: ' + process.env.db);

var db = connect();

function connect() {

  if(!process.env.isDemo) {

    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    var options = {
      //user: process.env.dbUsername,
      //pass: process.env.dbPassword,
      server: {
        //poolSize: 20,
        auto_reconnect: true, // already default, but explicit
        reconnectTries: 30, // already default, explicit
        socketOptions: {
          keepAlive: 100000, // less then 120s configured on mongo side
          connectTimeoutMS: 10000
        }
      }
    };
  }else{

  if(config.dbUsername && config.dbPassword ){

    var mongoUrl = 'mongodb://' + config.dbUsername + ':' + config.dbPassword + '@' + config.db;

  }else{

    var mongoUrl = 'mongodb://' + config.db;
  }
    var options = {};

  }

  if(process.env.dbUsername  && process.env.dbPassword  ){


    console.log("User synchronize-running-tests: " + process.env.dbUsername);
    console.log("User synchronize-running-tests: " + process.env.dbPassword);
    console.log("Connect (with credentials) synchronize-running-tests to: " + process.env.db);
    var mongoUrl = 'mongodb://' + process.env.dbUsername + ':' + process.env.dbPassword + '@' + process.env.db;

  }else{

    console.log("Connect synchronize-running-tests to: " + process.env.db);
    var mongoUrl = 'mongodb://' + process.env.db;
  }


  mongoose.connection.once('open', function() {
    console.log('Connected to MongoDB server with mongoose.');
  });

  mongoose.connection.on('error', function (err) { console.log("Synchronize-running-tests connect error: " + err) });

  mongoose.connection.on('disconnected', () => {
    // http://mongoosejs.com/docs/connections.html
    console.log('Disconnected MongoDB with mongoose, will autoreconnect a number of times');
  });

  // If the Node process ends, gracefully close the Mongoose connection
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, function cleanup() {
      mongoose.connection.close(() => {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
      });
    });
  });


  return mongoose.connect(mongoUrl, options);

};



var RunningTest = mongoose.model('RunningTest');
var Testrun = mongoose.model('Testrun');


  /* start polling every minute */
  setInterval(synchronizeRunningTestRuns, 60 * 1000);




function synchronizeRunningTestRuns () {


  var dateNow = new Date().getTime();


  /* Get  running tests */

  RunningTest.find().exec(function (err, runningTests) {
    if(err){

      console.log(err)
    }else {

      console.log('checking running tests');

      _.each(runningTests, function (runningTest) {

        /* if keep alive is older than 16 seconds, save running test in test run collection and remove from running tests collection */
        if (dateNow - new Date(runningTest.keepAliveTimestamp).getTime() > 16 * 1000) {

          /* mark test as not completed */
          runningTest.completed = false;

          saveTestRun(runningTest)
          .then(function(savedTestRun){

            console.log('removed running test: ' + savedTestRun.testRunId);

          })
          .catch(runningTestErrorHandler);


        }

      });
    }
  });
}

let runningTestErrorHandler = function(err){

  console.log('Error in saving test run: ' + err.stack);
}


let saveTestRun = function (runningTest){

  return new Promise((resolve, reject) => {

    let testRun = new Testrun({

      productName: runningTest.productName,
      productRelease: runningTest.productRelease,
      dashboardName: runningTest.dashboardName,
      testRunId: runningTest.testRunId,
      start: runningTest.start,
      end: runningTest.end,
      rampUpPeriod: runningTest.rampUpPeriod,
      completed: runningTest.completed,
      humanReadableDuration: humanReadbleDuration(runningTest.end.getTime() - runningTest.start.getTime()),
      buildResultsUrl: runningTest.buildResultsUrl,
      meetsRequirement: null,
      benchmarkResultFixedOK: null,
      benchmarkResultPreviousOK: null

    });


      testRun.save(function (err, savedTestRun) {
        if (err) {

          console.log(err);
          /* In case of error still remove running test! */
          runningTest.remove(function (err) {


            process.send({
              room: room,
              type: 'runningTest',
              event: 'removed',
              testrun: runningTest
            });

            process.send({
              room: 'running-test',
              type: 'runningTest',
              event: 'removed',
              testrun: runningTest
            });

            //resolve(savedTestRun);
            reject(err);

          });

        } else {

          var room = runningTest.productName + '-' + runningTest.dashboardName;

          process.send({
            room: room,
            type: 'testrun',
            event: 'saved',
            testrun: runningTest
          });


          process.send({
            room: 'recent-test',
            type: 'testrun',
            event: 'saved',
            testrun: runningTest
          });

          runningTest.remove(function (err) {


            process.send({
              room: room,
              type: 'runningTest',
              event: 'removed',
              testrun: runningTest
            });

            process.send({
              room: 'running-test',
              type: 'runningTest',
              event: 'removed',
              testrun: runningTest
            });

            resolve(savedTestRun);
          });
        }

    });
  });
}

function humanReadbleDuration(durationInMs){

  var date = new Date(durationInMs);
  var readableDate = '';
  var daysLabel = (date.getUTCDate()-1 === 1) ? " day, " : " days, ";
  var hoursLabel = (date.getUTCHours() === 1) ? " hour, " : " hours, "
  var minutesLabel = (date.getUTCMinutes() === 1) ? " minute" : " minutes";
  var secondsLabel = (date.getUTCSeconds() === 1) ? "  second" : "  seconds";

  if(date.getUTCDate()-1 > 0) readableDate += date.getUTCDate()-1 + daysLabel;
  if(date.getUTCHours() > 0) readableDate += date.getUTCHours() + hoursLabel ;
  if(date.getUTCMinutes() > 0)readableDate += date.getUTCMinutes() + minutesLabel ;
  if(date.getUTCMinutes() === 0)readableDate += date.getUTCSeconds() + secondsLabel ;
  return readableDate;
}

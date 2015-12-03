'use strict';
//Setting up route
angular.module('events').config([
  '$stateProvider',
  function ($stateProvider) {
    // Events state routing
    $stateProvider.state('listEvents', {
      url: '/events',
      templateUrl: 'modules/events/views/list-events-dashboard.client.view.html'
    }).state('createEvent', {
      url: '/create/event/:productName/:dashboardName',
      template: '<add-event></add-event>'
    }).state('editEvent', {
      url: '/edit/event/:productName/:dashboardName/:eventId',
      template: '<edit-event></edit-event>'
    });
  }
]);

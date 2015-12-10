'use strict';

angular.module('templates').directive('addEvent', AddEventDirective);

function AddEventDirective () {

  var directive = {
    restrict: 'EA',
    templateUrl: 'modules/events/directives/add-event.client.view.html',
    controller: AddEventDirectiveController
  };

  return directive;

  /* @ngInject */
  function AddEventDirectiveController ($scope, $state, Events, $filter, $rootScope, $stateParams) {

    $scope.event = {};
    $scope.event.eventTimestamp = new Date();
    $scope.event.productName = $stateParams.productName;
    $scope.event.dashboardName = $stateParams.dashboardName;

    $scope.testRunIds = Events.getTestRunId(Events.list);
    $scope.descriptions = Events.getDescriptions(Events.list);


    $scope.$watch('event.productName', function (val) {
      $scope.event.productName = $filter('uppercase')(val);
    }, true);

    $scope.$watch('event.dashboardName', function (val) {
      $scope.event.dashboardName = $filter('uppercase')(val);
    }, true);


    // Create new Event
    $scope.create = function () {
      Events.create($scope.event).then(function (event) {
        Events.selected = {};

        if ($rootScope.previousStateParams)
          $state.go($rootScope.previousState, $rootScope.previousStateParams);
        else
          $state.go($rootScope.previousState);
      }, function (errorResponse) {
        $scope.error = errorResponse.data.message;
        $scope.eventForm.eventDescription.$setValidity('server', false);
      });
    };

    $scope.cancel = function () {
      Events.selected = {};
      /* reset form*/
      $scope.eventForm.$setPristine();
      if ($rootScope.previousStateParams)
        $state.go($rootScope.previousState, $rootScope.previousStateParams);
      else
        $state.go($rootScope.previousState);
    };

  }
}
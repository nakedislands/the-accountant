export default gameService;
import _ from 'lodash';

/** @ngInject */
function gameService($log, $rootScope, Step, Var, Ending) {
  // Symbols declarion for private attributes and methods
  const _meta = Symbol('meta');
  const _vars = Symbol('vars');
  const _history = Symbol('history');

  class Game {
    constructor() {
      // Load meta data
      this[_meta] = angular.copy(require('./game.json'));
      // Build step using meta data
      this[_meta].steps = this[_meta].steps.map(meta => new Step(meta, this));
      // Build step using meta data
      this[_meta].endings = this[_meta].endings.map(meta => new Ending(meta, this));
      // Prepare vars according to choice's history
      this.apply();
      // Notice the user
      $log.info(`Starting game with ${this.steps.length} steps`);
    }
    isCurrent(step) {
      return step.isCurrent();
    }
    isOver() {
      return _.some(this.history, _.method('hasConsequences')) || !this.hasStepsAhead();
    }
    hasFeedback() {
      return this.history.length ? _.last(this.history).hasFeedback() : false;
    }
    hasStepsAhead() {
      return this.stepsAhead.length > 0;
    }
    hasStepsBehind() {
      return this.stepsBehind.length > 0;
    }
    update(changes) {
      _.forEach(changes, (value, key) => {
        // Set the value accordingly
        this.var(key).update(value);
      });
    }
    var(name) {
      return _.find(this.vars, {name});
    }
    endingsFor(name) {
      return _.filter(this.endingsWithVar, ending => ending.var.name === name);
    }
    select(choice) {
      this.history.push(choice);
      // Apply changes
      this.update(choice.changes);
      // Take risk according to the current variables
      if (choice.takeRisks()) {
        // We loose!
        $log.info('Losing causes: %s', choice.consequences.join(', '));
      }
      // Send event to the root scope
      $rootScope.$broadcast('game:selection', choice);
    }
    undo() {
      // Remove the last choice
      const choice = this.history.pop();
      // And apply the whole history
      this.apply();
      // Send event to the root scope
      $rootScope.$broadcast('game:undo', choice);
    }
    apply() {
      // Create new vars
      this[_vars] = _.map(this[_meta].vars, (value, name) => {
        return new Var(angular.extend({name}, value), this);
      });
      // Apply existing choices
      this.history.forEach(choice => this.update(choice.changes));
    }
    get feedback() {
      return this.hasFeedback() ? _.last(this.history).feedback : null;
    }
    get consequences() {
      return _(this.history).map('consequences').flatten().uniq().value();
    }
    // List of choices made by the player
    get history() {
      // Instanciate history if needed
      this[_history] = this[_history] || [];
      // Return the array
      return this[_history];
    }
    // List of step seen or currently seen by the player
    get journey() {
      // Do not add any step if the party is over
      if (this.isOver()) {
        // Get only steps from the past
        return this.stepsBehind;
      }
      // Get steps from the past and the first ahead
      return this.stepsBehind.concat(this.stepsAhead.slice(0, 1));
    }
    get vars() {
      return this[_vars];
    }
    get stepIndex() {
      return this.step.index;
    }
    get steps() {
      return this[_meta].steps;
    }
    get end() {
      // Did we had consequences?
      if (this.consequences.length) {
        // Get the last ending for the last consequence
        return _.last(this.endingsFor(_.last(this.consequences).name));
      }
      // Last ending is the default
      return _.last(this.endings);
    }
    get endings() {
      return this[_meta].endings;
    }
    get endingsWithVar() {
      return _.filter(this.endings, _.method('hasCondition'));
    }
    get stepsBehind() {
      // Collect step from history step
      return _.map(this.history, 'step');
    }
    get stepsAhead() {
      const steps = this.stepsBehind;
      // Start index
      const from = steps.length ? _.last(steps).index + 1 : 0;
      // Step must be valid
      return _.filter(this.steps.slice(from), {assert: true});
    }
    get step() {
      return this.isOver() ? null : _.last(this.journey);
    }
    get years() {
      return _(this.steps).map('year').compact().uniq().sort().value();
    }
    get risks() {
      return _.filter(this.vars, {category: 'risk'});
    }
    get publicRisks() {
      return _.filter(this.vars, {category: 'risk', public: true});
    }
    get publicVars() {
      return _.filter(this.vars, {public: true});
    }
  }
  return Game;
}
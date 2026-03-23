/**
 * Trip Planning Algorithms
 * Export all algorithm modules
 */

// TSP - Route Optimization
export {
  haversineDistance,
  buildDistanceMatrix,
  nearestNeighbor,
  twoOptImprovement,
  simulatedAnnealing,
  geneticAlgorithm,
  solveTSP,
} from './TSPSolver.js';

// Main Trip Planner
export { TripPlanner, generateQuickItinerary } from './TripPlannerService.js';

// Default export
import TripPlannerService from './TripPlannerService.js';
export default TripPlannerService;

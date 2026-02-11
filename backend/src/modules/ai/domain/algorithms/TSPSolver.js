/**
 * TSP Solver - Traveling Salesman Problem
 * Optimizes the order of visiting places to minimize total travel time/distance
 */

/**
 * Calculate distance between two points using Haversine formula
 * @param {Object} point1 - {lat, lng}
 * @param {Object} point2 - {lat, lng}
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(point1, point2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Build distance matrix between all places
 * @param {Array} places - Array of places with coordinates
 * @returns {Array<Array<number>>} Distance matrix
 */
export function buildDistanceMatrix(places) {
  const n = places.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = haversineDistance(
        { lat: places[i].latitude, lng: places[i].longitude },
        { lat: places[j].latitude, lng: places[j].longitude }
      );
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

/**
 * Nearest Neighbor Algorithm - Simple greedy TSP solver
 * Time complexity: O(n²)
 * @param {Array<Array<number>>} distMatrix - Distance matrix
 * @param {number} startIndex - Starting point index
 * @returns {Object} {route: number[], totalDistance: number}
 */
export function nearestNeighbor(distMatrix, startIndex = 0) {
  const n = distMatrix.length;
  const visited = new Set([startIndex]);
  const route = [startIndex];
  let totalDistance = 0;
  let current = startIndex;

  while (visited.size < n) {
    let nearest = -1;
    let minDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distMatrix[current][i] < minDist) {
        minDist = distMatrix[current][i];
        nearest = i;
      }
    }

    if (nearest !== -1) {
      visited.add(nearest);
      route.push(nearest);
      totalDistance += minDist;
      current = nearest;
    }
  }

  return { route, totalDistance };
}

/**
 * 2-opt improvement - Local search optimization
 * Improves an existing route by swapping edges
 * @param {Array<Array<number>>} distMatrix - Distance matrix
 * @param {number[]} route - Initial route
 * @returns {Object} {route: number[], totalDistance: number}
 */
export function twoOptImprovement(distMatrix, route) {
  const n = route.length;
  let improved = true;
  let currentRoute = [...route];

  while (improved) {
    improved = false;

    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        // Calculate current distance
        const d1 = distMatrix[currentRoute[i]][currentRoute[i + 1]];
        const d2 = j + 1 < n
          ? distMatrix[currentRoute[j]][currentRoute[j + 1]]
          : 0;

        // Calculate new distance if we swap
        const d3 = distMatrix[currentRoute[i]][currentRoute[j]];
        const d4 = j + 1 < n
          ? distMatrix[currentRoute[i + 1]][currentRoute[j + 1]]
          : 0;

        // If swapping improves the route
        if (d3 + d4 < d1 + d2) {
          // Reverse the segment between i+1 and j
          const newRoute = [
            ...currentRoute.slice(0, i + 1),
            ...currentRoute.slice(i + 1, j + 1).reverse(),
            ...currentRoute.slice(j + 1),
          ];
          currentRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  // Calculate total distance
  let totalDistance = 0;
  for (let i = 0; i < currentRoute.length - 1; i++) {
    totalDistance += distMatrix[currentRoute[i]][currentRoute[i + 1]];
  }

  return { route: currentRoute, totalDistance };
}

/**
 * Simulated Annealing TSP Solver
 * Metaheuristic for finding near-optimal solutions
 * @param {Array<Array<number>>} distMatrix - Distance matrix
 * @param {Object} options - Algorithm options
 * @returns {Object} {route: number[], totalDistance: number}
 */
export function simulatedAnnealing(distMatrix, options = {}) {
  const {
    initialTemp = 10000,
    coolingRate = 0.9995,
    minTemp = 1,
    maxIterations = 100000,
  } = options;

  const n = distMatrix.length;

  // Generate initial solution using nearest neighbor
  let currentSolution = nearestNeighbor(distMatrix, 0).route;
  let currentDistance = calculateRouteDistance(distMatrix, currentSolution);

  let bestSolution = [...currentSolution];
  let bestDistance = currentDistance;

  let temperature = initialTemp;
  let iteration = 0;

  while (temperature > minTemp && iteration < maxIterations) {
    // Generate neighbor solution by swapping two random cities
    const newSolution = [...currentSolution];
    const i = Math.floor(Math.random() * (n - 1)) + 1; // Don't swap first city
    const j = Math.floor(Math.random() * (n - 1)) + 1;

    if (i !== j) {
      [newSolution[i], newSolution[j]] = [newSolution[j], newSolution[i]];
    }

    const newDistance = calculateRouteDistance(distMatrix, newSolution);
    const delta = newDistance - currentDistance;

    // Accept if better, or with probability based on temperature
    if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
      currentSolution = newSolution;
      currentDistance = newDistance;

      if (currentDistance < bestDistance) {
        bestSolution = [...currentSolution];
        bestDistance = currentDistance;
      }
    }

    temperature *= coolingRate;
    iteration++;
  }

  return { route: bestSolution, totalDistance: bestDistance };
}

/**
 * Calculate total distance of a route
 */
function calculateRouteDistance(distMatrix, route) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += distMatrix[route[i]][route[i + 1]];
  }
  return total;
}

/**
 * Genetic Algorithm TSP Solver
 * Population-based metaheuristic
 * @param {Array<Array<number>>} distMatrix - Distance matrix
 * @param {Object} options - Algorithm options
 * @returns {Object} {route: number[], totalDistance: number}
 */
export function geneticAlgorithm(distMatrix, options = {}) {
  const {
    populationSize = 100,
    generations = 500,
    mutationRate = 0.02,
    eliteSize = 10,
  } = options;

  const n = distMatrix.length;

  // Initialize population with random permutations
  let population = [];
  for (let i = 0; i < populationSize; i++) {
    const route = shuffleArray([...Array(n).keys()]);
    population.push({
      route,
      fitness: 1 / calculateRouteDistance(distMatrix, route),
    });
  }

  for (let gen = 0; gen < generations; gen++) {
    // Sort by fitness (higher is better)
    population.sort((a, b) => b.fitness - a.fitness);

    // Select elite
    const newPopulation = population.slice(0, eliteSize);

    // Create rest of population through crossover and mutation
    while (newPopulation.length < populationSize) {
      // Tournament selection
      const parent1 = tournamentSelect(population, 5);
      const parent2 = tournamentSelect(population, 5);

      // Crossover (Order Crossover - OX)
      let child = orderCrossover(parent1.route, parent2.route);

      // Mutation (swap mutation)
      if (Math.random() < mutationRate) {
        const i = Math.floor(Math.random() * n);
        const j = Math.floor(Math.random() * n);
        [child[i], child[j]] = [child[j], child[i]];
      }

      newPopulation.push({
        route: child,
        fitness: 1 / calculateRouteDistance(distMatrix, child),
      });
    }

    population = newPopulation;
  }

  // Return best solution
  population.sort((a, b) => b.fitness - a.fitness);
  const best = population[0];

  return {
    route: best.route,
    totalDistance: 1 / best.fitness,
  };
}

function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function tournamentSelect(population, tournamentSize) {
  let best = null;
  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }
  return best;
}

function orderCrossover(parent1, parent2) {
  const n = parent1.length;
  const start = Math.floor(Math.random() * n);
  const end = Math.floor(Math.random() * (n - start)) + start;

  const child = Array(n).fill(-1);

  // Copy segment from parent1
  for (let i = start; i <= end; i++) {
    child[i] = parent1[i];
  }

  // Fill remaining from parent2
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (child[i] === -1) {
      while (child.includes(parent2[j])) {
        j++;
      }
      child[i] = parent2[j];
      j++;
    }
  }

  return child;
}

/**
 * Main TSP Solver - Chooses best algorithm based on problem size
 * @param {Array} places - Array of places with lat/lng
 * @param {Object} options - Solver options
 * @returns {Object} Optimized route and statistics
 */
export function solveTSP(places, options = {}) {
  const { algorithm = 'auto', startIndex = 0 } = options;

  if (places.length < 2) {
    return {
      route: places,
      totalDistance: 0,
      algorithm: 'none',
    };
  }

  const distMatrix = buildDistanceMatrix(places);
  let result;
  let usedAlgorithm;

  // Choose algorithm based on size or user preference
  const n = places.length;

  if (algorithm === 'auto') {
    if (n <= 10) {
      // For small problems, use nearest neighbor + 2-opt
      const nn = nearestNeighbor(distMatrix, startIndex);
      result = twoOptImprovement(distMatrix, nn.route);
      usedAlgorithm = 'nearest_neighbor_2opt';
    } else if (n <= 20) {
      // For medium problems, use simulated annealing
      result = simulatedAnnealing(distMatrix);
      usedAlgorithm = 'simulated_annealing';
    } else {
      // For larger problems, use genetic algorithm
      result = geneticAlgorithm(distMatrix);
      usedAlgorithm = 'genetic_algorithm';
    }
  } else {
    switch (algorithm) {
      case 'nearest_neighbor':
        result = nearestNeighbor(distMatrix, startIndex);
        usedAlgorithm = 'nearest_neighbor';
        break;
      case 'two_opt': {
        const nn = nearestNeighbor(distMatrix, startIndex);
        result = twoOptImprovement(distMatrix, nn.route);
        usedAlgorithm = 'two_opt';
        break;
      }
      case 'simulated_annealing':
        result = simulatedAnnealing(distMatrix, options);
        usedAlgorithm = 'simulated_annealing';
        break;
      case 'genetic':
        result = geneticAlgorithm(distMatrix, options);
        usedAlgorithm = 'genetic_algorithm';
        break;
      default: {
        const nnDefault = nearestNeighbor(distMatrix, startIndex);
        result = twoOptImprovement(distMatrix, nnDefault.route);
        usedAlgorithm = 'nearest_neighbor_2opt';
        break;
      }
    }
  }

  // Map route indices back to places
  const optimizedRoute = result.route.map(index => places[index]);

  return {
    route: optimizedRoute,
    routeIndices: result.route,
    totalDistance: result.totalDistance,
    algorithm: usedAlgorithm,
    distanceMatrix: distMatrix,
  };
}

export default {
  haversineDistance,
  buildDistanceMatrix,
  nearestNeighbor,
  twoOptImprovement,
  simulatedAnnealing,
  geneticAlgorithm,
  solveTSP,
};

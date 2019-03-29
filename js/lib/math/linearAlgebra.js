	/*import { asyncify } from './common'
	import { Matrix, Vector } from 'vectorious'*/

var linalg;

(function(){

	function _isMatrix (m) {
	  return m instanceof Array && m[0] instanceof Array
	}

	function _isNumber (n) {
	  return typeof n === 'number'
	}

	function _isVector (v) {
	  return v instanceof Array && v[0] instanceof Array === false
	}

	function asyncify(){
		
		throw("use sync method")
		
	}

	linalg = {
	  add,
	  addSync,
	  addColumn,
	  addColumnSync,
	  angle,
	  angleSync,
	  crossproduct,
	  crossproductSync,
	  divide,
	  divideSync,
	  dot,
	  dotSync,
	  fminunc,
	  fminuncSync,
	  isParallel,
	  isParallelSync,
	  isOrthogonal,
	  isOrthogonalSync,
	  log,
	  logSync,
	  magnitude,
	  magnitudeSync,
	  max,
	  maxSync,
	  mean,
	  meanSync,
	  multiply,
	  multiplySync,
	  normalize,
	  normalizeSync,
	  nullMatrix,
	  nullMatrixSync,
	  numCols,
	  numColsSync,
	  numRows,
	  numRowsSync,
	  ones,
	  onesSync,
	  pinv,
	  pinvSync,
	  power,
	  powerSync,
	  product,
	  productSync,
	  project,
	  projectSync,
	  projectAndReject,
	  projectAndRejectSync,
	  reject,
	  rejectSync,
	  removeFirstColumn,
	  removeFirstColumnSync,
	  sigmoid,
	  sigmoidSync,
	  splitXy,
	  splitXySync,
	  square,
	  squareSync,
	  std,
	  stdSync,
	  subtract,
	  subtractSync,
	  svd,
	  svdSync,
	  transpose,
	  transposeSync,
	  unit,
	  unitSync
	}

	function add (a, b, callback = () => {}) {
	  return asyncify(addSync, callback)(...arguments)
	}

	function addSync (a, b) {
	  try {
		if (_isMatrix(a) && _isMatrix(b)) {
		  return Matrix.add(new Matrix(a), new Matrix(b)).toArray()
		} else if (_isMatrix(a) && _isVector(b)) {
		  throw new Error('TODO: impl matrix-vector addition')
		} else if (_isVector(a) && _isMatrix(b)) {
		  throw new Error('TODO: impl vector-matrix addition')
		} else if (_isVector(a) && _isVector(b)) {
		  return Vector.add(new Vector(a), new Vector(b)).toArray()
		} else {
		  throw new Error('TODO: impl')
		}
	  } catch (error) {
		throw error
	  }
	}

	function addColumn (a, b, callback = () => {}) {
	  return asyncify(addColumnSync, callback)(...arguments)
	}

	function addColumnSync (a, b) {
	  if (_isMatrix(a) && _isMatrix(b)) {
		return Matrix.augment(new Matrix(a), new Matrix(b)).toArray()
	  } else {
		throw new Error('TODO: impl')
	  }
	}

	function angle (a, b, convertToDegrees = false, callback = () => {}) {
	  return asyncify(angleSync, callback)(...arguments)
	}

	function angleSync (a, b, convertToDegrees = false) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  const degreesPerRadian = 180 / Math.PI
	  const radians = new Vector(a).angle(new Vector(b))

	  if (convertToDegrees) return radians * degreesPerRadian
	  return radians
	}

	function crossproduct (a, b, callback = () => {}) {
	  return asyncify(crossproductSync, callback)(...arguments)
	}

	function crossproductSync (a, b) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  const i = new Matrix([a.slice(1), b.slice(1)]).determinant()
	  const j = -new Matrix([a.slice(0, 1).concat(a.slice(2)), b.slice(0, 1).concat(b.slice(2))]).determinant()
	  const k = new Matrix([a.slice(0, 2), b.slice(0, 2)]).determinant()
	  return [i, j, k]
	}

	function divide (a, b, callback = () => {}) {
	  return asyncify(divideSync, callback)(...arguments)
	}

	function divideSync (a, b) { // TODO: clean this up
	  if (b instanceof Array) {
		if (b[0] instanceof Array) {
		  throw new Error('trying to divide by matrix')
		} else {
		  return multiplySync(a, b.map(x => 1 / x))
		}
	  } else {
		return multiplySync(a, 1 / b)
	  }
	}

	function dot (a, b, callback = () => {}) {
	  return asyncify(dotSync, callback)(...arguments)
	}

	function dotSync (a, b) {
	  try {
		if (_isMatrix(a) && _isMatrix(b)) {
		  return numbers.matrix.multiply(a, b)
		} else if (_isMatrix(a) && _isVector(b)) {
		  return a.map(row => {
			return [ dotSync(row, b) ]
		  })
		} else if (_isVector(a) && _isMatrix(b)) {
		  throw new Error('TODO: impl vector-matrix dot product')
		} else if (_isVector(a) && _isVector(b)) {
		  return Vector.dot(new Vector(a), new Vector(b))
		} else {
		  throw new Error('TODO: impl')
		}
	  } catch (error) {
		throw error
	  }
	}

	function fminunc (f, thetaInitial, options = {}, callback = () => {}) {
	  return asyncify(fminuncSync, callback)(...arguments)
	}

	function fminuncSync (fn, thetaInitial, options = {}) {
	  function _toX (x) {
		return transposeSync(x)[0]
	  }

	  function _fromX (x) {
		return x.map((value, index, array) => {
		  return [value]
		})
	  }

	  const { f, solution } = numeric.uncmin(function (x) {
		return fn.call(this, _fromX(x)).cost
	  }, _toX(thetaInitial), options.tol, options.gradient, options.maxit)

	  return {
		cost: f,
		theta: solution
	  }
	}

	function isParallel (a, b, precision = 21, callback = () => {}) {
	  return asyncify(isParallelSync, callback)(...arguments)
	}

	function isParallelSync (a, b, precision = 21) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  let radians = parseFloat(angleSync(a, b).toPrecision(precision))
	  return isNaN(radians) || radians === 0 || radians === parseFloat(Math.PI.toPrecision(precision))
	}

	function isOrthogonal (a, b, precision = 21, callback = () => {}) {
	  return asyncify(isOrthogonalSync, callback)(...arguments)
	}

	function isOrthogonalSync (a, b, precision = 21) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  let radians = parseFloat(angleSync(a, b).toPrecision(precision))
	  return isNaN(radians) || radians === parseFloat((Math.PI / 2).toPrecision(precision))
	}

	function log (a, callback = () => {}) {
	  return asyncify(logSync, callback)(...arguments)
	}

	function logSync (a) {
	  if (!_isVector(a) && !_isMatrix(a)) throw new Error('a must be a vector or matrix')

	  return numeric.log(a)
	}

	function magnitude (a, callback = () => {}) {
	  return asyncify(magnitudeSync, callback)(...arguments)
	}

	function magnitudeSync (a) {
	  if (_isVector(a)) {
		return new Vector(a).magnitude()
	  } else {
		throw new Error('a must be a vector')
	  }
	}

	function max (a, callback = () => {}) {
	  return asyncify(maxSync, callback)(...arguments)
	}

    function getMaxOfArray(numArray) {
	  return Math.max.apply(null, numArray);
	}

	function maxSync (a) {
	  let max = Number.NEGATIVE_INFINITY

	  if (_isMatrix(a)) {
		return new Matrix(a).reduce(x => {
		  return x > max ? x : max
		}, max)
	  } else if (_isVector(a)) {
		return getMaxOfArray(a)
	  } else {
		throw new Error('a must be a matrix or vector')
	  }
	}

	function mean (a, callback = () => {}) {
	  return asyncify(meanSync, callback)(...arguments)
	}

	function meanSync (a) {
	  if (_isMatrix(a)) {
		return transposeSync(a).map(row => {
		  return math.mean(row)
		})
	  } else if (_isVector(a)) {
		return math.mean(a)
	  } else {
		throw new Error('a must be a vector or matrix')
	  }
	}

	function multiply (a, b, callback = () => {}) {
	  return asyncify(multiplySync, callback)(...arguments)
	}

	function multiplySync (a, b) {
	  try {
		if (_isMatrix(a) && _isMatrix(b)) {
		  return Matrix.multiply(new Matrix(a), new Matrix(b)).toArray()
		} else if (_isMatrix(a) && _isVector(b)) {
		  return a.map(row => {
			return row.map((col, i) => {
			  return col * b[i]
			})
		  })
		} else if (_isVector(a) && _isMatrix(b)) {
		  throw new Error('TODO: impl vector-matrix multiply')
		} else if (_isVector(a) && _isVector(b)) {
		  return Vector.dot(new Vector(a), new Vector(b)).toArray()
		} else if (_isMatrix(a) && _isNumber(b)) {
		  return Matrix.scale(new Matrix(a), b).toArray()
		} else if (_isVector(a) && _isNumber(b)) {
		  return Vector.scale(new Vector(a), b).toArray()
		} else if (_isMatrix(b) && _isNumber(a)) {
		  return Matrix.scale(new Matrix(b), a).toArray()
		} else if (_isVector(b) && _isNumber(a)) {
		  return Vector.scale(new Vector(b), a).toArray()
		} else {
		  throw new Error('TODO: impl')
		}
	  } catch (error) {
		throw error
	  }
	}

	function normalize (a, callback = () => {}) {
	  return asyncify(normalizeSync, callback)(...arguments)
	}

	function normalizeSync (a) {
	  if (_isVector(a)) {
		return new Vector(a).normalize().toArray()
	  } else {
		throw new Error('a must be a vector')
	  }
	}

	function nullMatrix (numRows, numCols, callback = () => {}) {
	  return asyncify(nullMatrixSync, callback)(...arguments)
	}

	function nullMatrixSync (numRows, numCols) {
	  return Matrix.zeros(numRows, numCols).toArray()
	}

	function numCols (a, callback = () => {}) {
	  return asyncify(numColsSync, callback)(...arguments)
	}

	function numColsSync (a) {
	  if (_isMatrix(a)) {
		return a[0].length
	  } else {
		throw new Error('a must be a matrix')
	  }
	}

	function numRows (a, callback = () => {}) {
	  return asyncify(numRowsSync, callback)(...arguments)
	}

	function numRowsSync (a) {
	  if (_isMatrix(a)) {
		return a.length
	  } else {
		throw new Error('a must be a matrix')
	  }
	}

	function ones (numRows, callback = () => {}) {
	  return asyncify(onesSync, callback)(...arguments)
	}

	function onesSync (numRows, numCols = 1) {
	  return Matrix.ones(numRows, numCols).toArray()
	}

	/**
	 * Compute the (Moore-Penrose) pseudo-inverse (pinv) of a matrix asynchronously.
	 * @param {Array[]} M - the matrix
	 * @returns {Promise<Array[], Error>} resolves to pinvM - the calculated pseudo-inverse
	 */
	function pinv (M, callback = () => {}) {
	  return asyncify(pinvSync, callback)(...arguments)
	}

	/**
	 * Compute the (Moore-Penrose) pseudo-inverse (pinv) of a matrix synchronously.
	 * @param {Array[]} M - the matrix
	 * @returns {Array[]} pinvM - the calculated pseudo-inverse
	 */
	function pinvSync (M) {
	  let [U, sum, V, s] = svdSync(M)
	  const ε = numeric.epsilon
	  const m = numRowsSync(U)
	  const n = numColsSync(transposeSync(V))
	  const diagDim = Math.max(m, n)
	  const maxS = maxSync(s)

	  const tolerance = ε * diagDim * maxS
	  const pinvSum = transposeSync(numeric.diag(s.map((sNum, index) => {
		return index < diagDim && sNum > tolerance ? 1 / sNum : 0
	  })))
	  const transposeU = transposeSync(U)
	  const pinvM = dotSync(transposeSync(V), dotSync(pinvSum, transposeU))

	  return pinvM
	}

	function power (a, power, callback = () => {}) {
	  return asyncify(powerSync, callback)(...arguments)
	}

	function powerSync (a, power) {
	  if (_isMatrix(a)) {
		return new Matrix(a).map(x => {
		  return Math.pow(x, power)
		}).toArray()
	  } else if (_isVector(a)) {
		return new Vector(a).map(x => {
		  return Math.pow(x, power)
		}).toArray()
	  } else {
		throw new Error('a must be a matrix or vector')
	  }
	}

	function product (a, b, callback = () => {}) {
	  return asyncify(productSync, callback)(...arguments)
	}

	function productSync (a, b) {
	  if (!_isMatrix(a) && !_isMatrix(b)) throw new Error('a and b must be matrices')
	  if (a.length !== b.length && a[0].length !== b[0].length) throw new Error('the sizes must match')

	  return new Matrix(a).product(new Matrix(b)).toArray()
	}

	function project (a, b, callback = () => {}) {
	  return asyncify(projectSync, callback)(...arguments)
	}

	function projectSync (a, b) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  return new Vector(a).project(new Vector(b)).toArray()
	}

	function projectAndReject (a, b, callback = () => {}) {
	  return asyncify(projectAndRejectSync, callback)(...arguments)
	}

	function projectAndRejectSync (a, b) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  return {
		projection: projectSync(a, b),
		rejection: rejectSync(a, b)
	  }
	}

	function reject (a, b, callback = () => {}) {
	  return asyncify(rejectSync, callback)(...arguments)
	}

	function rejectSync (a, b) {
	  if (!_isVector(a) && !_isVector(b)) throw new Error('a and b must be vectors')

	  return subtractSync(a, projectSync(a, b))
	}

	function removeFirstColumn (matrix, addOnes = true, callback = () => {}) {
	  return asyncify(removeFirstColumnSync, callback)(...arguments)
	}

	function removeFirstColumnSync (matrix) {
	  const M = matrix.map((row) => {
		const _row = row.slice(1)
		return _row
	  })

	  return M
	}

	function sigmoid (a, callback = () => {}) {
	  return asyncify(sigmoidSync, callback)(...arguments)
	}

	function sigmoidSync (a) {
	  if (_isMatrix(a)) {
		return new Matrix(a).map(sigmoidFn).toArray()
	  } else if (_isVector(a)) {
		return a.map(sigmoidFn)
	  } else {
		return sigmoidFn(a)
	  }

	  function sigmoidFn (x) {
		return 1 / (1 + Math.exp(-x))
	  }
	}

	/**
	 * Compute the singular value decomposition (SVD) of a matrix asynchronously.
	 * @param {Array[]} M - the matrix
	 * @returns {Promise<Array[], Error>} resolves to [U, Σ, V, s] - the calculated singular value decomposition
	 */
	function svd (a, callback = () => {}) {
	  return asyncify(svdSync, callback)(...arguments)
	}

	/**
	 * Compute the singular value decomposition (SVD) of a matrix synchronously.
	 * @param {Array[]} M - the matrix
	 * @returns {Array[]} [U, Σ, V, s] - the calculated singular value decomposition
	 */
	function svdSync (M) {
	  const res = numeric.svd(M)
	  const U = res.U
	  const s = res.S // singular values, or s-numbers
	  const sum = numeric.diag(s)
	  const transposeV = res.V
	  const V = transposeSync(transposeV)

	  return [U, sum, V, s]
	}

	function splitXy (data, addOnes = true, callback = () => {}) {
	  return asyncify(splitXySync, callback)(...arguments)
	}

	function splitXySync (data, addOnes = true) {
	  const X = data.map((row) => {
		const _row = row.slice(0, -1)
		return addOnes ? [1].concat(_row) : _row
	  })
	  const y = data.map((row) => {
		return row.slice(-1)
	  })

	  return { X, y }
	}

	function square (a, callback = () => {}) {
	  return asyncify(squareSync, callback)(...arguments)
	}

	function squareSync (a) {
	  if (_isMatrix(a)) {
		const A = new Matrix(a)
		return new Matrix(A.T).multiply(A).toArray()
	  } else {
		throw new Error('TODO: impl')
	  }
	}

	function std (a, callback = () => {}) {
	  return asyncify(stdSync, callback)(...arguments)
	}

	function stdSync (a) {
	  if (_isMatrix(a)) {
		return transposeSync(a).map(row => {
		  return math.std(row)
		})
	  } else if (_isVector(a)) {
		return math.std(a)
	  } else {
		throw new Error('a must be a vector or matrix')
	  }
	}

	function subtract (a, b, callback = () => {}) {
	  return asyncify(subtractSync, callback)(...arguments)
	}

	function subtractSync (a, b) {
	  try {
		if (_isMatrix(a) && _isMatrix(b)) {
		  return Matrix.subtract(new Matrix(a), new Matrix(b)).toArray()
		} else if (_isMatrix(a) && _isVector(b)) {
		  return a.map(row => {
			return subtractSync(row, b)
		  })
		} else if (_isVector(a) && _isMatrix(b)) {
		  throw new Error('TODO: impl vector-matrix subtraction')
		} else if (_isVector(a) && _isVector(b)) {
		  return Vector.subtract(new Vector(a), new Vector(b)).toArray()
		} else if (_isMatrix(a) && _isNumber(b)) {
		  return new Matrix(a).map(x => x - b).toArray()
		} else if (_isVector(a) && _isNumber(b)) {
		  return new Vector(a).map(x => x - b).toArray()
		} else if (_isNumber(a) && _isMatrix(b)) {
		  return b.map(row => {
			return row.map(col => a - col)
		  })
		} else if (_isNumber(a) && _isVector(b)) {
		  throw new Error('TODO: impl number-vector subtraction')
		} else {
		  throw new Error('TODO: impl')
		}
	  } catch (error) {
		throw error
	  }
	}

	function transpose (a, callback = () => {}) {
	  return asyncify(transposeSync, callback)(...arguments)
	}

	function transposeSync (a) {
	  return numbers.matrix.transpose(a)
	}

	function unit (a, callback = () => {}) {
	  return asyncify(unitSync, callback)(...arguments)
	}

	function unitSync (a) {
	  return divideSync(a, magnitude(a))
	}
})();
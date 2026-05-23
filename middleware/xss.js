/**
 * Custom simple XSS sanitizer helper
 */
const cleanXssString = (val) => {
  if (typeof val !== 'string') return val;
  return val.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const cleanXssObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (typeof obj[key] === 'string') {
        obj[key] = cleanXssString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        cleanXssObject(obj[key]);
      }
    }
  }
  return obj;
};

export const customXss = (req, res, next) => {
  if (req.body) {
    cleanXssObject(req.body);
  }
  if (req.query) {
    try {
      const cleanedQuery = cleanXssObject({ ...req.query });
      Object.defineProperty(req, 'query', {
        value: cleanedQuery,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      // Fallback if defineProperty fails
    }
  }
  if (req.params) {
    try {
      const cleanedParams = cleanXssObject({ ...req.params });
      Object.defineProperty(req, 'params', {
        value: cleanedParams,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      // Fallback if defineProperty fails
    }
  }
  next();
};
